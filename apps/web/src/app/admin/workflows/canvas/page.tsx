"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import AppShell from "../../../../components/AppShell";
import { workflowFetch } from "../../../../lib/workflow-api";

import type { BpmnEditorHandle, SelectedElement } from "./BpmnEditor";

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

const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:flowable="http://flowable.org/bpmn"
                  id="Definitions_nieuw"
                  targetNamespace="http://openzorg.nl/bpmn">
  <bpmn:process id="nieuw-proces" name="Nieuw proces" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="nieuw-proces">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/**
 * bpmn-auto-layout leest alleen <bpmn:incoming>/<bpmn:outgoing> children
 * voor connecties, niet de sequenceFlow sourceRef/targetRef. Veel
 * hand-gemaakte BPMN (zoals onze templates) laat die children weg. Deze
 * preprocessor leest alle sequenceFlows en injecteert de ontbrekende
 * incoming/outgoing children in de flow nodes zodat de layouter edges kan
 * genereren.
 */
function ensureFlowRefs(xml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return xml;

  const BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";
  const flows = Array.from(doc.getElementsByTagNameNS(BPMN_NS, "sequenceFlow"));
  if (flows.length === 0) {
    // Fallback voor documenten zonder default namespace-prefix
    const any = Array.from(doc.getElementsByTagName("*")).filter(
      (el) => el.localName === "sequenceFlow",
    );
    flows.push(...(any as Element[]));
  }

  for (const flow of flows) {
    const flowId = flow.getAttribute("id");
    const sourceRef = flow.getAttribute("sourceRef");
    const targetRef = flow.getAttribute("targetRef");
    if (!flowId || !sourceRef || !targetRef) continue;

    const source = doc.getElementById(sourceRef)
      ?? doc.querySelector(`[id='${sourceRef}']`);
    const target = doc.getElementById(targetRef)
      ?? doc.querySelector(`[id='${targetRef}']`);

    const addChild = (parent: Element | null, tag: "incoming" | "outgoing", value: string) => {
      if (!parent) return;
      const existing = Array.from(parent.children).find(
        (c) => c.localName === tag && c.textContent?.trim() === value,
      );
      if (existing) return;
      // Gebruik hetzelfde prefix als de parent zodat de output geldig blijft
      const prefix = parent.prefix ? `${parent.prefix}:` : "";
      const child = doc.createElementNS(BPMN_NS, `${prefix}${tag}`);
      child.textContent = value;
      parent.appendChild(child);
    };

    addChild(source, "outgoing", flowId);
    addChild(target, "incoming", flowId);
  }

  return new XMLSerializer().serializeToString(doc);
}

