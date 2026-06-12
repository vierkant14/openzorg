/**
 * Zorgzwaarte → FTE calculator.
 *
 * Sector-neutral interface with VVT implementation.
 * Other sectors (GGZ, GHZ) implement the same interface later.
 */

export interface ZorgzwaarteClient {
  id: string;
  zorgzwaarteKlasse: string; // "VV1", "VV5", "VV10", etc.
}

export interface ZorgzwaarteFTE {
  totaalFTE: number;
  perDienst: {
    vroeg: number;
    laat: number;
    nacht: number;
  };
  details: string; // Human-readable explanation
}

/** Default VVT factors: ZZP class → FTE per client per day */
const VVT_ZORGZWAARTE_FACTOREN: Record<string, number> = {
  VV1: 0.3,
  VV2: 0.4,
  VV3: 0.5,
  VV4: 0.7,
  VV5: 0.8,
  VV6: 0.9,
  VV7: 1.0,
  VV8: 1.1,
  VV9: 1.2,
  VV10: 1.4,
};

/** Default dienst-verdeling (% of total FTE per shift) */
const DEFAULT_DIENSTVERDELING = { vroeg: 0.4, laat: 0.35, nacht: 0.25 };

export function berekenZorgzwaarteFTE(
  clienten: ZorgzwaarteClient[],
  factoren?: Record<string, number>,
  dienstverdeling?: { vroeg: number; laat: number; nacht: number },
): ZorgzwaarteFTE {
  const f = factoren ?? VVT_ZORGZWAARTE_FACTOREN;
  const d = dienstverdeling ?? DEFAULT_DIENSTVERDELING;

  let totaal = 0;
  const perKlasse: Record<string, number> = {};

  for (const c of clienten) {
    const factor = f[c.zorgzwaarteKlasse] ?? 0.5;
    totaal += factor;
    perKlasse[c.zorgzwaarteKlasse] = (perKlasse[c.zorgzwaarteKlasse] ?? 0) + 1;
  }

  const details = Object.entries(perKlasse)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([klasse, aantal]) => `${aantal}x ${klasse}`)
    .join(", ");

  return {
    totaalFTE: Math.round(totaal * 10) / 10,
    perDienst: {
      vroeg: Math.round(totaal * d.vroeg * 10) / 10,
      laat: Math.round(totaal * d.laat * 10) / 10,
      nacht: Math.round(totaal * d.nacht * 10) / 10,
    },
    details: `${clienten.length} cliënten (${details}) → ${Math.round(totaal * 10) / 10} FTE aanbevolen`,
  };
}
