"use client";

import { useEffect, useRef, useState } from "react";

import "dmn-js/dist/assets/diagram-js.css";
import "dmn-js/dist/assets/dmn-js-shared.css";
import "dmn-js/dist/assets/dmn-js-decision-table.css";
import "dmn-js/dist/assets/dmn-js-decision-table-controls.css";
import "dmn-js/dist/assets/dmn-js-boxed-expression.css";
import "dmn-js/dist/assets/dmn-js-boxed-expression-controls.css";
import "dmn-js/dist/assets/dmn-js-drd.css";
import "dmn-js/dist/assets/dmn-js-literal-expression.css";
import "dmn-js/dist/assets/dmn-font/css/dmn.css";

const STARTER_DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="definitions_1"
             name="Nieuwe beslistabel"
             namespace="http://openzorg.nl/dmn">
  <decision id="decision_1" name="Nieuwe beslissing">
    <decisionTable id="decisionTable_1" hitPolicy="UNIQUE">
      <input id="input_1" label="Input">
        <inputExpression id="inputExpression_1" typeRef="string">
          <text>input1</text>
        </inputExpression>
      </input>
      <output id="output_1" label="Output" name="output1" typeRef="string" />
      <rule id="rule_1">
        <inputEntry id="inputEntry_1">
          <text>"waarde"</text>
        </inputEntry>
        <outputEntry id="outputEntry_1">
          <text>"resultaat"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram>
      <dmndi:DMNShape dmnElementRef="decision_1">
        <dc:Bounds x="160" y="100" width="180" height="80" />
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;

export interface DmnEditorHandle {
  loadXml: (xml: string) => Promise<void>;
  exportXml: () => Promise<string | null>;
}

interface DmnEditorProps {
  initialXml?: string;
}

export function DmnEditor({ initialXml }: DmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const DmnModelerCtor = (await import("dmn-js/lib/Modeler")).default;
        if (cancelled || !containerRef.current) return;
        const modeler = new DmnModelerCtor({ container: containerRef.current });
        modelerRef.current = modeler;
        await modeler.importXML(initialXml ?? STARTER_DMN);
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kon DMN-editor niet laden");
      }
    })();

    return () => {
      cancelled = true;
      try {
        (modelerRef.current as { destroy?: () => void } | null)?.destroy?.();
      } catch {
        // ignore
      }
      modelerRef.current = null;
    };
  }, [initialXml]);

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
        style={{ minHeight: 500 }}
      />
      {!ready && !error && (
        <span className="text-xs text-fg-subtle">DMN-editor laden...</span>
      )}
    </div>
  );
}