export default function BpmnCanvasPage() {
  const router = useRouter();
  const editorRef = useRef<BpmnEditorHandle>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [processKey, setProcessKey] = useState("nieuw-proces");
  const [processName, setProcessName] = useState("Nieuw proces");
  const [deploying, setDeploying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importXmlText, setImportXmlText] = useState("");

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
      let xml = await res.text();

      // Templates uit bpmn-templates.ts hebben alleen de start-shape in DI;
      // laat bpmn-auto-layout de rest uittekenen voordat we importeren.
      try {
        xml = ensureFlowRefs(xml);
        const { layoutProcess } = await import("bpmn-auto-layout");
        xml = await layoutProcess(xml);
      } catch (layoutErr) {
        console.warn("bpmn-auto-layout faalde, importeer ongeauto-layout'de XML", layoutErr);
      }

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

  /**
   * Killer-demo-knop (H8.6): deploy huidige XML → start meteen een
   * instance → spring naar werkbak zodat je de taak ziet verschijnen.
   */
  async function handleTest() {
    if (!editorRef.current) return;
    setTesting(true);
    setResult(null);
    const xml = await editorRef.current.exportXml();
    if (!xml) {
      setTesting(false);
      setResult({ ok: false, message: "Kon BPMN XML niet exporteren." });
      return;
    }
    // Stap 1: deploy
    const deployRes = await workflowFetch("/api/processen/deploy", {
      method: "POST",
      body: JSON.stringify({ xml, name: processKey }),
    });
    if (deployRes.error) {
      setTesting(false);
      setResult({ ok: false, message: `Deploy mislukt: ${deployRes.error}` });
      return;
    }
    // Stap 2: start instance met test-clientnaam
    const startRes = await workflowFetch(`/api/processen/${encodeURIComponent(processKey)}/start`, {
      method: "POST",
      body: JSON.stringify({ variables: { clientNaam: "Test cliënt (canvas)" } }),
    });
    setTesting(false);
    if (startRes.error) {
      setResult({ ok: false, message: `Proces starten mislukt: ${startRes.error}` });
      return;
    }
    // Stap 3: spring naar werkbak
    router.push("/werkbak");
  }

  function applyCandidateGroup(value: string) {
    editorRef.current?.setCandidateGroups(value);
    setSelectedElement((prev) => (prev ? { ...prev, candidateGroups: value } : prev));
  }

  function applyAssignee(value: string) {
    editorRef.current?.setAssignee(value);
    setSelectedElement((prev) => (prev ? { ...prev, assignee: value } : prev));
  }

  function applyFormKey(value: string) {
    editorRef.current?.setFormKey(value);
    setSelectedElement((prev) => (prev ? { ...prev, formKey: value } : prev));
  }

  function applyDueDate(value: string) {
    editorRef.current?.setDueDate(value);
    setSelectedElement((prev) => (prev ? { ...prev, dueDate: value } : prev));
  }

  function applyElementName(value: string) {
    editorRef.current?.setElementName(value);
    setSelectedElement((prev) => (prev ? { ...prev, name: value } : prev));
  }

  function applyFlowCondition(flowId: string, value: string) {
    editorRef.current?.setFlowCondition(flowId, value);
    setSelectedElement((prev) => {
      if (!prev?.outgoingFlows) return prev;
      return {
        ...prev,
        outgoingFlows: prev.outgoingFlows.map((f) =>
          f.id === flowId ? { ...f, condition: value } : f,
        ),
      };
    });
  }

  async function handleNewBlank() {
    if (!editorRef.current) return;
    setResult(null);
    setSelectedTemplate("");
    setProcessKey("nieuw-proces");
    setProcessName("Nieuw proces");
    await editorRef.current.loadXml(EMPTY_BPMN);
  }

  async function handleImportXml() {
    if (!editorRef.current || !importXmlText.trim()) return;
    setResult(null);
    try {
      let xml = ensureFlowRefs(importXmlText);
      try {
        const { layoutProcess } = await import("bpmn-auto-layout");
        xml = await layoutProcess(xml);
      } catch {
        // Gebruikers-BPMN heeft mogelijk al eigen DI, dan skip layout
      }
      await editorRef.current.loadXml(xml);
      setShowImport(false);
      setImportXmlText("");
      setResult({ ok: true, message: "BPMN XML geïmporteerd. Je kunt nu bewerken en deployen." });
    } catch (err) {
      setResult({
        ok: false,
        message: `Import mislukt: ${err instanceof Error ? err.message : "ongeldige BPMN XML"}`,
      });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-fg">Workflow canvas (BPMN)</h1>
            <p className="mt-1 text-sm text-fg-muted">
              Visuele editor voor BPMN 2.0-processen. Kies een template, begin leeg, of importeer XML.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleNewBlank}
              className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-sunken btn-press"
            >
              + Nieuw (leeg)
            </button>
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-sunken btn-press"
            >
              ⬆ Importeer BPMN
            </button>
          </div>
        </div>

        {showImport && (
          <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/30 p-4 dark:border-brand-800 dark:bg-brand-950/10">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">BPMN XML importeren</h3>
              <span className="text-xs text-fg-subtle">
                Tip: laat Claude/GPT een BPMN 2.0 XML genereren en plak 'm hier
              </span>
            </div>
            <textarea
              value={importXmlText}
              onChange={(e) => setImportXmlText(e.target.value)}
              rows={8}
              placeholder={`<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ...>\n  <bpmn:process id="..." ...>\n    ...\n  </bpmn:process>\n</bpmn:definitions>`}
              className="w-full rounded-lg border border-default bg-raised px-3 py-2 font-mono text-xs text-fg"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportXml}
                disabled={!importXmlText.trim()}
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
              >
                Importeer in canvas
              </button>
              <button
                type="button"
                onClick={() => { setShowImport(false); setImportXmlText(""); }}
                className="text-sm text-fg-muted hover:text-fg"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

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
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleDeploy}
              disabled={deploying || testing}
              className="h-[38px] rounded-lg border border-default px-4 text-sm font-medium text-fg-muted hover:bg-sunken disabled:opacity-50 btn-press"
            >
              {deploying ? "Deployen..." : "Deploy"}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || deploying}
              title="Deploy, start een test-instance en spring naar de werkbak"
              className="h-[38px] rounded-lg bg-brand-700 px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press"
            >
              {testing ? "Testen..." : "▶ Test dit proces"}
            </button>
          </div>
        </div>

        {/* Editor + zijpaneel */}
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="h-[600px]">
            <BpmnEditor
              ref={editorRef}
              onSelectionChange={setSelectedElement}
            />
          </div>
          <aside className="rounded-xl border border-default bg-raised p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-fg">Eigenschappen</h2>
            {!selectedElement ? (
              <p className="text-xs text-fg-subtle">
                Klik een element aan op het canvas (taak, gateway, start, einde) om de eigenschappen te zien en te bewerken.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-fg-muted">Element</div>
                  <div className="text-sm text-fg">
                    <span className="mr-2 rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950/20 dark:text-brand-300">
                      {selectedElement.kind}
                    </span>
                    <span className="font-mono text-xs text-fg-subtle">{selectedElement.id}</span>
                  </div>
                </div>

                {/* Naam — beschikbaar voor vrijwel elk element */}
                {(selectedElement.kind === "UserTask" ||
                  selectedElement.kind === "StartEvent" ||
                  selectedElement.kind === "EndEvent" ||
                  selectedElement.kind === "ExclusiveGateway" ||
                  selectedElement.kind === "ParallelGateway" ||
                  selectedElement.kind === "InclusiveGateway" ||
                  selectedElement.kind === "ServiceTask" ||
                  selectedElement.kind === "ScriptTask" ||
                  selectedElement.kind === "SequenceFlow") && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-fg-muted">Naam / label</label>
                    <input
                      type="text"
                      value={selectedElement.name ?? ""}
                      onChange={(e) => applyElementName(e.target.value)}
                      placeholder={
                        selectedElement.kind === "StartEvent"
                          ? "Bijv. Aanmelding ontvangen"
                          : selectedElement.kind === "EndEvent"
                            ? "Bijv. Cliënt in zorg"
                            : selectedElement.kind.endsWith("Gateway")
                              ? "Bijv. Goedgekeurd?"
                              : "Bijv. Aanmelding beoordelen"
                      }
                      className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                    />
                  </div>
                )}

                {/* UserTask-specifiek */}
                {selectedElement.kind === "UserTask" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Toegewezen rol (candidateGroups)</label>
                      <select
                        value={selectedElement.candidateGroups ?? ""}
                        onChange={(e) => applyCandidateGroup(e.target.value)}
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">
                        Specifieke persoon (assignee)
                      </label>
                      <input
                        type="text"
                        value={selectedElement.assignee ?? ""}
                        onChange={(e) => applyAssignee(e.target.value)}
                        placeholder="bv. jan@horizon.nl"
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                      />
                      <p className="mt-1 text-xs text-fg-subtle">
                        {selectedElement.assignee
                          ? "Taak wordt direct aan deze persoon toegewezen (overruled de rol)."
                          : "Leeg = iedereen met de rol kan claimen. Vul in om aan één persoon te geven."}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Formulier (formKey, optioneel)</label>
                      <input
                        type="text"
                        value={selectedElement.formKey ?? ""}
                        onChange={(e) => applyFormKey(e.target.value)}
                        placeholder="bv. intake-formulier"
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                      />
                      <p className="mt-1 text-xs text-fg-subtle">
                        Verwijst naar een JSONForms-template; voorlopig informatief.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Deadline / SLA (dueDate)</label>
                      <input
                        type="text"
                        value={selectedElement.dueDate ?? ""}
                        onChange={(e) => applyDueDate(e.target.value)}
                        placeholder="bv. PT5D (5 dagen)"
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                      />
                      <p className="mt-1 text-xs text-fg-subtle">
                        ISO 8601 duration (PT1H, P2D, PT5D). Flowable rekent vanaf taak-creatie.
                      </p>
                    </div>
                  </>
                )}

                {/* Gateway-specifiek: bewerk condities per uitgaande pijl */}
                {(selectedElement.kind === "ExclusiveGateway" ||
                  selectedElement.kind === "InclusiveGateway") && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-fg-muted">
                      Uitgaande paden ({selectedElement.outgoingFlows?.length ?? 0})
                    </div>
                    {!selectedElement.outgoingFlows?.length ? (
                      <p className="text-xs text-fg-subtle">
                        Teken een pijl vanaf deze gateway naar het volgende element om paden toe te voegen.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedElement.outgoingFlows.map((flow) => (
                          <div key={flow.id} className="rounded-lg border border-default bg-page p-2">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-medium text-fg">
                                → {flow.targetName ?? flow.targetId ?? "(onbekend)"}
                              </span>
                              <span className="font-mono text-fg-subtle">{flow.id}</span>
                            </div>
                            <input
                              type="text"
                              value={flow.condition ?? ""}
                              onChange={(e) => applyFlowCondition(flow.id, e.target.value)}
                              placeholder="${goedgekeurd == true}"
                              className="w-full rounded-md border border-default bg-raised px-2 py-1 font-mono text-xs text-fg"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-fg-subtle">
                      Flowable-expressie, bv. <code className="text-xs">$&#123;goedgekeurd == true&#125;</code>. Leeg = default pad.
                    </p>
                  </div>
                )}

                {/* StartEvent-specifiek: toon de trigger info */}
                {selectedElement.kind === "StartEvent" && (
                  <div className="rounded-lg border border-default bg-page p-3">
                    <div className="mb-1 text-xs font-medium text-fg-muted">Trigger</div>
                    <p className="text-xs text-fg-muted">
                      Dit proces start via een API-call:
                    </p>
                    <code className="mt-1 block rounded bg-raised px-2 py-1 text-xs text-fg">
                      POST /api/processen/{processKey}/start
                    </code>
                    <p className="mt-2 text-xs text-fg-subtle">
                      Meer trigger-types (formulier, timer, event) komen in een volgende versie.
                    </p>
                  </div>
                )}

                {/* SequenceFlow-specifiek */}
                {selectedElement.kind === "SequenceFlow" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-fg-muted">Conditie</label>
                    <input
                      type="text"
                      value={selectedElement.condition ?? ""}
                      onChange={(e) => applyFlowCondition(selectedElement.id, e.target.value)}
                      placeholder="${goedgekeurd == true}"
                      className="w-full rounded-lg border border-default bg-raised px-3 py-2 font-mono text-xs text-fg"
                    />
                    <p className="mt-1 text-xs text-fg-subtle">
                      Van {selectedElement.sourceId ?? "?"} → {selectedElement.targetId ?? "?"}
                    </p>
                  </div>
                )}
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
