"use client";

import { EmptyState, LoadingSkeleton, PageHeader } from "@openzorg/shared-ui";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { workflowFetch } from "../../../lib/workflow-api";

/* ---------- Types ---------- */

interface TaskVar {
  name: string;
  label: string;
  type: "boolean" | "text" | "select" | "number";
  options?: Array<{ value: string; label: string }>;
}

type FormOptionsConfig = Record<string, Record<string, TaskVar[]>>;

/**
 * De proces/taak-taxonomie komt uit de proces-catalogus (W1-3) — de éne bron
 * van waarheid. De vorige hardcoded lijst hier bevatte taak-keys die niet in
 * de BPMN bestonden (bv. "analyse"), waardoor overrides nooit matchten.
 */
interface CatalogusStap {
  taskKey: string;
  naam: string;
  rol: string;
  velden: TaskVar[];
}

interface CatalogusProces {
  key: string;
  naam: string;
  stappen: CatalogusStap[];
}

/* ---------- Page ---------- */

export default function TaskFormOptionsPage() {
  const [processen, setProcessen] = useState<CatalogusProces[]>([]);
  const [config, setConfig] = useState<FormOptionsConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, catalogusRes] = await Promise.all([
      ecdFetch<{ config: FormOptionsConfig }>("/api/task-form-options"),
      workflowFetch<{ processen: CatalogusProces[] }>("/api/catalogus"),
    ]);
    setConfig(data?.config ?? {});
    const geladen = catalogusRes.data?.processen ?? [];
    setProcessen(geladen);
    setSelectedProcess((huidig) => huidig || (geladen[0]?.key ?? ""));
    setSelectedTask((huidig) => huidig || (geladen[0]?.stappen[0]?.taskKey ?? ""));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveAll() {
    setSaving(true);
    setSaveMsg(null);
    const { error } = await ecdFetch("/api/task-form-options", {
      method: "PUT",
      body: JSON.stringify({ config }),
    });
    setSaving(false);
    if (error) {
      setSaveMsg({ ok: false, text: `Opslaan mislukt: ${error}` });
    } else {
      setSaveMsg({ ok: true, text: "Alle overrides opgeslagen" });
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  const vars = config[selectedProcess]?.[selectedTask] ?? [];

  function updateVars(newVars: TaskVar[]) {
    setConfig({
      ...config,
      [selectedProcess]: {
        ...(config[selectedProcess] ?? {}),
        [selectedTask]: newVars,
      },
    });
  }

  function addVar() {
    updateVars([
      ...vars,
      { name: "nieuwVeld", label: "Nieuw veld", type: "text" },
    ]);
  }

  function removeVar(index: number) {
    updateVars(vars.filter((_, i) => i !== index));
  }

  function updateVar(index: number, patch: Partial<TaskVar>) {
    updateVars(vars.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function addOption(varIndex: number) {
    const v = vars[varIndex];
    if (!v) return;
    const options = [...(v.options ?? []), { value: "", label: "" }];
    updateVar(varIndex, { options });
  }

  function removeOption(varIndex: number, optIndex: number) {
    const v = vars[varIndex];
    if (!v?.options) return;
    updateVar(varIndex, { options: v.options.filter((_, i) => i !== optIndex) });
  }

  function updateOption(varIndex: number, optIndex: number, patch: { value?: string; label?: string }) {
    const v = vars[varIndex];
    if (!v?.options) return;
    const options = v.options.map((o, i) => (i === optIndex ? { ...o, ...patch } : o));
    updateVar(varIndex, { options });
  }

  const inputCls = "w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <PageHeader
            titel="Taakformulieren"
            omschrijving="Pas per zorgpad en per stap aan welke velden op het afrond-formulier in de werkbak staan. Jouw aanpassingen overrulen de standaardvelden — bijvoorbeeld een extra ernstniveau bij de MIC-afhandeling, zonder nieuwe release."
          />
        </div>

        {saveMsg && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              saveMsg.ok
                ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-300"
                : "border-coral-200 bg-coral-50 text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300"
            }`}
          >
            {saveMsg.text}
          </div>
        )}

        {loading ? (
          <LoadingSkeleton regels={8} />
        ) : processen.length === 0 ? (
          <EmptyState
            titel="Catalogus niet beschikbaar"
            uitleg="De zorgpad-catalogus kon niet geladen worden. Controleer of de workflow-service draait en probeer opnieuw."
            actieLabel="Opnieuw proberen"
            onActie={() => void load()}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            {/* Zorgpad + stap kiezer (uit de catalogus) */}
            <aside className="rounded-xl border border-default bg-raised p-4">
              <div className="mb-4">
                <label htmlFor="proces-kiezer" className="mb-1 block text-xs font-medium text-fg-muted">Zorgpad</label>
                <select
                  id="proces-kiezer"
                  value={selectedProcess}
                  onChange={(e) => {
                    setSelectedProcess(e.target.value);
                    const eersteStap = processen.find((p) => p.key === e.target.value)?.stappen[0]?.taskKey ?? "";
                    setSelectedTask(eersteStap);
                  }}
                  className={inputCls}
                >
                  {processen.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.naam}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-fg-muted">Stap</span>
                <div className="space-y-1">
                  {processen.find((p) => p.key === selectedProcess)?.stappen.map((stap) => (
                    <button
                      key={stap.taskKey}
                      type="button"
                      onClick={() => setSelectedTask(stap.taskKey)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selectedTask === stap.taskKey
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300"
                          : "text-fg-muted hover:bg-sunken"
                      }`}
                    >
                      {stap.naam}
                      {(config[selectedProcess]?.[stap.taskKey]?.length ?? 0) > 0 && (
                        <span className="ml-2 inline-flex items-center rounded bg-brand-600 px-1.5 py-0.5 text-xs font-medium text-white">
                          {config[selectedProcess]?.[stap.taskKey]?.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Variabelen-editor */}
            <div className="space-y-3">
              {vars.length === 0 ? (
                <div className="rounded-xl border border-dashed border-default bg-raised p-8 text-center">
                  <p className="text-sm text-fg-muted">Geen eigen velden voor deze stap.</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    Zonder aanpassing gebruikt de werkbak de standaardvelden:{" "}
                    {processen
                      .find((p) => p.key === selectedProcess)
                      ?.stappen.find((s) => s.taskKey === selectedTask)
                      ?.velden.map((v) => v.label)
                      .join(", ") ?? "—"}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={addVar}
                    className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                  >
                    + Veld toevoegen
                  </button>
                </div>
              ) : (
                <>
                  {vars.map((v, i) => (
                    <div key={i} className="rounded-xl border border-default bg-raised p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-fg-muted">Name (technisch)</label>
                              <input
                                type="text"
                                value={v.name}
                                onChange={(e) => updateVar(i, { name: e.target.value })}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-fg-muted">Label</label>
                              <input
                                type="text"
                                value={v.label}
                                onChange={(e) => updateVar(i, { label: e.target.value })}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-fg-muted">Type</label>
                              <select
                                value={v.type}
                                onChange={(e) => updateVar(i, { type: e.target.value as TaskVar["type"] })}
                                className={inputCls}
                              >
                                <option value="text">Tekst</option>
                                <option value="number">Getal</option>
                                <option value="boolean">Ja/Nee</option>
                                <option value="select">Dropdown</option>
                              </select>
                            </div>
                          </div>

                          {v.type === "select" && (
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-medium text-fg-muted">Opties</span>
                                <button
                                  type="button"
                                  onClick={() => addOption(i)}
                                  className="text-xs text-brand-600 hover:underline"
                                >
                                  + Optie
                                </button>
                              </div>
                              <div className="space-y-2">
                                {(v.options ?? []).map((opt, j) => (
                                  <div key={j} className="flex gap-2">
                                    <input
                                      type="text"
                                      value={opt.value}
                                      onChange={(e) => updateOption(i, j, { value: e.target.value })}
                                      placeholder="value (technisch)"
                                      className="flex-1 rounded-md border border-default bg-page px-2 py-1 font-mono text-xs text-fg"
                                    />
                                    <input
                                      type="text"
                                      value={opt.label}
                                      onChange={(e) => updateOption(i, j, { label: e.target.value })}
                                      placeholder="Weergave"
                                      className="flex-1 rounded-md border border-default bg-page px-2 py-1 text-xs text-fg"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeOption(i, j)}
                                      className="text-xs text-coral-600 hover:underline"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVar(i)}
                          className="text-xs text-coral-600 hover:text-coral-800"
                        >
                          Verwijderen
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addVar}
                    className="w-full rounded-lg border border-dashed border-default py-3 text-sm font-medium text-fg-muted hover:bg-sunken"
                  >
                    + Nog een veld toevoegen
                  </button>
                </>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={saving}
                  className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
                >
                  {saving ? "Opslaan..." : "Alle wijzigingen opslaan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
