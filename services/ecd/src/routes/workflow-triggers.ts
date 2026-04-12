/**
 * Admin API routes for workflow trigger management.
 *
 * Provides endpoints to list, create, and update workflow triggers.
 * Defaults come from config/workflow-triggers.ts; per-tenant overrides
 * are stored in PostgreSQL (openzorg.tenant_configurations,
 * config_type = 'workflow_trigger').
 *
 * All routes require tenant context via X-Tenant-ID header.
 */

import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  DEFAULT_TRIGGERS,
  type WorkflowTrigger,
  type WorkflowTriggerEvent,
} from "../config/workflow-triggers.js";
import { pool } from "../lib/db.js";

export const workflowTriggerRoutes = new Hono<AppEnv>();

/* ── Helpers ── */

const VALID_EVENTS: WorkflowTriggerEvent[] = [
  "resource.created",
  "resource.updated",
  "resource.deleted",
  "timer.cron",
];

async function getTenantUuid(tenantId: string): Promise<string | null> {
  const res = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 OR slug = $1 LIMIT 1",
    [tenantId],
  );
  return (res.rows[0]?.id as string) ?? null;
}

interface StoredTrigger {
  id: string;
  config_data: WorkflowTrigger;
}

async function loadOverrides(
  tenantUuid: string,
): Promise<StoredTrigger[]> {
  const res = await pool.query(
    `SELECT id, config_data
       FROM openzorg.tenant_configurations
      WHERE tenant_id = $1
        AND config_type = 'workflow_trigger'
      ORDER BY created_at`,
    [tenantUuid],
  );
  return res.rows as StoredTrigger[];
}

/**
 * Merge default triggers with per-tenant overrides.
 * Database overrides win over defaults with the same trigger id.
 */
function mergeTriggersWithOverrides(
  overrides: StoredTrigger[],
): (WorkflowTrigger & { source: "default" | "override" | "custom" })[] {
  const overrideMap = new Map(
    overrides.map((o) => [o.config_data.id, o.config_data]),
  );

  type TriggerWithSource = WorkflowTrigger & { source: "default" | "override" | "custom" };
  const merged: TriggerWithSource[] = DEFAULT_TRIGGERS.map((d) => {
    const override = overrideMap.get(d.id);
    if (override) {
      return { ...override, source: "override" as const };
    }
    return { ...d, source: "default" as const };
  });

  // Append custom triggers (ids not in defaults)
  for (const o of overrides) {
    if (!DEFAULT_TRIGGERS.some((d) => d.id === o.config_data.id)) {
      merged.push({ ...o.config_data, source: "custom" as const });
    }
  }

  return merged;
}

/* ── Routes ── */

/**
 * GET /api/admin/workflow-triggers
 * List all effective triggers (defaults + overrides).
 */
workflowTriggerRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);

  if (!tenantUuid) {
    // No tenant in DB yet -- return defaults only
    return c.json({
      triggers: DEFAULT_TRIGGERS.map((t) => ({
        ...t,
        source: "default",
      })),
    });
  }

  const overrides = await loadOverrides(tenantUuid);
  const triggers = mergeTriggersWithOverrides(overrides);
  return c.json({ triggers });
});

/**
 * POST /api/admin/workflow-triggers
 * Create a new custom trigger for this tenant.
 */
workflowTriggerRoutes.post("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) {
    return c.json(
      {
        error: `Tenant niet gevonden voor ID '${tenantId}'.`,
      },
      404,
    );
  }

  const body = (await c.req.json()) as Partial<WorkflowTrigger>;

  // Validation
  if (!body.id || !body.name || !body.event || !body.processKey) {
    return c.json(
      {
        error:
          "id, name, event en processKey zijn verplicht",
      },
      400,
    );
  }

  if (!VALID_EVENTS.includes(body.event)) {
    return c.json(
      {
        error: `event moet een van ${VALID_EVENTS.join(", ")} zijn`,
      },
      400,
    );
  }

  // Check for duplicate ids
  const overrides = await loadOverrides(tenantUuid);
  const allIds = new Set([
    ...DEFAULT_TRIGGERS.map((d) => d.id),
    ...overrides.map((o) => o.config_data.id),
  ]);

  if (allIds.has(body.id)) {
    return c.json(
      { error: `Trigger met id '${body.id}' bestaat al` },
      409,
    );
  }

  const trigger: WorkflowTrigger = {
    id: body.id,
    name: body.name,
    event: body.event,
    resourceType: body.resourceType,
    condition: body.condition,
    processKey: body.processKey,
    variables: body.variables ?? {},
    enabled: body.enabled ?? true,
  };

  await pool.query(
    `INSERT INTO openzorg.tenant_configurations
       (tenant_id, config_type, config_data)
     VALUES ($1, 'workflow_trigger', $2)`,
    [tenantUuid, JSON.stringify(trigger)],
  );

  return c.json({ trigger: { ...trigger, source: "custom" } }, 201);
});

