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

/* ---------- Sector & Module definitions ---------- */

/**
 * Zorgsector — determines which modules are available and which
 * financing/regulatory rules apply.
 */
export type Zorgsector =
  | "vvt"           // Verpleging, Verzorging, Thuiszorg
  | "ggz"           // Geestelijke Gezondheidszorg
  | "ghz"           // Gehandicaptenzorg
  | "ziekenhuis"    // Medisch-specialistische zorg
  | "jeugdzorg"     // Jeugdhulp & jeugd-GGZ
  | "huisartsenzorg"
  | "revalidatie";

/**
 * Subsector — further specialization within a sector.
 * Determines default configuration templates.
 */
export type VvtSubsector = "verpleeghuis" | "verzorgingshuis" | "thuiszorg" | "wijkverpleging";
export type GgzSubsector = "basis-ggz" | "gespecialiseerde-ggz" | "langdurige-ggz" | "verslavingszorg";
export type ZiekenhuisSubsector = "academisch" | "topklinisch" | "algemeen";
export type GhzSubsector = "verstandelijk" | "lichamelijk" | "zintuiglijk";
export type JeugdzorgSubsector = "jeugd-ggz" | "jeugdhulp" | "jeugdbescherming";

/**
 * Financieringstype — which Dutch healthcare law governs payment.
 * A tenant can have multiple (e.g. VVT organization with both Wlz and Wmo clients).
 */
export type Financieringstype = "wlz" | "wmo" | "zvw" | "jeugdwet" | "wpg" | "particulier";

/**
 * Platform modules — kern is always active, sector modules are
 * activated based on the tenant's sector, optional modules can be
 * toggled individually. Only deployed modules ship to the client.
 */
export type KernModule =
  | "clientregistratie"     // Patient/cliënt CRUD + BSN
  | "medewerkers"           // Practitioner + PractitionerRole
  | "organisatie"           // Organization hierarchy
  | "rapportage"            // Observations + DocumentReference
  | "planning"              // Schedule, Slot, Appointment
  | "configuratie"          // Custom fields, validation rules
  | "toegangsbeheer"        // RBAC, audit trail
  | "berichten";            // Notifications, task inbox

export type VvtModule =
  | "zorgplan-leefgebieden" // CarePlan with 12 life domains
  | "indicatieverwerking"   // CIZ/Wlz, Wmo-beschikking
  | "soep-rapportage"       // SOEP structured reporting
  | "mic-meldingen"         // Incident reporting
  | "vbm"                   // Vrijheidsbeperkende maatregelen (Wzd)
  | "vvt-facturatie"        // AW319/AW320 Vektis
  | "iwlz";                 // iWlz berichtenverkeer

export type GgzModule =
  | "behandelplan"          // Treatment plan (different from zorgplan)
  | "rom-vragenlijsten"     // Routine Outcome Monitoring
  | "dbc-registratie"       // Diagnose Behandel Combinatie
  | "crisiskaart"           // Crisis card
  | "ggz-scores"            // GAF, HoNOS, etc.
  | "medicatiebewaking"     // Medication monitoring
  | "wvggz"                 // Verplichte zorg
  | "ggz-facturatie";       // DIS, Grouper

export type ZiekenhuisModule =
  | "order-entry"           // Lab, radiology, pathology orders
  | "dbc-dot"               // DBC/DOT registration
  | "ok-planning"           // Operating room scheduling
  | "sbar-overdracht"       // Structured clinical handoff
  | "polikliniek"           // Outpatient clinic scheduling
  | "seh-triage"            // Emergency department (MTS)
  | "zkh-facturatie";       // Hospital billing

export type GhzModule =
  | "ondersteuningsplan"    // Support plan (instead of zorgplan)
  | "gedragsanalyse"        // Behavioral analysis
  | "dagbesteding"          // Day activity registration
  | "zzp-registratie"       // ZZP/VG package registration
  | "ghz-facturatie";       // GHZ billing

