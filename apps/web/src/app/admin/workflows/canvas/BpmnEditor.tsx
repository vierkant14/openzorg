"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";

const EMPTY_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:flowable="http://flowable.org/bpmn"
                  id="Definitions_1"
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

export type ElementKind =
  | "UserTask"
  | "StartEvent"
  | "EndEvent"
  | "ExclusiveGateway"
  | "ParallelGateway"
  | "InclusiveGateway"
  | "ServiceTask"
  | "ScriptTask"
  | "SequenceFlow"
  | "Process"
  | "Other";

export interface SelectedElement {
  id: string;
  kind: ElementKind;
  name?: string;
  // UserTask-specifiek
  candidateGroups?: string;
  assignee?: string;
  formKey?: string;
  dueDate?: string;
  // StartEvent-specifiek
  triggerType?: "api" | "form" | "timer" | "event";
  triggerConfig?: string;
  // Gateway-specifiek
  outgoingFlows?: Array<{
    id: string;
    name?: string;
    targetId: string;
    targetName?: string;
    condition?: string;
  }>;
  // SequenceFlow-specifiek
  condition?: string;
  sourceId?: string;
  targetId?: string;
}

// Backwards-compat alias
export type SelectedTask = SelectedElement;

export interface BpmnEditorHandle {
  loadXml: (xml: string) => Promise<void>;
  exportXml: () => Promise<string | null>;
  zoomFit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getSelected: () => SelectedElement | null;
  setElementName: (value: string) => void;
  setCandidateGroups: (value: string) => void;
  setAssignee: (value: string) => void;
  setFormKey: (value: string) => void;
  setDueDate: (value: string) => void;
  setTaskName: (value: string) => void;
  setFlowCondition: (flowId: string, expression: string) => void;
  setStartTrigger: (type: "api" | "form" | "timer" | "event", config: string) => void;
}

interface BpmnCanvas {
  zoom: (fit: string | number, center?: unknown) => number;
}

interface BpmnSelection {
  get: () => BpmnElement[];
}

interface BpmnModeling {
  updateProperties: (element: BpmnElement, props: Record<string, unknown>) => void;
}

interface BpmnFactory {
  create: (type: string, attrs?: Record<string, unknown>) => unknown;
}

interface BpmnElementRegistry {
  get: (id: string) => BpmnElement | undefined;
}

interface BpmnBusinessObject {
  id?: string;
  name?: string;
  $type?: string;
  candidateGroups?: string;
  $attrs?: Record<string, unknown>;
  outgoing?: BpmnBusinessObject[];
  incoming?: BpmnBusinessObject[];
  sourceRef?: BpmnBusinessObject;
  targetRef?: BpmnBusinessObject;
  conditionExpression?: { body?: string; $type?: string };
}

interface BpmnElement {
  id: string;
  type: string;
  businessObject: BpmnBusinessObject;
}

interface BpmnEventBus {
  on: (event: string, cb: (e: { newSelection?: BpmnElement[] }) => void) => void;
}

interface BpmnModeler {
  importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
  saveXML: (opts: { format: boolean }) => Promise<{ xml: string }>;
  destroy: () => void;
  get(name: string): unknown;
}

interface BpmnEditorProps {
  initialXml?: string;
  onSelectionChange?: (element: SelectedElement | null) => void;
}

/** Verkort een bpmn:* type naar de kind. */
function typeToKind(type: string): ElementKind {
  const short = type.replace(/^bpmn:/, "");
  switch (short) {
    case "UserTask":
    case "StartEvent":
    case "EndEvent":
    case "ExclusiveGateway":
    case "ParallelGateway":
    case "InclusiveGateway":
    case "ServiceTask":
    case "ScriptTask":
    case "SequenceFlow":
    case "Process":
      return short;
    default:
      return "Other";
  }
}

/** Bouw een SelectedElement-snapshot van een bpmn-js element. */
function describeElement(el: BpmnElement): SelectedElement {
  const bo = el.businessObject;
  const kind = typeToKind(el.type);
  const result: SelectedElement = {
    id: el.id,
    kind,
    name: bo.name,
  };

  if (kind === "UserTask") {
    const attrs = bo.$attrs ?? {};
    result.candidateGroups = bo.candidateGroups ?? (attrs["flowable:candidateGroups"] as string | undefined);
    result.assignee = (bo as BpmnBusinessObject & { assignee?: string }).assignee ?? (attrs["flowable:assignee"] as string | undefined);
    result.formKey = (bo as BpmnBusinessObject & { formKey?: string }).formKey ?? (attrs["flowable:formKey"] as string | undefined);
    result.dueDate = (bo as BpmnBusinessObject & { dueDate?: string }).dueDate ?? (attrs["flowable:dueDate"] as string | undefined);
  }

  if (kind.endsWith("Gateway")) {
    result.outgoingFlows = (bo.outgoing ?? []).map((flow) => ({
      id: flow.id ?? "",
      name: flow.name,
      targetId: flow.targetRef?.id ?? "",
      targetName: flow.targetRef?.name,
      condition: flow.conditionExpression?.body,
    }));
  }

  if (kind === "SequenceFlow") {
    result.sourceId = bo.sourceRef?.id;
    result.targetId = bo.targetRef?.id;
    result.condition = bo.conditionExpression?.body;
  }

  if (kind === "StartEvent") {
    const attrs = bo.$attrs ?? {};
    const rawType = attrs["openzorg:triggerType"] as string | undefined;
    const rawCfg = attrs["openzorg:triggerConfig"] as string | undefined;
    result.triggerType = (rawType as "api" | "form" | "timer" | "event" | undefined) ?? "api";
    result.triggerConfig = rawCfg ?? "";
  }

  return result;
}

