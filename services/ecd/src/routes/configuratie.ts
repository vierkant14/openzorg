/**
 * Admin API routes for tenant configuration management.
 *
 * Provides CRUD endpoints for custom field definitions and validation rules.
 * Configuration is stored in-memory (Map<tenantId, config>) for now;
 * PostgreSQL persistence follows in the next iteration.
 *
 * All routes require tenant context via X-Tenant-ID header (set by tenantMiddleware).
 */

import type {
  CustomFieldDefinition,
  TenantConfiguration,
  ValidationRule,
} from "@openzorg/shared-config";
import { Hono } from "hono";

import type { AppEnv } from "../app.js";

/** In-memory store for tenant configurations. Will be replaced by PostgreSQL. */
const tenantConfigs = new Map<string, TenantConfiguration>();

function getOrCreateConfig(tenantId: string): TenantConfiguration {
  const existing = tenantConfigs.get(tenantId);
  if (existing) {
    return existing;
  }

  const config: TenantConfiguration = {
    tenantId,
    sector: "vvt",
    financieringstypen: ["wlz"],
    enabledModules: [
      "clientregistratie", "medewerkers", "organisatie", "rapportage",
      "planning", "configuratie", "toegangsbeheer", "berichten",
      "zorgplan-leefgebieden", "indicatieverwerking", "soep-rapportage",
      "mic-meldingen", "vvt-facturatie", "wachtlijst", "medicatieoverzicht",
    ],
    customFields: [],
    validationRules: [],
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  tenantConfigs.set(tenantId, config);
  return config;
}

function updateConfig(
  tenantId: string,
  updater: (config: TenantConfiguration) => TenantConfiguration,
): TenantConfiguration {
  const current = getOrCreateConfig(tenantId);
  const updated = updater(current);
  tenantConfigs.set(tenantId, updated);
  return updated;
}

export const configuratieRoutes = new Hono<AppEnv>();

// --- Custom Fields ---

configuratieRoutes.get("/custom-fields", (c) => {
  const tenantId = c.get("tenantId");
  const config = getOrCreateConfig(tenantId);
  const resourceTypeFilter = c.req.query("resourceType");
  const fields = resourceTypeFilter
    ? config.customFields.filter((f) => f.resourceType === resourceTypeFilter)
    : config.customFields;
  return c.json({ customFields: fields });
});

configuratieRoutes.post("/custom-fields", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{
    resourceType: string;
    fieldName: string;
    fieldType: CustomFieldDefinition["fieldType"];
    required?: boolean;
    options?: string[];
  }>();

  if (!body.resourceType || !body.fieldName || !body.fieldType) {
    return c.json(
      { error: "resourceType, fieldName en fieldType zijn verplicht" },
      400,
    );
  }

  const validTypes = ["string", "number", "boolean", "date", "codeable-concept", "dropdown", "multi-select", "textarea"];
  if (!validTypes.includes(body.fieldType)) {
    return c.json(
      { error: `fieldType moet een van ${validTypes.join(", ")} zijn` },
      400,
    );
  }

  // Dropdown and multi-select require options
  if ((body.fieldType === "dropdown" || body.fieldType === "multi-select") && (!body.options || body.options.length === 0)) {
    return c.json(
      { error: "Dropdown/multi-select velden vereisen minimaal 1 optie" },
      400,
    );
  }

  const id = `cf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const newField: CustomFieldDefinition = {
    id,
    resourceType: body.resourceType,
    fieldName: body.fieldName,
    fieldType: body.fieldType,
    required: body.required ?? false,
    extensionUrl: `https://openzorg.nl/extensions/${body.fieldName}`,
    layer: "uitbreiding",
    options: body.options,
    active: true,
  };

  const updated = updateConfig(tenantId, (config) => ({
    ...config,
    customFields: [...config.customFields, newField],
    version: config.version + 1,
    updatedAt: new Date().toISOString(),
  }));

  return c.json({ customField: newField, version: updated.version }, 201);
});