/**
 * PUT /api/admin/workflow-triggers/:id
 * Update an existing trigger (override a default, or update a custom one).
 */
workflowTriggerRoutes.put("/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const triggerId = c.req.param("id");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) {
    return c.json(
      {
        error: `Tenant niet gevonden voor ID '${tenantId}'.`,
      },
      404,
    );
  }

  const body = (await c.req.json()) as Partial<WorkflowTrigger>;

  if (body.event && !VALID_EVENTS.includes(body.event)) {
    return c.json(
      {
        error: `event moet een van ${VALID_EVENTS.join(", ")} zijn`,
      },
      400,
    );
  }

  // Find the base trigger (default or existing override)
  const defaultTrigger = DEFAULT_TRIGGERS.find((d) => d.id === triggerId);
  const overrides = await loadOverrides(tenantUuid);
  const existingOverride = overrides.find(
    (o) => o.config_data.id === triggerId,
  );

  if (!defaultTrigger && !existingOverride) {
    return c.json(
      { error: `Trigger '${triggerId}' niet gevonden` },
      404,
    );
  }

  // Merge: start from default (if any), then existing override, then new body
  const base = existingOverride?.config_data ?? defaultTrigger;
  const updated: WorkflowTrigger = {
    id: triggerId,
    name: body.name ?? base?.name ?? "",
    event: body.event ?? base?.event ?? "resource.created",
    resourceType:
      body.resourceType !== undefined
        ? body.resourceType
        : base?.resourceType,
    condition:
      body.condition !== undefined ? body.condition : base?.condition,
    processKey: body.processKey ?? base?.processKey ?? "",
    variables: body.variables ?? base?.variables ?? {},
    enabled: body.enabled ?? base?.enabled ?? true,
  };

  if (existingOverride) {
    // Update existing override row
    await pool.query(
      `UPDATE openzorg.tenant_configurations
          SET config_data = $1, updated_at = now()
        WHERE tenant_id = $2
          AND config_type = 'workflow_trigger'
          AND (config_data->>'id') = $3`,
      [JSON.stringify(updated), tenantUuid, triggerId],
    );
  } else {
    // Insert new override for a default trigger
    await pool.query(
      `INSERT INTO openzorg.tenant_configurations
         (tenant_id, config_type, config_data)
       VALUES ($1, 'workflow_trigger', $2)`,
      [tenantUuid, JSON.stringify(updated)],
    );
  }

  const source = defaultTrigger ? "override" : "custom";
  return c.json({ trigger: { ...updated, source } });
});

/**
 * DELETE /api/admin/workflow-triggers/:id
 * Remove a tenant override. For default triggers this resets to the
 * platform default. Custom triggers are deleted entirely.
 */
workflowTriggerRoutes.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const triggerId = c.req.param("id");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) {
    return c.json(
      {
        error: `Tenant niet gevonden voor ID '${tenantId}'.`,
      },
      404,
    );
  }

  const res = await pool.query(
    `DELETE FROM openzorg.tenant_configurations
      WHERE tenant_id = $1
        AND config_type = 'workflow_trigger'
        AND (config_data->>'id') = $2`,
    [tenantUuid, triggerId],
  );

  if (res.rowCount === 0) {
    return c.json(
      { error: `Geen override gevonden voor trigger '${triggerId}'` },
      404,
    );
  }

  const isDefault = DEFAULT_TRIGGERS.some((d) => d.id === triggerId);
  return c.json({
    deleted: true,
    message: isDefault
      ? "Override verwijderd, standaard trigger is hersteld"
      : "Custom trigger verwijderd",
  });
});
