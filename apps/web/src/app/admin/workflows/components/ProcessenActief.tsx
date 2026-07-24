"use client";

import { EmptyState } from "@openzorg/shared-ui";
import { useState } from "react";

import { workflowFetch } from "../../../../lib/workflow-api";

import { processKeyVanDefinitie, type CatalogusProces, type ProcesDefinitie, type ProcesInstantie } from "./types";

interface ProcessenActiefProps {
  catalogus: CatalogusProces[];
  definities: ProcesDefinitie[];
  instanties: ProcesInstantie[];
  onGestart: () => void;
  naarSjablonen: () => void;
  naarLopend: () => void;
}

/**
 * Actief-tab: welke zorgpaden draaien er voor deze organisatie, hoeveel
 * instanties lopen er, en per zorgpad de stappen in gewone taal.
 */
export function ProcessenActief({ catalogus, definities, instanties, onGestart, naarSjablonen, naarLopend }: ProcessenActiefProps) {
  const [bezigMet, setBezigMet] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [openStappen, setOpenStappen] = useState<string | null>(null);

  const catalogusOpKey = new Map(catalogus.map((p) => [p.key, p]));

  const lopendPerKey = new Map<string, number>();
  for (const instantie of instanties) {
    const key = processKeyVanDefinitie(instantie.processDefinitionId);
    lopendPerKey.set(key, (lopendPerKey.get(key) ?? 0) + 1);
  }

  async function startProef(key: string, naam: string) {
    setFout(null);
    setMelding(null);
    setBezigMet(key);
    const { error } = await workflowFetch(`/api/processen/${key}/start`, {
      method: "POST",
      body: JSON.stringify({
        variables: { proef: true, clientNaam: "Proefcliënt (test)" },
      }),
    });
    setBezigMet(null);
    if (error) {
      setFout(error);
      return;
    }
    setMelding(`Proefinstantie van "${naam}" gestart — de eerste taak staat nu in de werkbak van de verantwoordelijke rol.`);
    onGestart();
  }

  if (definities.length === 0) {
    return (
      <EmptyState
        titel="Nog geen zorgpaden actief"
        uitleg="Activeer een zorgpad-sjabloon om taken automatisch in de werkbak van je team te laten verschijnen."
        actieLabel="Naar sjablonen"
        onActie={naarSjablonen}
      />
    );
  }

  return (
    <div>
      {melding && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
          {melding}
        </p>
      )}
      {fout && (
        <p role="alert" className="mb-4 rounded-lg border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300">
          {fout}
        </p>
      )}

      <div className="space-y-3">
        {definities.map((definitie) => {
          const proces = catalogusOpKey.get(definitie.key);
          const lopend = lopendPerKey.get(definitie.key) ?? 0;
          const stappenOpen = openStappen === definitie.key;

          return (
            <div key={definitie.id} className="rounded-xl border border-default bg-raised p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-fg">
                      {proces?.naam ?? definitie.name ?? definitie.key}
                    </h3>
                    {!proces && (
                      <span className="inline-flex items-center rounded bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-navy-700 dark:bg-navy-950/30 dark:text-navy-300">
                        Eigen proces
                      </span>
                    )}
                    <span className="text-xs text-fg-subtle">v{definitie.version}</span>
                  </div>
                  {proces && <p className="mt-1 text-sm text-fg-muted">{proces.omschrijving}</p>}
                  <p className="mt-1.5 text-xs">
                    {lopend === 0 ? (
                      <span className="text-fg-subtle">Geen lopende instanties</span>
                    ) : (
                      <button
                        type="button"
                        onClick={naarLopend}
                        className="font-medium text-brand-600 hover:text-brand-800 hover:underline"
                      >
                        {lopend === 1 ? "1 lopende instantie" : `${lopend} lopende instanties`} →
                      </button>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {proces && (
                    <button
                      type="button"
                      onClick={() => setOpenStappen(stappenOpen ? null : definitie.key)}
                      className="rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-sunken btn-press"
                      aria-expanded={stappenOpen}
                    >
                      {stappenOpen ? "Verberg stappen" : "Bekijk stappen"}
                    </button>
                  )}
                  <button
                    onClick={() => void startProef(definitie.key, proces?.naam ?? definitie.key)}
                    disabled={bezigMet === definitie.key}
                    className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 btn-press dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-300 dark:hover:bg-brand-950/40"
                  >
                    {bezigMet === definitie.key ? "Starten…" : "Start proefinstantie"}
                  </button>
                </div>
              </div>

              {stappenOpen && proces && (
                <ol className="mt-4 space-y-2 border-l-2 border-brand-100 pl-4 dark:border-brand-900">
                  {proces.stappen.map((stap, i) => (
                    <li key={stap.taskKey} className="text-sm">
                      <span className="font-medium text-fg">
                        {i + 1}. {stap.naam}
                      </span>
                      <span className="ml-2 inline-flex items-center rounded bg-sunken px-1.5 py-0.5 text-xs text-fg-subtle">
                        {stap.rol}
                      </span>
                      {stap.velden.length > 0 && (
                        <span className="ml-2 text-xs text-fg-subtle">
                          formulier: {stap.velden.map((v) => v.label).join(", ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
