"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import AppShell from "../../../../components/AppShell";
import { workflowFetch } from "../../../../lib/workflow-api";

const BpmnEditor = dynamic(
  () => import("./BpmnEditor").then((m) => m.BpmnEditor),
  { ssr: false, loading: () => <div className="p-8 text-sm text-fg-muted">BPMN-editor laden...</div> },
);

export default function BpmnCanvasPage() {
  const [lastXml, setLastXml] = useState<string | null>(null);
  const [processKey, setProcessKey] = useState("nieuw-proces");
  const [processName, setProcessName] = useState("Nieuw proces");
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleDeploy() {
    if (!lastXml) {
      setResult({ ok: false, message: "Eerst op 'Exporteer BPMN XML' klikken in de editor." });
      return;
    }
    setDeploying(true);
    setResult(null);
    const { error } = await workflowFetch("/api/processen/deploy", {
      method: "POST",
      body: JSON.stringify({ xml: lastXml, name: processKey }),
    });
    setDeploying(false);
    if (error) {
      setResult({ ok: false, message: `Deploy mislukt: ${error}` });
    } else {
      setResult({ ok: true, message: `Proces '${processName}' is gedeployed naar Flowable.` });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-fg">Workflow canvas (BPMN)</h1>
            <p className="mt-1 text-sm text-fg-muted">
              Experimentele visuele editor — sleep elementen op het canvas, exporteer als BPMN XML en deploy naar Flowable.
            </p>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Proces-key (technisch, uniek)</label>
            <input
              type="text"
              value={processKey}
              onChange={(e) => setProcessKey(e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase())}
              className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Weergavenaam</label>
            <input
              type="text"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
            />
          </div>
        </div>

        <div className="h-[600px]">
          <BpmnEditor onSaved={(xml) => setLastXml(xml)} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleDeploy}
            disabled={!lastXml || deploying}
            className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
          >
            {deploying ? "Deployen..." : "Deploy naar Flowable"}
          </button>
          {lastXml && <span className="text-xs text-fg-subtle">BPMN XML klaar ({lastXml.length} bytes)</span>}
        </div>

        {result && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              result.ok
                ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-300"
                : "border-coral-200 bg-coral-50 text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300"
            }`}
          >
            {result.message}
          </div>
        )}
      </div>
    </AppShell>
  );
}
