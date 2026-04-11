import { Hono } from "hono";

import type { Declaratie, DeclaratieStatus, Financieringstype } from "../lib/declaratie-types.js";

const app = new Hono();

// In-memory store (will be replaced with PostgreSQL)
const declaraties = new Map<string, Declaratie>();
let counter = 0;

/**
 * GET /api/declaraties — List all declarations.
 * Query params: ?status=concept&financieringstype=wlz
 */
app.get("/", (c) => {
  const statusFilter = c.req.query("status");
  const typeFilter = c.req.query("financieringstype");

  let items = Array.from(declaraties.values());

  if (statusFilter) items = items.filter((d) => d.status === statusFilter);
  if (typeFilter) items = items.filter((d) => d.financieringstype === typeFilter);

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totaalOpen = items.filter((d) => d.status === "ingediend").reduce((s, d) => s + d.totaalBedrag, 0);
  const totaalBetaald = items.filter((d) => d.status === "betaald").reduce((s, d) => s + d.totaalBedrag, 0);

  return c.json({
    declaraties: items,
    stats: {
      totaal: items.length,
      totaalOpen,
      totaalBetaald,
      concept: items.filter((d) => d.status === "concept").length,
      ingediend: items.filter((d) => d.status === "ingediend").length,
      geaccepteerd: items.filter((d) => d.status === "geaccepteerd").length,
      afgewezen: items.filter((d) => d.status === "afgewezen").length,
      betaald: items.filter((d) => d.status === "betaald").length,
    },
  });
});

/**
 * GET /api/declaraties/:id — Get declaration details.
 */
app.get("/:id", (c) => {
  const id = c.req.param("id");
  const declaratie = declaraties.get(id);
  if (!declaratie) return c.json({ error: "Declaratie niet gevonden" }, 404);
  return c.json(declaratie);
});

/**
 * POST /api/declaraties — Create a new declaration from validated prestaties.
 */
app.post("/", async (c) => {
  const body = await c.req.json<{
    financieringstype: Financieringstype;
    periodeVan: string;
    periodeTot: string;
    prestatieIds: string[];
    totaalBedrag: number;
  }>();

  if (!body.financieringstype || !body.periodeVan || !body.periodeTot) {
    return c.json({ error: "financieringstype, periodeVan en periodeTot zijn verplicht" }, 400);
  }

  counter++;
  const jaar = new Date().getFullYear();
  const nummer = `DEC-${jaar}-${String(counter).padStart(5, "0")}`;
  const id = `decl-${String(counter).padStart(6, "0")}`;
  const now = new Date().toISOString();

  const declaratie: Declaratie = {
    id,
    nummer,
    tenantId: c.req.header("X-Tenant-ID") ?? "",
    financieringstype: body.financieringstype,
    periode: { van: body.periodeVan, tot: body.periodeTot },
    status: "concept",
    totaalBedrag: body.totaalBedrag ?? 0,
    aantalPrestaties: body.prestatieIds?.length ?? 0,
    prestaties: body.prestatieIds ?? [],
    createdAt: now,
    updatedAt: now,
  };

  declaraties.set(id, declaratie);

  return c.json(declaratie, 201);
});

/**
 * PUT /api/declaraties/:id/indienen — Submit declaration to payer.
 */
app.put("/:id/indienen", (c) => {
  const id = c.req.param("id");
  const declaratie = declaraties.get(id);
  if (!declaratie) return c.json({ error: "Declaratie niet gevonden" }, 404);

  if (declaratie.status !== "concept") {
    return c.json({ error: "Alleen conceptdeclaraties kunnen worden ingediend" }, 400);
  }

  declaratie.status = "ingediend";
  declaratie.ingediendOp = new Date().toISOString();
  declaratie.updatedAt = new Date().toISOString();

  return c.json(declaratie);
});

/**
 * PUT /api/declaraties/:id/status — Update declaration status (simulate payer response).
 */
app.put("/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ status: DeclaratieStatus; reden?: string }>();
  const declaratie = declaraties.get(id);
  if (!declaratie) return c.json({ error: "Declaratie niet gevonden" }, 404);

  declaratie.status = body.status;
  declaratie.updatedAt = new Date().toISOString();
  if (body.status === "afgewezen" && body.reden) {
    declaratie.afwijzingsReden = body.reden;
  }
  if (body.status === "geaccepteerd" || body.status === "afgewezen") {
    declaratie.antwoordOp = new Date().toISOString();
  }

  return c.json(declaratie);
});

export { app as declaratieRoutes };
