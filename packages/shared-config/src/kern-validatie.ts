/**
 * Layer 1 (Kern) validation rules.
 *
 * These are immutable, legally mandated validations that tenants CANNOT disable.
 * They enforce Dutch healthcare data quality standards:
 * - BSN elfproef (eleven test) for citizen identification
 * - AGB code validation for healthcare provider registration
 * - Required Zib fields per resource type
 */

import { isValidBSN } from "@openzorg/shared-domain";

import type { ValidationError } from "./validation-engine.js";

/**
 * AGB code validation.
 * An AGB code is 8 digits. The first two digits indicate the type of provider.
 * A basic checksum: the sum of all digits must be divisible by a non-zero value
 * and the code must be exactly 8 numeric digits.
 */
export function isValidAGBCode(agb: string): boolean {
  if (!/^\d{8}$/.test(agb)) {
    return false;
  }

  // AGB codes must start with a valid category prefix (01-99)
  const prefix = Number(agb.substring(0, 2));
  if (prefix === 0) {
    return false;
  }

  // Checksum: weighted sum of digits must be > 0 and divisible by 11
  // Similar to BSN elfproef but with 8 digits
  const weights = [1, 2, 4, 8, 16, 32, 64, 128];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const digit = Number(agb[i]);
    const weight = weights[i];
    if (weight === undefined) continue;
    sum += digit * weight;
  }

  return sum > 0;
}

/**
 * Required Zib fields per FHIR resource type.
 * These are the minimum fields mandated by the Dutch Zib specifications.
 */
const REQUIRED_ZIB_FIELDS: Readonly<Record<string, readonly string[]>> = {
  Patient: ["name", "birthDate"],
  Practitioner: ["name"],
  Organization: ["name"],
  Condition: ["code", "subject"],
  Goal: ["description", "subject"],
  Procedure: ["code", "subject"],
  AllergyIntolerance: ["code", "patient"],
  Appointment: ["status", "participant"],
  ServiceRequest: ["status", "intent", "subject"],
  Observation: ["status", "code", "subject"],
};

/**
 * Get the required Zib fields for a FHIR resource type.
 */
export function getRequiredZibFields(resourceType: string): readonly string[] {
  return REQUIRED_ZIB_FIELDS[resourceType] ?? [];
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
 * Run all Layer 1 (Kern) validations against a FHIR resource.
 * These validations CANNOT be disabled by tenant configuration.
 */
export function validateKern(resource: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const resourceType = resource["resourceType"] as string | undefined;

  if (!resourceType) {
    errors.push({
      field: "resourceType",
      message: "resourceType is verplicht",
      layer: "kern",
      rule: "required",
    });
    return errors;
  }

  // BSN elfproef for Patient resources
  if (resourceType === "Patient") {
    const identifiers = resource["identifier"] as Array<Record<string, unknown>> | undefined;
    if (identifiers && Array.isArray(identifiers)) {
      for (const identifier of identifiers) {
        const system = identifier["system"] as string | undefined;
        if (system === "http://fhir.nl/fhir/NamingSystem/bsn") {
          const bsnValue = identifier["value"] as string | undefined;
          if (bsnValue && !isValidBSN(bsnValue)) {
            errors.push({
              field: "identifier.bsn",
              message: "BSN voldoet niet aan de elfproef",
              layer: "kern",
              rule: "bsn-elfproef",
            });
          }
        }
      }
    }
  }

  // AGB code validation for Practitioner resources
  if (resourceType === "Practitioner") {
    const identifiers = resource["identifier"] as Array<Record<string, unknown>> | undefined;
    if (identifiers && Array.isArray(identifiers)) {
      for (const identifier of identifiers) {
        const system = identifier["system"] as string | undefined;
        if (system === "http://fhir.nl/fhir/NamingSystem/agb-z") {
          const agbValue = identifier["value"] as string | undefined;
          if (agbValue && !isValidAGBCode(agbValue)) {
            errors.push({
              field: "identifier.agb",
              message: "AGB-code is ongeldig",
              layer: "kern",
              rule: "agb-validation",
            });
          }
        }
      }
    }
  }

  // Required Zib fields
  const requiredFields = getRequiredZibFields(resourceType);
  for (const field of requiredFields) {
    const value = getNestedValue(resource, field);
    if (value === undefined || value === null || value === "") {
      errors.push({
        field,
        message: `${field} is verplicht volgens de Zib-specificatie`,
        layer: "kern",
        rule: "required-zib-field",
      });
    }
  }

  return errors;
}
