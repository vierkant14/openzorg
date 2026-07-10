import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { writeWorkflowAudit } from "../lib/audit.js";
import {
  claimTask,
  completeTask,
  queryTasks,
  unclaimTask,
  verifyTaskTenant,
} from "../lib/flowable-client.js";

export const takenRoutes = new Hono<AppEnv>();

const OVERSIGHT_ROLLEN = new Set(["teamleider", "beheerder", "tenant-admin"]);

function extractProcessKey(processDefinitionId?: string): string | undefined {
  if (!processDefinitionId) return undefined;
  // Format: "intake-proces:1:12345" → "intake-proces"
  return processDefinitionId.split(":")[0];
}

/**
 * GET / — Taken van de tenant, per scope of per procesinstantie.
 *
 *   ?scope=mijn         → taken toegewezen aan de ingelogde persoon
 *   ?scope=beschikbaar  → onbeclaimde taken voor de eigen rol (X-User-Role)
 *   ?scope=alle         → alle taken van de tenant (alleen oversight-rollen)
 *   ?processInstanceId= → taken van één lopende instantie
 */
takenRoutes.get("/", async (c) => {
  try {
    const tenantId = c.get("tenantId");
    const processInstanceId = c.req.query("processInstanceId");
    const scope = c.req.query("scope");
    const rol = c.req.header("X-User-Role") ?? "";

    if (processInstanceId) {
      const taken = await queryTasks({ tenantId, processInstanceId });
      return c.json({ data: taken, total: taken.length });
    }

    // DEPRECATED overgangsalias (verwijderen in W1-3): oude frontends sturen
    // ?userId=<rol-of-persoon>. Gedraagt zich als vroeger (assignee óf
    // candidateGroup), maar nu wél tenant-native gefilterd.
    const deprecatedUserId = c.req.query("userId");
    if (!scope && deprecatedUserId) {
      const [toegewezen, kandidaat] = await Promise.all([
        queryTasks({ tenantId, assignee: deprecatedUserId }),
        queryTasks({ tenantId, candidateGroup: deprecatedUserId }).catch(() => []),
      ]);
      const gezien = new Set<string>();
      const taken = [...toegewezen, ...kandidaat].filter((t) => {
        if (gezien.has(t.id)) return false;
        gezien.add(t.id);
        return true;
      });
      return c.json({ data: taken, total: taken.length });
    }

    if (scope === "mijn") {
      const taken = await queryTasks({ tenantId, assignee: c.get("userId") });
      return c.json({ data: taken, total: taken.length });
    }

    if (scope === "beschikbaar") {
      if (!rol) {
        return c.json({ error: "X-User-Role-header is vereist voor scope 'beschikbaar'" }, 400);
      }
      const taken = (await queryTasks({ tenantId, candidateGroup: rol })).filter(
        (taak) => !taak.assignee,
      );
      return c.json({ data: taken, total: taken.length });
    }

    if (scope === "alle") {
      if (!OVERSIGHT_ROLLEN.has(rol)) {
        return c.json({ error: "Scope 'alle' is alleen beschikbaar voor oversight-rollen" }, 403);
      }
      const taken = await queryTasks({ tenantId });
      return c.json({ data: taken, total: taken.length });
    }

    return c.json(
      { error: "Query-parameter 'scope' (mijn|beschikbaar|alle) of 'processInstanceId' is vereist" },
      400,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen taken";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /:taskId — Get details for a specific task.
 */
takenRoutes.get("/:taskId", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const taak = await verifyTaskTenant(taskId, c.get("tenantId"));
    return c.json(taak);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen taakdetails";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:taskId/claim — Claim een taak voor de ingelogde persoon.
 * Optioneel body { assignee } om namens iemand anders te claimen
 * (seed/beheer); de audit registreert altijd wie de actie uitvoerde.
 */
takenRoutes.post("/:taskId/claim", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const tenantId = c.get("tenantId");

    const taak = await verifyTaskTenant(taskId, tenantId);

    const body = await c.req
      .json<{ assignee?: string }>()
      .catch((): { assignee?: string } => ({}));
    const assignee = body.assignee?.trim() || c.get("userId");

    if (!assignee) {
      return c.json({ error: "Geen persoon om aan toe te wijzen (token zonder profiel)" }, 400);
    }

    await claimTask(taskId, assignee);

    writeWorkflowAudit({
      tenantId,
      userId: c.get("userRef") || assignee,
      role: c.req.header("X-User-Role"),
      action: "workflow.task.claim",
      taskId,
      taskName: taak.name,
      processKey: extractProcessKey(taak.processDefinitionId),
      processInstanceId: taak.processInstanceId,
      details: { claimedBy: assignee },
    });

    return c.json({ status: "geclaimd", taskId, assignee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij claimen van taak";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:taskId/unclaim — Geef een taak terug aan de groep.
 */
takenRoutes.post("/:taskId/unclaim", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const tenantId = c.get("tenantId");

    const taak = await verifyTaskTenant(taskId, tenantId);
    await unclaimTask(taskId);

    writeWorkflowAudit({
      tenantId,
      userId: c.get("userRef"),
      role: c.req.header("X-User-Role"),
      action: "workflow.task.unclaim",
      taskId,
      taskName: taak.name,
      processKey: extractProcessKey(taak.processDefinitionId),
      processInstanceId: taak.processInstanceId,
      details: { assigneeVoor: taak.assignee ?? null },
    });

    return c.json({ status: "teruggegeven", taskId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij teruggeven van taak";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:taskId/complete — Complete a task with optional variables.
 */
takenRoutes.post("/:taskId/complete", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const tenantId = c.get("tenantId");

    // Taak-details via de tenant-check — na complete bestaat de taak niet meer
    const taak = await verifyTaskTenant(taskId, tenantId);

    const body = await c.req
      .json<{ variables?: Record<string, unknown> }>()
      .catch((): { variables?: Record<string, unknown> } => ({}));

    await completeTask(taskId, body.variables);

    writeWorkflowAudit({
      tenantId,
      userId: c.get("userRef"),
      role: c.req.header("X-User-Role"),
      action: "workflow.task.complete",
      taskId,
      taskName: taak.name,
      processKey: extractProcessKey(taak.processDefinitionId),
      processInstanceId: taak.processInstanceId,
      details: {
        variables: body.variables ?? {},
        assigneeVoor: taak.assignee ?? null,
      },
    });

    return c.json({ status: "voltooid", taskId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij voltooien van taak";
    return c.json({ error: message }, 500);
  }
});
