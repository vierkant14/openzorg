"use client";

import { EmptyState } from "@openzorg/shared-ui";
import Link from "next/link";
import { useId, useState } from "react";

import { workflowFetch } from "../../../../lib/workflow-api";

import {
  instantieVariabele,
  processKeyVanDefinitie,
  type CatalogusProces,
  type InstantieTaak,
  type ProcesInstantie,
} from "./types";

interface LopendeZorgpadenProps {
  catalogus: CatalogusProces[];
  instanties: ProcesInstantie[];
  takenPerInstantie: Map<string, InstantieTaak[]>;
  onGewijzigd: () => void;
}

/**
 * Lopend-tab: per lopend zorgpad de cliënt, de huidige stap en wie aan zet
 * is, met annuleren-met-reden. Vervangt de oude instanties-pagina die
 * dubbel kapot was (lege lijst + lege taken).
 */
export function LopendeZorgpaden({ catalogus, instanties, takenPerInstantie, onGewijzigd }: LopendeZorgpadenProps) {
  const redenId = useId();
  const [annuleerOpen, setAnnuleerOpen] = useState<string | null>(null);
  const [reden, setReden] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const catalogusOpKey = new Map(catalogus.map((p) => [p.key, p]));

  async function annuleer(instantieId: string) {
    if (!reden.trim()) {
      setFout("Geef een reden op voor het annuleren.");
      return;
    }
    setFout(null);
    setBezig(true);
    const { error } = await workflowFetch(`/api/processen/instances/${instantieId}`, {
      method: "DELETE",
      body: JSON.stringify({ reden: reden.trim() }),
    });
    setBezig(false);
    if (error) {
      setFout(error);
      return;
    }
    setAnnuleerOpen(null);
    setReden("");
    onGewijzigd();
  }

  if (instanties.length === 0) {
    return (
      <EmptyState
        titel="Er lopen nu geen zorgpaden"
        uitleg="Zodra een zorgpad start — automatisch of via een proefinstantie — zie je hier de voortgang per cliënt."
      />
    );
  }

  return (
    <div>
      {fout && (
        <p role="alert" className="mb-4 rounded-lg border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300">
          {fout}
        </p>
      )}

      <div className="space-y-3">
        {instanties.map((instantie) => {
          const key = processKeyVanDefinitie(instantie.processDefinitionId);
          const proces = catalogusOpKey.get(key);
          const taken = takenPerInstantie.get(instantie.id) ?? [];
          const huidigeTaak = taken[0];
          const stapNaam =
            huidigeTaak?.name ??
            (taken.length === 0 ? "Wacht op systeem-stap" : undefined);
          const clientNaam = instantieVariabele(instantie, "clientNaam");
          const clientRef = instantieVariabele(instantie, "clientRef");
          // Triggers leveren een kale clientId; handmatige starts een clientRef
          const clientId =
            clientRef?.replace("Patient/", "") ?? instantieVariabele(instantie, "clientId");
          const isAnnuleren = annuleerOpen === instantie.id;

          return (
            <div key={instantie.id} className="rounded-xl border border-default bg-raised p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-950/20 dark:text-brand-300">
                      {proces?.naam ?? key ?? "Zorgpad"}
                    </span>
                    {instantie.startTime && (
                      <span className="text-xs text-fg-subtle">
                        Gestart{" "}
                        {new Date(instantie.startTime).toLocaleString("nl-NL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-sm text-fg">
                    {clientId ? (
                      <Link href={`/ecd/${clientId}`} className="font-medium text-brand-600 hover:text-brand-800 hover:underline">
                        {clientNaam ?? "Cliëntdossier"}
                      </Link>
                    ) : (
                      <span className="font-medium">{clientNaam ?? "Zonder cliënt"}</span>
                    )}
                  </p>

                  <p className="mt-1 text-sm text-fg-muted">
                    Huidige stap: <span className="font-medium text-fg">{stapNaam ?? "—"}</span>
                    {huidigeTaak && (
                      <span className="ml-2 text-xs text-fg-subtle">
                        {huidigeTaak.assignee ? "opgepakt" : "wacht op oppakken"}
                      </span>
                    )}
                    {taken.length > 1 && (
                      <span className="ml-2 text-xs text-fg-subtle">(+{taken.length - 1} parallelle taak)</span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAnnuleerOpen(isAnnuleren ? null : instantie.id);
                    setReden("");
                    setFout(null);
                  }}
                  className="shrink-0 rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-sunken btn-press"
                >
                  {isAnnuleren ? "Toch niet" : "Annuleren"}
                </button>
              </div>

              {isAnnuleren && (
                <div className="mt-4 border-t border-default pt-4">
                  <label htmlFor={`${redenId}-${instantie.id}`} className="mb-1 block text-xs font-medium text-fg-muted">
                    Reden voor annuleren <span className="text-coral-600">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`${redenId}-${instantie.id}`}
                      type="text"
                      value={reden}
                      onChange={(e) => setReden(e.target.value)}
                      placeholder="Bijv. dubbel gestart, cliënt uitgeschreven…"
                      className="flex-1 rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none"
                    />
                    <button
                      onClick={() => void annuleer(instantie.id)}
                      disabled={bezig}
                      className="rounded-lg bg-coral-600 px-4 py-2 text-sm font-medium text-white hover:bg-coral-700 disabled:opacity-50 btn-press"
                    >
                      {bezig ? "Annuleren…" : "Zorgpad annuleren"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
