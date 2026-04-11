import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { completeTask, flowableFetch, getTasksForUser, verifyTaskTenant } from "../lib/flowable-client.js";

export const takenRoutes = new Hono<AppEnv>();

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

    await verifyTaskTenant(taskId, tenantId);

    const body = await c.req.json<{ variables?: Record<string, unknown> }>().catch((): { variables?: Record<string, unknown> } => ({}));

    await completeTask(taskId, body.variables);
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

    return c.json({ status: "geclaimd", taskId, userId: body.userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout bij claimen van taak";
    return c.json({ error: message }, 500);
  }
});
