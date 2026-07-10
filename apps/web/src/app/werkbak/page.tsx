"use client";

import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@openzorg/shared-ui";

import AppShell from "../../components/AppShell";
import { FeatureGate } from "../../components/FeatureGate";

import { TaakKaart } from "./TaakKaart";
import { useWerkbak, type WerkbakScope } from "./useWerkbak";

/**
 * Werkbak — de persoonlijke taken-inbox (W1-3, spec §4.4).
 *
 * Drie tabbladen: "Mijn taken" (aan mij toegewezen), "Beschikbaar"
 * (onbeclaimd voor mijn rol) en — alleen voor oversight-rollen — "Alle
 * taken". Taken komen uit twee bronnen (Flowable-zorgpaden en FHIR-taken);
 * dat onderscheid is voor de gebruiker onzichtbaar en elke knop routeert
 * naar de juiste bron.
 */

const TAB_LABELS: Record<WerkbakScope, string> = {
  mijn: "Mijn taken",
  beschikbaar: "Beschikbaar",
  alle: "Alle taken",
};

const LEGE_STAAT: Record<WerkbakScope, { titel: string; uitleg: string }> = {
  mijn: {
    titel: "Je hebt geen openstaande taken",
    uitleg: "Alles is afgerond. Kijk bij Beschikbaar of er werk klaarstaat om op te pakken.",
  },
  beschikbaar: {
    titel: "Geen taken beschikbaar voor jouw rol",
    uitleg: "Er staan nu geen onbeclaimde taken klaar. Nieuwe taken verschijnen hier automatisch zodra een zorgpad een stap voor jouw rol bereikt.",
  },
  alle: {
    titel: "Geen openstaande taken in de organisatie",
    uitleg: "Alle lopende zorgpaden zijn bij. Nieuwe taken verschijnen hier zodra ze ontstaan.",
  },
};

export default function WerkbakPage() {
  return (
    <FeatureGate flag="workflow-engine">
      <WerkbakInner />
    </FeatureGate>
  );
}

function WerkbakInner() {
  const {
    eigenId,
    heeftOversight,
    scope,
    setScope,
    taken,
    aantallen,
    laden,
    fout,
    actieFout,
    bezigMet,
    herlaad,
    claim,
    geefTerug,
    voltooi,
  } = useWerkbak();

  const tabs: WerkbakScope[] = heeftOversight
    ? ["mijn", "beschikbaar", "alle"]
    : ["mijn", "beschikbaar"];
  const zichtbareTaken = taken[scope];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          titel="Werkbak"
          omschrijving="Taken uit lopende zorgpaden: oppakken, afronden of teruggeven."
        />

        {/* Tabs */}
        <div role="tablist" aria-label="Taken-filter" className="mb-5 mt-6 flex gap-1 rounded-xl border border-default bg-raised p-1">
          {tabs.map((tab) => {
            const actief = scope === tab;
            const aantal = aantallen[tab as keyof typeof aantallen];
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={actief}
                onClick={() => setScope(tab)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                  actief ? "bg-brand-600 text-white shadow-sm" : "text-fg-muted hover:bg-sunken"
                }`}
              >
                {TAB_LABELS[tab]}
                {typeof aantal === "number" && aantal > 0 && (
                  <span
                    className={`ml-2 inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      actief ? "bg-white/20 text-white" : "bg-sunken text-fg-subtle"
                    }`}
                  >
                    {aantal}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {actieFout && (
          <div className="mb-4">
            <ErrorState melding={actieFout} />
          </div>
        )}

        {laden ? (
          <LoadingSkeleton regels={6} />
        ) : fout ? (
          <ErrorState melding={fout} onOpnieuw={() => void herlaad()} />
        ) : zichtbareTaken.length === 0 ? (
          <EmptyState titel={LEGE_STAAT[scope].titel} uitleg={LEGE_STAAT[scope].uitleg} />
        ) : (
          <div className="stagger space-y-3">
            {zichtbareTaken.map((taak) => (
              <TaakKaart
                key={`${taak.bron}-${taak.id}`}
                taak={taak}
                eigenId={eigenId}
                bezig={bezigMet === taak.id}
                onClaim={() => void claim(taak)}
                onGeefTerug={() => void geefTerug(taak)}
                onVoltooi={(waarden) => voltooi(taak, waarden)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
