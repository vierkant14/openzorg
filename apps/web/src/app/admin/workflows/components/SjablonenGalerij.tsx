"use client";

import { EmptyState } from "@openzorg/shared-ui";
import { useState } from "react";

import { workflowFetch } from "../../../../lib/workflow-api";

import type { CatalogusProces, ProcesDefinitie } from "./types";

interface SjablonenGalerijProps {
  catalogus: CatalogusProces[];
  definities: ProcesDefinitie[];
  onGeactiveerd: () => void;
}

/**
 * Sjablonen-tab: de zorgpad-galerij. "Activeren" deployt de template voor
 * déze organisatie (per-tenant, W1-1); al-geactiveerde zorgpaden tonen hun
 * versie. Vervangt de oude statische voorbeelden-pagina én de "Deployen"-
 * kaarten met engine-jargon.
 */
export function SjablonenGalerij({ catalogus, definities, onGeactiveerd }: SjablonenGalerijProps) {
  const [bezigMet, setBezigMet] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [openStappen, setOpenStappen] = useState<string | null>(null);

  const versiePerKey = new Map(definities.map((d) => [d.key, d.version]));

  async function activeer(key: string) {
    setFout(null);
    setBezigMet(key);
    const { error } = await workflowFetch(`/api/bpmn-templates/${key}/deploy`, { method: "POST" });
    setBezigMet(null);
    if (error) {
      setFout(error);
      return;
    }
    onGeactiveerd();
  }

  if (catalogus.length === 0) {
    return (
      <EmptyState
        titel="Geen zorgpad-sjablonen beschikbaar"
        uitleg="De sjablonen-catalogus kon niet geladen worden. Probeer het later opnieuw."
      />
    );
  }

  return (
    <div>
      <p className="mb-5 max-w-3xl text-sm text-fg-muted">
        Een zorgpad is een vast proces met stappen en verantwoordelijke rollen — bijvoorbeeld de
        intake van een nieuwe cliënt. Activeer een sjabloon om het voor jouw organisatie te
        gebruiken; taken verschijnen daarna automatisch in de werkbak van de juiste rol.
      </p>

      {fout && (
        <p role="alert" className="mb-4 rounded-lg border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300">
          {fout}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {catalogus.map((proces) => {
          const versie = versiePerKey.get(proces.key);
          const geactiveerd = versie !== undefined;
          const stappenOpen = openStappen === proces.key;

          return (
            <div key={proces.key} className="rounded-xl border border-default bg-raised p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-fg">{proces.naam}</h3>
                {geactiveerd && (
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                    Actief · v{versie}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-fg-muted">{proces.omschrijving}</p>
              <p className="mt-2 text-xs text-fg-subtle">{proces.trigger}</p>

              <button
                type="button"
                onClick={() => setOpenStappen(stappenOpen ? null : proces.key)}
                className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-800"
                aria-expanded={stappenOpen}
              >
                {stappenOpen ? "Verberg stappen" : `Bekijk stappen (${proces.stappen.length})`}
              </button>

              {stappenOpen && (
                <ol className="mt-3 space-y-2 border-l-2 border-brand-100 pl-4 dark:border-brand-900">
                  {proces.stappen.map((stap, i) => (
                    <li key={stap.taskKey} className="text-sm">
                      <span className="font-medium text-fg">
                        {i + 1}. {stap.naam}
                      </span>
                      <span className="ml-2 inline-flex items-center rounded bg-sunken px-1.5 py-0.5 text-xs text-fg-subtle">
                        {stap.rol}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-4">
                {geactiveerd ? (
                  <span className="text-sm text-fg-subtle">
                    Dit zorgpad is actief voor jouw organisatie.
                  </span>
                ) : (
                  <button
                    onClick={() => void activeer(proces.key)}
                    disabled={bezigMet === proces.key}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 btn-press"
                  >
                    {bezigMet === proces.key ? "Activeren…" : "Activeren"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
