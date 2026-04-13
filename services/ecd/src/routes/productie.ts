/**
 * Productieregistratie routes.
 *
 * Tracks delivered care per client per day for billing purposes.
 * Stored in PostgreSQL (openzorg.productie_registratie table).
 */

import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const productieRoutes = new Hono<AppEnv>();

/**
 * GET /api/productie — List production registrations.
 * Query params: clientId, datum_van, datum_tot, locatie
 */
productieRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const clientId = c.req.query("clientId");
  const datumVan = c.req.query("datum_van");
  const datumTot = c.req.query("datum_tot");

  let query = `
    SELECT id, tenant_id, client_id, client_naam, medewerker_id, medewerker_naam,
           datum, uren, productie_type, locatie, notitie, created_at
    FROM openzorg.productie_registratie
    WHERE tenant_id = $1
  `;
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (clientId) {
    query += ` AND client_id = $${idx++}`;
    params.push(clientId);
  }
  if (datumVan) {
    query += ` AND datum >= $${idx++}`;
    params.push(datumVan);
  }
  if (datumTot) {
    query += ` AND datum <= $${idx++}`;
    params.push(datumTot);
  }

  query += " ORDER BY datum DESC, created_at DESC LIMIT 500";

  try {
    const result = await pool.query(query, params);
    return c.json({ items: result.rows, total: result.rowCount });
  } catch (err) {
    console.error("[productie] Query failed:", err);
    return c.json({ items: [], total: 0 });
  }
});

/**
 * POST /api/productie — Register production for a client.
 */
productieRoutes.post("/", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{
    clientId: string;
    clientNaam: string;
    medewerkerId?: string;
    medewerkerNaam?: string;
    datum: string;
    uren: number;
    productieType: string;
    locatie?: string;
    notitie?: string;
  }>();

  if (!body.clientId || !body.datum || !body.uren || !body.productieType) {
    return c.json({ error: "clientId, datum, uren en productieType zijn vereist" }, 400);
  }

  try {
    const result = await pool.query(
      `INSERT INTO openzorg.productie_registratie
       (tenant_id, client_id, client_naam, medewerker_id, medewerker_naam, datum, uren, productie_type, locatie, notitie)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        tenantId,
        body.clientId,
        body.clientNaam,
        body.medewerkerId ?? null,
        body.medewerkerNaam ?? null,
        body.datum,
        body.uren,
        body.productieType,
        body.locatie ?? null,
        body.notitie ?? null,
      ],
    );
    return c.json({ id: result.rows[0]?.id, status: "ok" }, 201);
  } catch (err) {
    console.error("[productie] Insert failed:", err);
    return c.json({ error: "Kon productieregistratie niet opslaan" }, 500);
  }
});

/**
 * GET /api/productie/samenvatting — Summary per client per month.
 */
productieRoutes.get("/samenvatting", async (c) => {
  const tenantId = c.get("tenantId");
  const maand = c.req.query("maand") ?? new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const result = await pool.query(
      `SELECT client_id, client_naam, productie_type, SUM(uren) as totaal_uren, COUNT(*) as aantal_registraties
       FROM openzorg.productie_registratie
       WHERE tenant_id = $1 AND datum >= $2 AND datum < ($2::date + INTERVAL '1 month')
       GROUP BY client_id, client_naam, productie_type
       ORDER BY client_naam, productie_type`,
      [tenantId, `${maand}-01`],
    );
    return c.json({ items: result.rows, maand });
  } catch (err) {
    console.error("[productie] Summary failed:", err);
    return c.json({ items: [], maand });
  }
});
