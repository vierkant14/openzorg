"use client";

import { ErrorState } from "@openzorg/shared-ui";
import { useCallback, useState } from "react";

import AppShell from "../../components/AppShell";
import { isFeatureEnabled } from "../../lib/features";

import { ActiviteitenFeed } from "./components/ActiviteitenFeed";
import { SignaleringenCard } from "./components/SignaleringenCard";
import { SnelleActies } from "./components/SnelleActies";
import { TakenTeller } from "./components/TakenTeller";
import { WelkomKop } from "./components/WelkomKop";

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardInhoud />
    </AppShell>
  );
}

/**
 * Startpagina van de team-werkruimte: begroeting, snelle acties per rol en
 * drie datasecties. Elke sectie degradeert stil bij een fout; alleen wanneer
 * álle datasecties falen tonen we één herstelbare foutstaat.
 */
function DashboardInhoud() {
  const workflowActief = isFeatureEnabled("workflow-engine");
  // Uitkomst per datasectie: true = geladen (of bewust verborgen), false = fout.
  const [uitkomsten, setUitkomsten] = useState<Record<string, boolean>>({});
  const [poging, setPoging] = useState(0);

  const meld = useCallback((sectie: string, gelukt: boolean) => {
    setUitkomsten((vorige) =>
      vorige[sectie] === gelukt ? vorige : { ...vorige, [sectie]: gelukt },
    );
  }, []);
  const meldTaken = useCallback((gelukt: boolean) => meld("taken", gelukt), [meld]);
  const meldSignaleringen = useCallback(
    (gelukt: boolean) => meld("signaleringen", gelukt),
    [meld],
  );
  const meldActiviteiten = useCallback((gelukt: boolean) => meld("activiteiten", gelukt), [meld]);

  const herlaad = useCallback(() => {
    setUitkomsten({});
    setPoging((p) => p + 1);
  }, []);

  const verwachteSecties = workflowActief ? 3 : 2;
  const gemeld = Object.values(uitkomsten);
  const allesFaalt = gemeld.length >= verwachteSecties && gemeld.every((gelukt) => !gelukt);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <WelkomKop />

      <div className="mt-6">
        <SnelleActies />
      </div>

      {allesFaalt ? (
        <div className="mt-6">
          <ErrorState
            melding="Het overzicht kan nu niet geladen worden. Controleer je verbinding en probeer het opnieuw."
            onOpnieuw={herlaad}
          />
        </div>
      ) : (
        <div key={poging} className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {workflowActief && <TakenTeller onResultaat={meldTaken} />}
            <SignaleringenCard onResultaat={meldSignaleringen} />
          </div>
          <ActiviteitenFeed onResultaat={meldActiviteiten} />
        </div>
      )}
    </div>
  );
}
