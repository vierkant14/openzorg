"use client";

import Link from "next/link";

import type { ProcesDefinitie } from "./types";

interface GeavanceerdPaneelProps {
  definities: ProcesDefinitie[];
  dmnBeschikbaar: boolean;
}

/**
 * Geavanceerd-tab: de enige plek waar engine-begrippen (key, versie, BPMN)
 * zichtbaar mogen zijn. Links naar de proces-ontwerper en beslisregels,
 * plus de rauwe definitie-tabel.
 */
export function GeavanceerdPaneel({ definities, dmnBeschikbaar }: GeavanceerdPaneelProps) {
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-fg-muted">
        Voor gevorderde beheerders: ontwerp eigen zorgpaden met de visuele proces-ontwerper
        (BPMN) of bekijk de technische procesdefinities. De sjablonen op de Sjablonen-tab
        volstaan voor de standaard zorgprocessen.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/workflows/canvas"
          className="rounded-xl border border-default bg-raised p-5 transition-shadow duration-200 hover:shadow-md"
        >
          <h3 className="text-base font-semibold text-fg">Proces-ontwerper</h3>
          <p className="mt-1 text-sm text-fg-muted">
            Teken of wijzig een zorgpad op het BPMN-canvas en activeer het voor jouw organisatie.
          </p>
        </Link>

        {dmnBeschikbaar && (
          <Link
            href="/admin/workflows/dmn"
            className="rounded-xl border border-default bg-raised p-5 transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-fg">Beslisregels</h3>
              <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                Experimenteel
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              Beslistabellen (DMN) verkennen. Opslaan naar de proces-engine staat op de roadmap.
            </p>
          </Link>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-fg">Technische procesdefinities</h3>
        {definities.length === 0 ? (
          <p className="text-sm text-fg-subtle">Geen definities voor deze organisatie.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-default bg-raised">
            <table className="min-w-full divide-y divide-default">
              <thead className="bg-page">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-subtle">Naam</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-subtle">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-subtle">Versie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {definities.map((definitie) => (
                  <tr key={definitie.id} className="hover:bg-sunken">
                    <td className="px-4 py-3 text-sm text-fg">{definitie.name || definitie.key}</td>
                    <td className="px-4 py-3 font-mono text-sm text-fg-muted">{definitie.key}</td>
                    <td className="px-4 py-3 text-sm text-fg-muted">{definitie.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
