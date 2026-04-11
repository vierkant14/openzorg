import { Hono } from "hono";

import type { AppEnv } from "../index.js";
import { pool, getTenantUuid } from "../lib/db.js";
import { getProducten } from "../lib/declaratie-types.js";

export const prestatieRoutes = new Hono<AppEnv>();

// GET / — List prestaties with filters
prestatieRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ prestaties: [], totaal: 0 });

  const financieringstype = c.req.query("financieringstype");
  const status = c.req.query("status");
  const clientId = c.req.query("clientId");
  const van = c.req.query("van");
  const tot = c.req.query("tot");

  let query = "SELECT * FROM openzorg.prestaties WHERE tenant_id = $1";
  const params: unknown[] = [tenantUuid];
  let idx = 2;

  if (financieringstype) { query += ` AND financieringstype = $${idx++}`; params.push(financieringstype); }
  if (status) { query += ` AND status = $${idx++}`; params.push(status); }
  if (clientId) { query += ` AND client_id = $${idx++}`; params.push(clientId); }
  if (van) { query += ` AND datum >= $${idx++}`; params.push(van); }
  if (tot) { query += ` AND datum <= $${idx++}`; params.push(tot); }

  query += " ORDER BY datum DESC, created_at DESC";

  const res = await pool.query(query, params);
  const prestaties = res.rows.map(mapPrestatie);
  const totaal = prestaties.reduce((sum, p) => sum + p.totaal, 0);

  return c.json({ prestaties, totaal, aantal: prestaties.length });
});

// GET /producten — Product catalog
prestatieRoutes.get("/producten", (c) => {
  const type = c.req.query("type") || "wlz";
  const producten = getProducten(type as "wlz" | "wmo" | "zvw" | "jeugdwet");
  return c.json({ producten });
});

// POST / — Register new prestatie
prestatieRoutes.post("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const body = await c.req.json<{
    clientId: string;
    medewerkerNaam?: string;
    datum: string;
    productCode: string;
    financieringstype: string;
    aantal?: number;
    opmerking?: string;
  }>();

  if (!body.clientId || !body.datum || !body.productCode || !body.financieringstype) {
    return c.json({ error: "clientId, datum, productCode en financieringstype zijn verplicht" }, 400);
  }

  const producten = getProducten(body.financieringstype as "wlz" | "wmo" | "zvw" | "jeugdwet");
  const product = producten.find((p) => p.code === body.productCode);
  if (!product) return c.json({ error: `Product ${body.productCode} niet gevonden` }, 400);

  const aantal = body.aantal ?? 1;
  const totaal = product.tarief * aantal;

  const res = await pool.query(
    `INSERT INTO openzorg.prestaties
      (tenant_id, client_id, medewerker_id, datum, product_code, product_naam, financieringstype, eenheid, aantal, tarief, totaal, status, opmerking)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'concept', $12)
     RETURNING *`,
    [tenantUuid, body.clientId, body.medewerkerNaam, body.datum, body.productCode,
     product.omschrijving, body.financieringstype,
     (product as { eenheid?: string }).eenheid ?? "dag",
     aantal, product.tarief, totaal, body.opmerking],
  );

  return c.json({ prestatie: mapPrestatie(res.rows[0]) }, 201);
});

// PUT /:id/valideer — Mark as validated
prestatieRoutes.put("/:id/valideer", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const id = c.req.param("id");
  const res = await pool.query(
    "UPDATE openzorg.prestaties SET status = 'gevalideerd', updated_at = now() WHERE id = $1 AND tenant_id = $2 AND status = 'concept' RETURNING *",
    [id, tenantUuid],
  );

  if (res.rows.length === 0) return c.json({ error: "Prestatie niet gevonden of al gevalideerd" }, 404);
  return c.json({ prestatie: mapPrestatie(res.rows[0]) });
});

function mapPrestatie(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    medewerkerNaam: (row.medewerker_id as string) ?? "",
    datum: (row.datum as string),
    productCode: row.product_code as string,
    productOmschrijving: row.product_naam as string,
    financieringstype: row.financieringstype as string,
    eenheid: row.eenheid as string,
    aantal: Number(row.aantal),
    tariefPerEenheid: Number(row.tarief),
    totaal: Number(row.totaal),
    status: row.status as string,
    declaratieId: (row.declaratie_id as string) ?? null,
    opmerking: (row.opmerking as string) ?? null,
  };
}
