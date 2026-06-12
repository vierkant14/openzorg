/**
 * Facturatie types for Dutch healthcare billing.
 *
 * The Dutch healthcare system has multiple funding streams (financieringstypen),
 * each with their own declaration rules, message formats, and tariff structures.
 */

/** Supported funding types */
export type Financieringstype = "wlz" | "wmo" | "zvw" | "jeugdwet";

/** Declaration status lifecycle */
export type DeclaratieStatus =
  | "concept"       // Draft, not yet submitted
  | "ingediend"     // Submitted to payer
  | "geaccepteerd"  // Accepted by payer
  | "afgewezen"     // Rejected by payer
  | "gecrediteerd"  // Credit note issued
  | "betaald";      // Payment received

/** A single care activity that can be billed */
export interface Prestatie {
  id: string;
  clientId: string;
  clientNaam: string;
  datum: string;                // ISO date
  productCode: string;          // AGB/NZa product code
  productOmschrijving: string;
  eenheid: "uur" | "dag" | "etmaal" | "stuks" | "minuten" | "dagdeel";
  aantal: number;
  tariefPerEenheid: number;     // Euro cents
  totaal: number;               // Euro cents
  financieringstype: Financieringstype;
  medewerkerNaam: string;
  status: "geregistreerd" | "gevalideerd" | "gedeclareerd";
}

/** A declaration groups multiple prestaties for submission */
export interface Declaratie {
  id: string;
  nummer: string;               // Human-readable: DEC-2026-00001
  tenantId: string;
  financieringstype: Financieringstype;
  periode: {
    van: string;                // ISO date
    tot: string;                // ISO date
  };
  status: DeclaratieStatus;
  totaalBedrag: number;         // Euro cents
  aantalPrestaties: number;
  ingediendOp?: string;         // ISO datetime
  antwoordOp?: string;          // ISO datetime
  afwijzingsReden?: string;
  prestaties: string[];         // Prestatie IDs
  createdAt: string;
  updatedAt: string;
}

/** WLZ ZZP-VV producten met NZa 2026 dagtarieven (in eurocenten) */
export const WLZ_PRODUCTEN = [
  { code: "ZZP-VV01", omschrijving: "ZZP-VV1 Beschut wonen met begeleiding", tarief: 7351, eenheid: "dag" as const },
  { code: "ZZP-VV02", omschrijving: "ZZP-VV2 Beschut wonen met begeleiding en verzorging", tarief: 9243, eenheid: "dag" as const },
  { code: "ZZP-VV03", omschrijving: "ZZP-VV3 Beschut wonen met begeleiding en intensieve verzorging", tarief: 12156, eenheid: "dag" as const },
  { code: "ZZP-VV04", omschrijving: "ZZP-VV4 Beschut wonen met intensieve begeleiding en uitgebreide verzorging", tarief: 14589, eenheid: "dag" as const },
  { code: "ZZP-VV05", omschrijving: "ZZP-VV5 Beschermd wonen met intensieve dementiezorg", tarief: 18234, eenheid: "dag" as const },
  { code: "ZZP-VV06", omschrijving: "ZZP-VV6 Beschermd wonen met intensieve verzorging en verpleging", tarief: 19876, eenheid: "dag" as const },
  { code: "ZZP-VV07", omschrijving: "ZZP-VV7 Beschermd wonen met zeer intensieve zorg", tarief: 23456, eenheid: "dag" as const },
  { code: "ZZP-VV08", omschrijving: "ZZP-VV8 Beschermd wonen met zeer intensieve zorg en target", tarief: 27891, eenheid: "dag" as const },
  { code: "ZZP-VV09", omschrijving: "ZZP-VV9 Herstelgerichte behandeling met verpleging en verzorging", tarief: 31245, eenheid: "dag" as const },
  { code: "ZZP-VV10", omschrijving: "ZZP-VV10 Beschermd verblijf met intensieve pallatieve zorg", tarief: 34212, eenheid: "dag" as const },
  { code: "VPT-BASIS", omschrijving: "VPT Basis (volledig pakket thuis)", tarief: 4280, eenheid: "dag" as const },
  { code: "VPT-INT", omschrijving: "VPT Intensief (volledig pakket thuis)", tarief: 7820, eenheid: "dag" as const },
  { code: "MPT", omschrijving: "MPT (modulair pakket thuis)", tarief: 5250, eenheid: "uur" as const },
  { code: "DAGBEST", omschrijving: "Dagbesteding", tarief: 3580, eenheid: "dagdeel" as const },
] as const;

/** WMO product codes (common ones) */
export const WMO_PRODUCTEN = [
  { code: "W001", omschrijving: "Hulp bij huishouden HH1", tarief: 2850, eenheid: "uur" as const },
  { code: "W002", omschrijving: "Hulp bij huishouden HH2", tarief: 3200, eenheid: "uur" as const },
  { code: "W003", omschrijving: "Begeleiding individueel", tarief: 5500, eenheid: "uur" as const },
  { code: "W004", omschrijving: "Begeleiding groep", tarief: 3800, eenheid: "dag" as const },
  { code: "W005", omschrijving: "Dagbesteding", tarief: 6200, eenheid: "dag" as const },
  { code: "W006", omschrijving: "Kortdurend verblijf", tarief: 15500, eenheid: "etmaal" as const },
  { code: "W007", omschrijving: "Persoonlijke verzorging", tarief: 5200, eenheid: "uur" as const },
  { code: "W008", omschrijving: "Verpleging", tarief: 7100, eenheid: "uur" as const },
] as const;

/** ZVW product codes (common nursing/care acts) */
export const ZVW_PRODUCTEN = [
  { code: "Z001", omschrijving: "Verpleging in de thuissituatie", tarief: 7950, eenheid: "uur" as const },
  { code: "Z002", omschrijving: "Persoonlijke verzorging in de thuissituatie", tarief: 5450, eenheid: "uur" as const },
  { code: "Z003", omschrijving: "Gespecialiseerde verpleging", tarief: 9200, eenheid: "uur" as const },
  { code: "Z004", omschrijving: "Indicatiestelling wijkverpleging", tarief: 8800, eenheid: "uur" as const },
] as const;

/** Get products for a given financieringstype */
export function getProducten(type: Financieringstype): ReadonlyArray<{ code: string; omschrijving: string; tarief: number; eenheid?: string }> {
  switch (type) {
    case "wlz": return WLZ_PRODUCTEN;
    case "wmo": return WMO_PRODUCTEN;
    case "zvw": return ZVW_PRODUCTEN;
    case "jeugdwet": return WMO_PRODUCTEN; // Jeugdwet uses similar structure
    default: return [];
  }
}

/** Format cents to euro display string */
export function formatBedrag(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
