"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../components/AppShell";
import { getUserRole } from "../../lib/api";
import { workflowFetch } from "../../lib/workflow-api";

/* ---------- Types ---------- */

interface WorkflowTask {
  id: string;
  name: string;
  description?: string;
  createTime: string;
  assignee?: string;
  processDefinitionId?: string;
  processInstanceId?: string;
  taskDefinitionKey?: string;
  variables?: Array<{ name: string; value: unknown }>;
}

interface TasksResponse {
  data: WorkflowTask[];
  total: number;
}

/* ---------- Process variable definitions ---------- */

interface TaskVar {
  name: string;
  label: string;
  type: "boolean" | "text" | "select";
  options?: Array<{ value: string; label: string }>;
}

/** Map process definition keys to their gateway variables */
const PROCESS_VARS: Record<string, TaskVar[]> = {
  "intake-proces": [
    { name: "goedgekeurd", label: "Goedgekeurd?", type: "boolean" },
    { name: "opmerking", label: "Opmerking", type: "text" },
  ],
  "zorgplan-evaluatie": [
    { name: "bijstellingNodig", label: "Bijstelling nodig?", type: "boolean" },
    { name: "opmerking", label: "Opmerking", type: "text" },
  ],
  "herindicatie": [
    { name: "herindicatieNodig", label: "Herindicatie nodig?", type: "boolean" },
    { name: "opmerking", label: "Opmerking", type: "text" },
  ],
  "mic-afhandeling": [
    { name: "ernstNiveau", label: "Ernst niveau", type: "select", options: [
      { value: "laag", label: "Laag" },
      { value: "hoog", label: "Hoog" },
    ]},
    { name: "opmerking", label: "Opmerking", type: "text" },
  ],
  "vaccinatie-campagne": [
    { name: "opmerking", label: "Opmerking", type: "text" },
  ],
};

function getProcessKey(processDefinitionId?: string): string {
  if (!processDefinitionId) return "";
  // Format: "intake-proces:1:12345" → "intake-proces"
  return processDefinitionId.split(":")[0] ?? "";
}

function getProcessLabel(key: string): string {
  const labels: Record<string, string> = {
    "intake-proces": "Intake",
    "zorgplan-evaluatie": "Zorgplan Evaluatie",
    "herindicatie": "Herindicatie",
    "mic-afhandeling": "MIC Afhandeling",
    "vaccinatie-campagne": "Vaccinatie Campagne",
  };
  return labels[key] ?? key;
}

/* ---------- Page ---------- */

