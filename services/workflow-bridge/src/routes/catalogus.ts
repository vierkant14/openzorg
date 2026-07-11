import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { haalCatalogus, haalCatalogusProces } from "../lib/proces-catalogus.js";

export const catalogusRoutes = new Hono<AppEnv>();

/**
 * GET / — De effectieve proces-catalogus van deze tenant (Laag 1 ⊕ Laag 2).
 */
catalogusRoutes.get("/", async (c) => {
  try {
    const processen = await haalCatalogus(c.get("tenantId"));
    return c.json({ processen });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen catalogus";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:key — Eén catalogus-proces.
 */
catalogusRoutes.get("/:key", async (c) => {
  try {
    const proces = await haalCatalogusProces(c.get("tenantId"), c.req.param("key"));
    if (!proces) {
      return c.json({ error: "Onbekend zorgpad" }, 404);
    }
    return c.json(proces);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen catalogus";
    return c.json({ error: message }, 500);
  }
});
