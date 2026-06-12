/**
 * Planning engine: validates staffing, suggests optimizations, generates rosters.
 *
 * Three modes:
 * 1. validate — check current staffing against requirements, return gaps
 * 2. optimize — fill gaps in a partial roster
 * 3. generate — create a full roster from scratch
 */

export interface Dienst {
  code: string;
  naam: string;
  start: string;
  eind: string;
}

export interface BezettingsEis {
  dienstCode: string;
  rollen: Array<{ competentie: string; minimum: number }>;
}

export interface Medewerker {
  id: string;
  naam: string;
  competenties: string[];
  contractUren: number;
  geplandUren: number; // already planned this week
}

export interface Toewijzing {
  medewerkerId: string;
  medewerkerNaam: string;
  dienstCode: string;
  datum: string; // ISO date
  orgId: string;
}

export interface BezettingsGap {
  datum: string;
  dienstCode: string;
  dienstNaam: string;
  orgId: string;
  orgNaam: string;
  competentie: string;
  vereist: number;
  ingepland: number;
  tekort: number;
  severity: "kritiek" | "waarschuwing"; // kritiek = 0 ingepland, waarschuwing = under minimum
}

export interface OptimalisatieSuggestie {
  medewerkerId: string;
  medewerkerNaam: string;
  datum: string;
  dienstCode: string;
  orgId: string;
  reden: string; // Dutch explanation
  score: number; // higher = better fit
}

/**
 * Mode 1: Validate current staffing.
 * Returns gaps where actual < required.
 */
export function validateBezetting(
  eisen: BezettingsEis[],
  toewijzingen: Toewijzing[],
  medewerkers: Medewerker[],
  dagen: string[],
  orgId: string,
  orgNaam: string,
  diensten: Dienst[],
): BezettingsGap[] {
  const gaps: BezettingsGap[] = [];

  for (const dag of dagen) {
    for (const eis of eisen) {
      const dienst = diensten.find((d) => d.code === eis.dienstCode);
      const dagToewijzingen = toewijzingen.filter(
        (t) => t.datum === dag && t.dienstCode === eis.dienstCode && t.orgId === orgId,
      );

      for (const rol of eis.rollen) {
        // Count how many assigned practitioners have this competency
        const ingepland = dagToewijzingen.filter((t) => {
          const mw = medewerkers.find((m) => m.id === t.medewerkerId);
          return mw?.competenties.includes(rol.competentie) ?? false;
        }).length;

        if (ingepland < rol.minimum) {
          gaps.push({
            datum: dag,
            dienstCode: eis.dienstCode,
            dienstNaam: dienst?.naam ?? eis.dienstCode,
            orgId,
            orgNaam,
            competentie: rol.competentie,
            vereist: rol.minimum,
            ingepland,
            tekort: rol.minimum - ingepland,
            severity: ingepland === 0 ? "kritiek" : "waarschuwing",
          });
        }
      }
    }
  }

  return gaps.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "kritiek" ? -1 : 1;
    return a.datum.localeCompare(b.datum);
  });
}

/**
 * Mode 2: Suggest practitioners to fill gaps.
 * Greedy: for each gap, find best available practitioner.
 */
export function optimaliseer(
  gaps: BezettingsGap[],
  beschikbareMedewerkers: Medewerker[],
  bestaandeToewijzingen: Toewijzing[],
): OptimalisatieSuggestie[] {
  const suggesties: OptimalisatieSuggestie[] = [];

  for (const gap of gaps) {
    // Find practitioners who:
    // 1. Have the required competency
    // 2. Are not already assigned to another shift on this day
    // 3. Have contract hours remaining
    const kandidaten = beschikbareMedewerkers
      .filter((mw) => mw.competenties.includes(gap.competentie))
      .filter((mw) => {
        const dagToewijzingen = bestaandeToewijzingen.filter(
          (t) => t.medewerkerId === mw.id && t.datum === gap.datum,
        );
        return dagToewijzingen.length === 0; // not yet planned on this day
      })
      .map((mw) => {
        // Score: higher = better fit
        let score = 50;
        // Prefer those with more contract hours remaining
        const urenOver = mw.contractUren - mw.geplandUren;
        score += Math.min(urenOver, 20);
        // Prefer those with more matching competencies (specialist)
        score += mw.competenties.length * 2;
        return { mw, score };
      })
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < gap.tekort && i < kandidaten.length; i++) {
      const k = kandidaten[i]!;
      suggesties.push({
        medewerkerId: k.mw.id,
        medewerkerNaam: k.mw.naam,
        datum: gap.datum,
        dienstCode: gap.dienstCode,
        orgId: gap.orgId,
        reden: `${k.mw.naam} heeft ${gap.competentie} en nog ${Math.round(k.mw.contractUren - k.mw.geplandUren)}u over deze week`,
        score: k.score,
      });
    }
  }

  return suggesties;
}

/**
 * Mode 3: Generate a full roster.
 * Calls validate to find all gaps, then optimaliseer to fill them.
 */
export function genereerRooster(
  eisen: BezettingsEis[],
  medewerkers: Medewerker[],
  dagen: string[],
  orgId: string,
  orgNaam: string,
  diensten: Dienst[],
): { toewijzingen: Toewijzing[]; onoplosbaar: BezettingsGap[] } {
  const toewijzingen: Toewijzing[] = [];
  const gebruiktPerDag: Map<string, Set<string>> = new Map();

  for (const dag of dagen) {
    gebruiktPerDag.set(dag, new Set());
  }

  // Greedy: iterate diensten by priority (nacht first — hardest to fill)
  const dienstPrioriteit = ["nacht", "laat", "vroeg", "dag", "weekend"];
  const gesorteerdeEisen = [...eisen].sort((a, b) => {
    const ai = dienstPrioriteit.indexOf(a.dienstCode);
    const bi = dienstPrioriteit.indexOf(b.dienstCode);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const dag of dagen) {
    for (const eis of gesorteerdeEisen) {
      for (const rol of eis.rollen) {
        let toegewezen = 0;
        const dagGebruikt = gebruiktPerDag.get(dag)!;

        // Sort candidates: prefer those with most contract hours remaining
        const kandidaten = medewerkers
          .filter((mw) => mw.competenties.includes(rol.competentie))
          .filter((mw) => !dagGebruikt.has(mw.id))
          .sort(
            (a, b) => b.contractUren - b.geplandUren - (a.contractUren - a.geplandUren),
          );

        while (toegewezen < rol.minimum && kandidaten.length > 0) {
          const mw = kandidaten.shift()!;
          toewijzingen.push({
            medewerkerId: mw.id,
            medewerkerNaam: mw.naam,
            dienstCode: eis.dienstCode,
            datum: dag,
            orgId,
          });
          dagGebruikt.add(mw.id);
          mw.geplandUren += 8; // approximate
          toegewezen++;
        }
      }
    }
  }

  // Validate: what couldn't be filled?
  const gaps = validateBezetting(
    eisen,
    toewijzingen,
    medewerkers,
    dagen,
    orgId,
    orgNaam,
    diensten,
  );

  return { toewijzingen, onoplosbaar: gaps };
}
