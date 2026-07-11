/**
 * BPMN-DI-generator (W1-5): genereert een volledig <bpmndi:BPMNDiagram>-blok
 * voor de hand-geschreven templates, zodat bpmn-js ze zonder rommelige
 * auto-layout rendert (backlog-item "volledige BPMN-DI").
 *
 * Model: elementen staan in kolommen (hoofdstroom op rij 0, aftakking op
 * rij 1). Edges lopen recht tussen kolommen; kruis-rij-edges buigen met een
 * extra waypoint.
 */

export interface DiElement {
  id: string;
  type: "event" | "task" | "gateway";
  kolom: number;
  /** 0 = hoofdstroom (default), 1 = aftakking eronder. */
  rij?: 0 | 1;
}

export interface DiFlow {
  id: string;
  van: string;
  naar: string;
}

const KOLOM_BREEDTE = 175;
const START_X = 60;
const RIJ_Y: Record<0 | 1, number> = { 0: 120, 1: 320 };

interface Vorm {
  x: number;
  y: number;
  breedte: number;
  hoogte: number;
}

function vormVoor(element: DiElement): Vorm {
  const kolomX = START_X + element.kolom * KOLOM_BREEDTE;
  const rijTop = RIJ_Y[element.rij ?? 0];

  switch (element.type) {
    case "event":
      return { x: kolomX + 42, y: rijTop + 22, breedte: 36, hoogte: 36 };
    case "gateway":
      return { x: kolomX + 35, y: rijTop + 15, breedte: 50, hoogte: 50 };
    case "task":
      return { x: kolomX, y: rijTop, breedte: 120, hoogte: 80 };
  }
}

function midden(vorm: Vorm): { x: number; y: number } {
  return { x: vorm.x + vorm.breedte / 2, y: vorm.y + vorm.hoogte / 2 };
}

function waypoints(van: Vorm, naar: Vorm): Array<{ x: number; y: number }> {
  const vanMidden = midden(van);
  const naarMidden = midden(naar);

  if (Math.abs(vanMidden.y - naarMidden.y) < 1) {
    // Zelfde rij: rechte horizontale lijn van rand naar rand
    return [
      { x: van.x + van.breedte, y: vanMidden.y },
      { x: naar.x, y: naarMidden.y },
    ];
  }

  // Kruis-rij: omlaag/omhoog uit de bron, dan horizontaal het doel in
  return [
    { x: vanMidden.x, y: vanMidden.y > naarMidden.y ? van.y : van.y + van.hoogte },
    { x: vanMidden.x, y: naarMidden.y },
    { x: naar.x, y: naarMidden.y },
  ];
}

export function genereerDi(processId: string, elementen: DiElement[], flows: DiFlow[]): string {
  const vormen = new Map<string, Vorm>();
  for (const element of elementen) {
    vormen.set(element.id, vormVoor(element));
  }

  const shapes = elementen
    .map((element) => {
      const vorm = vormen.get(element.id)!;
      const marker = element.type === "gateway" ? ' isMarkerVisible="true"' : "";
      return `      <bpmndi:BPMNShape bpmnElement="${element.id}" id="Shape_${element.id}"${marker}>
        <omgdc:Bounds x="${vorm.x}" y="${vorm.y}" width="${vorm.breedte}" height="${vorm.hoogte}" />
      </bpmndi:BPMNShape>`;
    })
    .join("\n");

  const edges = flows
    .map((flow) => {
      const van = vormen.get(flow.van);
      const naar = vormen.get(flow.naar);
      if (!van || !naar) {
        throw new Error(`DI-flow ${flow.id} verwijst naar onbekend element (${flow.van} → ${flow.naar})`);
      }
      const punten = waypoints(van, naar)
        .map((p) => `        <omgdi:waypoint x="${p.x}" y="${p.y}" />`)
        .join("\n");
      return `      <bpmndi:BPMNEdge bpmnElement="${flow.id}" id="Edge_${flow.id}">
${punten}
      </bpmndi:BPMNEdge>`;
    })
    .join("\n");

  return `  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}">
    <bpmndi:BPMNPlane bpmnElement="${processId}" id="BPMNPlane_${processId}">
${shapes}
${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>`;
}
