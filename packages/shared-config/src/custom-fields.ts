/**
 * Custom field engine for OpenZorg Layer 2 (Uitbreiding).
 *
 * Transforms tenant-defined custom fields into FHIR extensions and back.
 * Custom fields are stored as FHIR extensions under the OpenZorg namespace,
 * keeping all data FHIR-compliant even when tenants add extra fields.
 *
 * Field types: string, number, boolean, date, codeable-concept
 */

import { getExtensionUrl } from "@openzorg/shared-domain";

import type { CustomFieldDefinition } from "./configuration";

/** FHIR extension with a typed value. */
interface FhirExtension {
  readonly url: string;
  readonly valueString?: string;
  readonly valueInteger?: number;
  readonly valueBoolean?: boolean;
  readonly valueDate?: string;
  readonly valueCodeableConcept?: {
    readonly coding: readonly { readonly system: string; readonly code: string; readonly display?: string }[];
    readonly text?: string;
  };
}

/** Map of custom field names to their values. */
export type CustomFieldValues = Record<string, unknown>;

/**
 * Apply custom field values to a FHIR resource as extensions.
 *
 * Takes a resource and a set of custom field values, and returns a new resource
 * with FHIR extensions added for each custom field that has a value.
 *
 * @param resource - The FHIR resource to extend
 * @param customFieldDefs - Definitions of the custom fields
 * @param values - Values for the custom fields (keyed by fieldName)
 * @returns A new resource with extensions added
 */
export function applyCustomFields(
  resource: Record<string, unknown>,
  customFieldDefs: readonly CustomFieldDefinition[],
  values: CustomFieldValues = {},
): Record<string, unknown> {
  const existingExtensions = (resource["extension"] as FhirExtension[] | undefined) ?? [];

  // Remove any existing OpenZorg custom field extensions to avoid duplicates
  const customFieldUrls = new Set(
    customFieldDefs.map((def) => def.extensionUrl || getExtensionUrl(def.fieldName)),
  );
  const filteredExtensions = existingExtensions.filter(
    (ext) => !customFieldUrls.has(ext.url),
  );

  // Build new extensions from values
  const newExtensions: FhirExtension[] = [];

  for (const def of customFieldDefs) {
    const value = values[def.fieldName];
    if (value === undefined || value === null) {
      continue;
    }

    const url = def.extensionUrl || getExtensionUrl(def.fieldName);
    const extension = buildExtension(url, def.fieldType, value);
    if (extension) {
      newExtensions.push(extension);
    }
  }

  const allExtensions = [...filteredExtensions, ...newExtensions];

  return {
    ...resource,
    ...(allExtensions.length > 0 ? { extension: allExtensions } : {}),
  };
}

/**
 * Extract custom field values from a FHIR resource's extensions.
 *
 * Reads the resource's extensions and maps them back to custom field values.
 *
 * @param resource - The FHIR resource to read from
 * @param customFieldDefs - Definitions of the custom fields
 * @returns A map of field names to their values
 */
export function extractCustomFields(
  resource: Record<string, unknown>,
  customFieldDefs: readonly CustomFieldDefinition[],
): CustomFieldValues {
  const extensions = (resource["extension"] as FhirExtension[] | undefined) ?? [];
  const result: CustomFieldValues = {};

  for (const def of customFieldDefs) {
    const url = def.extensionUrl || getExtensionUrl(def.fieldName);
    const ext = extensions.find((e) => e.url === url);

    if (!ext) {
      continue;
    }

    const value = extractValue(ext, def.fieldType);
    if (value !== undefined) {
      result[def.fieldName] = value;
    }
  }

  return result;
}

/**
 * Build a FHIR extension object from a field type and value.
 */
function buildExtension(
  url: string,
  fieldType: CustomFieldDefinition["fieldType"],
  value: unknown,
): FhirExtension | null {
  switch (fieldType) {
    case "string":
      return { url, valueString: String(value) };
    case "number":
      return { url, valueInteger: Number(value) };
    case "boolean":
      return { url, valueBoolean: Boolean(value) };
    case "date":
      return { url, valueDate: String(value) };
    case "codeable-concept":
      if (typeof value === "object" && value !== null) {
        return {
          url,
          valueCodeableConcept: value as FhirExtension["valueCodeableConcept"],
        };
      }
      return null;
    default:
      return null;
  }
}

/**
 * Extract a typed value from a FHIR extension.
 */
function extractValue(
  ext: FhirExtension,
  fieldType: CustomFieldDefinition["fieldType"],
): unknown {
  switch (fieldType) {
    case "string":
      return ext.valueString;
    case "number":
      return ext.valueInteger;
    case "boolean":
      return ext.valueBoolean;
    case "date":
      return ext.valueDate;
    case "codeable-concept":
      return ext.valueCodeableConcept;
    default:
      return undefined;
  }
}
