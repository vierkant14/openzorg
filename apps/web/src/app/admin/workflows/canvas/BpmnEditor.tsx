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

export interface BpmnEditorHandle {
  loadXml: (xml: string) => Promise<void>;
  exportXml: () => Promise<string | null>;
  zoomFit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getSelectedUserTask: () => SelectedTask | null;
  setCandidateGroups: (value: string) => void;
  setAssignee: (value: string) => void;
  setTaskName: (value: string) => void;
}

export interface SelectedTask {
  id: string;
  name?: string;
  candidateGroups?: string;
  assignee?: string;
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

interface BpmnBusinessObject {
  id?: string;
  name?: string;
  $type?: string;
  candidateGroups?: string;
  $attrs?: Record<string, unknown>;
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
  onSelectionChange?: (task: SelectedTask | null) => void;
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
    () => ({
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
      getSelectedUserTask() {
        if (!modelerRef.current) return null;
        const selection = modelerRef.current.get("selection") as BpmnSelection;
        const picked = selection.get()[0];
        if (!picked) return null;
        if (!picked.type.endsWith("UserTask")) return null;
        const bo = picked.businessObject;
        return {
          id: picked.id,
          name: bo.name,
          candidateGroups: bo.candidateGroups ?? (bo.$attrs?.["flowable:candidateGroups"] as string | undefined),
          assignee: (bo as BpmnBusinessObject & { assignee?: string }).assignee ?? (bo.$attrs?.["flowable:assignee"] as string | undefined),
        };
      },
      setCandidateGroups(value: string) {
        if (!modelerRef.current) return;
        const selection = modelerRef.current.get("selection") as BpmnSelection;
        const picked = selection.get()[0];
        if (!picked || !picked.type.endsWith("UserTask")) return;
        const modeling = modelerRef.current.get("modeling") as BpmnModeling;
        // Flowable-extensie: candidateGroups leeft als attribuut op de userTask
        modeling.updateProperties(picked, { "flowable:candidateGroups": value });
      },
      setAssignee(value: string) {
        if (!modelerRef.current) return;
        const selection = modelerRef.current.get("selection") as BpmnSelection;
        const picked = selection.get()[0];
        if (!picked || !picked.type.endsWith("UserTask")) return;
        const modeling = modelerRef.current.get("modeling") as BpmnModeling;
        modeling.updateProperties(picked, { "flowable:assignee": value });
      },
      setTaskName(value: string) {
        if (!modelerRef.current) return;
        const selection = modelerRef.current.get("selection") as BpmnSelection;
        const picked = selection.get()[0];
        if (!picked || !picked.type.endsWith("UserTask")) return;
        const modeling = modelerRef.current.get("modeling") as BpmnModeling;
        modeling.updateProperties(picked, { name: value });
      },
    }),
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

        // Selectie-events doorgeven aan de parent voor het properties-panel
        const eventBus = modeler.get("eventBus") as BpmnEventBus;
        eventBus.on("selection.changed", (e) => {
          if (!onSelectionChange) return;
          const picked = e.newSelection?.[0];
          if (!picked) {
            onSelectionChange(null);
            return;
          }
          if (!picked.type.endsWith("UserTask")) {
            onSelectionChange(null);
            return;
          }
          const bo = picked.businessObject;
          onSelectionChange({
            id: picked.id,
            name: bo.name,
            candidateGroups: bo.candidateGroups ?? (bo.$attrs?.["flowable:candidateGroups"] as string | undefined),
            assignee: (bo as BpmnBusinessObject & { assignee?: string }).assignee ?? (bo.$attrs?.["flowable:assignee"] as string | undefined),
          });
        });

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
