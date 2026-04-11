import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const vbmRoutes = new Hono<AppEnv>();

/**
 * Vrijheidsbeperkende Maatregelen (VBM) — Wvggz/Wzd compliance.
 *
 * Stored as FHIR Procedure resources with specific coding:
 * - Procedure.code = type maatregel
 * - Procedure.subject = Patient
 * - Procedure.performedPeriod = when the measure was/is active
 * - Procedure.reasonCode = reden/grondslag
 * - Procedure.note = evaluaties
 *
 * Extensions for:
 * - Wettelijke grondslag (Wvggz / Wzd / Wmo / overig)
 * - Evaluatiefrequentie
 * - Evaluatiehistorie
 */

const VBM_EXT = "https://openzorg.nl/extensions/vbm";

const MAATREGEL_TYPES = [
  { code: "fixatie", display: "Fixatie" },
  { code: "afzondering", display: "Afzondering" },
  { code: "separatie", display: "Separatie" },
  { code: "medicatie-onvrijwillig", display: "Onvrijwillige medicatie" },
  { code: "bewegingsbeperking", display: "Bewegingsbeperking" },
  { code: "toezicht", display: "Continu toezicht" },
  { code: "beperking-communicatie", display: "Beperking communicatiemiddelen" },
  { code: "beperking-bezoek", display: "Beperking bezoek" },
  { code: "deur-op-slot", display: "Deur op slot (individueel)" },
  { code: "gesloten-afdeling", display: "Gesloten afdeling" },
  { code: "camerabewaking", display: "Camerabewaking" },
  { code: "sensor", display: "Sensortechnologie" },
] as const;

const WETTELIJKE_GRONDSLAGEN = [
  { code: "wvggz", display: "Wet verplichte geestelijke gezondheidszorg (Wvggz)" },
  { code: "wzd", display: "Wet zorg en dwang (Wzd)" },
  { code: "wmo", display: "Wet maatschappelijke ondersteuning (Wmo)" },
  { code: "instemming", display: "Met instemming client/vertegenwoordiger" },
  { code: "noodsituatie", display: "Noodsituatie (tijdelijk)" },
] as const;

/**
 * GET /api/vbm/types — List available measure types and legal bases.
 */
vbmRoutes.get("/types", (c) => {
  return c.json({
    maatregelTypes: MAATREGEL_TYPES,
    grondslagen: WETTELIJKE_GRONDSLAGEN,
  });
});

/**
 * GET /api/clients/:patientId/vbm — List all VBMs for a patient.
 */
vbmRoutes.get("/:patientId/vbm", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(
    c,
    `/fhir/R4/Procedure?subject=Patient/${patientId}&category=https://openzorg.nl/CodeSystem/procedure-category|vbm&_sort=-date&_count=50`,
  );
});

/**
 * POST /api/clients/:patientId/vbm — Register a new VBM.
 *
 * Body: {
 *   maatregelType: string,
 *   grondslag: string,
 *   reden: string,
 *   startdatum: string,
 *   einddatum?: string,
 *   evaluatieFrequentie?: string,  // e.g. "2 weken", "1 maand"
 *   betrokkenArts?: string,        // Practitioner display name
 *   betrokkenArtsPractitionerId?: string,
 *   toelichting?: string,
 * }
 */
