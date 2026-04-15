import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

/**
 * Plan 2D fase 1 — CRUD endpoints voor tenant-validatieregels (Laag 2).
 *
 * Elke regel is een aparte rij in openzorg.tenant_configurations met
 * config_type='validation_rule' en config_data als ValidationRule JSON.
 */
export const validationRulesRoutes = new Hono<AppEnv>();

type Operator = "required" | "min" | "max" | "range" | "pattern" | "in" | "minLength" | "maxLength";

interface ValidationRule {
  id?: string;
  resourceType: string;
  fieldPath: string;
  operator: Operator;
  value: string | number | boolean | string[];
  errorMessage: string;
  active?: boolean;
}

const VALID_OPERATORS: readonly Operator[] = [
  "required", "min", "max", "range", "pattern", "in", "minLength", "maxLength",
];

async function resolveTenantUuid(tenantIdOrProjectId: string): Promise<string | null> {
  try {
    const result = await pool.query<{ id: string }>(
      "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
      [tenantIdOrProjectId],
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

function validateRule(rule: Partial<ValidationRule>): string | null {
  if (!rule.resourceType || typeof rule.resourceType !== "string") {
    return "resourceType is vereist";
  }
  if (!rule.fieldPath || typeof rule.fieldPath !== "string") {
    return "fieldPath is vereist";
  }
  if (!rule.operator || !VALID_OPERATORS.includes(rule.operator as Operator)) {
    return `operator moet een van: ${VALID_OPERATORS.join(", ")}`;
  }
  if (rule.value === undefined || rule.value === null) {
    return "value is vereist";
  }
  if (!rule.errorMessage || typeof rule.errorMessage !== "string") {
    return "errorMessage is vereist";
  }
  if (rule.operator === "min" || rule.operator === "max" || rule.operator === "minLength" || rule.operator === "maxLength") {
    if (typeof rule.value !== "number") return `${rule.operator} vereist een numerieke value`;
  }
  if (rule.operator === "in" && !Array.isArray(rule.value)) {
    return "in vereist een array van waarden";
  }
  if (rule.operator === "range") {
    if (!Array.isArray(rule.value) || rule.value.length !== 2) {
      return "range vereist [min, max] array";
    }
  }
  return null;
}

/**
 * GET / — List all validation rules for the current tenant.
 */
validationRulesRoutes.get("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ rules: [] });
  }
  const result = await pool.query<{ id: string; config_data: ValidationRule; version: number; created_at: string }>(
    `SELECT id, config_data, version, created_at
       FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'validation_rule'
      ORDER BY created_at DESC`,
    [tenantUuid],
  );
  const rules = result.rows.map((row) => ({
    ...row.config_data,
    id: row.id,
    version: row.version,
  }));
  return c.json({ rules });
});

/**
 * POST / — Create a new validation rule.
 */
validationRulesRoutes.post("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: `Tenant niet gevonden voor id '${tenantHeader}'` }, 404);
  }

  const body = await c.req.json<Partial<ValidationRule>>().catch(() => null);
  if (!body) {
    return c.json({ error: "Ongeldige JSON body" }, 400);
  }

  const validationError = validateRule(body);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const rule: ValidationRule = {
    resourceType: body.resourceType!,
    fieldPath: body.fieldPath!,
    operator: body.operator!,
    value: body.value!,
    errorMessage: body.errorMessage!,
    active: body.active ?? true,
  };

  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO openzorg.tenant_configurations
         (tenant_id, config_type, config_data, version)
       VALUES ($1, 'validation_rule', $2, 1)
       RETURNING id`,
      [tenantUuid, JSON.stringify(rule)],
    );
    const newId = result.rows[0]?.id;

    try {
      await pool.query(
        `INSERT INTO openzorg.audit_log
           (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantUuid,
          c.req.header("X-User-Id") ?? "system",
          "validation.rule.create",
          "ValidationRule",
          newId,
          JSON.stringify({ rule }),
        ],
      );
    } catch (err) {
      console.error("[VALIDATION] audit failed:", err);
    }

    return c.json({ id: newId, ...rule }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "onbekende fout";
    console.error("[VALIDATION] POST faalde:", msg);
    return c.json({ error: `Database-fout: ${msg}` }, 500);
  }
});

/**
 * PUT /:id — Update an existing validation rule.
 */
