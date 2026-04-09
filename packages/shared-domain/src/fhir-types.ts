/**
 * OpenZorg FHIR type mappings.
 * Maps Dutch Zib concepts to FHIR R4 resources with zorg-NL profiles.
 *
 * These types are thin wrappers that ensure our codebase stays aligned
 * with the Nictiz Zibs while using standard FHIR resources underneath.
 */

/**
 * Zib-to-FHIR resource mapping for the MVP.
 * Each entry represents a Zorginformatiebouwsteen mapped to its FHIR resource.
 */
export const ZIB_FHIR_MAPPING = {
  Patient: { fhirResource: "Patient", openZorgName: "Client" },
  Zorgverlener: { fhirResource: "Practitioner", openZorgName: "Zorgverlener" },
  Zorgaanbieder: { fhirResource: "Organization", openZorgName: "Zorgaanbieder" },
  Contactpersoon: { fhirResource: "RelatedPerson", openZorgName: "Contactpersoon" },
  Probleem: { fhirResource: "Condition", openZorgName: "Probleem" },
  BehandelDoel: { fhirResource: "Goal", openZorgName: "Doel" },
  PlannedCareActivity: { fhirResource: "ServiceRequest", openZorgName: "GeplandeZorgActiviteit" },
  Verrichting: { fhirResource: "Procedure", openZorgName: "Verrichting" },
  Allergie: { fhirResource: "AllergyIntolerance", openZorgName: "Allergie" },
  LichaamsGewicht: { fhirResource: "Observation", openZorgName: "Meting" },
  AfsprakenInfo: { fhirResource: "Appointment", openZorgName: "Afspraak" },
} as const;

export type ZibName = keyof typeof ZIB_FHIR_MAPPING;

/**
 * BSN (Burgerservicenummer) validation using the 11-proef (eleven test).
 * A BSN is valid if it has 9 digits and the weighted sum is divisible by 11.
 */
export function isValidBSN(bsn: string): boolean {
  if (!/^\d{9}$/.test(bsn)) {
    return false;
  }

  const weights = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    const digit = Number(bsn[i]);
    const weight = weights[i];
    if (weight === undefined) continue;
    sum += digit * weight;
  }

  return sum > 0 && sum % 11 === 0;
}

/**
 * Extension namespace for OpenZorg custom FHIR extensions.
 */
export const OPENZORG_EXTENSION_BASE = "https://openzorg.nl/extensions" as const;

export function getExtensionUrl(extensionName: string): string {
  return `${OPENZORG_EXTENSION_BASE}/${extensionName}`;
}
