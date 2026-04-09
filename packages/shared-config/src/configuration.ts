/**
 * Three-layer configuration model for OpenZorg.
 *
 * Layer 1 (Kern): Immutable core - FHIR/Zib required fields, legally mandated validations.
 * Layer 2 (Uitbreiding): Tenant-configurable - custom fields, validation rules, workflows.
 * Layer 3 (Plugin): Code-level customization via published plugin interfaces.
 *
 * Configuration is always stored as data, never as code.
 */

export type ConfigurationLayer = "kern" | "uitbreiding" | "plugin";

export interface TenantConfiguration {
  readonly tenantId: string;
  readonly enabledModules: readonly string[];
  readonly customFields: readonly CustomFieldDefinition[];
  readonly validationRules: readonly ValidationRule[];
  readonly version: number;
  readonly updatedAt: string;
}

export interface CustomFieldDefinition {
  readonly id: string;
  readonly resourceType: string;
  readonly fieldName: string;
  readonly fieldType: "string" | "number" | "boolean" | "date" | "codeable-concept";
  readonly required: boolean;
  readonly extensionUrl: string;
  readonly layer: "uitbreiding";
}

export interface ValidationRule {
  readonly id: string;
  readonly resourceType: string;
  readonly fieldPath: string;
  readonly operator: "required" | "min" | "max" | "pattern" | "in";
  readonly value: string | number | boolean | readonly string[];
  readonly layer: ConfigurationLayer;
  readonly errorMessage: string;
}

export function isLayerModifiable(layer: ConfigurationLayer): boolean {
  return layer !== "kern";
}
