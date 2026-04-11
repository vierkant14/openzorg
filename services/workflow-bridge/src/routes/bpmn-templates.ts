import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { deployProcess } from "../lib/flowable-client.js";

export const bpmnTemplateRoutes = new Hono<AppEnv>();

/* -------------------------------------------------------------------------- */
/*  Template definitions                                                      */
/* -------------------------------------------------------------------------- */

interface BpmnTemplate {
  id: string;
  name: string;
  description: string;
  getBpmn: () => string;
}

const TEMPLATES: BpmnTemplate[] = [
  {
    id: "intake-proces",
    name: "Intake Proces",
    description: "Standaard intake workflow: aanmelding beoordelen, goedkeuring/afwijzing, intake plannen",
    getBpmn: getIntakeProcessBpmn,
  },
  {
    id: "zorgplan-evaluatie",
    name: "Zorgplan Evaluatie",
    description: "Periodieke zorgplan-evaluatie: voorbereiding, MDO, evaluatie vastleggen, bijstellen",
    getBpmn: getZorgplanEvaluatieBpmn,
  },
  {
    id: "herindicatie",
    name: "Herindicatie Proces",
    description: "Herindicatie workflow: signalering, gegevens verzamelen, aanvraag indienen, besluit verwerken",
    getBpmn: getHerindicatieBpmn,
  },
  {
    id: "mic-afhandeling",
    name: "MIC Afhandeling",
    description: "MIC-melding afhandeling: analyse, maatregelen bepalen, uitvoeren, evalueren",
    getBpmn: getMicAfhandelingBpmn,
  },
];

/* -------------------------------------------------------------------------- */
/*  BPMN XML generators                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Intake: Aanmelding → Beoordelen → Goedgekeurd? → Ja: Intake plannen / Nee: Afwijzing
 */
export function getIntakeProcessBpmn(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://openzorg.nl/bpmn"
             id="intakeDefinitions">

  <process id="intake-proces" name="Intake Proces" isExecutable="true">

    <startEvent id="start" name="Aanmelding ontvangen" />

    <sequenceFlow id="flow-start-beoordelen" sourceRef="start" targetRef="aanmeldingBeoordelen" />

    <userTask id="aanmeldingBeoordelen"
              name="Aanmelding beoordelen"
              flowable:candidateGroups="planner" />

    <sequenceFlow id="flow-beoordelen-gateway" sourceRef="aanmeldingBeoordelen" targetRef="goedgekeurdGateway" />

    <exclusiveGateway id="goedgekeurdGateway" name="Goedgekeurd?" />

    <sequenceFlow id="flow-goedgekeurd-ja" sourceRef="goedgekeurdGateway" targetRef="intakeGesprekPlannen">
      <conditionExpression xsi:type="tFormalExpression">\${goedgekeurd == true}</conditionExpression>
    </sequenceFlow>

    <sequenceFlow id="flow-goedgekeurd-nee" sourceRef="goedgekeurdGateway" targetRef="afwijzingCommuniceren">
      <conditionExpression xsi:type="tFormalExpression">\${goedgekeurd == false}</conditionExpression>
    </sequenceFlow>

    <userTask id="intakeGesprekPlannen"
              name="Intake gesprek plannen"
              flowable:candidateGroups="zorgmedewerker" />

    <sequenceFlow id="flow-intake-end" sourceRef="intakeGesprekPlannen" targetRef="endGoedgekeurd" />

    <endEvent id="endGoedgekeurd" name="Intake afgerond" />

    <userTask id="afwijzingCommuniceren"
              name="Afwijzing communiceren"
              flowable:candidateGroups="beheerder" />

    <sequenceFlow id="flow-afwijzing-end" sourceRef="afwijzingCommuniceren" targetRef="endAfgewezen" />

    <endEvent id="endAfgewezen" name="Aanmelding afgewezen" />

  </process>

</definitions>`;
}

/**
 * Zorgplan Evaluatie:
 * Start → Voorbereiding (zorgmedewerker) → MDO plannen (planner) →
 * MDO uitvoeren (teamleider) → Evaluatie vastleggen (zorgmedewerker) →
 * Bijstelling nodig? → Ja: Zorgplan bijstellen → Eind / Nee: Eind
 */
function getZorgplanEvaluatieBpmn(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://openzorg.nl/bpmn"
             id="zorgplanEvaluatieDefinitions">

  <process id="zorgplan-evaluatie" name="Zorgplan Evaluatie" isExecutable="true">

    <startEvent id="start" name="Evaluatie gestart" />

    <sequenceFlow id="f1" sourceRef="start" targetRef="voorbereiding" />

    <userTask id="voorbereiding"
              name="Evaluatie voorbereiden"
              flowable:candidateGroups="zorgmedewerker">
      <documentation>Verzamel rapportages, doelen-voortgang en observaties ter voorbereiding op het MDO.</documentation>
    </userTask>

    <sequenceFlow id="f2" sourceRef="voorbereiding" targetRef="mdoPlannen" />

    <userTask id="mdoPlannen"
              name="MDO inplannen"
              flowable:candidateGroups="planner">
      <documentation>Plan het multidisciplinair overleg met alle betrokken disciplines.</documentation>
    </userTask>

    <sequenceFlow id="f3" sourceRef="mdoPlannen" targetRef="mdoUitvoeren" />

    <userTask id="mdoUitvoeren"
              name="MDO uitvoeren"
              flowable:candidateGroups="teamleider">
      <documentation>Voer het MDO uit. Bespreek voortgang op alle leefgebieden.</documentation>
    </userTask>

    <sequenceFlow id="f4" sourceRef="mdoUitvoeren" targetRef="evaluatieVastleggen" />

    <userTask id="evaluatieVastleggen"
              name="Evaluatie vastleggen"
              flowable:candidateGroups="zorgmedewerker">
      <documentation>Leg de evaluatieresultaten vast in het zorgplan. Beoordeel per doel of het is bereikt.</documentation>
    </userTask>

    <sequenceFlow id="f5" sourceRef="evaluatieVastleggen" targetRef="bijstellingGateway" />

    <exclusiveGateway id="bijstellingGateway" name="Bijstelling nodig?" />

    <sequenceFlow id="f6-ja" sourceRef="bijstellingGateway" targetRef="zorgplanBijstellen">
      <conditionExpression xsi:type="tFormalExpression">\${bijstellingNodig == true}</conditionExpression>
    </sequenceFlow>

    <sequenceFlow id="f6-nee" sourceRef="bijstellingGateway" targetRef="endEvaluatie">
      <conditionExpression xsi:type="tFormalExpression">\${bijstellingNodig == false}</conditionExpression>
    </sequenceFlow>

    <userTask id="zorgplanBijstellen"
              name="Zorgplan bijstellen"
              flowable:candidateGroups="zorgmedewerker">
      <documentation>Pas doelen en interventies aan op basis van de evaluatie.</documentation>
    </userTask>

    <sequenceFlow id="f7" sourceRef="zorgplanBijstellen" targetRef="endBijgesteld" />

    <endEvent id="endBijgesteld" name="Zorgplan bijgesteld" />
    <endEvent id="endEvaluatie" name="Evaluatie afgerond" />

  </process>

</definitions>`;
}

