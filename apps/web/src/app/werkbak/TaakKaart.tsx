"use client";

import Link from "next/link";
import { useState } from "react";

import { TaakFormulier } from "./TaakFormulier";
import type { WerkbakTaak } from "./useWerkbak";

/** Deadline-urgentie: kleur + label op basis van hoe dringend het is. */
function formatDeadline(iso?: string | null): { label: string; kleur: string } | null {
  if (!iso) return null;
  const deadline = new Date(iso);
  if (isNaN(deadline.getTime())) return null;
  const nu = new Date();
  const verschilMs = deadline.getTime() - nu.getTime();
  const verschilUren = Math.floor(verschilMs / (1000 * 60 * 60));
  const verschilDagen = Math.floor(verschilUren / 24);

  if (verschilMs < 0) {
    return {
      label: `Verlopen: ${Math.abs(verschilDagen)}d geleden`,
      kleur: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
    };
  }
  if (verschilUren < 24) {
    return {
      label: `Over ${verschilUren}u`,
      kleur: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    };
  }
  if (verschilDagen < 3) {
    return {
      label: `Over ${verschilDagen}d`,
      kleur: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    };
  }
  return {
    label: `Over ${verschilDagen}d`,
    kleur: "bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300",
  };
}

/** Cliënt-referentie ("Patient/abc") → dossier-route. */
function dossierRoute(clientRef?: string): string | null {
  const id = clientRef?.replace("Patient/", "");
  return id ? `/ecd/${id}` : null;
}

interface TaakKaartProps {
  taak: WerkbakTaak;
  eigenId: string | null;
  bezig: boolean;
  onClaim: () => void;
  onGeefTerug: () => void;
  onVoltooi: (waarden: Record<string, string>) => Promise<boolean>;
}

export function TaakKaart({ taak, eigenId, bezig, onClaim, onGeefTerug, onVoltooi }: TaakKaartProps) {
  const [formulierOpen, setFormulierOpen] = useState(false);

  const deadline = formatDeadline(taak.deadline);
  const dossier = dossierRoute(taak.clientRef);
  const isVanMij = !!taak.assignee && taak.assignee === eigenId;
  const isGeclaimd = !!taak.assignee;

  return (
    <div className="rounded-xl border border-default bg-raised p-5 transition-shadow duration-200 ease-out hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-950/20 dark:text-brand-300">
              {taak.procesNaam}
            </span>
            {!isGeclaimd && (
              <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                Beschikbaar
              </span>
            )}
            {deadline && (
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold ${deadline.kleur}`}
              >
                ⏰ {deadline.label}
              </span>
            )}
          </div>

          <h3 className="mt-1.5 text-base font-semibold text-fg">{taak.naam}</h3>
          {taak.omschrijving && <p className="mt-1 text-sm text-fg-muted">{taak.omschrijving}</p>}

          <p className="mt-1.5 text-xs text-fg-subtle">
            {dossier ? (
              <Link href={dossier} className="font-medium text-brand-600 hover:text-brand-800 hover:underline">
                {taak.clientNaam ?? "Cliëntdossier"}
              </Link>
            ) : (
              taak.clientNaam && <span>{taak.clientNaam}</span>
            )}
            {(dossier || taak.clientNaam) && " · "}
            Aangemaakt:{" "}
            {new Date(taak.aangemaakt).toLocaleString("nl-NL", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {isGeclaimd && (
              <>
                {" · "}
                Opgepakt door{" "}
                <span className="font-medium text-fg-muted">{isVanMij ? "jou" : "een collega"}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isGeclaimd && (
            <button
              onClick={onClaim}
              disabled={bezig}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 btn-press"
            >
              Oppakken
            </button>
          )}
          {isVanMij && taak.bron === "flowable" && (
            <button
              onClick={onGeefTerug}
              disabled={bezig}
              className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-sunken disabled:opacity-50 btn-press"
            >
              Teruggeven
            </button>
          )}
          {(isVanMij || !isGeclaimd) && (
            <button
              onClick={() => setFormulierOpen((open) => !open)}
              className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-sunken btn-press"
            >
              {formulierOpen ? "Inklappen" : "Afronden"}
            </button>
          )}
        </div>
      </div>

      {formulierOpen && (
        <TaakFormulier
          taak={taak}
          bezig={bezig}
          onVoltooi={async (waarden) => {
            const gelukt = await onVoltooi(waarden);
            if (gelukt) setFormulierOpen(false);
            return gelukt;
          }}
          onAnnuleer={() => setFormulierOpen(false)}
        />
      )}
    </div>
  );
}
