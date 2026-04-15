import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

/**
 * Task form options — configuratie voor de werkbak-completion-forms.
 *
 * Dit is laag 2 van het drielagen-model (H7.2): de functioneel beheerder
 * kan per proces + per userTask definiëren welke velden op het completion-
 * formulier staan, inclusief dropdown-opties.
 *
 * Datastructuur in openzorg.tenant_configurations.config_data:
 * {
 *   "<processKey>": {
 *     "<taskDefinitionKey>": [
 *       { name: "ernstNiveau", label: "Ernst", type: "select",
 *         options: [{ value: "laag", label: "Laag" }, ...] },
 *       ...
 *     ]
 *   }
 * }
 *
 * config_type = 'task_form_options', één rij per tenant.
 */
export const taskFormOptionsRoutes = new Hono<AppEnv>();

interface TaskVar {
  name: string;
  label: string;
  type: "boolean" | "text" | "select" | "number";
  options?: Array<{ value: string; label: string }>;
}

type FormOptionsConfig = Record<string, Record<string, TaskVar[]>>;

async function resolveTenantUuid(tenantIdOrProjectId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
    [tenantIdOrProjectId],
  );
  return result.rows[0]?.id ?? null;
}

/**
 * GET / — Return config voor deze tenant.
 */
taskFormOptionsRoutes.get("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    // Geen match → return lege config (UI valt terug op defaults)
    return c.json({ config: {} });
  }

  const result = await pool.query<{ config_data: FormOptionsConfig }>(
    `SELECT config_data FROM openzorg.tenant_configurations
       WHERE tenant_id = $1 AND config_type = 'task_form_options'
       ORDER BY version DESC LIMIT 1`,
    [tenantUuid],
  );
  const config = result.rows[0]?.config_data ?? {};
  return c.json({ config });
});

/**
 * PUT / — Upsert de hele tenant task-form-options config.
 * Body: { config: FormOptionsConfig }
 */
taskFormOptionsRoutes.put("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: `Tenant niet gevonden in openzorg.tenants voor id '${tenantHeader}'` }, 404);
  }

  const body = await c.req.json<{ config: FormOptionsConfig }>().catch(() => null);
  if (!body?.config) {
    return c.json({ error: "Body moet { config: {...} } zijn" }, 400);
  }

  try {
    const existing = await pool.query<{ id: string; version: number }>(
      `SELECT id, version FROM openzorg.tenant_configurations
         WHERE tenant_id = $1 AND config_type = 'task_form_options'
         ORDER BY version DESC LIMIT 1`,
      [tenantUuid],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0]!;
      await pool.query(
        `UPDATE openzorg.tenant_configurations
           SET config_data = $1, version = $2, updated_at = now()
         WHERE id = $3`,
        [JSON.stringify(body.config), row.version + 1, row.id],
      );
    } else {
      await pool.query(
        `INSERT INTO openzorg.tenant_configurations
           (tenant_id, config_type, config_data, version)
         VALUES ($1, 'task_form_options', $2, 1)`,
        [tenantUuid, JSON.stringify(body.config)],
      );
    }

    // Audit-log
    await pool.query(
      `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'task-form-options.update', 'TenantConfiguration', $3, $4)`,
      [
        tenantUuid,
        c.req.header("X-User-Id") ?? "system",
        null,
        JSON.stringify({ keysCount: Object.keys(body.config).length }),
      ],
    );

    return c.json({ success: true, config: body.config });
  } catch (err) {
    const message = err instanceof Error ? err.message : "onbekende fout";
    console.error("[TASK-FORM-OPTIONS] PUT faalde:", message);
    return c.json({ error: `Database-fout: ${message}` }, 500);
  }
});