validationRulesRoutes.put("/:id", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: `Tenant niet gevonden voor id '${tenantHeader}'` }, 404);
  }

  const id = c.req.param("id");
  const body = await c.req.json<Partial<ValidationRule>>().catch(() => null);
  if (!body) {
    return c.json({ error: "Ongeldige JSON body" }, 400);
  }

  const validationError = validateRule(body);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const existing = await pool.query<{ config_data: ValidationRule; version: number }>(
    `SELECT config_data, version FROM openzorg.tenant_configurations
      WHERE id = $1 AND tenant_id = $2 AND config_type = 'validation_rule'`,
    [id, tenantUuid],
  );
  if (existing.rows.length === 0) {
    return c.json({ error: "Regel niet gevonden" }, 404);
  }

  const before = existing.rows[0]!.config_data;
  const after: ValidationRule = {
    resourceType: body.resourceType!,
    fieldPath: body.fieldPath!,
    operator: body.operator!,
    value: body.value!,
    errorMessage: body.errorMessage!,
    active: body.active ?? true,
  };

  await pool.query(
    `UPDATE openzorg.tenant_configurations
        SET config_data = $1, version = version + 1, updated_at = now()
      WHERE id = $2`,
    [JSON.stringify(after), id],
  );

  try {
    await pool.query(
      `INSERT INTO openzorg.audit_log
         (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantUuid,
        c.req.header("X-User-Id") ?? "system",
        "validation.rule.update",
        "ValidationRule",
        id,
        JSON.stringify({ before, after }),
      ],
    );
  } catch (err) {
    console.error("[VALIDATION] audit failed:", err);
  }

  return c.json({ id, ...after });
});

/**
 * DELETE /:id — Delete a validation rule.
 */
validationRulesRoutes.delete("/:id", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }
  const id = c.req.param("id");
  const result = await pool.query(
    `DELETE FROM openzorg.tenant_configurations
      WHERE id = $1 AND tenant_id = $2 AND config_type = 'validation_rule'`,
    [id, tenantUuid],
  );
  if (result.rowCount === 0) {
    return c.json({ error: "Regel niet gevonden" }, 404);
  }

  try {
    await pool.query(
      `INSERT INTO openzorg.audit_log
         (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantUuid, c.req.header("X-User-Id") ?? "system", "validation.rule.delete", "ValidationRule", id, JSON.stringify({})],
    );
  } catch (err) {
    console.error("[VALIDATION] audit failed:", err);
  }

  return c.json({ deleted: true, id });
});

/**
 * POST /test — Test a rule against an example resource without persisting.
 */
validationRulesRoutes.post("/test", async (c) => {
  const body = await c.req.json<{ rule: Partial<ValidationRule>; resource: Record<string, unknown> }>().catch(() => null);
  if (!body?.rule || !body?.resource) {
    return c.json({ error: "Body moet { rule, resource } zijn" }, 400);
  }

  const err = validateRule(body.rule);
  if (err) {
    return c.json({ error: `Ongeldige regel: ${err}` }, 400);
  }

  const rule = body.rule as ValidationRule;
  const value = body.resource[rule.fieldPath];

  let pass = true;
  let failMessage: string | undefined;

  switch (rule.operator) {
    case "required":
      if (value === undefined || value === null || value === "") {
        pass = false;
        failMessage = rule.errorMessage;
      }
      break;
    case "min":
      if (typeof value === "number" && value < (rule.value as number)) {
        pass = false;
        failMessage = rule.errorMessage;
      }
      break;
    case "max":
      if (typeof value === "number" && value > (rule.value as number)) {
        pass = false;
        failMessage = rule.errorMessage;
      }
      break;
    case "range": {
      const rangeArr = rule.value as unknown as [number, number];
      const [minVal, maxVal] = rangeArr;
      if (typeof value === "number" && (value < minVal || value > maxVal)) {
        pass = false;
        failMessage = rule.errorMessage;
      }
      break;
    }
    case "in":
      if (!(rule.value as string[]).includes(String(value))) {
        pass = false;
        failMessage = rule.errorMessage;
      }
      break;
    case "pattern":
      try {
        const re = new RegExp(rule.value as string);
        if (typeof value === "string" && !re.test(value)) {
          pass = false;
          failMessage = rule.errorMessage;
        }
      } catch {
        return c.json({ error: "Ongeldige regex pattern" }, 400);
      }
      break;
    case "minLength":
      if (typeof value === "string" && value.length < (rule.value as number)) {
        pass = false;
        failMessage = rule.errorMessage;
      }
      break;
    case "maxLength":
      if (typeof value === "string" && value.length > (rule.value as number)) {
        pass = false;
        failMessage = rule.errorMessage;
      }
      break;
  }

  return c.json({ pass, failMessage });
});
