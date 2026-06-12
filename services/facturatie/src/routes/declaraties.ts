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
  type Declaratie = ReturnType<typeof mapDeclaratie>;
  const declaraties: Declaratie[] = res.rows.map(mapDeclaratie);

  // Calculate statistics
  const stats = {
    totaalOpen: declaraties.filter((d: Declaratie) => d.status === "concept" || d.status === "ingediend").reduce((s: number, d: Declaratie) => s + d.totaalBedrag, 0),
    totaalBetaald: declaraties.filter((d: Declaratie) => d.status === "betaald").reduce((s: number, d: Declaratie) => s + d.totaalBedrag, 0),
    concept: declaraties.filter((d: Declaratie) => d.status === "concept").length,
    ingediend: declaraties.filter((d: Declaratie) => d.status === "ingediend").length,
    geaccepteerd: declaraties.filter((d: Declaratie) => d.status === "geaccepteerd").length,
    afgewezen: declaraties.filter((d: Declaratie) => d.status === "afgewezen").length,
    betaald: declaraties.filter((d: Declaratie) => d.status === "betaald").length,
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

  const totaal = prestaties.rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.totaal), 0);

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
  const prestatieIds = prestaties.rows.map((r: Record<string, unknown>) => r.id as string);
  await pool.query(
    `UPDATE openzorg.prestaties SET declaratie_id = $1, status = 'gedeclareerd', updated_at = now()
     WHERE id = ANY($2) AND tenant_id = $3`,
    [declaratieId, prestatieIds, tenantUuid],
  );

  return c.json({ declaratie: mapDeclaratie(decRes.rows[0]) }, 201);
});

// GET /:id/export/csv — CSV export for Excel
declaratieRoutes.get("/:id/export/csv", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const id = c.req.param("id");
  const decRes = await pool.query(
    "SELECT * FROM openzorg.declaraties WHERE id = $1 AND tenant_id = $2",
    [id, tenantUuid],
  );
  if (decRes.rows.length === 0) return c.json({ error: "Declaratie niet gevonden" }, 404);

  const declaratie = decRes.rows[0] as Record<string, unknown>;
  const nummer = declaratie.nummer as string;

  const prestaties = await pool.query(
    "SELECT * FROM openzorg.prestaties WHERE declaratie_id = $1 AND tenant_id = $2 ORDER BY datum",
    [id, tenantUuid],
  );

  const formatBedrag = (cents: number) =>
    (cents / 100).toFixed(2).replace(".", ",");

  const header = "Declaratienummer;BSN;Clientnaam;Productcode;Productnaam;Datum;Aantal;Eenheid;Tarief;Bedrag";
  const rows = prestaties.rows.map((r: Record<string, unknown>) => {
    const cols = [
      nummer,
      r.client_id as string,
      "—",
      r.product_code as string,
      r.product_naam as string,
      r.datum as string,
      String(r.aantal),
      r.eenheid as string,
      formatBedrag(Number(r.tarief)),
      formatBedrag(Number(r.totaal)),
    ];
    return cols.join(";");
  });

  const csv = "\uFEFF" + [header, ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="declaratie-${nummer}.csv"`,
    },
  });
});

// GET /:id/export/pdf — Print-friendly HTML for browser PDF export
declaratieRoutes.get("/:id/export/pdf", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const id = c.req.param("id");
  const decRes = await pool.query(
    "SELECT * FROM openzorg.declaraties WHERE id = $1 AND tenant_id = $2",
    [id, tenantUuid],
  );
  if (decRes.rows.length === 0) return c.json({ error: "Declaratie niet gevonden" }, 404);

  const declaratie = decRes.rows[0] as Record<string, unknown>;

  const tenantRes = await pool.query<{ naam: string }>(
    "SELECT naam FROM openzorg.tenants WHERE id = $1",
    [tenantUuid],
  );
  const tenantNaam = tenantRes.rows[0]?.naam ?? tenantId;

  const prestaties = await pool.query(
    "SELECT * FROM openzorg.prestaties WHERE declaratie_id = $1 AND tenant_id = $2 ORDER BY datum",
    [id, tenantUuid],
  );

  const formatBedrag = (cents: number) =>
    (cents / 100).toFixed(2).replace(".", ",");

  const nummer = declaratie.nummer as string;
  const periodeVan = declaratie.periode_van as string;
  const periodeTot = declaratie.periode_tot as string;
  const financieringstype = declaratie.financieringstype as string;
  const status = declaratie.status as string;
  const vandaag = new Date().toLocaleDateString("nl-NL");

  const tableRows = prestaties.rows
    .map((r: Record<string, unknown>) => `
      <tr>
        <td>${nummer}</td>
        <td>${r.client_id as string}</td>
        <td>—</td>
        <td>${r.product_code as string}</td>
        <td>${r.product_naam as string}</td>
        <td>${r.datum as string}</td>
        <td>${String(r.aantal)}</td>
        <td>${r.eenheid as string}</td>
        <td style="text-align:right">&euro; ${formatBedrag(Number(r.tarief))}</td>
        <td style="text-align:right">&euro; ${formatBedrag(Number(r.totaal))}</td>
      </tr>`)
    .join("");

  const totaalBedrag = Number(declaratie.totaal_bedrag);

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>Declaratie ${nummer}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12pt; color: #111; padding: 2cm; }
    h1 { font-size: 18pt; margin-bottom: 0.5em; }
    .meta { margin-bottom: 1.5em; }
    .meta table { border-collapse: collapse; }
    .meta td { padding: 2px 12px 2px 0; }
    .meta td:first-child { font-weight: bold; }
    table.prestaties { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; }
    table.prestaties th { background: #f0f0f0; text-align: left; padding: 5px 6px; border: 1px solid #ccc; font-size: 10pt; }
    table.prestaties td { padding: 4px 6px; border: 1px solid #ddd; font-size: 10pt; vertical-align: top; }
    table.prestaties tr:nth-child(even) td { background: #fafafa; }
    .totaal td { font-weight: bold; border-top: 2px solid #888; }
    .footer { margin-top: 2em; font-size: 9pt; color: #666; }
    @media print {
      body { font-size: 10pt; padding: 1cm; }
      table.prestaties th { background: #e8e8e8 !important; -webkit-print-color-adjust: exact; }
      .footer { position: fixed; bottom: 1cm; width: 100%; }
    }
  </style>
</head>
<body>
  <h1>Declaratie ${nummer}</h1>
  <div class="meta">
    <table>
      <tr><td>Organisatie</td><td>${tenantNaam}</td></tr>
      <tr><td>Periode</td><td>${periodeVan} &ndash; ${periodeTot}</td></tr>
      <tr><td>Financieringstype</td><td>${financieringstype.toUpperCase()}</td></tr>
      <tr><td>Status</td><td>${status.charAt(0).toUpperCase() + status.slice(1)}</td></tr>
    </table>
  </div>
  <table class="prestaties">
    <thead>
      <tr>
        <th>Declaratienummer</th>
        <th>BSN</th>
        <th>Clientnaam</th>
        <th>Productcode</th>
        <th>Productnaam</th>
        <th>Datum</th>
        <th>Aantal</th>
        <th>Eenheid</th>
        <th>Tarief</th>
        <th>Bedrag</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
    <tfoot>
      <tr class="totaal">
        <td colspan="9">Totaal</td>
        <td style="text-align:right">&euro; ${formatBedrag(totaalBedrag)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">Gegenereerd door OpenZorg op ${vandaag}</div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
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
