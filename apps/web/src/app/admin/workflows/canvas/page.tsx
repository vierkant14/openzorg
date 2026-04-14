"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import AppShell from "../../../../components/AppShell";
import { workflowFetch } from "../../../../lib/workflow-api";

import type { BpmnEditorHandle, SelectedTask } from "./BpmnEditor";

const BpmnEditor = dynamic(
  () => import("./BpmnEditor").then((m) => m.BpmnEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center rounded-xl border border-default bg-raised text-sm text-fg-muted">
        BPMN-editor laden...
      </div>
    ),
  },
);

interface Template {
  id: string;
  name: string;
  description: string;
}

interface TemplatesResponse {
  templates: Template[];
}

const ROLES = [
  { value: "", label: "— geen —" },
  { value: "zorgmedewerker", label: "Zorgmedewerker" },
  { value: "planner", label: "Planner" },
  { value: "teamleider", label: "Teamleider" },
  { value: "beheerder", label: "Beheerder" },
];

export default function BpmnCanvasPage() {
  const editorRef = useRef<BpmnEditorHandle>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [processKey, setProcessKey] = useState("nieuw-proces");
  const [processName, setProcessName] = useState("Nieuw proces");
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    workflowFetch<TemplatesResponse>("/api/bpmn-templates").then(({ data }) => {
      setTemplates(data?.templates ?? []);
    });
  }, []);

  async function loadTemplate(templateId: string) {
    if (!templateId || !editorRef.current) return;
    setResult(null);
    try {
      const res = await fetch(`/api/workflow/api/bpmn-templates/${templateId}`, {
        headers: {
          "X-Tenant-ID": typeof window !== "undefined" ? (localStorage.getItem("openzorg_tenant_id") ?? "") : "",
        },
      });
      if (!res.ok) {
        setResult({ ok: false, message: `Template ophalen mislukt (${res.status})` });
        return;
      }
      const xml = await res.text();
      await editorRef.current.loadXml(xml);
      const found = templates.find((t) => t.id === templateId);
      if (found) {
        setProcessKey(found.id);
        setProcessName(found.name);
      }
    } catch (err) {
      setResult({
        ok: false,
        message: `Template laden mislukt: ${err instanceof Error ? err.message : "onbekende fout"}`,
      });
    }
  }

  async function handleDeploy() {
    if (!editorRef.current) return;
    setDeploying(true);
    setResult(null);
    const xml = await editorRef.current.exportXml();
    if (!xml) {
      setDeploying(false);
      setResult({ ok: false, message: "Kon BPMN XML niet exporteren." });
      return;
    }
    const { error } = await workflowFetch("/api/processen/deploy", {
      method: "POST",
      body: JSON.stringify({ xml, name: processKey }),
    });
    setDeploying(false);
    if (error) {
      setResult({ ok: false, message: `Deploy mislukt: ${error}` });
    } else {
      setResult({
        ok: true,
        message: `Proces '${processName}' is gedeployed naar Flowable. Je vindt 'm terug in /admin/workflows.`,
      });
    }
  }

  function applyCandidateGroup(value: string) {
    editorRef.current?.setCandidateGroups(value);
    setSelectedTask((prev) => (prev ? { ...prev, candidateGroups: value } : prev));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">Workflow canvas (BPMN)</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Visuele editor voor BPMN 2.0-processen. Kies een template, pas 'm aan en deploy naar Flowable.
          </p>
        </div>

        {/* Template-row + meta */}
        <div className="mb-4 grid gap-3 lg:grid-cols-[260px_1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Template laden</label>
            <select
              value={selectedTemplate}
              onChange={(e) => {
                setSelectedTemplate(e.target.value);
                loadTemplate(e.target.value);
              }}
              className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
            >
              <option value="">— Kies template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-muted">Proces-key (uniek, technisch)</label>
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
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleDeploy}
              disabled={deploying}
              className="h-[38px] rounded-lg bg-brand-700 px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press"
            >
              {deploying ? "Deployen..." : "Deploy naar Flowable"}
            </button>
          </div>
        </div>

        {/* Editor + zijpaneel */}
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="h-[600px]">
            <BpmnEditor
              ref={editorRef}
              onSelectionChange={setSelectedTask}
            />
          </div>
          <aside className="rounded-xl border border-default bg-raised p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-fg">Eigenschappen</h2>
            {!selectedTask ? (
              <p className="text-xs text-fg-subtle">
                Klik een <strong>User Task</strong> aan op het canvas om 'm aan een rol toe te wijzen.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-fg-muted">ID</div>
                  <div className="text-sm text-fg font-mono">{selectedTask.id}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-fg-muted">Naam</div>
                  <div className="text-sm text-fg">{selectedTask.name ?? <span className="text-fg-subtle">—</span>}</div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-fg-muted">Toegewezen rol (candidateGroups)</label>
                  <select
                    value={selectedTask.candidateGroups ?? ""}
                    onChange={(e) => applyCandidateGroup(e.target.value)}
                    className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-fg-subtle">
                    Deze taak verschijnt na deploy in de werkbak van iedereen met deze rol.
                  </p>
                </div>
              </div>
            )}
          </aside>
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
