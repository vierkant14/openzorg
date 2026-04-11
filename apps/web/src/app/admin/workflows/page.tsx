"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { workflowFetch } from "../../../lib/workflow-api";

interface ProcessDefinition {
  id: string;
  key: string;
  name: string;
  version: number;
}

interface Task {
  id: string;
  name: string;
  processDefinitionId?: string;
  created: string;
}

interface BpmnTemplate {
  id: string;
  name: string;
  description: string;
}

export default function WorkflowsAdminPage() {
  const [processes, setProcesses] = useState<ProcessDefinition[]>([]);
  const [processError, setProcessError] = useState<string | null>(null);
  const [processLoading, setProcessLoading] = useState(true);

  const [templates, setTemplates] = useState<BpmnTemplate[]>([]);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadProcesses();
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const res = await workflowFetch<{ templates: BpmnTemplate[] }>("/api/bpmn-templates");
    if (!res.error && res.data) {
      setTemplates(res.data.templates ?? []);
    }
  }

  async function loadProcesses() {
    setProcessLoading(true);
    const res = await workflowFetch<{ data: ProcessDefinition[] }>("/api/processen");
    if (res.error) {
      setProcessError(res.error);
      setProcesses([]);
    } else {
      // Flowable wraps results in { data: [...] }
      const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setProcesses(items);
    }
    setProcessLoading(false);
  }

  async function handleDeploy(templateId: string, templateName: string) {
    setDeployingId(templateId);
    setDeployStatus(null);
    const res = await workflowFetch(`/api/bpmn-templates/${templateId}/deploy`, {
      method: "POST",
    });
    if (res.error) {
      setDeployStatus(`Fout: ${res.error}`);
    } else {
      setDeployStatus(`${templateName} is gedeployed.`);
      loadProcesses();
    }
    setDeployingId(null);
  }

  async function loadTasks() {
    if (!userId.trim()) return;
    setTaskLoading(true);
    setTaskError(null);
    const res = await workflowFetch<{ data: Task[] }>(
      `/api/taken?userId=${encodeURIComponent(userId.trim())}`,
    );
    if (res.error) {
      setTaskError(res.error);
      setTasks([]);
    } else {
      // Flowable wraps results in { data: [...] }
      const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setTasks(items);
    }
    setTaskLoading(false);
  }

  async function handleComplete(taskId: string) {
    setCompletingTaskId(taskId);
    const res = await workflowFetch(`/api/taken/${taskId}/complete`, {
      method: "POST",
    });
    if (res.error) {
      setTaskError(res.error);
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
    setCompletingTaskId(null);
  }

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header met link naar ontwerper */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-lg text-fg">Workflows</h1>
            <p className="text-body text-fg-muted mt-1">Procesdefinities, templates en taken beheren</p>
          </div>
          <Link
            href="/admin/workflows/ontwerp"
            className="bg-brand-600 text-white px-5 py-2.5 rounded-lg hover:bg-brand-700 text-sm font-medium"
          >
            + Nieuw proces ontwerpen
          </Link>
        </div>

        {/* Section 1: Gedeployede processen */}
        <section>
          <h2 className="text-xl font-bold text-fg mb-4">
            Gedeployede processen
          </h2>
          {processError && (
            <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-4 mb-4 text-sm">
              {processError}
            </div>
          )}
          {processLoading ? (
            <p className="text-fg-subtle text-sm">Laden...</p>
          ) : processes.length === 0 ? (
            <p className="text-fg-subtle text-sm">Geen processen gevonden.</p>
          ) : (
            <div className="bg-raised rounded-lg border overflow-hidden">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-page">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                      Naam
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                      Key
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                      Versie
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {processes.map((p) => (
                    <tr key={p.id} className="hover:bg-sunken">
                      <td className="px-4 py-3 text-sm text-fg">
                        {p.name || p.key}
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-muted font-mono">
                        {p.key}
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-muted">
                        {p.version}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 2: Proces templates deployen */}
        <section>
          <h2 className="text-xl font-bold text-fg mb-4">
            Proces templates
          </h2>

          {deployStatus && (
            <div
              className={`mb-4 rounded p-3 text-sm ${deployStatus.startsWith("Fout") ? "bg-coral-50 border border-coral-200 text-coral-600" : "bg-brand-50 border border-brand-200 text-brand-700"}`}
            >
              {deployStatus}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <div key={t.id} className="bg-raised rounded-lg border p-5">
                <h3 className="font-semibold text-fg">{t.name}</h3>
                <p className="mt-1 text-sm text-fg-muted">{t.description}</p>
                <button
                  onClick={() => handleDeploy(t.id, t.name)}
                  disabled={deployingId === t.id}
                  className="mt-3 bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
                >
                  {deployingId === t.id ? "Deployen..." : "Deployen"}
                </button>
              </div>
            ))}
          </div>

          {templates.length === 0 && (
            <p className="text-fg-subtle text-sm">Geen templates beschikbaar.</p>
          )}
        </section>

        {/* Section 3: Taakwerkbak */}
        <section>
          <h2 className="text-xl font-bold text-fg mb-4">Taakwerkbak</h2>

          <div className="flex items-end gap-3 mb-4">
            <div>
              <label
                htmlFor="userId"
                className="block text-sm font-medium text-fg-muted mb-1"
              >
                Gebruiker ID
              </label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="bijv. admin"
                className="border rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={loadTasks}
              disabled={taskLoading || !userId.trim()}
              className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
            >
              {taskLoading ? "Laden..." : "Taken ophalen"}
            </button>
          </div>

          {taskError && (
            <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-4 mb-4 text-sm">
              {taskError}
            </div>
          )}

          {tasks.length > 0 && (
            <div className="bg-raised rounded-lg border overflow-hidden">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-page">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                      Taaknaam
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                      Proces
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                      Aangemaakt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-sunken">
                      <td className="px-4 py-3 text-sm text-fg">
                        {task.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-muted font-mono">
                        {task.processDefinitionId || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-muted">
                        {new Date(task.created).toLocaleString("nl-NL")}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => handleComplete(task.id)}
                          disabled={completingTaskId === task.id}
                          className="text-brand-600 hover:text-brand-800 font-medium disabled:opacity-50"
                        >
                          {completingTaskId === task.id
                            ? "Afronden..."
                            : "Afronden"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!taskLoading && tasks.length === 0 && userId.trim() && (
            <p className="text-fg-subtle text-sm">
              Geen taken gevonden voor deze gebruiker.
            </p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
