/**
 * Three-layer validation engine for OpenZorg.
 *
 * Runs all applicable validation rules against a FHIR resource:
 * - Layer 1 (Kern): Hardcoded, immutable rules (BSN elfproef, AGB, required Zib fields)
 * - Layer 2 (Uitbreiding): Tenant-configurable rules from TenantConfiguration
 * - Layer 3 (Plugin): Reserved for future plugin-based validation
 *
 * Configuration is always data, never code. Layer boundaries are enforced in code.
 */

import type { TenantConfiguration, ValidationRule } from "./configuration.js";
import { validateKern } from "./kern-validatie.js";

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly layer: string;
  readonly rule: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

/**
 * Resolve a dot-path on a FHIR resource, returning the value at that path.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Apply a single Layer 2 validation rule to a resource.
 */
function applyRule(
  resource: Record<string, unknown>,
  rule: ValidationRule,
): ValidationError | null {
  const value = getNestedValue(resource, rule.fieldPath);

  switch (rule.operator) {
    case "required": {
      if (value === undefined || value === null || value === "") {
        return {
          field: rule.fieldPath,
          message: rule.errorMessage,
          layer: rule.layer,
          rule: rule.id,
        };
      }
      return null;
    }

    case "min": {
      if (typeof value === "number" && value < Number(rule.value)) {
        return {
          field: rule.fieldPath,
          message: rule.errorMessage,
          layer: rule.layer,
          rule: rule.id,
        };
      }
      // If value is not a number but exists, that is a type mismatch (not this rule's concern)
      return null;
    }

    case "max": {
      if (typeof value === "number" && value > Number(rule.value)) {
        return {
          field: rule.fieldPath,
          message: rule.errorMessage,
          layer: rule.layer,
          rule: rule.id,
        };
      }
      return null;
    }

    case "minLength": {
      if (typeof value === "string" && value.length < Number(rule.value)) {
        return {
          field: rule.fieldPath,
          message: rule.errorMessage,
          layer: rule.layer,
          rule: rule.id,
        };
      }
      return null;
    }

    case "maxLength": {
      if (typeof value === "string" && value.length > Number(rule.value)) {
        return {
          field: rule.fieldPath,
          message: rule.errorMessage,
          layer: rule.layer,
          rule: rule.id,
        };
      }
      return null;
    }

    case "pattern": {
      if (typeof value === "string" && typeof rule.value === "string") {
        const regex = new RegExp(rule.value);
        if (!regex.test(value)) {
          return {
            field: rule.fieldPath,
            message: rule.errorMessage,
            layer: rule.layer,
            rule: rule.id,
          };
        }
      }
      return null;
    }

    case "in": {
      if (Array.isArray(rule.value)) {
        const stringValue = String(value);
        if (!rule.value.includes(stringValue)) {
          return {
            field: rule.fieldPath,
            message: rule.errorMessage,
            layer: rule.layer,
            rule: rule.id,
          };
        }
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Validate a FHIR resource against all applicable rules.
 *
 * Runs Layer 1 (Kern) rules first (always, cannot be disabled),
 * then Layer 2 (Uitbreiding) rules from tenant configuration.
 *
 * @param resource - The FHIR resource to validate
 * @param tenantConfig - Optional tenant configuration with Layer 2 rules
 * @returns Validation result with all errors from both layers
 */
export function validateResource(
  resource: Record<string, unknown>,
  tenantConfig?: TenantConfiguration,
): ValidationResult {
  const errors: ValidationError[] = [];

  // Layer 1: Kern validation (always runs, cannot be disabled)
  const kernErrors = validateKern(resource);
  errors.push(...kernErrors);

  // Layer 2: Uitbreiding validation (tenant-configurable rules)
  if (tenantConfig) {
    const resourceType = resource["resourceType"] as string | undefined;
    const applicableRules = tenantConfig.validationRules.filter(
      (rule) => rule.resourceType === resourceType && rule.layer === "uitbreiding",
    );

    for (const rule of applicableRules) {
      const error = applyRule(resource, rule);
      if (error) {
        errors.push(error);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
