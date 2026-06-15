"use client";

import { getExtensionUrl } from "@openzorg/shared-domain";
import { EmptyState, ErrorState, LoadingSkeleton } from "@openzorg/shared-ui";

import {
  getGoalIdFromObservation,
  type FhirGoal,
  type FhirObservation,
} from "./useRapportages";

/** SOEP-velden met label en bijbehorende extensie-url-sleutel. */
const SOEP_VELDEN = [
  { label: "Subjectief", afkorting: "S", key: "soep-subjectief" },
  { label: "Objectief", afkorting: "O", key: "soep-objectief" },
  { label: "Evaluatie", afkorting: "E", key: "soep-evaluatie" },
  { label: "Plan", afkorting: "P", key: "soep-plan" },
] as const;

interface RapportageLijstProps {
  items: FhirObservation[];
  goalsById: Map<string, FhirGoal>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Of er momenteel een filter actief is — bepaalt de lege-staat-tekst. */
  heeftActieveFilter: boolean;
  onWisFilters: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Datum-helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Lokale kalenderdag-sleutel (jjjj-mm-dd) voor groepering. */
function dagSleutel(iso?: string): string {
  if (!iso) return "onbekend";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "onbekend";
  const jaar = d.getFullYear();
  const maand = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${jaar}-${maand}-${dag}`;
}

function tijdLabel(iso?: string): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

/** Dag-kop: "Vandaag" / "Gisteren" / NL-datum (bv. "donderdag 12 juni"). */
function dagKop(sleutel: string): string {
  if (sleutel === "onbekend") return "Onbekende datum";
  const vandaag = dagSleutel(new Date().toISOString());
  const gisterenDate = new Date();
  gisterenDate.setDate(gisterenDate.getDate() - 1);
  const gisteren = dagSleutel(gisterenDate.toISOString());

  if (sleutel === vandaag) return "Vandaag";
  if (sleutel === gisteren) return "Gisteren";

  const d = new Date(`${sleutel}T00:00:00`);
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

interface DagGroep {
  sleutel: string;
  items: FhirObservation[];
}

/** Groepeert (al aflopend gesorteerde) items per kalenderdag, nieuwste dag eerst. */
function groepeerPerDag(items: FhirObservation[]): DagGroep[] {
  const groepen: DagGroep[] = [];
  const index = new Map<string, DagGroep>();

  for (const obs of items) {
    const sleutel = dagSleutel(obs.effectiveDateTime);
    let groep = index.get(sleutel);
    if (!groep) {
      groep = { sleutel, items: [] };
      index.set(sleutel, groep);
      groepen.push(groep);
    }
    groep.items.push(obs);
  }

  // Binnen een dag nieuwste eerst.
  for (const groep of groepen) {
    groep.items.sort((a, b) =>
      (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""),
    );
  }
  // Dagen aflopend (nieuwste dag bovenaan).
  groepen.sort((a, b) => b.sleutel.localeCompare(a.sleutel));
  return groepen;
}

/* -------------------------------------------------------------------------- */
/*  Item                                                                      */
/* -------------------------------------------------------------------------- */

function RapportageItem({
  obs,
  goalsById,
}: {
  obs: FhirObservation;
  goalsById: Map<string, FhirGoal>;
}) {
  const type = obs.code?.text ?? "vrij";
  const isSoep = type.toLowerCase() === "soep";
  const goalId = getGoalIdFromObservation(obs);
  const linkedGoal = goalId ? goalsById.get(goalId) : undefined;

  return (
    <li className="rounded-lg border border-default bg-raised p-4">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-fg-subtle">{tijdLabel(obs.effectiveDateTime)}</span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
            isSoep
              ? "bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300"
              : "bg-surface-100 text-fg-muted dark:bg-surface-800"
          }`}
        >
          {isSoep ? "SOEP" : "Vrij"}
        </span>
        {linkedGoal && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-brand-50/50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950/20 dark:text-brand-300"
            title={linkedGoal.description?.text}
          >
            🎯 {linkedGoal.description?.text ?? "Doel"}
          </span>
        )}
      </div>
      {isSoep ? (
        <dl className="grid gap-1 text-sm">
          {SOEP_VELDEN.map(({ label, afkorting, key }) => {
            // Lees op extensie-url, niet op index: de backend schrijft alleen
            // ingevulde velden weg, dus een index zou verschuiven.
            const url = getExtensionUrl(key);
            const val = obs.extension?.find((e) => e.url === url)?.valueString;
            if (!val) return null;
            return (
              <div key={key} className="flex gap-2">
                <dt className="w-6 shrink-0 font-medium text-fg-muted" title={label}>
                  {afkorting}
                </dt>
                <dd className="text-fg">{val}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-sm text-fg">{obs.valueString ?? "-"}</p>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lijst                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Rapportagelijst, gegroepeerd per kalenderdag met dag-koppen
 * (Vandaag/Gisteren/NL-datum). Toont laad-, fout- en lege staten.
 */
export function RapportageLijst({
  items,
  goalsById,
  loading,
  error,
  onRetry,
  heeftActieveFilter,
  onWisFilters,
}: RapportageLijstProps) {
  if (loading) return <LoadingSkeleton regels={5} />;
  if (error) return <ErrorState melding={error} onOpnieuw={onRetry} />;
  if (items.length === 0) {
    // Onderscheid: niets door een actief filter vs. nog geen rapportages.
    return heeftActieveFilter ? (
      <EmptyState
        titel="Geen rapportages met deze filters"
        uitleg="Pas de filters aan of wis ze om alles te zien."
        actieLabel="Filters wissen"
        onActie={onWisFilters}
      />
    ) : (
      <EmptyState titel="Nog geen rapportages" uitleg="Schrijf hierboven je eerste rapportage." />
    );
  }

  const groepen = groepeerPerDag(items);

  return (
    <div className="space-y-6">
      {groepen.map((groep) => (
        <section key={groep.sleutel}>
          <h3 className="mb-2 text-sm font-semibold text-fg-muted">{dagKop(groep.sleutel)}</h3>
          <ul className="space-y-3">
            {groep.items.map((obs, i) => (
              <RapportageItem key={obs.id ?? `${groep.sleutel}-${i}`} obs={obs} goalsById={goalsById} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
