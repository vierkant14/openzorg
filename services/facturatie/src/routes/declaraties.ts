import { Hono } from "hono";

import type { AppEnv } from "../index.js";
import { pool, getTenantUuid } from "../lib/db.js";

export const declaratieRoutes = new Hono<AppEnv>();

// GET / — List declarations with statistics
declaratieRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ declaraties: [], stats: {} });

  const status = c.req.query("status");
  const financieringstype = c.req.query("financieringstype");

  let query = "SELECT * FROM openzorg.declaraties WHERE tenant_id = $1";
  const params: unknown[] = [tenantUuid];
  let idx = 2;

  if (status) { query += ` AND status = $${idx++}`; params.push(status); }
  if (financieringstype) { query += ` AND financieringstype = $${idx++}`; params.push(financieringstype); }

  query += " ORDER BY created_at DESC";

  const res = await pool.query(query, params);
  const declaraties = res.rows.map(mapDeclaratie);

  // Calculate statistics
  const stats = {
    totaalOpen: declaraties.filter((d) => d.status === "concept" || d.status === "ingediend").reduce((s, d) => s + d.totaalBedrag, 0),
    totaalBetaald: declaraties.filter((d) => d.status === "betaald").reduce((s, d) => s + d.totaalBedrag, 0),
    concept: declaraties.filter((d) => d.status === "concept").length,
    ingediend: declaraties.filter((d) => d.status === "ingediend").length,
    geaccepteerd: declaraties.filter((d) => d.status === "geaccepteerd").length,
    afgewezen: declaraties.filter((d) => d.status === "afgewezen").length,
    betaald: declaraties.filter((d) => d.status === "betaald").length,
  };

  return c.json({ declaraties, stats });
});

// GET /:id — Single declaration
declaratieRoutes.get("/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const id = c.req.param("id");
  const res = await pool.query(
    "SELECT * FROM openzorg.declaraties WHERE id = $1 AND tenant_id = $2",
    [id, tenantUuid],
  );

  if (res.rows.length === 0) return c.json({ error: "Declaratie niet gevonden" }, 404);

  // Also load linked prestaties
  const prestaties = await pool.query(
    "SELECT * FROM openzorg.prestaties WHERE declaratie_id = $1 AND tenant_id = $2 ORDER BY datum",
    [id, tenantUuid],
  );

  return c.json({
    declaratie: mapDeclaratie(res.rows[0]),
    prestaties: prestaties.rows.map(mapPrestatie),
  });
});

// POST / — Create declaration from validated prestaties
declaratieRoutes.post("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const body = await c.req.json<{
    financieringstype: string;
    periodeVan: string;
    periodeTot: string;
  }>();

  if (!body.financieringstype || !body.periodeVan || !body.periodeTot) {
    return c.json({ error: "financieringstype, periodeVan en periodeTot zijn verplicht" }, 400);
  }

  // Find validated prestaties for this period
  const prestaties = await pool.query(
    `SELECT * FROM openzorg.prestaties
     WHERE tenant_id = $1 AND financieringstype = $2 AND status = 'gevalideerd'
       AND datum >= $3 AND datum <= $4
     ORDER BY datum`,
    [tenantUuid, body.financieringstype, body.periodeVan, body.periodeTot],
  );

  if (prestaties.rows.length === 0) {
    return c.json({ error: "Geen gevalideerde prestaties gevonden voor deze periode" }, 400);
  }

  const totaal = prestaties.rows.reduce((sum, r) => sum + Number(r.totaal), 0);

  // Generate declaration number
  const countRes = await pool.query(
    "SELECT COUNT(*) FROM openzorg.declaraties WHERE tenant_id = $1",
    [tenantUuid],
  );
  const seqNum = Number(countRes.rows[0]?.count ?? 0) + 1;
  const year = new Date().getFullYear();
  const nummer = `DEC-${year}-${String(seqNum).padStart(5, "0")}`;

  // Create declaration
  const decRes = await pool.query(
    `INSERT INTO openzorg.declaraties
      (tenant_id, nummer, financieringstype, periode_van, periode_tot, status, totaal_bedrag, aantal_prestaties)
     VALUES ($1, $2, $3, $4, $5, 'concept', $6, $7)
     RETURNING *`,
    [tenantUuid, nummer, body.financieringstype, body.periodeVan, body.periodeTot, totaal, prestaties.rows.length],
  );

  const declaratieId = decRes.rows[0]?.id as string;

  // Link prestaties to declaration
  const prestatieIds = prestaties.rows.map((r) => r.id as string);
  await pool.query(
    `UPDATE openzorg.prestaties SET declaratie_id = $1, status = 'gedeclareerd', updated_at = now()
     WHERE id = ANY($2) AND tenant_id = $3`,
    [declaratieId, prestatieIds, tenantUuid],
  );

  return c.json({ declaratie: mapDeclaratie(decRes.rows[0]) }, 201);
});

// PUT /:id/indienen — Submit to payer
declaratieRoutes.put("/:id/indienen", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const id = c.req.param("id");
  const res = await pool.query(
    `UPDATE openzorg.declaraties SET status = 'ingediend', ingediend_op = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'concept'
     RETURNING *`,
    [id, tenantUuid],
  );

  if (res.rows.length === 0) return c.json({ error: "Declaratie niet gevonden of status is niet 'concept'" }, 404);
  return c.json({ declaratie: mapDeclaratie(res.rows[0]) });
});

// PUT /:id/status — Update status (simulate payer response)
declaratieRoutes.put("/:id/status", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const id = c.req.param("id");
  const body = await c.req.json<{ status: string; afwijzingsReden?: string }>();

  const valid = ["geaccepteerd", "afgewezen", "betaald"];
  if (!valid.includes(body.status)) {
    return c.json({ error: `Status moet een van ${valid.join(", ")} zijn` }, 400);
  }

  const res = await pool.query(
    `UPDATE openzorg.declaraties SET status = $1, afwijzings_reden = $2, antwoord_op = now(), updated_at = now()
     WHERE id = $3 AND tenant_id = $4
     RETURNING *`,
    [body.status, body.afwijzingsReden ?? null, id, tenantUuid],
  );

  if (res.rows.length === 0) return c.json({ error: "Declaratie niet gevonden" }, 404);
  return c.json({ declaratie: mapDeclaratie(res.rows[0]) });
});

function mapDeclaratie(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    nummer: row.nummer as string,
    financieringstype: row.financieringstype as string,
    periodeVan: row.periode_van as string,
    periodeTot: row.periode_tot as string,
    status: row.status as string,
    totaalBedrag: Number(row.totaal_bedrag),
    aantalPrestaties: Number(row.aantal_prestaties),
    afwijzingsReden: (row.afwijzings_reden as string) ?? null,
    ingediendOp: (row.ingediend_op as string) ?? null,
    antwoordOp: (row.antwoord_op as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapPrestatie(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    datum: row.datum as string,
    productCode: row.product_code as string,
    productOmschrijving: row.product_naam as string,
    totaal: Number(row.totaal),
    status: row.status as string,
  };
}