/**
 * Herindicatie:
 * Start → Signalering controleren (planner) →
 * Clientgegevens actualiseren (zorgmedewerker) →
 * Herindicatie aanvragen (beheerder) →
 * Besluit verwerken (planner) → Eind
 */
function getHerindicatieBpmn(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://openzorg.nl/bpmn"
             id="herindicatieDefinitions">

  <process id="herindicatie" name="Herindicatie Proces" isExecutable="true">

    <startEvent id="start" name="Herindicatie signalering" />

    <sequenceFlow id="f1" sourceRef="start" targetRef="signaleringControleren" />

    <userTask id="signaleringControleren"
              name="Signalering controleren"
              flowable:candidateGroups="planner">
      <documentation>Controleer of de huidige indicatie afloopt en of herindicatie nodig is. Controleer de einddatum en het zorgprofiel.</documentation>
    </userTask>

    <sequenceFlow id="f2" sourceRef="signaleringControleren" targetRef="nodigGateway" />

    <exclusiveGateway id="nodigGateway" name="Herindicatie nodig?" />

    <sequenceFlow id="f3-ja" sourceRef="nodigGateway" targetRef="gegevensActualiseren">
      <conditionExpression xsi:type="tFormalExpression">\${herindicatieNodig == true}</conditionExpression>
    </sequenceFlow>

    <sequenceFlow id="f3-nee" sourceRef="nodigGateway" targetRef="endNietNodig">
      <conditionExpression xsi:type="tFormalExpression">\${herindicatieNodig == false}</conditionExpression>
    </sequenceFlow>

    <userTask id="gegevensActualiseren"
              name="Clientgegevens actualiseren"
              flowable:candidateGroups="zorgmedewerker">
      <documentation>Werk het zorgplan bij, actualiseer diagnoses en zorgzwaarte. Vul het aanvraagformulier in.</documentation>
    </userTask>

    <sequenceFlow id="f4" sourceRef="gegevensActualiseren" targetRef="aanvraagIndienen" />

    <userTask id="aanvraagIndienen"
              name="Herindicatie aanvragen bij CIZ"
              flowable:candidateGroups="beheerder">
      <documentation>Dien de herindicatie-aanvraag in bij het CIZ (Wlz) of de gemeente (Wmo).</documentation>
    </userTask>

    <sequenceFlow id="f5" sourceRef="aanvraagIndienen" targetRef="besluitVerwerken" />

    <userTask id="besluitVerwerken"
              name="Indicatiebesluit verwerken"
              flowable:candidateGroups="planner">
      <documentation>Verwerk het indicatiebesluit. Werk de indicatiegegevens bij in het clientdossier en plan de zorg in.</documentation>
    </userTask>

    <sequenceFlow id="f6" sourceRef="besluitVerwerken" targetRef="endVerwerkt" />

    <endEvent id="endVerwerkt" name="Herindicatie verwerkt" />
    <endEvent id="endNietNodig" name="Geen herindicatie nodig" />

  </process>

</definitions>`;
}

/**
 * MIC Afhandeling:
 * Start → Melding analyseren (teamleider) →
 * Ernst bepalen → Laag: Maatregelen registreren → Eind
 *               → Hoog: Maatregelen bepalen (beheerder) → Uitvoeren (zorgmedewerker) → Evalueren (teamleider) → Eind
 */
function getMicAfhandelingBpmn(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://openzorg.nl/bpmn"
             id="micAfhandelingDefinitions">

  <process id="mic-afhandeling" name="MIC Afhandeling" isExecutable="true">

    <startEvent id="start" name="MIC-melding ontvangen" />

    <sequenceFlow id="f1" sourceRef="start" targetRef="meldingAnalyseren" />

    <userTask id="meldingAnalyseren"
              name="Melding analyseren"
              flowable:candidateGroups="teamleider">
      <documentation>Analyseer de MIC-melding. Bepaal de ernst en de oorzaak van het incident.</documentation>
    </userTask>

    <sequenceFlow id="f2" sourceRef="meldingAnalyseren" targetRef="ernstGateway" />

    <exclusiveGateway id="ernstGateway" name="Ernst niveau?" />

    <sequenceFlow id="f3-laag" sourceRef="ernstGateway" targetRef="maatregelenRegistreren">
      <conditionExpression xsi:type="tFormalExpression">\${ernstNiveau == 'laag'}</conditionExpression>
    </sequenceFlow>

    <sequenceFlow id="f3-hoog" sourceRef="ernstGateway" targetRef="maatregelenBepalen">
      <conditionExpression xsi:type="tFormalExpression">\${ernstNiveau == 'hoog'}</conditionExpression>
    </sequenceFlow>

    <userTask id="maatregelenRegistreren"
              name="Maatregelen registreren"
              flowable:candidateGroups="teamleider">
      <documentation>Registreer de genomen maatregelen voor dit laag-risico incident.</documentation>
    </userTask>

    <sequenceFlow id="f4-laag" sourceRef="maatregelenRegistreren" targetRef="endLaag" />

    <endEvent id="endLaag" name="MIC afgehandeld (laag)" />

    <userTask id="maatregelenBepalen"
              name="Verbetermaatregelen bepalen"
              flowable:candidateGroups="beheerder">
      <documentation>Bepaal structurele verbetermaatregelen voor dit hoog-risico incident. Stel een actieplan op.</documentation>
    </userTask>

    <sequenceFlow id="f5" sourceRef="maatregelenBepalen" targetRef="maatregelenUitvoeren" />

    <userTask id="maatregelenUitvoeren"
              name="Maatregelen uitvoeren"
              flowable:candidateGroups="zorgmedewerker">
      <documentation>Voer de bepaalde verbetermaatregelen uit in de dagelijkse praktijk.</documentation>
    </userTask>

    <sequenceFlow id="f6" sourceRef="maatregelenUitvoeren" targetRef="evalueren" />

    <userTask id="evalueren"
              name="Effectiviteit evalueren"
              flowable:candidateGroups="teamleider">
      <documentation>Evalueer of de maatregelen effectief zijn geweest. Zijn er vervolgacties nodig?</documentation>
    </userTask>

    <sequenceFlow id="f7" sourceRef="evalueren" targetRef="endHoog" />

    <endEvent id="endHoog" name="MIC afgehandeld (hoog)" />

  </process>

</definitions>`;
}

