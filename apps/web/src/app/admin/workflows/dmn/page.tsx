"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import AppShell from "../../../../components/AppShell";
import { FeatureGate } from "../../../../components/FeatureGate";

const DmnEditor = dynamic(
  () => import("./DmnEditor").then((m) => m.DmnEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-xl border border-default bg-raised text-sm text-fg-muted">
        DMN-editor laden...
      </div>
    ),
  },
);

export default function DmnPage() {
  return (
    <FeatureGate flag="dmn-editor">
      <DmnInner />
    </FeatureGate>
  );
}

function DmnInner() {
  const [showUitleg, setShowUitleg] = useState(true);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">DMN Beslistabellen</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Visuele editor voor Decision Model & Notation (DMN). Gebruik beslistabellen
            voor business rules zoals &ldquo;indicatie hoog → traject A&rdquo;. Experimentele feature —
            activeer via platform-instellingen.
          </p>
        </div>

        {/* ── DMN Uitleg panel ── */}
        {showUitleg && (
          <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/30 p-5 dark:border-brand-800 dark:bg-brand-950/10">
            <div className="flex items-start justify-between">
              <h2 className="text-sm font-semibold text-brand-800 dark:text-brand-200">
                Wat zijn DMN beslistabellen?
              </h2>
              <button
                onClick={() => setShowUitleg(false)}
                className="ml-4 text-brand-400 hover:text-brand-600 dark:hover:text-brand-200 transition-colors"
                aria-label="Uitleg sluiten"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-sm text-brand-700 dark:text-brand-300">
              DMN (Decision Model &amp; Notation) tabellen helpen bij het automatiseren van beslissingen.
              Definieer inputs, outputs en regels in een overzichtelijke tabel — het systeem past
              de juiste regel automatisch toe.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-brand-100 bg-raised p-3 dark:border-brand-900">
                <p className="text-xs font-semibold text-fg mb-1">Voorbeeld 1: ZZP-klasse bepalen</p>
                <p className="text-xs text-fg-muted">
                  <strong>Input:</strong> zorgzwaarte, diagnoses<br />
                  <strong>Output:</strong> ZZP-klasse<br />
                  &ldquo;Welke ZZP-klasse past bij deze client?&rdquo; — de beslistabel
                  koppelt automatisch de juiste klasse op basis van clientgegevens.
                </p>
              </div>
              <div className="rounded-lg border border-brand-100 bg-raised p-3 dark:border-brand-900">
                <p className="text-xs font-semibold text-fg mb-1">Voorbeeld 2: MIC-melding escalatie</p>
                <p className="text-xs text-fg-muted">
                  <strong>Input:</strong> ernst, type melding<br />
                  <strong>Output:</strong> actie (bijv. escaleren, informeren)<br />
                  &ldquo;Moet deze melding geescaleerd worden?&rdquo; — de tabel bepaalt
                  welke actie nodig is op basis van de ernst en het type.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-brand-600 dark:text-brand-400">
              DMN-tabellen kunnen gekoppeld worden aan BPMN-workflows via het{" "}
              <a href="/admin/workflows" className="underline hover:text-brand-800 dark:hover:text-brand-200">
                workflow canvas
              </a>
              . Gebruik een Business Rule Task in je BPMN-diagram om een beslistabel aan te roepen.
            </p>
          </div>
        )}

        <div className="h-[600px]">
          <DmnEditor />
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-800 dark:bg-amber-950/10">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <strong>Status:</strong> minimale DMN-viewer/-editor aanwezig. Save-to-Flowable
            koppeling volgt in een volgende iteratie. Voor nu kun je de tabel bewerken en
            het resultaat kopiëren naar je workflow canvas als gateway-conditie.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
