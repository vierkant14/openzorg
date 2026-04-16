/**
 * Admin API routes for tenant configuration management.
 *
 * Provides CRUD endpoints for custom field definitions and validation rules.
 * Configuration is stored in PostgreSQL (openzorg.tenant_configurations table).
 *
 * All routes require tenant context via X-Tenant-ID header (set by tenantMiddleware).
 */

import type {
  CustomFieldDefinition,
  ValidationRule,
} from "@openzorg/shared-config";
import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const configuratieRoutes = new Hono<AppEnv>();

/* ── Helpers ── */

async function getTenantUuid(tenantId: string): Promise<string | null> {
  // Try matching on medplum_project_id, UUID, or slug
  const res = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 OR slug = $1 LIMIT 1",
    [tenantId],
  );
  if (res.rows[0]?.id) return res.rows[0].id as string;
  // Fallback: if no exact match, try to auto-register the project ID
  // This handles the case where seed ran but didn't link the Medplum project ID
  const fallback = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id IS NULL OR medplum_project_id = '' LIMIT 1",
  );
  if (fallback.rows[0]?.id) {
    const uuid = fallback.rows[0].id as string;
    await pool.query(
      "UPDATE openzorg.tenants SET medplum_project_id = $1 WHERE id = $2",
      [tenantId, uuid],
    );
    return uuid;
  }
  return null;
}

async function loadCustomFields(tenantUuid: string): Promise<CustomFieldDefinition[]> {
  const res = await pool.query(
    "SELECT id, config_data FROM openzorg.tenant_configurations WHERE tenant_id = $1 AND config_type = 'custom_field' ORDER BY created_at",
    [tenantUuid],
  );
  return res.rows.map((r) => ({
    id: r.id as string,
    ...(r.config_data as Omit<CustomFieldDefinition, "id">),
    layer: "uitbreiding" as const,
  }));
}

async function _loadValidationRules(tenantUuid: string): Promise<ValidationRule[]> {
  const res = await pool.query(
    "SELECT id, config_data FROM openzorg.tenant_configurations WHERE tenant_id = $1 AND config_type = 'validation_rule' ORDER BY created_at",
    [tenantUuid],
  );
  return res.rows.map((r) => ({
    id: r.id as string,
    ...(r.config_data as Omit<ValidationRule, "id">),
    layer: "uitbreiding" as const,
  }));
}

// --- Custom Fields ---

configuratieRoutes.get("/custom-fields", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ customFields: [] });

  const fields = await loadCustomFields(tenantUuid);
  const resourceTypeFilter = c.req.query("resourceType");
  const filtered = resourceTypeFilter
    ? fields.filter((f) => f.resourceType === resourceTypeFilter)
    : fields;
  return c.json({ customFields: filtered });
});

configuratieRoutes.post("/custom-fields", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: `Tenant niet gevonden voor ID '${tenantId}'. Controleer of de tenant correct is aangemaakt.` }, 404);

  const body = await c.req.json<{
    resourceType: string;
    fieldName: string;
    fieldType: CustomFieldDefinition["fieldType"];
    required?: boolean;
    options?: string[];
  }>();

  if (!body.resourceType || !body.fieldName || !body.fieldType) {
    return c.json({ error: "resourceType, fieldName en fieldType zijn verplicht" }, 400);
  }

  const validTypes = ["string", "number", "boolean", "date", "codeable-concept", "dropdown", "multi-select", "textarea"];
  if (!validTypes.includes(body.fieldType)) {
    return c.json({ error: `fieldType moet een van ${validTypes.join(", ")} zijn` }, 400);
  }

  if ((body.fieldType === "dropdown" || body.fieldType === "multi-select") && (!body.options || body.options.length === 0)) {
    return c.json({ error: "Dropdown/multi-select velden vereisen minimaal 1 optie" }, 400);
  }

  const configData = {
    resourceType: body.resourceType,
    fieldName: body.fieldName,
    fieldType: body.fieldType,
    required: body.required ?? false,
    extensionUrl: `https://openzorg.nl/extensions/${body.fieldName}`,
    options: body.options,
    active: true,
  };

  const res = await pool.query(
    "INSERT INTO openzorg.tenant_configurations (tenant_id, config_type, config_data) VALUES ($1, 'custom_field', $2) RETURNING id",
    [tenantUuid, JSON.stringify(configData)],
  );

  const newField: CustomFieldDefinition = {
    id: res.rows[0]?.id as string,
    ...configData,
    layer: "uitbreiding",
  };

  return c.json({ customField: newField }, 201);
});

configuratieRoutes.patch("/custom-fields/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const fieldId = c.req.param("id");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: `Tenant niet gevonden voor ID '${tenantId}'. Controleer of de tenant correct is aangemaakt.` }, 404);

  const body = await c.req.json<{
    active?: boolean;
    options?: string[];
    required?: boolean;
  }>();

  // Load current field
  const existing = await pool.query(
    "SELECT config_data FROM openzorg.tenant_configurations WHERE id = $1 AND tenant_id = $2 AND config_type = 'custom_field'",
    [fieldId, tenantUuid],
  );
  if (existing.rows.length === 0) return c.json({ error: "Custom field niet gevonden" }, 404);

  const current = existing.rows[0]?.config_data as Record<string, unknown>;
  const updated = {
    ...current,
    ...(body.active !== undefined ? { active: body.active } : {}),
    ...(body.options !== undefined ? { options: body.options } : {}),
    ...(body.required !== undefined ? { required: body.required } : {}),
  };

  await pool.query(
    "UPDATE openzorg.tenant_configurations SET config_data = $1, updated_at = now() WHERE id = $2",
    [JSON.stringify(updated), fieldId],
  );

  return c.json({ customField: { id: fieldId, ...updated, layer: "uitbreiding" } });
});

configuratieRoutes.delete("/custom-fields/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const fieldId = c.req.param("id");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: `Tenant niet gevonden voor ID '${tenantId}'. Controleer of de tenant correct is aangemaakt.` }, 404);

  const res = await pool.query(
    "DELETE FROM openzorg.tenant_configurations WHERE id = $1 AND tenant_id = $2 AND config_type = 'custom_field'",
    [fieldId, tenantUuid],
  );

  if (res.rowCount === 0) return c.json({ error: "Custom field niet gevonden" }, 404);
  return c.json({ deleted: true });
});

// --- Validation Rules ---
// De canonical routes voor /api/admin/validation-rules staan in
// routes/validation-rules.ts met CRUD + test-endpoint. Deze oude
// handlers zijn verwijderd in Plan 2D fase 3. De LOAD-helper blijft
// bestaan omdat andere code hem mogelijk nog aanroept.
