"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "../../../../components/AppShell";
import { workflowFetch } from "../../../../lib/workflow-api";

/* ---------- Types ---------- */

interface ProcessDefinition {
  id: string;
  key: string;
  name: string;
  version: number;
}

interface ProcessInstance {
  id: string;
  processDefinitionId?: string;
  processDefinitionKey?: string;
  processDefinitionName?: string;
  businessKey?: string;
  startTime?: string;
  startUserId?: string;
  ended?: boolean;
  suspended?: boolean;
  tenantId?: string;
  variables?: Array<{ name: string; value: unknown }>;
}

interface TaskItem {
  id: string;
  name: string;
  assignee?: string;
  created: string;
  dueDate?: string;
  description?: string;
}

/* ---------- Component ---------- */

export default function InstantiesPage() {
  const [processes, setProcesses] = useState<ProcessDefinition[]>([]);
  const [selectedProcess, setSelectedProcess] = useState("");
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start process modal
  const [showStartModal, setShowStartModal] = useState(false);
  const [startKey, setStartKey] = useState("");
  const [startBusinessKey, setStartBusinessKey] = useState("");
  const [starting, setStarting] = useState(false);

  // Instance detail
  const [selectedInstance, setSelectedInstance] = useState<ProcessInstance | null>(null);
  const [instanceTasks, setInstanceTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  useEffect(() => {
    loadProcesses();
  }, []);

  async function loadProcesses() {
    const res = await workflowFetch<{ data: ProcessDefinition[] }>("/api/processen");
    if (!res.error && res.data) {
      const items = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
      setProcesses(items);
      if (items.length > 0 && !selectedProcess) {
        const firstKey = items[0]?.key;
        if (firstKey) {
          setSelectedProcess(firstKey);
          loadInstances(firstKey);
        }
      }
    }
  }

  async function loadInstances(processKey: string) {
    setLoading(true);
    setError(null);
    const res = await workflowFetch<{ data: ProcessInstance[] }>(
      `/api/processen/${processKey}/instances`,
    );
    if (res.error) {
      setError(res.error);
      setInstances([]);
    } else {
      const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setInstances(items);
    }
    setLoading(false);
  }

  function handleSelectProcess(key: string) {
    setSelectedProcess(key);
    setSelectedInstance(null);
    loadInstances(key);
  }

  async function handleStartProcess() {
    if (!startKey) return;
    setStarting(true);
    setError(null);
    const { error: err } = await workflowFetch(`/api/processen/${startKey}/start`, {
      method: "POST",
      body: JSON.stringify({
        businessKey: startBusinessKey || undefined,
      }),
    });
    setStarting(false);
    setShowStartModal(false);
    setStartBusinessKey("");
    if (err) {
      setError(err);
    } else {
      loadInstances(selectedProcess || startKey);
    }
  }

  async function handleSelectInstance(inst: ProcessInstance) {
    setSelectedInstance(inst);
    setTasksLoading(true);
    // Load tasks for this instance — use the task query API
    const res = await workflowFetch<{ data: TaskItem[] }>(
      `/api/taken?processInstanceId=${inst.id}`,
    );
    if (!res.error && res.data) {
      const items = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
      setInstanceTasks(items);
    } else {
      setInstanceTasks([]);
    }
    setTasksLoading(false);
  }

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-lg text-fg">Procesinstanties</h1>
            <p className="text-body text-fg-muted mt-1">Lopende en afgeronde workflow-instanties bekijken en beheren.</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/workflows"
              className="border border-default text-fg px-4 py-2 rounded-lg hover:bg-sunken text-sm font-medium"
            >
              Terug naar workflows
            </Link>
            <button
              onClick={() => { setShowStartModal(true); setStartKey(selectedProcess); }}
              disabled={processes.length === 0}
              className="bg-brand-600 text-white px-5 py-2.5 rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
            >
              + Nieuw proces starten
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Process selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-fg-muted">Proces:</label>
          <select
            value={selectedProcess}
            onChange={(e) => handleSelectProcess(e.target.value)}
            className="rounded-md border border-default px-3 py-2 text-sm min-w-[250px]"
          >
            {processes.map((p) => (
              <option key={p.id} value={p.key}>{p.name || p.key} (v{p.version})</option>
            ))}
          </select>
          <span className="text-sm text-fg-subtle">{instances.length} instantie(s)</span>
        </div>

        {/* Instances list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
          </div>
        ) : instances.length === 0 ? (
          <div className="bg-raised rounded-lg border p-12 text-center">
            <p className="text-fg-subtle text-sm">Geen lopende instanties voor dit proces.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Instance list */}
            <div className="bg-raised rounded-lg border overflow-hidden">
              <div className="border-b border-subtle px-4 py-3 bg-page">
                <h3 className="text-sm font-semibold text-fg">Instanties</h3>
              </div>
              <div className="divide-y divide-subtle max-h-[600px] overflow-y-auto">
                {instances.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => handleSelectInstance(inst)}
                    className={`w-full text-left px-4 py-3 hover:bg-sunken transition-colors ${
                      selectedInstance?.id === inst.id ? "bg-brand-50 dark:bg-brand-900/20" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-fg">
                        {inst.businessKey || inst.id.slice(0, 8)}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        inst.ended
                          ? "bg-surface-100 text-fg-subtle"
                          : inst.suspended
                            ? "bg-amber-100 text-amber-800"
                            : "bg-brand-50 text-brand-700"
                      }`}>
                        {inst.ended ? "Afgerond" : inst.suspended ? "Gepauzeerd" : "Actief"}
                      </span>
                    </div>
                    {inst.startTime && (
                      <p className="text-xs text-fg-subtle mt-1">
                        Gestart: {new Date(inst.startTime).toLocaleString("nl-NL")}
                      </p>
                    )}
                    {inst.startUserId && (
                      <p className="text-xs text-fg-subtle">
                        Door: {inst.startUserId}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Instance detail */}
            <div className="bg-raised rounded-lg border">
              {selectedInstance ? (
                <div>
                  <div className="border-b border-subtle px-4 py-3 bg-page">
                    <h3 className="text-sm font-semibold text-fg">
                      {selectedInstance.businessKey || selectedInstance.id.slice(0, 8)}
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-fg-subtle">ID</dt>
                      <dd className="font-mono text-xs text-fg">{selectedInstance.id}</dd>
                      <dt className="text-fg-subtle">Proces</dt>
                      <dd className="text-fg">{selectedInstance.processDefinitionName || selectedInstance.processDefinitionKey}</dd>
                      <dt className="text-fg-subtle">Status</dt>
                      <dd className="text-fg">{selectedInstance.ended ? "Afgerond" : selectedInstance.suspended ? "Gepauzeerd" : "Actief"}</dd>
                      {selectedInstance.startTime && (
                        <>
                          <dt className="text-fg-subtle">Gestart</dt>
                          <dd className="text-fg">{new Date(selectedInstance.startTime).toLocaleString("nl-NL")}</dd>
                        </>
                      )}
                    </dl>

                    {/* Active tasks */}
                    <div>
                      <h4 className="text-sm font-semibold text-fg mb-2">Actieve taken</h4>
                      {tasksLoading ? (
                        <p className="text-sm text-fg-subtle">Laden...</p>
                      ) : instanceTasks.length === 0 ? (
                        <p className="text-sm text-fg-subtle">Geen actieve taken.</p>
                      ) : (
                        <div className="space-y-2">
                          {instanceTasks.map((task) => (
                            <div key={task.id} className="bg-sunken rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-fg">{task.name}</span>
                                {task.assignee && (
                                  <span className="text-xs text-fg-subtle">Toegewezen: {task.assignee}</span>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-xs text-fg-muted mt-1">{task.description}</p>
                              )}
                              <p className="text-xs text-fg-subtle mt-1">
                                Aangemaakt: {new Date(task.created).toLocaleString("nl-NL")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Variables */}
                    {selectedInstance.variables && selectedInstance.variables.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-fg mb-2">Variabelen</h4>
                        <div className="bg-sunken rounded-lg p-3">
                          <table className="w-full text-xs">
                            <tbody>
                              {selectedInstance.variables.map((v) => (
                                <tr key={v.name} className="border-b last:border-0 border-subtle">
                                  <td className="py-1.5 pr-3 font-medium text-fg-muted">{v.name}</td>
                                  <td className="py-1.5 text-fg font-mono">{String(v.value)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-sm text-fg-subtle">Selecteer een instantie om details te bekijken.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Start process modal */}
        {showStartModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-raised rounded-xl border shadow-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-fg mb-4">Nieuw proces starten</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">Proces</label>
                  <select
                    value={startKey}
                    onChange={(e) => setStartKey(e.target.value)}
                    className="w-full rounded-md border border-default px-3 py-2 text-sm"
                  >
                    {processes.map((p) => (
                      <option key={p.id} value={p.key}>{p.name || p.key}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">Business key (optioneel)</label>
                  <input
                    type="text"
                    value={startBusinessKey}
                    onChange={(e) => setStartBusinessKey(e.target.value)}
                    placeholder="bijv. client-12345"
                    className="w-full rounded-md border border-default px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowStartModal(false)}
                  className="px-4 py-2 text-sm font-medium text-fg-muted hover:text-fg"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleStartProcess}
                  disabled={starting || !startKey}
                  className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
                >
                  {starting ? "Starten..." : "Proces starten"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
