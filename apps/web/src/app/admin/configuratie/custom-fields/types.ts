/** Gedeelde typen en constanten voor de custom-velden-configuratie. */

export interface CustomField {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  options?: string[];
  active?: boolean;
  required?: boolean;
}

export interface ValidationRule {
  id: string;
  resourceType: string;
  fieldPath: string;
  operator: string;
  value: string;
  errorMessage: string;
}

/** FHIR-resourcetypen waarvoor custom velden en validatieregels beschikbaar zijn. */
export const RESOURCE_TYPES = ["Patient", "Practitioner", "Organization", "Observation"];
