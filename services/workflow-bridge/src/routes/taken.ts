import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { writeWorkflowAudit } from "../lib/audit.js";
import { completeTask, flowableFetch, getTasksForUser, verifyTaskTenant } from "../lib/flowable-client.js";

export const takenRoutes = new Hono<AppEnv>();

interface FlowableTaskDetails {
  id?: string;
  name?: string;
  assignee?: string;
  processInstanceId?: string;
  processDefinitionId?: string;
}

async function fetchTaskDetails(taskId: string): Promise<FlowableTaskDetails | null> {
  try {
    const res = await flowableFetch(`/service/runtime/tasks/${encodeURIComponent(taskId)}`);
    return (await res.json()) as FlowableTaskDetails;
  } catch {
    return null;
  }
}

function extractProcessKey(processDefinitionId?: string): string | undefined {
  if (!processDefinitionId) return undefined;
  // Format: "intake-proces:1:12345" → "intake-proces"
  return processDefinitionId.split(":")[0];
}

/**
 * GET / — Get tasks for a user (query param userId).
 */
takenRoutes.get("/", async (c) => {
  try {
    const userId = c.req.query("userId");

    if (!userId) {
      return c.json({ error: "Query parameter 'userId' is vereist" }, 400);
    }

    const tenantId = c.get("tenantId");
    const data = await getTasksForUser(userId, tenantId);
    return c.json(data);
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
    const tenantId = c.get("tenantId");

    await verifyTaskTenant(taskId, tenantId);

    const response = await flowableFetch(`/service/runtime/tasks/${encodeURIComponent(taskId)}`);
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij ophalen taakdetails";
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
    const userId = c.req.header("X-User-Id") ?? c.req.header("X-User-Role") ?? "anonymous";
    const role = c.req.header("X-User-Role");

    await verifyTaskTenant(taskId, tenantId);

    const body = await c.req.json<{ variables?: Record<string, unknown> }>().catch((): { variables?: Record<string, unknown> } => ({}));

    // Taak-details ophalen vóór complete — na complete bestaat de taak niet meer
    const taskDetails = await fetchTaskDetails(taskId);

    await completeTask(taskId, body.variables);

    writeWorkflowAudit({
      tenantId,
      userId,
      role,
      action: "workflow.task.complete",
      taskId,
      taskName: taskDetails?.name,
      processKey: extractProcessKey(taskDetails?.processDefinitionId),
      processInstanceId: taskDetails?.processInstanceId,
      details: {
        variables: body.variables ?? {},
        assigneeVoor: taskDetails?.assignee,
      },
    });

    return c.json({ status: "voltooid", taskId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij voltooien van taak";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /:taskId/claim — Claim an unclaimed task.
 */
takenRoutes.post("/:taskId/claim", async (c) => {
  try {
    const taskId = c.req.param("taskId");
    const tenantId = c.get("tenantId");
    const role = c.req.header("X-User-Role");
    const headerUserId = c.req.header("X-User-Id");

    await verifyTaskTenant(taskId, tenantId);

    const body = await c.req.json<{ userId: string }>();

    if (!body.userId) {
      return c.json({ error: "Veld 'userId' is vereist" }, 400);
    }

    await flowableFetch(`/service/runtime/tasks/${encodeURIComponent(taskId)}`, {
      method: "POST",
      body: {
        action: "claim",
        assignee: body.userId,
      },
    });

    const taskDetails = await fetchTaskDetails(taskId);

    writeWorkflowAudit({
      tenantId,
      userId: headerUserId ?? body.userId,
      role,
      action: "workflow.task.claim",
      taskId,
      taskName: taskDetails?.name,
      processKey: extractProcessKey(taskDetails?.processDefinitionId),
      processInstanceId: taskDetails?.processInstanceId,
      details: {
        claimedBy: body.userId,
      },
    });

    return c.json({ status: "geclaimd", taskId, userId: body.userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij claimen van taak";
    return c.json({ error: message }, 500);
  }
});