export const BpmnEditor = forwardRef<BpmnEditorHandle, BpmnEditorProps>(function BpmnEditor(
  { initialXml, onSelectionChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => {
      const getSelected = (): { element: BpmnElement | null; snapshot: SelectedElement | null } => {
        if (!modelerRef.current) return { element: null, snapshot: null };
        const selection = modelerRef.current.get("selection") as BpmnSelection;
        const picked = selection.get()[0];
        if (!picked) return { element: null, snapshot: null };
        return { element: picked, snapshot: describeElement(picked) };
      };

      const updateSelected = (props: Record<string, unknown>) => {
        if (!modelerRef.current) return;
        const { element } = getSelected();
        if (!element) return;
        const modeling = modelerRef.current.get("modeling") as BpmnModeling;
        modeling.updateProperties(element, props);
      };

      return {
        async loadXml(xml: string) {
          if (!modelerRef.current) return;
          try {
            await modelerRef.current.importXML(xml);
            (modelerRef.current.get("canvas") as BpmnCanvas).zoom("fit-viewport");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Kon BPMN niet laden");
          }
        },
        async exportXml() {
          if (!modelerRef.current) return null;
          try {
            const { xml } = await modelerRef.current.saveXML({ format: true });
            return xml;
          } catch (err) {
            setError(err instanceof Error ? err.message : "Export mislukt");
            return null;
          }
        },
        zoomFit() {
          if (!modelerRef.current) return;
          (modelerRef.current.get("canvas") as BpmnCanvas).zoom("fit-viewport");
        },
        zoomIn() {
          if (!modelerRef.current) return;
          const canvas = modelerRef.current.get("canvas") as BpmnCanvas & { zoom: (level: number | string) => number };
          const current = canvas.zoom("fit-viewport");
          canvas.zoom(typeof current === "number" ? current * 1.2 : 1);
        },
        zoomOut() {
          if (!modelerRef.current) return;
          const canvas = modelerRef.current.get("canvas") as BpmnCanvas & { zoom: (level: number | string) => number };
          const current = canvas.zoom("fit-viewport");
          canvas.zoom(typeof current === "number" ? current * 0.8 : 1);
        },
        getSelected() {
          return getSelected().snapshot;
        },
        setElementName(value: string) {
          updateSelected({ name: value });
        },
        setTaskName(value: string) {
          updateSelected({ name: value });
        },
        setCandidateGroups(value: string) {
          updateSelected({ "flowable:candidateGroups": value });
        },
        setAssignee(value: string) {
          updateSelected({ "flowable:assignee": value });
        },
        setFormKey(value: string) {
          updateSelected({ "flowable:formKey": value });
        },
        setDueDate(value: string) {
          updateSelected({ "flowable:dueDate": value });
        },
        setFlowCondition(flowId: string, expression: string) {
          if (!modelerRef.current) return;
          const registry = modelerRef.current.get("elementRegistry") as BpmnElementRegistry;
          const flow = registry.get(flowId);
          if (!flow) return;
          const modeling = modelerRef.current.get("modeling") as BpmnModeling;
          if (!expression.trim()) {
            modeling.updateProperties(flow, { conditionExpression: undefined });
            return;
          }
          const bpmnFactory = modelerRef.current.get("bpmnFactory") as BpmnFactory;
          const conditionExpression = bpmnFactory.create("bpmn:FormalExpression", {
            body: expression,
          });
          modeling.updateProperties(flow, { conditionExpression });
        },
        setStartTrigger(type, config) {
          // Schrijf de trigger-metadata als custom openzorg:* attributen op
          // het start-event. Wordt bij export behouden omdat bpmn-js onbekende
          // attributen in $attrs bewaart.
          updateSelected({
            "openzorg:triggerType": type,
            "openzorg:triggerConfig": config,
          });
        },
      };
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const BpmnModelerCtor = (await import("bpmn-js/lib/Modeler")).default;
        if (cancelled || !containerRef.current) return;

        const modeler = new BpmnModelerCtor({
          container: containerRef.current,
        }) as unknown as BpmnModeler;
        modelerRef.current = modeler;

        await modeler.importXML(initialXml ?? EMPTY_DIAGRAM);
        (modeler.get("canvas") as BpmnCanvas).zoom("fit-viewport");

        // Selectie-events doorgeven aan de parent
        const eventBus = modeler.get("eventBus") as BpmnEventBus;
        eventBus.on("selection.changed", (e) => {
          if (!onSelectionChange) return;
          const picked = e.newSelection?.[0];
          if (!picked) {
            onSelectionChange(null);
            return;
          }
          onSelectionChange(describeElement(picked));
        });

        // Ook bij element.changed updates doorgeven zodat het panel
        // live bijwerkt na modeling.updateProperties aanroepen elders
        eventBus.on("element.changed", ((e: { element?: BpmnElement }) => {
          if (!onSelectionChange || !modelerRef.current) return;
          const selection = modelerRef.current.get("selection") as BpmnSelection;
          const picked = selection.get()[0];
          if (picked && e.element && picked.id === e.element.id) {
            onSelectionChange(describeElement(picked));
          }
        }) as unknown as (e: { newSelection?: BpmnElement[] }) => void);

        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kon BPMN-editor niet laden");
      }
    })();

    return () => {
      cancelled = true;
      modelerRef.current?.destroy();
      modelerRef.current = null;
    };

  }, []);

  return (
    <div className="flex h-full flex-col gap-2">
      {error && (
        <div className="rounded-lg border border-coral-200 bg-coral-50 px-4 py-2 text-sm text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden rounded-xl border border-default bg-raised shadow-sm"
        style={{ minHeight: 560 }}
      />
      {!ready && (
        <span className="text-xs text-fg-subtle">Editor laden...</span>
      )}
    </div>
  );
});