export default function WerkbakPage() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [formVars, setFormVars] = useState<Record<string, string>>({});

  const role = typeof window !== "undefined" ? getUserRole() : "";

  const loadTasks = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setError(null);

    const { data, error: err } = await workflowFetch<TasksResponse>(
      `/api/taken?userId=${encodeURIComponent(role)}`,
    );

    if (err) {
      setError(err);
    } else {
      setTasks(data?.data ?? []);
    }
    setLoading(false);
  }, [role]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function claimTask(taskId: string) {
    const { error: err } = await workflowFetch(`/api/taken/${taskId}/claim`, {
      method: "POST",
      body: JSON.stringify({ userId: role }),
    });
    if (err) alert(err);
    else loadTasks();
  }

  async function completeTask(taskId: string) {
    setCompleting(taskId);

    // Build variables from form, only include non-empty values
    const variables: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(formVars)) {
      if (!val.trim()) continue;
      // Convert boolean strings
      if (val === "true" || val === "false") {
        variables[key] = val === "true";
      } else {
        variables[key] = val;
      }
    }

    const { error: err } = await workflowFetch(`/api/taken/${taskId}/complete`, {
      method: "POST",
      body: JSON.stringify({ variables }),
    });

    setCompleting(null);
    if (err) {
      alert(err);
    } else {
      setExpandedTask(null);
      setFormVars({});
      loadTasks();
    }
  }

  const inputCls = "w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-[border-color,box-shadow] duration-200 ease-out";

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">Werkbak</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Openstaande taken voor jouw rol: <span className="font-medium text-brand-600">{role || "onbekend"}</span>
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-4 border-brand-300 border-t-brand-700" style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 px-4 py-3 text-sm text-coral-700 dark:text-coral-300">
            {error}
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-default bg-raised p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-fg-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-3 text-fg-muted">Geen openstaande taken</p>
            <p className="mt-1 text-sm text-fg-subtle">Alle taken zijn afgerond of er zijn geen actieve processen.</p>
          </div>
        )}

        {!loading && !error && tasks.length > 0 && (
          <div className="space-y-3 stagger">
            {tasks.map((task) => {
              const processKey = getProcessKey(task.processDefinitionId);
              const isExpanded = expandedTask === task.id;
              const taskVars = PROCESS_VARS[processKey] ?? [{ name: "opmerking", label: "Opmerking", type: "text" as const }];
              const isClaimed = !!task.assignee;
              const clientNaam = task.variables?.find((v) => v.name === "clientNaam")?.value as string | undefined;

              return (
                <div
                  key={task.id}
                  className="rounded-xl border border-default bg-raised p-5 transition-shadow duration-200 ease-out hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center rounded-lg bg-brand-50 dark:bg-brand-950/20 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
                          {getProcessLabel(processKey)}
                        </span>
                        {!isClaimed && (
                          <span className="inline-flex items-center rounded-lg bg-amber-50 dark:bg-amber-950/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                            Niet geclaimd
                          </span>
                        )}
                        {clientNaam && (
                          <span className="text-xs text-fg-subtle">Client: {clientNaam}</span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-base font-semibold text-fg">{task.name}</h3>
                      {task.description && (
                        <p className="mt-1 text-sm text-fg-muted">{task.description}</p>
                      )}
                      <p className="mt-1.5 text-xs text-fg-subtle">
                        Aangemaakt: {new Date(task.createTime).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isClaimed && (
                        <button
                          onClick={() => claimTask(task.id)}
                          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 btn-press"
                        >
                          Claimen
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedTask(null);
                            setFormVars({});
                          } else {
                            setExpandedTask(task.id);
                            setFormVars({});
                          }
                        }}
                        className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-sunken btn-press"
                      >
                        {isExpanded ? "Inklappen" : "Voltooien"}
                      </button>
                    </div>
                  </div>

                  {/* Completion form */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-default pt-4 animate-[fade-in_300ms_cubic-bezier(0.16,1,0.3,1)]">
                      <h4 className="text-sm font-semibold text-fg mb-3">Taak voltooien</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {taskVars.map((v) => (
                          <div key={v.name}>
                            <label className="block text-xs font-medium text-fg-muted mb-1">{v.label}</label>
                            {v.type === "boolean" ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setFormVars((prev) => ({ ...prev, [v.name]: "true" }))}
                                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border btn-press ${
                                    formVars[v.name] === "true"
                                      ? "bg-brand-600 text-white border-brand-600"
                                      : "bg-raised text-fg-muted border-default hover:bg-sunken"
                                  }`}
                                >
                                  Ja
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormVars((prev) => ({ ...prev, [v.name]: "false" }))}
                                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border btn-press ${
                                    formVars[v.name] === "false"
                                      ? "bg-coral-600 text-white border-coral-600"
                                      : "bg-raised text-fg-muted border-default hover:bg-sunken"
                                  }`}
                                >
                                  Nee
                                </button>
                              </div>
                            ) : v.type === "select" ? (
                              <select
                                value={formVars[v.name] ?? ""}
                                onChange={(e) => setFormVars((prev) => ({ ...prev, [v.name]: e.target.value }))}
                                className={inputCls}
                              >
                                <option value="">Selecteer...</option>
                                {v.options?.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={formVars[v.name] ?? ""}
                                onChange={(e) => setFormVars((prev) => ({ ...prev, [v.name]: e.target.value }))}
                                placeholder={`Waarde voor ${v.label.toLowerCase()}`}
                                className={inputCls}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={() => completeTask(task.id)}
                          disabled={completing === task.id}
                          className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press"
                        >
                          {completing === task.id ? "Afronden..." : "Taak afronden"}
                        </button>
                        <button
                          onClick={() => { setExpandedTask(null); setFormVars({}); }}
                          className="text-sm font-medium text-fg-muted hover:text-fg btn-press"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Refresh */}
        {!loading && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadTasks}
              className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-sunken btn-press"
            >
              Taken vernieuwen
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
