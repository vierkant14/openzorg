/**
 * Three-layer competency system for OpenZorg.
 *
 * Layer 1: Kern (wettelijk bepaald, niet verwijderbaar)
 * Layer 2: Uitbreiding (standaard meegeleverd, aan/uit per medewerker)
 * Layer 3: Organisatie-specifiek (tenant maakt zelf aan)
 */

export interface Competentie {
  code: string;
  naam: string;
  beschrijving: string;
  laag: "kern" | "uitbreiding" | "organisatie";
  /** Sector tags — empty means cross-sector */
  sectoren: string[];
  /** BIG-niveau vereist (optional) */
  bigNiveau?: number;
}

/**
 * Kern-competenties: voorbehouden handelingen (Wet BIG).
 * Niet verwijderbaar, altijd aanwezig.
 */
export const KERN_COMPETENTIES: readonly Competentie[] = [
  { code: "VH-INJECTIES", naam: "Injecties toedienen", beschrijving: "Subcutaan, intramusculair, intraveneus", laag: "kern", sectoren: [], bigNiveau: 3 },
  { code: "VH-KATHETERISATIE", naam: "Katheterisatie", beschrijving: "Blaaskatheter inbrengen en verwisselen", laag: "kern", sectoren: [], bigNiveau: 3 },
  { code: "VH-INFUUS", naam: "Infuusbeheer", beschrijving: "Infuus inbrengen, aankoppelen en bewaken", laag: "kern", sectoren: [], bigNiveau: 3 },
  { code: "VH-MEDICATIE", naam: "Medicatie delen (risicovolle)", beschrijving: "Opiaten, cytostatica, insuline titratie", laag: "kern", sectoren: [], bigNiveau: 3 },
  { code: "VH-BLOEDAFNAME", naam: "Bloedafname (venapunctie)", beschrijving: "Veneus bloed afnemen voor diagnostiek", laag: "kern", sectoren: [], bigNiveau: 3 },
  { code: "VH-SONDE", naam: "Sondevoeding", beschrijving: "Maagsonde inbrengen en sondevoeding beheren", laag: "kern", sectoren: [], bigNiveau: 3 },
  { code: "VH-STOMA", naam: "Stomazorg", beschrijving: "Stoma verzorgen, materiaal wisselen", laag: "kern", sectoren: [], bigNiveau: 2 },
  { code: "VH-TRACHEOSTOMA", naam: "Tracheacanule", beschrijving: "Tracheacanule verzorgen en wisselen", laag: "kern", sectoren: [], bigNiveau: 3 },
  { code: "VH-BEADEMING", naam: "Beademing (non-invasief)", beschrijving: "CPAP/BiPAP instellen en bewaken", laag: "kern", sectoren: [], bigNiveau: 3 },
  { code: "VH-WOND-COMPLEX", naam: "Complexe wondzorg", beschrijving: "VAC-therapie, debridement, specialistische verbanden", laag: "kern", sectoren: [], bigNiveau: 3 },
] as const;

/**
 * Uitbreiding-competenties: veelvoorkomend in VVT, standaard beschikbaar.
 * Beheerder zet aan/uit per medewerker.
 */
export const UITBREIDING_COMPETENTIES: readonly Competentie[] = [
  { code: "UIT-DEMENTIE", naam: "Dementiezorg", beschrijving: "Omgang met dementie, validatie, belevingsgerichte zorg", laag: "uitbreiding", sectoren: ["vvt", "ghz"] },
  { code: "UIT-PALLIATIEF", naam: "Palliatieve zorg", beschrijving: "Symptoombestrijding, comfort care, stervensbegeleiding", laag: "uitbreiding", sectoren: ["vvt", "ghz", "ziekenhuis"] },
  { code: "UIT-WOND", naam: "Wondzorg (basis)", beschrijving: "Decubitus preventie en behandeling, wondassessment", laag: "uitbreiding", sectoren: ["vvt"] },
  { code: "UIT-DIABETES", naam: "Diabeteszorg", beschrijving: "Glucoseregulatie, insuline aanpassing, voetcontrole", laag: "uitbreiding", sectoren: ["vvt", "ziekenhuis"] },
  { code: "UIT-REVALIDATIE", naam: "Revalidatiezorg", beschrijving: "Mobilisatie, ADL-training, valpreventie", laag: "uitbreiding", sectoren: ["vvt", "revalidatie"] },
  { code: "UIT-PSYCHIATRIE", naam: "Psychiatrische zorg", beschrijving: "Omgaan met psychiatrische problematiek, deëscalatie", laag: "uitbreiding", sectoren: ["vvt", "ggz"] },
  { code: "UIT-GERIATRIE", naam: "Geriatrische expertise", beschrijving: "Multimorbiditeit, polyfarmacie, kwetsbare ouderen", laag: "uitbreiding", sectoren: ["vvt"] },
  { code: "UIT-TILLIFT", naam: "Tillift bediening", beschrijving: "Gecertificeerd gebruik van passieve en actieve tilliften", laag: "uitbreiding", sectoren: ["vvt", "ghz", "revalidatie"] },
  { code: "UIT-EHBO", naam: "EHBO / BLS", beschrijving: "Eerste hulp, reanimatie (BLS/AED gecertificeerd)", laag: "uitbreiding", sectoren: [] },
  { code: "UIT-MEDICATIE-BASIS", naam: "Medicatie delen (basis)", beschrijving: "Uitdelen en toedienen van niet-risicovolle medicatie", laag: "uitbreiding", sectoren: ["vvt", "ghz"] },
] as const;

/** All standard competencies (kern + uitbreiding) */
export const ALLE_STANDAARD_COMPETENTIES: readonly Competentie[] = [
  ...KERN_COMPETENTIES,
  ...UITBREIDING_COMPETENTIES,
] as const;

/** Get competencies for a specific sector */
export function getCompetentiesVoorSector(sector: string): Competentie[] {
  return ALLE_STANDAARD_COMPETENTIES.filter(
    (c) => c.sectoren.length === 0 || c.sectoren.includes(sector),
  );
}
