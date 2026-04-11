import { Hono } from "hono";

import type { Prestatie, Financieringstype } from "../lib/declaratie-types.js";
import { getProducten } from "../lib/declaratie-types.js";

const app = new Hono();

// In-memory store (will be replaced with Medplum/PostgreSQL)
const prestaties = new Map<string, Prestatie>();
let counter = 0;

/**
 * GET /api/prestaties — List all care activities for billing.
 * Query params: ?financieringstype=wlz&status=geregistreerd&clientId=xxx&van=2026-01-01&tot=2026-01-31
 */
app.get("/", (c) => {
  const filters = {
    financieringstype: c.req.query("financieringstype"),
    status: c.req.query("status"),
    clientId: c.req.query("clientId"),
    van: c.req.query("van"),
    tot: c.req.query("tot"),
  };

  let items = Array.from(prestaties.values());

  if (filters.financieringstype) {
    items = items.filter((p) => p.financieringstype === filters.financieringstype);
  }
  if (filters.status) {
    items = items.filter((p) => p.status === filters.status);
  }
  if (filters.clientId) {
    items = items.filter((p) => p.clientId === filters.clientId);
  }
  if (filters.van) {
    items = items.filter((p) => p.datum >= filters.van!);
  }
  if (filters.tot) {
    items = items.filter((p) => p.datum <= filters.tot!);
  }

  items.sort((a, b) => b.datum.localeCompare(a.datum));

  return c.json({
    prestaties: items,
    totaal: items.reduce((sum, p) => sum + p.totaal, 0),
    aantal: items.length,
  });
});

/**
 * POST /api/prestaties — Register a new care activity.
 */
app.post("/", async (c) => {
  const body = await c.req.json<{
    clientId: string;
    clientNaam: string;
    datum: string;
    productCode: string;
    financieringstype: Financieringstype;
    aantal: number;
    medewerkerNaam: string;
  }>();

  if (!body.clientId || !body.productCode || !body.datum || !body.financieringstype) {
    return c.json({ error: "clientId, productCode, datum en financieringstype zijn verplicht" }, 400);
  }

  const producten = getProducten(body.financieringstype);
  const product = producten.find((p) => p.code === body.productCode);

  if (!product) {
    return c.json({ error: `Product ${body.productCode} niet gevonden voor ${body.financieringstype}` }, 400);
  }

  const aantal = body.aantal ?? 1;

  counter++;
  const id = `prest-${String(counter).padStart(6, "0")}`;

  const prestatie: Prestatie = {
    id,
    clientId: body.clientId,
    clientNaam: body.clientNaam ?? "",
    datum: body.datum,
    productCode: body.productCode,
    productOmschrijving: product.omschrijving,
    eenheid: ("eenheid" in product ? product.eenheid : "dag") as Prestatie["eenheid"],
    aantal,
    tariefPerEenheid: product.tarief,
    totaal: product.tarief * aantal,
    financieringstype: body.financieringstype,
    medewerkerNaam: body.medewerkerNaam ?? "",
    status: "geregistreerd",
  };

  prestaties.set(id, prestatie);

  return c.json(prestatie, 201);
});

/**
 * GET /api/prestaties/producten?type=wlz — List available products for a financieringstype.
 */
app.get("/producten", (c) => {
  const type = (c.req.query("type") ?? "wlz") as Financieringstype;
  return c.json({ producten: getProducten(type) });
});

/**
 * PUT /api/prestaties/:id/valideer — Mark prestatie as validated (ready for billing).
 */
app.put("/:id/valideer", (c) => {
  const id = c.req.param("id");
  const prestatie = prestaties.get(id);
  if (!prestatie) return c.json({ error: "Prestatie niet gevonden" }, 404);

  prestatie.status = "gevalideerd";
  return c.json(prestatie);
});

export { app as prestatieRoutes };
