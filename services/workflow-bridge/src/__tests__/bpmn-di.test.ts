import { describe, expect, it } from "vitest";

import { genereerDi } from "../lib/bpmn-di.js";
import { getTemplateById } from "../routes/bpmn-templates.js";

describe("bpmn-di generator", () => {
  it("genereert een shape per element en een edge met ≥2 waypoints per flow", () => {
    const xml = genereerDi(
      "test-proces",
      [
        { id: "start", type: "event", kolom: 0 },
        { id: "stap1", type: "task", kolom: 1 },
        { id: "keuze", type: "gateway", kolom: 2 },
        { id: "onder", type: "task", kolom: 3, rij: 1 },
        { id: "einde", type: "event", kolom: 4 },
      ],
      [
        { id: "f1", van: "start", naar: "stap1" },
        { id: "f2", van: "stap1", naar: "keuze" },
        { id: "f3", van: "keuze", naar: "onder" },
        { id: "f4", van: "onder", naar: "einde" },
      ],
    );

    expect(xml.match(/BPMNShape/g)?.length).toBe(10); // open+close per element
    expect(xml.match(/BPMNEdge/g)?.length).toBe(8); // open+close per flow
    // Kruis-rij-flow (keuze → onder) heeft 3 waypoints
    const edgeF3 = xml.split('bpmnElement="f3"')[1]?.split("</bpmndi:BPMNEdge>")[0] ?? "";
    expect(edgeF3.match(/waypoint/g)?.length).toBe(3);
  });

  it("gooit bij een flow naar een onbekend element", () => {
    expect(() =>
      genereerDi("x", [{ id: "a", type: "task", kolom: 0 }], [{ id: "f", van: "a", naar: "bestaat-niet" }]),
    ).toThrow(/onbekend element/);
  });
});

describe("templates hebben volledige DI", () => {
  const TEMPLATE_IDS = [
    "intake-proces",
    "zorgplan-evaluatie",
    "herindicatie",
    "mic-afhandeling",
    "vaccinatie-campagne",
  ];

  it.each(TEMPLATE_IDS)("%s: elke userTask, gateway en event heeft een BPMNShape", (id) => {
    const xml = getTemplateById(id)!.getBpmn();

    const elementIds = [
      ...xml.matchAll(/<(?:userTask|exclusiveGateway|startEvent|endEvent) id="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(elementIds.length).toBeGreaterThan(2);

    for (const elementId of elementIds) {
      expect(xml, `shape voor ${elementId} in ${id}`).toMatch(
        new RegExp(`<bpmndi:BPMNShape[^>]*bpmnElement="${elementId}"`),
      );
    }

    const flowIds = [...xml.matchAll(/<sequenceFlow id="([^"]+)"/g)].map((m) => m[1]);
    for (const flowId of flowIds) {
      expect(xml, `edge voor ${flowId} in ${id}`).toMatch(
        new RegExp(`<bpmndi:BPMNEdge[^>]*bpmnElement="${flowId}"`),
      );
    }
  });
});
