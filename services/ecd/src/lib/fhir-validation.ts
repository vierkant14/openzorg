import { validateResource, type TenantConfiguration, type ValidationRule } from "@openzorg/shared-config";

import { pool } from "./db.js";

/**
 * Plan 2D fase 4 — Save-hook voor tenant validatieregels.
 *
 * Laadt de tenant-specifieke validatieregels uit openzorg.tenant_configurations
 * (config_type = 'validation_rule') en runt ze via de shared-config engine
 * tegen een FHIR-resource dat op het punt staat opgeslagen te worden.
 *
 * Gebruikt de config_data JSONB shape zoals geproduceerd door de CRUD-endpoints
 * in routes/validation-rules.ts.
 */

interface StoredRule {
  resourceType?: string;
  fieldPath?: string;
  operator?: ValidationRule["operator"];
  value?: unknown;
  errorMessage?: string;
  active?: boolean;
}

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

/**
 * Lees alle actieve validatieregels voor een tenant als ValidationRule[].
 */
async function loadTenantRules(tenantHeader: string): Promise<ValidationRule[]> {
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) return [];

  try {
    const result = await pool.query<{ id: string; config_data: StoredRule }>(
      `SELECT id, config_data FROM openzorg.tenant_configurations
        WHERE tenant_id = $1 AND config_type = 'validation_rule'`,
      [tenantUuid],
    );

    const rules: ValidationRule[] = [];
    for (const row of result.rows) {
      const raw = row.config_data;
      if (raw.active === false) continue;
      if (!raw.resourceType || !raw.fieldPath || !raw.operator) continue;
      if (raw.value === undefined || raw.value === null) continue;
      if (!raw.errorMessage) continue;

      rules.push({
        id: row.id,
        resourceType: raw.resourceType,
        fieldPath: raw.fieldPath,
        operator: raw.operator,
        value: raw.value as ValidationRule["value"],
        layer: "uitbreiding",
        errorMessage: raw.errorMessage,
      });
    }
    return rules;
  } catch (err) {
    console.error("[fhir-validation] loadTenantRules faalde:", err);
    return [];
  }
}

/**
 * Valideer een FHIR-resource tegen tenant-validatieregels.
 * Returnt een lijst errors of een lege lijst als alles OK is.
 *
 * Gebruik in route-handlers:
 * ```ts
 * const errors = await validateForSave(c.get("tenantId"), patientBody);
 * if (errors.length > 0) return c.json(toOperationOutcome(errors), 400);
 * ```
 */
export async function validateForSave(
  tenantHeader: string,
  resource: Record<string, unknown>,
): Promise<readonly { field: string; message: string; layer: string; rule: string }[]> {
  const rules = await loadTenantRules(tenantHeader);
  if (rules.length === 0) return [];

  const tenantConfig: TenantConfiguration = {
    tenantId: tenantHeader,
    sector: "vvt",
    financieringstypen: [],
    enabledModules: [],
    customFields: [],
    validationRules: rules,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const result = validateResource(resource, tenantConfig);
  return result.errors;
}

/**
 * Bouw een FHIR OperationOutcome van een set validation errors.
 */
export function errorsToOperationOutcome(
  errors: readonly { field: string; message: string; layer: string; rule: string }[],
): Record<string, unknown> {
  return {
    resourceType: "OperationOutcome",
    issue: errors.map((err) => ({
      severity: "error" as const,
      code: "invariant",
      diagnostics: `${err.message} (veld: ${err.field}, regel: ${err.rule}, laag: ${err.layer})`,
      expression: [err.field],
    })),
  };
}