/**
 * PATCH /custom-fields/:id — Toggle active/inactive or update options.
 */
configuratieRoutes.patch("/custom-fields/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const fieldId = c.req.param("id");
  const body = await c.req.json<{
    active?: boolean;
    options?: string[];
    required?: boolean;
  }>();

  const config = getOrCreateConfig(tenantId);
  const fieldIdx = config.customFields.findIndex((f) => f.id === fieldId);
  if (fieldIdx === -1) {
    return c.json({ error: "Custom field niet gevonden" }, 404);
  }

  const updated = updateConfig(tenantId, (cfg) => ({
    ...cfg,
    customFields: cfg.customFields.map((f) => {
      if (f.id !== fieldId) return f;
      return {
        ...f,
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.options !== undefined ? { options: body.options } : {}),
        ...(body.required !== undefined ? { required: body.required } : {}),
      };
    }),
    version: cfg.version + 1,
    updatedAt: new Date().toISOString(),
  }));

  const updatedField = updated.customFields.find((f) => f.id === fieldId);
  return c.json({ customField: updatedField });
});

configuratieRoutes.delete("/custom-fields/:id", (c) => {
  const tenantId = c.get("tenantId");
  const fieldId = c.req.param("id");
  const config = getOrCreateConfig(tenantId);

  const fieldExists = config.customFields.some((f) => f.id === fieldId);
  if (!fieldExists) {
    return c.json({ error: "Custom field niet gevonden" }, 404);
  }

  updateConfig(tenantId, (cfg) => ({
    ...cfg,
    customFields: cfg.customFields.filter((f) => f.id !== fieldId),
    version: cfg.version + 1,
    updatedAt: new Date().toISOString(),
  }));

  return c.json({ deleted: true });
});

// --- Validation Rules ---

configuratieRoutes.get("/validation-rules", (c) => {
  const tenantId = c.get("tenantId");
  const config = getOrCreateConfig(tenantId);
  return c.json({ validationRules: config.validationRules });
});

configuratieRoutes.post("/validation-rules", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{
    resourceType: string;
    fieldPath: string;
    operator: ValidationRule["operator"];
    value: ValidationRule["value"];
    errorMessage: string;
  }>();

  if (!body.resourceType || !body.fieldPath || !body.operator || !body.errorMessage) {
    return c.json(
      { error: "resourceType, fieldPath, operator en errorMessage zijn verplicht" },
      400,
    );
  }

  const validOperators = ["required", "min", "max", "pattern", "in", "minLength", "maxLength"];
  if (!validOperators.includes(body.operator)) {
    return c.json(
      { error: `operator moet een van ${validOperators.join(", ")} zijn` },
      400,
    );
  }

  const id = `vr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const newRule: ValidationRule = {
    id,
    resourceType: body.resourceType,
    fieldPath: body.fieldPath,
    operator: body.operator,
    value: body.value,
    layer: "uitbreiding", // Tenant-created rules are always Layer 2
    errorMessage: body.errorMessage,
  };

  const updated = updateConfig(tenantId, (config) => ({
    ...config,
    validationRules: [...config.validationRules, newRule],
    version: config.version + 1,
    updatedAt: new Date().toISOString(),
  }));

  return c.json({ validationRule: newRule, version: updated.version }, 201);
});

configuratieRoutes.delete("/validation-rules/:id", (c) => {
  const tenantId = c.get("tenantId");
  const ruleId = c.req.param("id");
  const config = getOrCreateConfig(tenantId);

  const ruleExists = config.validationRules.some((r) => r.id === ruleId);
  if (!ruleExists) {
    return c.json({ error: "Validatieregel niet gevonden" }, 404);
  }

  updateConfig(tenantId, (cfg) => ({
    ...cfg,
    validationRules: cfg.validationRules.filter((r) => r.id !== ruleId),
    version: cfg.version + 1,
    updatedAt: new Date().toISOString(),
  }));

  return c.json({ deleted: true });
});
