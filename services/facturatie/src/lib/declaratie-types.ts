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
  eenheid: "uur" | "dag" | "etmaal" | "stuks" | "minuten";
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

/** WLZ-specific product codes (ZZP/VPT) */
export const WLZ_PRODUCTEN = [
  { code: "V001", omschrijving: "ZZP VV-01 — Beschut wonen met begeleiding", tarief: 7500 },
  { code: "V002", omschrijving: "ZZP VV-02 — Beschut wonen met begeleiding en verzorging", tarief: 9800 },
  { code: "V003", omschrijving: "ZZP VV-03 — Beschut wonen met intensieve verzorging", tarief: 12500 },
  { code: "V004", omschrijving: "ZZP VV-04 — Beschut wonen met uitgebreide verzorging", tarief: 15200 },
  { code: "V005", omschrijving: "ZZP VV-05 — Beschermd wonen met dementiezorg", tarief: 17800 },
  { code: "V006", omschrijving: "ZZP VV-06 — Beschermd wonen met intensieve verpleging", tarief: 19500 },
  { code: "V007", omschrijving: "ZZP VV-07 — Beschermd wonen met zeer intensieve zorg", tarief: 22100 },
  { code: "V008", omschrijving: "ZZP VV-08 — Zeer intensieve zorg specifieke aandoeningen", tarief: 26800 },
  { code: "V009", omschrijving: "ZZP VV-09 — Herstelgerichte behandeling", tarief: 19200 },
  { code: "V010", omschrijving: "ZZP VV-10 — Palliatief-terminale zorg", tarief: 28500 },
  { code: "TVPT", omschrijving: "VPT — Volledig Pakket Thuis", tarief: 13500 },
  { code: "TMPT", omschrijving: "MPT — Modulair Pakket Thuis", tarief: 8500 },
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
