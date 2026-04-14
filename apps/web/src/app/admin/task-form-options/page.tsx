"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

/* ---------- Types ---------- */

interface TaskVar {
  name: string;
  label: string;
  type: "boolean" | "text" | "select" | "number";
  options?: Array<{ value: string; label: string }>;
}

type FormOptionsConfig = Record<string, Record<string, TaskVar[]>>;

/* ---------- Pre-baked process/task lijst ---------- */

const PROCESSES = [
  {
    key: "intake-proces",
    label: "Intake Proces",
    tasks: [
      { key: "aanmeldingBeoordelen", label: "Aanmelding beoordelen" },
      { key: "intakeGesprekPlannen", label: "Intake gesprek plannen" },
      { key: "afwijzingCommuniceren", label: "Afwijzing communiceren" },
    ],
  },
  {
    key: "zorgplan-evaluatie",
    label: "Zorgplan Evaluatie",
    tasks: [
      { key: "voorbereiding", label: "Voorbereiding" },
      { key: "mdoPlannen", label: "MDO plannen" },
      { key: "mdoUitvoeren", label: "MDO uitvoeren" },
      { key: "evaluatieVastleggen", label: "Evaluatie vastleggen" },
      { key: "zorgplanBijstellen", label: "Zorgplan bijstellen" },
    ],
  },
  {
    key: "mic-afhandeling",
    label: "MIC Afhandeling",
    tasks: [
      { key: "analyse", label: "Analyse" },
      { key: "maatregelenBepalen", label: "Maatregelen bepalen" },
      { key: "uitvoeren", label: "Uitvoeren" },
      { key: "evalueren", label: "Evalueren" },
    ],
  },
  {
    key: "herindicatie",
    label: "Herindicatie",
    tasks: [
      { key: "signaleringControleren", label: "Signalering controleren" },
      { key: "gegevensActualiseren", label: "Gegevens actualiseren" },
      { key: "aanvraagIndienen", label: "Aanvraag indienen" },
    ],
  },
] as const;

/* ---------- Page ---------- */

export default function TaskFormOptionsPage() {
  const [config, setConfig] = useState<FormOptionsConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<string>(PROCESSES[0]?.key ?? "");
  const [selectedTask, setSelectedTask] = useState<string>(PROCESSES[0]?.tasks[0]?.key ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await ecdFetch<{ config: FormOptionsConfig }>("/api/task-form-options");
    setConfig(data?.config ?? {});
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
          <h1 className="text-2xl font-bold text-fg">Task form opties (Laag 2)</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Pas per proces en per taak aan welke velden er op het werkbak-completion-formulier staan.
            Dit overrulet de standaard-velden uit code. Voeg bv. ernstniveau 'middel' toe aan de MIC-afhandeling zonder nieuwe release.
          </p>
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
          <div className="py-12 text-center text-fg-muted">Laden...</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            {/* Proces + task kiezer */}
            <aside className="rounded-xl border border-default bg-raised p-4">
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-fg-muted">Proces</label>
                <select
                  value={selectedProcess}
                  onChange={(e) => {
                    setSelectedProcess(e.target.value);
                    const firstTask = PROCESSES.find((p) => p.key === e.target.value)?.tasks[0]?.key ?? "";
                    setSelectedTask(firstTask);
                  }}
                  className={inputCls}
                >
                  {PROCESSES.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">Taak</label>
                <div className="space-y-1">
                  {PROCESSES.find((p) => p.key === selectedProcess)?.tasks.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSelectedTask(t.key)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selectedTask === t.key
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300"
                          : "text-fg-muted hover:bg-sunken"
                      }`}
                    >
                      {t.label}
                      {config[selectedProcess]?.[t.key]?.length && (
                        <span className="ml-2 inline-flex items-center rounded bg-brand-600 px-1.5 py-0.5 text-xs font-medium text-white">
                          {config[selectedProcess]?.[t.key]?.length}
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
                  <p className="text-sm text-fg-muted">Geen custom velden voor deze taak.</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    Zonder override gebruikt de werkbak de default-velden uit de code.
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
