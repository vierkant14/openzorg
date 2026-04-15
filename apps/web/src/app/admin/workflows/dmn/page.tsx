"use client";

import dynamic from "next/dynamic";

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
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">DMN Beslistabellen</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Visuele editor voor Decision Model & Notation (DMN). Gebruik beslistabellen
            voor business rules zoals "indicatie hoog → traject A". Experimentele feature —
            activeer via platform-instellingen.
          </p>
        </div>

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
