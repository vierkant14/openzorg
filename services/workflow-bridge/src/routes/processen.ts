import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { deployProcess, flowableFetch, getProcessInstances, startProcess } from "../lib/flowable-client.js";

export const processenRoutes = new Hono<AppEnv>();

/**
 * GET / — List deployed process definitions from Flowable.
 */
processenRoutes.get("/", async (c) => {
  try {
    const response = await flowableFetch("/service/repository/process-definitions");
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen procesdefinities";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /deploy — Deploy a BPMN process definition (accepts XML body).
 */
processenRoutes.post("/deploy", async (c) => {
  try {
    const body = await c.req.json<{ xml: string; name: string }>();

    if (!body.xml || !body.name) {
      return c.json({ error: "Velden 'xml' en 'name' zijn vereist" }, 400);
    }

    const result = await deployProcess(body.xml, body.name);
    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij deployment van proces";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:processKey/start — Start a new process instance.
 */
processenRoutes.post("/:processKey/start", async (c) => {
  try {
    const processKey = c.req.param("processKey");
    const body = await c.req.json<{ variables?: Record<string, unknown> }>().catch((): { variables?: Record<string, unknown> } => ({}));

    const tenantId = c.get("tenantId");
    const result = await startProcess(processKey, body.variables, tenantId);
    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij starten van proces";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:processKey/instances — List running instances for a process key.
 */
processenRoutes.get("/:processKey/instances", async (c) => {
  try {
    const processKey = c.req.param("processKey");
    const tenantId = c.get("tenantId");
    const data = await getProcessInstances(processKey, tenantId);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen procesinstanties";
    return c.json({ error: message }, 500);
  }
});
