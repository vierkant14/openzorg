"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../components/AppShell";
import { FeatureGate } from "../../components/FeatureGate";
import { ecdFetch, getUserRole } from "../../lib/api";
import { workflowFetch } from "../../lib/workflow-api";

/* ---------- Types ---------- */

interface WorkflowTask {
  id: string;
  name: string;
  description?: string;
  createTime: string;
  dueDate?: string | null;
  assignee?: string;
  processDefinitionId?: string;
  processInstanceId?: string;
  taskDefinitionKey?: string;
  variables?: Array<{ name: string; value: unknown }>;
}

/**
 * Formatter voor deadlines. Geeft een { label, color } terug zodat de kaart
 * kan kleuren op basis van hoe dringend het is.
 */
function formatDueDate(iso?: string | null): { label: string; color: string } | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) {
    return { label: `Verlopen: ${Math.abs(diffDays)}d geleden`, color: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300" };
  }
  if (diffHours < 24) {
    return { label: `Over ${diffHours}u`, color: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" };
  }
  if (diffDays < 3) {
    return { label: `Over ${diffDays}d`, color: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" };
  }
  return { label: `Over ${diffDays}d`, color: "bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300" };
}

interface TasksResponse {
  data: WorkflowTask[];
  total: number;
}

/** FHIR Task resource (from Medplum, e.g. auto-generated zorgplan-evaluatie). */
interface FhirTask {
  resourceType: "Task";
  id?: string;
  status?: string;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  description?: string;
  authoredOn?: string;
  executionPeriod?: { end?: string };
  focus?: { reference?: string };
  for?: { reference?: string };
  extension?: Array<{ url?: string; valueString?: string; valueBoolean?: boolean }>;
}

interface FhirBundle<T> {
  resourceType: "Bundle";
  entry?: Array<{ resource: T }>;
}

/** Convert a FHIR Task to a WorkflowTask shape so it fits the werkbak UI. */
function fhirTaskToWorkflow(task: FhirTask): WorkflowTask {
  const code = task.code?.coding?.[0]?.code ?? "fhir-task";
  return {
    id: `fhir-${task.id ?? ""}`,
    name: task.code?.text ?? task.code?.coding?.[0]?.display ?? "FHIR Taak",
    description: task.description,
    createTime: task.authoredOn ?? new Date().toISOString(),
    dueDate: task.executionPeriod?.end ?? null,
    processDefinitionId: `${code}:fhir:1`,
    taskDefinitionKey: code,
    variables: [
      ...(task.for?.reference
        ? [{ name: "clientRef", value: task.for.reference }]
        : []),
    ],
  };
}

/* ---------- Process variable definitions ---------- */

interface TaskVar {
  name: string;
  label: string;
  type: "boolean" | "text" | "select";
  options?: Array<{ value: string; label: string }>;
}

/**
 * Default-vars per process-key. Deze hardcoded defaults zijn Laag 1 —
 * leveranciersvoorschrift. Tenant-configuraties (Laag 2) mergen erover
 * heen zodat een functioneel beheerder per task eigen opties kan zetten
 * zonder code te wijzigen.
 */
const DEFAULT_PROCESS_VARS: Record<string, TaskVar[]> = {
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

type StatusFilter = "all" | "unclaimed" | "claimed-mine" | "claimed-other";

export default function WerkbakPage() {
  return (
    <FeatureGate flag="workflow-engine">
      <WerkbakInner />
    </FeatureGate>
  );
}

interface TenantFormOptions {
  [processKey: string]: { [taskKey: string]: TaskVar[] };
}

function WerkbakInner() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [tenantFormOptions, setTenantFormOptions] = useState<TenantFormOptions>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [formVars, setFormVars] = useState<Record<string, string>>({});

  // Filters
  const [processFilter, setProcessFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const role = typeof window !== "undefined" ? getUserRole() : "";

  // Teamleider, beheerder en tenant-admin zien taken van alle rollen (oversight)
  const isOversight = role === "teamleider" || role === "beheerder" || role === "tenant-admin";
  const ALL_ROLES = ["zorgmedewerker", "planner", "teamleider", "beheerder", "tenant-admin"];

  const loadTasks = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setError(null);

    // Fetch FHIR Tasks (e.g. auto-generated zorgplan-evaluatie) in parallel
    const fhirTasksPromise = ecdFetch<FhirBundle<FhirTask>>("/api/fhir-taken").then(
      ({ data }) => (data?.entry ?? []).map((e) => fhirTaskToWorkflow(e.resource)),
    ).catch(() => [] as WorkflowTask[]);

    if (isOversight) {
      // Fetch tasks for all roles and merge
      const allTasks: WorkflowTask[] = [];
      const seenIds = new Set<string>();
      for (const r of ALL_ROLES) {
        const { data } = await workflowFetch<TasksResponse>(
          `/api/taken?userId=${encodeURIComponent(r)}`,
        );
        for (const task of data?.data ?? []) {
          if (!seenIds.has(task.id)) {
            seenIds.add(task.id);
            allTasks.push(task);
          }
        }
      }
      // Merge FHIR Tasks
      const fhirTasks = await fhirTasksPromise;
      for (const ft of fhirTasks) {
        if (!seenIds.has(ft.id)) {
          seenIds.add(ft.id);
          allTasks.push(ft);
        }
      }
      setTasks(allTasks);
    } else {
      const { data, error: err } = await workflowFetch<TasksResponse>(
        `/api/taken?userId=${encodeURIComponent(role)}`,
      );
      // Merge FHIR Tasks
      const fhirTasks = await fhirTasksPromise;
      if (err) {
        // Even if workflow fails, show FHIR tasks
        if (fhirTasks.length > 0) {
          setTasks(fhirTasks);
        } else {
          setError(err);
        }
      } else {
        setTasks([...(data?.data ?? []), ...fhirTasks]);
      }
    }
    setLoading(false);
  }, [role, isOversight]);

  useEffect(() => {
    loadTasks();
    // Laad tenant-specifieke form-opties (Laag 2)
    import("../../lib/api").then(({ ecdFetch }) =>
      ecdFetch<{ config: TenantFormOptions }>("/api/task-form-options").then(({ data }) => {
        if (data?.config) setTenantFormOptions(data.config);
      }),
    );
  }, [loadTasks]);

  /**
   * Merge Laag 1 (hardcoded defaults) met Laag 2 (tenant-overrides).
   * Tenant-config wint per var-name; defaults zijn de fallback.
   */
  function getTaskVars(processKey: string, taskDefKey?: string): TaskVar[] {
    const defaults = DEFAULT_PROCESS_VARS[processKey] ?? [
      { name: "opmerking", label: "Opmerking", type: "text" as const },
    ];
    const override = tenantFormOptions[processKey]?.[taskDefKey ?? ""] ?? [];
    if (override.length === 0) return defaults;
    // Merge: tenant-override vervangt default met zelfde name, rest blijft
    const byName = new Map<string, TaskVar>();
    for (const v of defaults) byName.set(v.name, v);
    for (const v of override) byName.set(v.name, v);
    return Array.from(byName.values());
  }

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

  // Unieke proces-keys uit de huidige taken-set, gesorteerd op label
  const availableProcesses = Array.from(
    new Set(tasks.map((t) => getProcessKey(t.processDefinitionId)).filter(Boolean)),
  )
    .map((key) => ({ key, label: getProcessLabel(key) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Filter de taken-lijst
  const filteredTasks = tasks.filter((task) => {
    if (processFilter !== "all" && getProcessKey(task.processDefinitionId) !== processFilter) return false;

    if (statusFilter === "unclaimed" && task.assignee) return false;
    if (statusFilter === "claimed-mine" && task.assignee !== role) return false;
    if (statusFilter === "claimed-other" && (!task.assignee || task.assignee === role)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay = [
        task.name,
        task.description ?? "",
        (task.variables?.find((v) => v.name === "clientNaam")?.value as string | undefined) ?? "",
        task.assignee ?? "",
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">Werkbak</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {isOversight
              ? <>Alle openstaande taken (overzicht als <span className="font-medium text-brand-600">{role}</span>)</>
              : <>Openstaande taken voor jouw rol: <span className="font-medium text-brand-600">{role || "onbekend"}</span></>
            }
          </p>
        </div>

        {/* Filter-bar */}
        <div className="mb-5 grid gap-3 rounded-xl border border-default bg-raised p-4 sm:grid-cols-[1fr_200px_200px]">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Zoek (naam, cliënt, beschrijving)</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Typ om te filteren..."
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Proces-type</label>
            <select
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              className={inputCls}
            >
              <option value="all">Alle processen</option>
              {availableProcesses.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={inputCls}
            >
              <option value="all">Alles</option>
              <option value="unclaimed">Niet geclaimd</option>
              <option value="claimed-mine">Door mij geclaimd</option>
              <option value="claimed-other">Door anderen geclaimd</option>
            </select>
          </div>
        </div>

        {!loading && tasks.length > 0 && (
          <p className="mb-3 text-xs text-fg-subtle">
            {filteredTasks.length} van {tasks.length} taken zichtbaar
            {(processFilter !== "all" || statusFilter !== "all" || searchQuery.trim()) && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => {
                    setProcessFilter("all");
                    setStatusFilter("all");
                    setSearchQuery("");
                  }}
                  className="text-brand-600 hover:underline"
                >
                  filters wissen
                </button>
              </>
            )}
          </p>
        )}

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

        {!loading && !error && tasks.length > 0 && filteredTasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-default bg-raised p-8 text-center">
            <p className="text-fg-muted">Geen taken die voldoen aan deze filters.</p>
          </div>
        )}

        {!loading && !error && filteredTasks.length > 0 && (
          <div className="space-y-3 stagger">
            {filteredTasks.map((task) => {
              const processKey = getProcessKey(task.processDefinitionId);
              const isExpanded = expandedTask === task.id;
              const taskVars = getTaskVars(processKey, task.taskDefinitionKey);
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
                        {(() => {
                          const due = formatDueDate(task.dueDate);
                          if (!due) return null;
                          return (
                            <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold ${due.color}`}>
                              ⏰ {due.label}
                            </span>
                          );
                        })()}
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
                        {task.assignee && <> · Geclaimd door <span className="font-medium text-fg-muted">{task.assignee}</span></>}
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
