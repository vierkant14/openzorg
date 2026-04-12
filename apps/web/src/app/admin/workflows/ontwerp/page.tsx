"use client";

import { useState } from "react";

import AppShell from "../../../../components/AppShell";
import { workflowFetch } from "../../../../lib/workflow-api";

/* ---------- Types ---------- */

interface ProcessStep {
  id: string;
  type: "task" | "decision";
  name: string;
  description: string;
  assignedRole: string;
  // For decisions
  conditionVariable?: string;
  conditionLabel?: string;
}

interface ProcessDefinition {
  name: string;
  description: string;
  processKey: string;
  steps: ProcessStep[];
}

const ROLES = [
  { value: "zorgmedewerker", label: "Zorgmedewerker" },
  { value: "planner", label: "Planner" },
  { value: "teamleider", label: "Teamleider" },
  { value: "beheerder", label: "Beheerder" },
];

function generateId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "proces";
}

/* ---------- BPMN XML Generator ---------- */

function generateBpmn(def: ProcessDefinition): string {
  const processId = def.processKey || slugify(def.name);
  const lines: string[] = [];

  // Helper: resolve the BPMN element ID for step at index i.
  // Tasks use "step{n}", decisions use "gateway{n}".
  function elementId(idx: number): string {
    const s = def.steps[idx];
    if (!s) return "end";
    return s.type === "decision" ? `gateway${idx + 1}` : `step${idx + 1}`;
  }

  // Track which element IDs already have an incoming flow (from a gateway "ja" branch)
  const hasIncomingFlow = new Set<string>();

  // Pre-scan: find elements that are targets of gateway "ja" branches
  for (let i = 0; i < def.steps.length; i++) {
    if (def.steps[i]!.type === "decision" && i + 1 < def.steps.length) {
      hasIncomingFlow.add(elementId(i + 1));
    }
  }

  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"`);
  lines.push(`             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`);
  lines.push(`             xmlns:flowable="http://flowable.org/bpmn"`);
  lines.push(`             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"`);
  lines.push(`             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"`);
  lines.push(`             targetNamespace="http://openzorg.nl/bpmn"`);
  lines.push(`             id="${processId}Definitions">`);
  lines.push(``);
  lines.push(`  <process id="${processId}" name="${escXml(def.name)}" isExecutable="true">`);
  lines.push(``);
  lines.push(`    <startEvent id="start" name="Start" />`);

  let prevId = "start";
  let flowIndex = 1;

  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i]!;
    const elId = elementId(i);

    if (step.type === "task") {
      // Only create incoming flow if this step doesn't already have one from a gateway
      if (!hasIncomingFlow.has(elId)) {
        const flowId = `flow${flowIndex++}`;
        lines.push(``);
        lines.push(`    <sequenceFlow id="${flowId}" sourceRef="${prevId}" targetRef="${elId}" />`);
      }
      lines.push(``);
      lines.push(`    <userTask id="${elId}"`);
      lines.push(`              name="${escXml(step.name)}"`);
      lines.push(`              flowable:candidateGroups="${step.assignedRole}">`);
      if (step.description) {
        lines.push(`      <documentation>${escXml(step.description)}</documentation>`);
      }
      lines.push(`    </userTask>`);
      prevId = elId;

    } else if (step.type === "decision") {
      const gatewayId = elId;
      const varName = step.conditionVariable || `beslissing${i + 1}`;

      // Connect previous element to this gateway (unless a prior gateway "ja" already connects)
      if (!hasIncomingFlow.has(gatewayId)) {
        const flowId = `flow${flowIndex++}`;
        lines.push(``);
        lines.push(`    <sequenceFlow id="${flowId}" sourceRef="${prevId}" targetRef="${gatewayId}" />`);
      }
      lines.push(``);
      lines.push(`    <exclusiveGateway id="${gatewayId}" name="${escXml(step.conditionLabel || step.name)}" />`);

      // "Ja" branch — continues to the correct next element or end
      const flowYesId = `flow${flowIndex++}`;
      const nextTarget = i + 1 < def.steps.length ? elementId(i + 1) : "end";
      lines.push(``);
      lines.push(`    <sequenceFlow id="${flowYesId}" sourceRef="${gatewayId}" targetRef="${nextTarget}">`);
      lines.push(`      <conditionExpression xsi:type="tFormalExpression">\${${varName} == true}</conditionExpression>`);
      lines.push(`    </sequenceFlow>`);

      // "Nee" branch — goes to separate end event
      const flowNoId = `flow${flowIndex++}`;
      const neeEndId = `endNee${i + 1}`;
      lines.push(``);
      lines.push(`    <sequenceFlow id="${flowNoId}" sourceRef="${gatewayId}" targetRef="${neeEndId}">`);
      lines.push(`      <conditionExpression xsi:type="tFormalExpression">\${${varName} == false}</conditionExpression>`);
      lines.push(`    </sequenceFlow>`);
      lines.push(``);
      lines.push(`    <endEvent id="${neeEndId}" name="${escXml(step.name)} — Nee" />`);

      prevId = gatewayId;
    }
  }

  // Final flow to end — only if last step was a task (decisions handle their own end flows)
  const lastStep = def.steps[def.steps.length - 1];
  if (!lastStep || lastStep.type === "task") {
    const endFlowId = `flow${flowIndex++}`;
    lines.push(``);
    lines.push(`    <sequenceFlow id="${endFlowId}" sourceRef="${prevId}" targetRef="end" />`);
  }

  lines.push(``);
  lines.push(`    <endEvent id="end" name="Proces voltooid" />`);
  lines.push(``);
  lines.push(`  </process>`);
  lines.push(``);
  lines.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}">`);
  lines.push(`    <bpmndi:BPMNPlane bpmnElement="${processId}" id="BPMNPlane_${processId}">`);
  lines.push(`      <bpmndi:BPMNShape bpmnElement="start" id="BPMNShape_start"><omgdc:Bounds x="100" y="200" width="36" height="36" /></bpmndi:BPMNShape>`);
  lines.push(`    </bpmndi:BPMNPlane>`);
  lines.push(`  </bpmndi:BPMNDiagram>`);
  lines.push(``);
  lines.push(`</definitions>`);

  return lines.join("\n");
}

function escXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- Page ---------- */

export default function WorkflowDesignerPage() {
  const [process, setProcess] = useState<ProcessDefinition>({
    name: "",
    description: "",
    processKey: "",
    steps: [],
  });

  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showXml, setShowXml] = useState(false);

  function addStep(type: "task" | "decision") {
    setProcess((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: generateId(),
          type,
          name: type === "task" ? "" : "",
          description: "",
          assignedRole: "zorgmedewerker",
          conditionVariable: type === "decision" ? "" : undefined,
          conditionLabel: type === "decision" ? "" : undefined,
        },
      ],
    }));
  }

  function updateStep(index: number, updates: Partial<ProcessStep>) {
    setProcess((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    }));
  }

  function removeStep(index: number) {
    setProcess((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= process.steps.length) return;
    setProcess((prev) => {
      const steps = [...prev.steps];
      const temp = steps[index]!;
      steps[index] = steps[newIndex]!;
      steps[newIndex] = temp;
      return { ...prev, steps };
    });
  }

  async function handleDeploy() {
    if (!process.name || process.steps.length === 0) return;

    setDeploying(true);
    setDeployResult(null);

    const key = process.processKey || slugify(process.name);
    const xml = generateBpmn({ ...process, processKey: key });

    const res = await workflowFetch("/api/processen/deploy", {
      method: "POST",
      body: JSON.stringify({ xml, name: key }),
    });

    if (res.error) {
      setDeployResult({ success: false, message: res.error });
    } else {
      setDeployResult({ success: true, message: `Proces "${process.name}" is succesvol gedeployed naar Flowable.` });
    }
    setDeploying(false);
  }

  const canDeploy = process.name.trim() && process.steps.length > 0 &&
    process.steps.every((s) => s.name.trim());

  const inputClass = "w-full rounded-xl border border-default bg-raised px-3 py-2 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-[border-color,box-shadow] duration-200 ease-out";

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a href="/admin/workflows" className="text-sm text-brand-700 hover:text-brand-900 transition-colors duration-150">
                &larr; Workflows
              </a>
            </div>
            <h1 className="text-2xl font-bold text-fg">Procesontwerp</h1>
            <p className="text-sm text-fg-muted mt-1">
              Ontwerp een zorgproces met stappen, rollen en beslismomenten
            </p>
          </div>
        </div>

        {deployResult && (
          <div
            className={`rounded-xl p-4 mb-6 text-body-sm animate-[fade-in_300ms_cubic-bezier(0.16,1,0.3,1)] ${
              deployResult.success
                ? "bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300"
                : "bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-300"
            }`}
          >
            {deployResult.message}
          </div>
        )}

        {/* Process info */}
        <section className="bg-raised rounded-2xl border border-default p-6 mb-6">
          <h2 className="text-lg font-semibold text-fg mb-4">Procesinformatie</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-medium text-fg-muted mb-1">Procesnaam</label>
              <input
                type="text"
                value={process.name}
                onChange={(e) => setProcess((p) => ({ ...p, name: e.target.value, processKey: slugify(e.target.value) }))}
                placeholder="bijv. Intake Zorgtraject"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-caption font-medium text-fg-muted mb-1">Proces-ID (automatisch)</label>
              <input
                type="text"
                value={process.processKey || slugify(process.name)}
                readOnly
                className={`${inputClass} bg-sunken text-fg-subtle`}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-caption font-medium text-fg-muted mb-1">Beschrijving</label>
            <textarea
              value={process.description}
              onChange={(e) => setProcess((p) => ({ ...p, description: e.target.value }))}
              placeholder="Beschrijf het doel en de scope van dit proces..."
              rows={2}
              className={inputClass}
            />
          </div>
        </section>

        {/* Steps */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-fg">Stappen</h2>
            <div className="flex gap-2">
              <button
                onClick={() => addStep("task")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-caption font-semibold rounded-xl hover:bg-brand-700 btn-press"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Taak
              </button>
              <button
                onClick={() => addStep("decision")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy-600 text-white text-caption font-semibold rounded-xl hover:bg-navy-700 btn-press"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3l9 9-9 9-9-9z" /></svg>
                Beslismoment
              </button>
            </div>
          </div>

          {process.steps.length === 0 ? (
            <div className="bg-raised rounded-2xl border border-dashed border-default p-10 text-center">
              <p className="text-fg-muted text-body-sm">
                Voeg stappen toe aan je proces. Begin met een taak of een beslismoment.
              </p>
              <p className="text-caption text-fg-subtle mt-2">
                Elke taak wordt toegewezen aan een rol (zorgmedewerker, planner, teamleider of beheerder).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Start node */}
              <div className="flex items-center gap-3 pl-4">
                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
                <span className="text-caption font-medium text-fg-muted">Start</span>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-0.5 h-6 bg-default" />
              </div>

              {process.steps.map((step, index) => (
                <div key={step.id}>
                  <StepCard
                    step={step}
                    index={index}
                    total={process.steps.length}
                    onUpdate={(updates) => updateStep(index, updates)}
                    onRemove={() => removeStep(index)}
                    onMoveUp={() => moveStep(index, -1)}
                    onMoveDown={() => moveStep(index, 1)}
                    inputClass={inputClass}
                  />
                  {/* Arrow between steps */}
                  {index < process.steps.length - 1 && (
                    <div className="flex justify-center">
                      <div className="w-0.5 h-6 bg-default" />
                    </div>
                  )}
                </div>
              ))}

              {/* Arrow to end */}
              <div className="flex justify-center">
                <div className="w-0.5 h-6 bg-default" />
              </div>

              {/* End node */}
              <div className="flex items-center gap-3 pl-4">
                <div className="w-8 h-8 rounded-full bg-surface-400 dark:bg-surface-600 border-[3px] border-surface-500 dark:border-surface-400 flex items-center justify-center shrink-0">
                  <div className="w-3 h-3 rounded-full bg-surface-500 dark:bg-surface-400" />
                </div>
                <span className="text-caption font-medium text-fg-muted">Einde</span>
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        {process.steps.length > 0 && (
          <section className="bg-raised rounded-2xl border border-default p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-fg">Deployen</h2>
                <p className="text-caption text-fg-muted mt-1">
                  Deploy dit proces naar Flowable om het actief te maken.
                  {!canDeploy && " Vul eerst alle stappen in."}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowXml(!showXml)}
                  className="px-4 py-2 text-caption font-medium text-fg-muted border border-default rounded-xl hover:bg-sunken btn-press"
                >
                  {showXml ? "Verberg BPMN" : "Bekijk BPMN"}
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={!canDeploy || deploying}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 btn-press"
                >
                  {deploying ? "Deployen..." : "Deployen naar Flowable"}
                </button>
              </div>
            </div>

            {showXml && (
              <div className="mt-4">
                <pre className="bg-sunken rounded-xl p-4 text-xs font-mono text-fg-muted overflow-x-auto max-h-96 border border-subtle">
                  {generateBpmn({ ...process, processKey: process.processKey || slugify(process.name) })}
                </pre>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

/* ---------- Step Card Component ---------- */

function StepCard({
  step,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  inputClass,
}: {
  step: ProcessStep;
  index: number;
  total: number;
  onUpdate: (updates: Partial<ProcessStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  inputClass: string;
}) {
  const isTask = step.type === "task";

  return (
    <div className={`rounded-2xl border p-5 transition-[border-color,background-color] duration-200 ease-out ${
      isTask
        ? "bg-raised border-default"
        : "bg-navy-50/50 dark:bg-navy-950/20 border-navy-200 dark:border-navy-800"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
            isTask
              ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
              : "bg-navy-100 dark:bg-navy-900/30 text-navy-700 dark:text-navy-300"
          }`}>
            {index + 1}
          </span>
          <span className={`text-caption font-semibold uppercase tracking-wider ${
            isTask ? "text-brand-600 dark:text-brand-400" : "text-navy-600 dark:text-navy-400"
          }`}>
            {isTask ? "Taak" : "Beslismoment"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-sunken text-fg-subtle disabled:opacity-30 btn-press-sm"
            title="Omhoog"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg hover:bg-sunken text-fg-subtle disabled:opacity-30 btn-press-sm"
            title="Omlaag"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-coral-50 dark:hover:bg-coral-950/20 text-fg-subtle hover:text-coral-600 btn-press-sm"
            title="Verwijderen"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-caption font-medium text-fg-muted mb-1">
            {isTask ? "Taaknaam" : "Vraag / Beslismoment"}
          </label>
          <input
            type="text"
            value={step.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={isTask ? "bijv. Aanmelding beoordelen" : "bijv. Goedgekeurd?"}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-fg-muted mb-1">
            {isTask ? "Toegewezen aan" : "Wie beslist?"}
          </label>
          <select
            value={step.assignedRole}
            onChange={(e) => onUpdate({ assignedRole: e.target.value })}
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-caption font-medium text-fg-muted mb-1">Omschrijving / instructie</label>
        <textarea
          value={step.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder={isTask
            ? "Wat moet de medewerker doen in deze stap?"
            : "Welke criteria gelden voor dit beslismoment?"
          }
          rows={2}
          className={inputClass}
        />
      </div>

      {!isTask && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-caption font-medium text-fg-muted mb-1">Variabele naam</label>
            <input
              type="text"
              value={step.conditionVariable || ""}
              onChange={(e) => onUpdate({ conditionVariable: e.target.value.replace(/\s/g, "") })}
              placeholder="bijv. goedgekeurd"
              className={`${inputClass} font-mono`}
            />
            <p className="text-[10px] text-fg-subtle mt-1">Technische naam voor de ja/nee beslissing</p>
          </div>
          <div className="flex items-end gap-3 pb-5">
            <div className="flex items-center gap-2 text-caption text-fg-muted">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 font-medium">
                Ja → volgende stap
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-coral-50 dark:bg-coral-950/20 text-coral-600 dark:text-coral-400 font-medium">
                Nee → einde
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
