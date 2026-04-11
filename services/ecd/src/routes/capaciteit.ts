import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";
import { medplumFetch } from "../lib/medplum-client.js";

export const capaciteitRoutes = new Hono<AppEnv>();

/**
 * Capaciteitsplanning: match beschikbare bedden/plaatsen × medewerkers × contracturen.
 *
 * Locatiecapaciteit is opgeslagen in de PostgreSQL tenants settings.
 * Medewerker- en clientdata komt uit Medplum.
 */

/**
 * GET /api/capaciteit/overzicht — Dashboard overview.
 * Combines: location capacity, active clients, active contracts.
 */
capaciteitRoutes.get("/overzicht", async (c) => {
  const tenantId = c.get("tenantId");

  // 1. Get location capacity from tenant settings
  const tenantResult = await pool.query(
    `SELECT settings FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1`,
    [tenantId],
  );
  const settings = (tenantResult.rows[0] as { settings?: Record<string, unknown> } | undefined)?.settings ?? {};
  const locatieCapaciteit = (settings["locatieCapaciteit"] as Array<{ locatieId: string; naam: string; bedden: number }>) ?? [];

  // 2. Count active patients
  const patientsRes = await medplumFetch(c, "/fhir/R4/Patient?active=true&_summary=count");
  let totalClienten = 0;
  if (patientsRes.ok) {
    const patBundle = (await patientsRes.json()) as { total?: number };
    totalClienten = patBundle.total ?? 0;
  }

  // 3. Count active practitioners and FTE
  const practRes = await medplumFetch(c, "/fhir/R4/PractitionerRole?active=true&_count=500");
  let totalMedewerkers = 0;
  let totalFte = 0;
  let totalUrenPerWeek = 0;

  if (practRes.ok) {
    const practBundle = (await practRes.json()) as {
      entry?: Array<{
        resource: {
          extension?: Array<{
            url: string;
            extension?: Array<{ url: string; valueDecimal?: number }>;
          }>;
        };
      }>;
    };

    totalMedewerkers = practBundle.entry?.length ?? 0;

    for (const entry of practBundle.entry ?? []) {
      const contractExt = entry.resource.extension?.find((e) => e.url === "https://openzorg.nl/extensions/contract");
      if (contractExt) {
        totalFte += contractExt.extension?.find((e) => e.url === "fte")?.valueDecimal ?? 0;
        totalUrenPerWeek += contractExt.extension?.find((e) => e.url === "urenPerWeek")?.valueDecimal ?? 0;
      }
    }
  }

  // 4. Calculate totals
  const totalBedden = locatieCapaciteit.reduce((sum, l) => sum + l.bedden, 0);
  const bezettingsgraad = totalBedden > 0 ? Math.round((totalClienten / totalBedden) * 100) : 0;

  return c.json({
    locaties: locatieCapaciteit,
    totalen: {
      bedden: totalBedden,
      clienten: totalClienten,
      bezettingsgraad,
      medewerkers: totalMedewerkers,
      fte: Math.round(totalFte * 100) / 100,
      urenPerWeek: Math.round(totalUrenPerWeek * 100) / 100,
    },
    signalen: [
      ...(bezettingsgraad > 90 ? [{ type: "waarschuwing", bericht: `Hoge bezettingsgraad: ${bezettingsgraad}%` }] : []),
      ...(bezettingsgraad > 100 ? [{ type: "kritiek", bericht: `Overbezetting: ${bezettingsgraad}% (meer clienten dan bedden)` }] : []),
      ...(totalFte < totalClienten * 0.3 ? [{ type: "waarschuwing", bericht: "Mogelijke onderbezetting: lage FTE-ratio per client" }] : []),
    ],
  });
});

/**
 * PUT /api/capaciteit/locaties — Update location capacity.
 * Body: { locaties: [{ locatieId, naam, bedden }] }
 */
capaciteitRoutes.put("/locaties", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{
    locaties: Array<{ locatieId: string; naam: string; bedden: number }>;
  }>();

  if (!body.locaties || !Array.isArray(body.locaties)) {
    return c.json({ error: "locaties array is verplicht" }, 400);
  }

  // Update tenant settings with location capacity
  await pool.query(
    `UPDATE openzorg.tenants
     SET settings = settings || $2::jsonb,
         updated_at = now()
     WHERE medplum_project_id = $1 OR id::text = $1`,
    [tenantId, JSON.stringify({ locatieCapaciteit: body.locaties })],
  );

  return c.json({ message: "Locatiecapaciteit bijgewerkt", locaties: body.locaties });
});
