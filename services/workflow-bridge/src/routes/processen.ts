import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { writeWorkflowAudit } from "../lib/audit.js";
import {
  cancelProcessInstance,
  deployProcess,
  getProcessDefinitions,
  getProcessInstances,
  startProcess,
} from "../lib/flowable-client.js";

import { getTemplateById } from "./bpmn-templates.js";

export const processenRoutes = new Hono<AppEnv>();

/**
 * GET / — Procesdefinities van déze tenant.
 */
processenRoutes.get("/", async (c) => {
  try {
    const data = await getProcessDefinitions(c.get("tenantId"));
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen procesdefinities";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /deploy — Deploy een BPMN-definitie (XML) binnen de tenant.
 */
processenRoutes.post("/deploy", async (c) => {
  try {
    const body = await c.req.json<{ xml: string; name: string }>();

    if (!body.xml || !body.name) {
      return c.json({ error: "Velden 'xml' en 'name' zijn vereist" }, 400);
    }

    const tenantId = c.get("tenantId");
    const result = await deployProcess(body.xml, body.name, tenantId);

    writeWorkflowAudit({
      tenantId,
      userId: c.get("userRef"),
      role: c.req.header("X-User-Role"),
      action: "workflow.task.deploy",
      processKey: body.name,
      details: { bron: "eigen-xml" },
    });

    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij deployment van proces";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /instances — Alle lopende instanties van de tenant ("Lopend"-tab).
 * LET OP: vóór /:processKey/instances gemount (route-volgorde-regel).
 */
processenRoutes.get("/instances", async (c) => {
  try {
    const data = await getProcessInstances(c.get("tenantId"));
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen procesinstanties";
    return c.json({ error: message }, 500);
  }
});

/**
 * DELETE /instances/:instanceId — Annuleer een lopende instantie (met reden).
 */
processenRoutes.delete("/instances/:instanceId", async (c) => {
  try {
    const instanceId = c.req.param("instanceId");
    const tenantId = c.get("tenantId");

    const body = await c.req.json<{ reden?: string }>().catch((): { reden?: string } => ({}));
    const reden = body.reden?.trim();

    if (!reden) {
      return c.json({ error: "Veld 'reden' is vereist bij het annuleren van een zorgpad" }, 400);
    }

    await cancelProcessInstance(instanceId, tenantId, reden);

    writeWorkflowAudit({
      tenantId,
      userId: c.get("userRef"),
      role: c.req.header("X-User-Role"),
      action: "workflow.instance.cancel",
      processInstanceId: instanceId,
      details: { reden },
    });

    return c.json({ status: "geannuleerd", instanceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij annuleren van instantie";
    return c.json({ error: message }, 500);
  }
});

/** Herkent de Flowable-fout "er is geen definitie met deze key in deze tenant". */
function isOnbekendeDefinitieFout(error: unknown): boolean {
  return error instanceof Error && /no processes deployed with key/i.test(error.message);
}

/**
 * POST /:processKey/start — Start een instantie binnen de tenant.
 * Ensure-deployed: ontbreekt de definitie en bestaat er een template met
 * deze key, dan wordt die eerst voor de tenant geactiveerd (met audit)
 * en volgt één retry. Zo faalt een verse omgeving nooit stil.
 */
processenRoutes.post("/:processKey/start", async (c) => {
  try {
    const processKey = c.req.param("processKey");
    const tenantId = c.get("tenantId");
    const body = await c.req
      .json<{ variables?: Record<string, unknown> }>()
      .catch((): { variables?: Record<string, unknown> } => ({}));

    let result: { id: string };
    try {
      result = await startProcess(processKey, body.variables, tenantId);
    } catch (error) {
      const template = getTemplateById(processKey);
      if (!isOnbekendeDefinitieFout(error) || !template) {
        throw error;
      }

      await deployProcess(template.getBpmn(), template.id, tenantId);
      writeWorkflowAudit({
        tenantId,
        userId: c.get("userRef"),
        role: c.req.header("X-User-Role"),
        action: "workflow.task.deploy",
        processKey,
        details: { bron: "ensure-deployed" },
      });

      result = await startProcess(processKey, body.variables, tenantId);
    }

    writeWorkflowAudit({
      tenantId,
      userId: c.get("userRef"),
      role: c.req.header("X-User-Role"),
      action: "workflow.instance.start",
      processKey,
      processInstanceId: result.id,
      details: { variables: body.variables ?? {} },
    });

    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij starten van proces";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:processKey/instances — Lopende instanties van één proces-key.
 */
processenRoutes.get("/:processKey/instances", async (c) => {
  try {
    const processKey = c.req.param("processKey");
    const data = await getProcessInstances(c.get("tenantId"), processKey);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen procesinstanties";
    return c.json({ error: message }, 500);
  }
});