export type JeugdzorgModule =
  | "gezinsplan"            // Family plan
  | "veiligheidsplan"       // Signs of Safety
  | "ijw"                   // iJW berichtenverkeer
  | "jeugd-facturatie";     // Youth care billing

export type OptionalModule =
  | "medicatieoverzicht"    // Medication overview (cross-sector)
  | "vragenlijsten"         // Questionnaires/screenings
  | "mdo"                   // Multi-disciplinary meetings
  | "documentbeheer"        // Extended document management
  | "wachtlijst"            // Waitlist management
  | "kwaliteitsregistratie" // Quality indicators
  | "groepszorg"            // Group care activities
  | "caseload";             // Caseload management

export type PlatformModule =
  | KernModule
  | VvtModule
  | GgzModule
  | ZiekenhuisModule
  | GhzModule
  | JeugdzorgModule
  | OptionalModule;

/**
 * Sector-specific default modules — activated automatically
 * when a tenant selects their sector during onboarding.
 */
export const SECTOR_DEFAULT_MODULES: Record<Zorgsector, readonly PlatformModule[]> = {
  vvt: [
    "zorgplan-leefgebieden", "indicatieverwerking", "soep-rapportage",
    "mic-meldingen", "vvt-facturatie", "wachtlijst", "medicatieoverzicht",
  ],
  ggz: [
    "behandelplan", "rom-vragenlijsten", "dbc-registratie",
    "ggz-scores", "medicatiebewaking", "ggz-facturatie",
  ],
  ghz: [
    "ondersteuningsplan", "dagbesteding", "zzp-registratie",
    "ghz-facturatie", "medicatieoverzicht",
  ],
  ziekenhuis: [
    "order-entry", "dbc-dot", "ok-planning", "sbar-overdracht",
    "polikliniek", "seh-triage", "zkh-facturatie",
  ],
  jeugdzorg: [
    "gezinsplan", "veiligheidsplan", "ijw", "jeugd-facturatie",
  ],
  huisartsenzorg: [
    "medicatieoverzicht", "vragenlijsten", "kwaliteitsregistratie",
  ],
  revalidatie: [
    "behandelplan", "rom-vragenlijsten", "vragenlijsten",
    "medicatieoverzicht",
  ],
} as const;

/**
 * Kern modules — always active for every tenant regardless of sector.
 */
export const KERN_MODULES: readonly KernModule[] = [
  "clientregistratie", "medewerkers", "organisatie", "rapportage",
  "planning", "configuratie", "toegangsbeheer", "berichten",
] as const;

/* ---------- Tenant configuration ---------- */

export interface TenantConfiguration {
  readonly tenantId: string;
  readonly sector: Zorgsector;
  readonly subsector?: string;
  readonly financieringstypen: readonly Financieringstype[];
  readonly enabledModules: readonly PlatformModule[];
  readonly customFields: readonly CustomFieldDefinition[];
  readonly validationRules: readonly ValidationRule[];
  readonly version: number;
  readonly updatedAt: string;
}

export type CustomFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "codeable-concept"
  | "dropdown"
  | "multi-select"
  | "textarea";

export interface CustomFieldDefinition {
  readonly id: string;
  readonly resourceType: string;
  readonly fieldName: string;
  readonly fieldType: CustomFieldType;
  readonly required: boolean;
  readonly extensionUrl: string;
  readonly layer: "uitbreiding";
  /** For dropdown/multi-select: the available options */
  readonly options?: readonly string[];
  /** Whether this field is currently active (can be toggled off) */
  readonly active?: boolean;
}

export interface ValidationRule {
  readonly id: string;
  readonly resourceType: string;
  readonly fieldPath: string;
  readonly operator: "required" | "min" | "max" | "pattern" | "in" | "minLength" | "maxLength";
  readonly value: string | number | boolean | readonly string[];
  readonly layer: ConfigurationLayer;
  readonly errorMessage: string;
}

export function isLayerModifiable(layer: ConfigurationLayer): boolean {
  return layer !== "kern";
}
