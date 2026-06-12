/**
 * FHIR-field registry voor de validation-rule editor.
 *
 * Per resource-type een whitelist van velden die door een
 * functioneel beheerder als validatieregel kunnen worden gebruikt.
 * Kern-velden (BSN, verplichte Zib-velden) zijn gemarkeerd als
 * locked — UI filtert die eruit omdat ze in kern-validatie.ts staan.
 */

export interface ValidatableField {
  /** Dot-path naar de waarde op het FHIR-resource. */
  readonly path: string;
  /** NL-label zoals een beheerder het ziet. */
  readonly label: string;
  /** Primitieve type-hint voor de UI. */
  readonly type: "string" | "number" | "date" | "boolean";
  /** Of dit veld door laag 1 (kern) al gelocked is — UI toont dan een disabled state. */
  readonly locked?: boolean;
  /** Korte toelichting. */
  readonly hint?: string;
}

export const VALIDATABLE_FIELDS: Record<string, readonly ValidatableField[]> = {
  Patient: [
    { path: "name[0].family", label: "Achternaam", type: "string" },
    { path: "name[0].given[0]", label: "Voornaam", type: "string" },
    { path: "birthDate", label: "Geboortedatum", type: "date" },
    { path: "gender", label: "Geslacht", type: "string", hint: "male | female | other | unknown" },
    { path: "identifier[bsn].value", label: "BSN", type: "string", locked: true, hint: "Al gedekt door kern-validatie (elfproef)" },
    { path: "telecom[phone].value", label: "Telefoonnummer", type: "string" },
    { path: "telecom[email].value", label: "E-mailadres", type: "string" },
    { path: "address[0].postalCode", label: "Postcode", type: "string", hint: "bv. 1234 AB" },
    { path: "address[0].city", label: "Woonplaats", type: "string" },
    { path: "maritalStatus.coding[0].code", label: "Burgerlijke staat", type: "string" },
    { path: "extension[indicatie].extension[zorgprofiel].valueString", label: "Zorgprofiel (ZZP/VPT/MPT)", type: "string" },
    { path: "extension[indicatie].extension[einddatum].valueString", label: "Indicatie einddatum", type: "date" },
    { path: "extension[trajectStatus].valueString", label: "Traject-status", type: "string" },
  ],
  Observation: [
    { path: "code.text", label: "Meetnaam", type: "string" },
    { path: "valueQuantity.value", label: "Meetwaarde", type: "number" },
    { path: "valueQuantity.unit", label: "Eenheid", type: "string", hint: "bv. kg, mmHg, °C" },
    { path: "effectiveDateTime", label: "Meting datum-tijd", type: "date" },
    { path: "status", label: "Status", type: "string", hint: "registered | preliminary | final | amended" },
  ],
  MedicationRequest: [
    { path: "medicationCodeableConcept.text", label: "Medicijn naam", type: "string" },
    { path: "dosageInstruction[0].text", label: "Dosering instructie", type: "string" },
    { path: "authoredOn", label: "Voorschrijfdatum", type: "date" },
    { path: "status", label: "Status", type: "string", hint: "active | on-hold | cancelled | completed" },
  ],
  Condition: [
    { path: "code.text", label: "Diagnose", type: "string" },
    { path: "onsetDateTime", label: "Startdatum", type: "date" },
    { path: "clinicalStatus.coding[0].code", label: "Klinische status", type: "string" },
    { path: "severity.coding[0].display", label: "Ernst", type: "string" },
  ],
  AllergyIntolerance: [
    { path: "code.text", label: "Allergie", type: "string" },
    { path: "criticality", label: "Criticaliteit", type: "string", hint: "low | high | unable-to-assess" },
    { path: "category[0]", label: "Categorie", type: "string", hint: "food | medication | environment | biologic" },
  ],
  Flag: [
    { path: "code.text", label: "Signalering", type: "string" },
    { path: "category[0].coding[0].code", label: "Categorie", type: "string", hint: "valrisico | allergie | mrsa | dieet" },
    { path: "extension[signalering-ernst].valueString", label: "Ernst", type: "string", hint: "laag | midden | hoog" },
  ],
  Practitioner: [
    { path: "name[0].family", label: "Achternaam", type: "string" },
    { path: "identifier[agb].value", label: "AGB-code", type: "string", locked: true, hint: "Al gedekt door kern-validatie" },
    { path: "qualification[0].code.text", label: "Kwalificatie", type: "string" },
    { path: "active", label: "Actief", type: "boolean" },
  ],
} as const;

/** Alle resource-types die velden hebben om te valideren. */
export const RESOURCE_TYPES = Object.keys(VALIDATABLE_FIELDS) as ReadonlyArray<keyof typeof VALIDATABLE_FIELDS>;
