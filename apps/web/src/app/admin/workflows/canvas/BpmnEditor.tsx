"use client";

import { useEffect, useRef, useState } from "react";

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

interface BpmnEditorProps {
  initialXml?: string;
  onSaved?: (xml: string) => void;
}

interface BpmnModeler {
  importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
  saveXML: (opts: { format: boolean }) => Promise<{ xml: string }>;
  destroy: () => void;
  get: (name: string) => { zoom: (fit: string) => void };
}

export function BpmnEditor({ initialXml, onSaved }: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        modeler.get("canvas").zoom("fit-viewport");
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
  }, [initialXml]);

  async function handleExport() {
    if (!modelerRef.current) return;
    setSaving(true);
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      onSaved?.(xml);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {error && (
        <div className="rounded-lg border border-coral-200 bg-coral-50 px-4 py-2 text-sm text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="relative min-h-[500px] flex-1 rounded-lg border border-default bg-raised"
        style={{ minHeight: 500 }}
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-fg-subtle">
          {ready ? "Klaar — sleep elementen uit het palet links" : "Editor laden..."}
        </span>
        <button
          type="button"
          onClick={handleExport}
          disabled={!ready || saving}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press"
        >
          {saving ? "Exporteren..." : "Exporteer BPMN XML"}
        </button>
      </div>
    </div>
  );
}