/* -------------------------------------------------------------------------- */
/*  Routes                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * GET / — List all available BPMN templates.
 */
bpmnTemplateRoutes.get("/", (c) => {
  return c.json({
    templates: TEMPLATES.map(({ id, name, description }) => ({
      id,
      name,
      description,
    })),
  });
});

/**
 * GET /:templateId — Get BPMN XML for a specific template.
 */
bpmnTemplateRoutes.get("/:templateId", (c) => {
  const templateId = c.req.param("templateId");
  const template = TEMPLATES.find((t) => t.id === templateId);

  if (!template) {
    return c.json({ error: "BPMN template niet gevonden" }, 404);
  }

  return c.text(template.getBpmn(), 200, {
    "Content-Type": "application/xml",
  });
});

/**
 * POST /:templateId/deploy — Deploy a template to Flowable.
 */
bpmnTemplateRoutes.post("/:templateId/deploy", async (c) => {
  const templateId = c.req.param("templateId");
  const template = TEMPLATES.find((t) => t.id === templateId);

  if (!template) {
    return c.json({ error: "BPMN template niet gevonden" }, 404);
  }

  try {
    const bpmnXml = template.getBpmn();
    const result = await deployProcess(bpmnXml, template.id);
    return c.json(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deployment mislukt";
    return c.json({ error: message }, 500);
  }
});