vbmRoutes.post("/:patientId/vbm", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<{
    maatregelType: string;
    grondslag: string;
    reden: string;
    startdatum: string;
    einddatum?: string;
    evaluatieFrequentie?: string;
    betrokkenArts?: string;
    betrokkenArtsPractitionerId?: string;
    toelichting?: string;
  }>();

  if (!body.maatregelType || !body.grondslag || !body.reden || !body.startdatum) {
    return c.json(operationOutcome("error", "invalid", "maatregelType, grondslag, reden en startdatum zijn verplicht"), 400);
  }

  const maatregelDef = MAATREGEL_TYPES.find((m) => m.code === body.maatregelType);
  if (!maatregelDef) {
    return c.json(operationOutcome("error", "invalid", `Ongeldig maatregeltype. Kies uit: ${MAATREGEL_TYPES.map((m) => m.code).join(", ")}`), 400);
  }

  const grondslagDef = WETTELIJKE_GRONDSLAGEN.find((g) => g.code === body.grondslag);

  const procedure = {
    resourceType: "Procedure",
    status: body.einddatum ? "completed" : "in-progress",
    category: {
      coding: [{
        system: "https://openzorg.nl/CodeSystem/procedure-category",
        code: "vbm",
        display: "Vrijheidsbeperkende maatregel",
      }],
    },
    code: {
      coding: [{
        system: "https://openzorg.nl/CodeSystem/vbm-type",
        code: body.maatregelType,
        display: maatregelDef.display,
      }],
    },
    subject: { reference: `Patient/${patientId}` },
    performedPeriod: {
      start: `${body.startdatum}T00:00:00Z`,
      ...(body.einddatum ? { end: `${body.einddatum}T23:59:59Z` } : {}),
    },
    reasonCode: [{ text: body.reden }],
    ...(body.betrokkenArtsPractitionerId
      ? { performer: [{ actor: { reference: `Practitioner/${body.betrokkenArtsPractitionerId}`, display: body.betrokkenArts } }] }
      : {}),
    ...(body.toelichting ? { note: [{ text: body.toelichting }] } : {}),
    extension: [
      {
        url: VBM_EXT,
        extension: [
          {
            url: "grondslag",
            valueCoding: {
              system: "https://openzorg.nl/CodeSystem/vbm-grondslag",
              code: body.grondslag,
              display: grondslagDef?.display ?? body.grondslag,
            },
          },
          ...(body.evaluatieFrequentie
            ? [{ url: "evaluatieFrequentie", valueString: body.evaluatieFrequentie }]
            : []),
        ],
      },
    ],
  };

  return medplumProxy(c, "/fhir/R4/Procedure", {
    method: "POST",
    body: JSON.stringify(procedure),
  });
});

/**
 * POST /api/clients/:patientId/vbm/:vbmId/evaluatie — Add evaluation.
 *
 * Body: {
 *   datum: string,
 *   conclusie: "voortzetten" | "aanpassen" | "beeindigen",
 *   toelichting: string,
 *   evaluator?: string,
 * }
 */
vbmRoutes.post("/:patientId/vbm/:vbmId/evaluatie", async (c) => {
  const patientId = c.req.param("patientId");
  const vbmId = c.req.param("vbmId");
  const body = await c.req.json<{
    datum: string;
    conclusie: string;
    toelichting: string;
    evaluator?: string;
  }>();

  if (!body.conclusie || !body.toelichting) {
    return c.json(operationOutcome("error", "invalid", "Conclusie en toelichting zijn verplicht"), 400);
  }

  // Store evaluation as Observation linked to the Procedure
  const observation = {
    resourceType: "Observation",
    status: "final",
    code: {
      coding: [{
        system: "https://openzorg.nl/CodeSystem/observation-type",
        code: "vbm-evaluatie",
        display: "VBM Evaluatie",
      }],
    },
    subject: { reference: `Patient/${patientId}` },
    partOf: [{ reference: `Procedure/${vbmId}` }],
    effectiveDateTime: body.datum ?? new Date().toISOString(),
    valueString: body.toelichting,
    interpretation: [{
      coding: [{
        system: "https://openzorg.nl/CodeSystem/vbm-conclusie",
        code: body.conclusie,
        display: body.conclusie === "voortzetten" ? "Voortzetten" : body.conclusie === "aanpassen" ? "Aanpassen" : "Beëindigen",
      }],
    }],
    ...(body.evaluator ? { performer: [{ display: body.evaluator }] } : {}),
  };

  return medplumProxy(c, "/fhir/R4/Observation", {
    method: "POST",
    body: JSON.stringify(observation),
  });
});

/**
 * PUT /api/clients/:patientId/vbm/:id/beeindigen — End a VBM.
 */
vbmRoutes.put("/:patientId/vbm/:id/beeindigen", async (c) => {
  const patientId = c.req.param("patientId");
  const _patientId = patientId; // used for reference validation
  void _patientId;
  const id = c.req.param("id");
  const body = await c.req.json<{ einddatum?: string; reden?: string }>();

  const einddatum = body.einddatum ?? new Date().toISOString().slice(0, 10);

  // Fetch and update the Procedure
  return medplumProxy(c, `/fhir/R4/Procedure/${id}`, {
    method: "PATCH",
    body: JSON.stringify([
      { op: "replace", path: "/status", value: "completed" },
      { op: "add", path: "/performedPeriod/end", value: `${einddatum}T23:59:59Z` },
      ...(body.reden ? [{ op: "add", path: "/note/-", value: { text: `Beëindigd: ${body.reden}` } }] : []),
    ]),
    headers: { "Content-Type": "application/json-patch+json" },
  });
});
