import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const vragenlijstenRoutes = new Hono<AppEnv>();

/**
 * Configurable questionnaires using FHIR Questionnaire + QuestionnaireResponse.
 *
 * Beheerders create Questionnaire templates.
 * Zorgmedewerkers fill them in per client → QuestionnaireResponse.
 * Results can be linked to a CarePlan (zorgplan).
 */

/* ── Questionnaire templates (admin) ── */

/**
 * GET /api/vragenlijsten — List all questionnaire templates.
 */
vragenlijstenRoutes.get("/", async (c) => {
  return medplumProxy(c, "/fhir/R4/Questionnaire?status=active&_sort=-date&_count=50");
});

/**
 * GET /api/vragenlijsten/:id — Get a single questionnaire template.
 */
vragenlijstenRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Questionnaire/${id}`);
});

/**
 * POST /api/vragenlijsten — Create a questionnaire template.
 *
 * Body: {
 *   title: string,
 *   description?: string,
 *   categorie: string,  // e.g. "screening", "intake", "evaluatie"
 *   items: Array<{
 *     linkId: string,
 *     text: string,
 *     type: "string" | "integer" | "decimal" | "boolean" | "choice" | "date" | "text",
 *     required?: boolean,
 *     options?: Array<{ value: string, display: string }>,
 *   }>
 * }
 */
vragenlijstenRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    title: string;
    description?: string;
    categorie?: string;
    items: Array<{
      linkId: string;
      text: string;
      type: string;
      required?: boolean;
      options?: Array<{ value: string; display: string }>;
    }>;
  }>();

  if (!body.title || !body.items?.length) {
    return c.json(operationOutcome("error", "invalid", "Titel en minimaal 1 vraag zijn verplicht"), 400);
  }

  const FHIR_TYPE_MAP: Record<string, string> = {
    string: "string",
    integer: "integer",
    decimal: "decimal",
    boolean: "boolean",
    choice: "choice",
    date: "date",
    text: "text",
  };

  const questionnaire = {
    resourceType: "Questionnaire",
    status: "active",
    title: body.title,
    description: body.description,
    date: new Date().toISOString(),
    code: body.categorie
      ? [{ system: "https://openzorg.nl/CodeSystem/vragenlijst-categorie", code: body.categorie, display: body.categorie }]
      : undefined,
    item: body.items.map((item) => ({
      linkId: item.linkId,
      text: item.text,
      type: FHIR_TYPE_MAP[item.type] ?? "string",
      required: item.required ?? false,
      ...(item.options
        ? {
            answerOption: item.options.map((opt) => ({
              valueCoding: { code: opt.value, display: opt.display },
            })),
          }
        : {}),
    })),
  };

  return medplumProxy(c, "/fhir/R4/Questionnaire", {
    method: "POST",
    body: JSON.stringify(questionnaire),
  });
});

/* ── QuestionnaireResponses (per client) ── */

/**
 * GET /api/clients/:patientId/vragenlijsten — Responses for a patient.
 */
vragenlijstenRoutes.get("/clients/:patientId/responses", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(
    c,
    `/fhir/R4/QuestionnaireResponse?subject=Patient/${patientId}&_sort=-authored&_count=50&_include=QuestionnaireResponse:questionnaire`,
  );
});

/**
 * POST /api/clients/:patientId/vragenlijsten — Submit a questionnaire response.
 *
 * Body: {
 *   questionnaireId: string,
 *   carePlanId?: string,     // optional link to zorgplan
 *   antwoorden: Array<{
 *     linkId: string,
 *     answer: string | number | boolean,
 *   }>
 * }
 */
vragenlijstenRoutes.post("/clients/:patientId/responses", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<{
    questionnaireId: string;
    carePlanId?: string;
    antwoorden: Array<{
      linkId: string;
      answer: string | number | boolean;
    }>;
  }>();

  if (!body.questionnaireId || !body.antwoorden?.length) {
    return c.json(operationOutcome("error", "invalid", "questionnaireId en antwoorden zijn verplicht"), 400);
  }

  // Get the questionnaire to validate linkIds
  const qRes = await medplumFetch(c, `/fhir/R4/Questionnaire/${body.questionnaireId}`);
  if (!qRes.ok) {
    return c.json(operationOutcome("error", "not-found", "Vragenlijst niet gevonden"), 404);
  }

  const response = {
    resourceType: "QuestionnaireResponse",
    questionnaire: `Questionnaire/${body.questionnaireId}`,
    status: "completed",
    subject: { reference: `Patient/${patientId}` },
    authored: new Date().toISOString(),
    ...(body.carePlanId
      ? { basedOn: [{ reference: `CarePlan/${body.carePlanId}` }] }
      : {}),
    item: body.antwoorden.map((a) => ({
      linkId: a.linkId,
      answer: [
        typeof a.answer === "boolean"
          ? { valueBoolean: a.answer }
          : typeof a.answer === "number"
            ? { valueDecimal: a.answer }
            : { valueString: String(a.answer) },
      ],
    })),
  };

  return medplumProxy(c, "/fhir/R4/QuestionnaireResponse", {
    method: "POST",
    body: JSON.stringify(response),
  });
});
