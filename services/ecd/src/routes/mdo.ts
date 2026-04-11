import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const mdoRoutes = new Hono<AppEnv>();

/**
 * MDO (Multidisciplinair Overleg) stored as FHIR Encounter resources.
 *
 * An MDO is a meeting about a client with multiple care professionals.
 * - Encounter.class = "MDO"
 * - Encounter.subject = Patient
 * - Encounter.participant = attendees (Practitioners)
 * - Encounter.reasonReference = CarePlan (optional link to zorgplan)
 * - DocumentReference linked to Encounter for meeting notes
 */

const _MDO_STATUSSEN = ["planned", "in-progress", "finished", "cancelled"] as const;

/**
 * GET /api/clients/:patientId/mdo — List all MDOs for a patient.
 */
mdoRoutes.get("/:patientId/mdo", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(
    c,
    `/fhir/R4/Encounter?subject=Patient/${patientId}&class=MDO&_sort=-date&_count=50`,
  );
});

/**
 * POST /api/clients/:patientId/mdo — Create/plan an MDO.
 *
 * Body: {
 *   datum: string,           // ISO date
 *   onderwerp: string,
 *   deelnemers: Array<{ practitionerId: string, naam: string, rol?: string }>,
 *   carePlanId?: string,     // link to zorgplan
 *   status?: string,
 * }
 */
mdoRoutes.post("/:patientId/mdo", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<{
    datum: string;
    onderwerp: string;
    deelnemers: Array<{ practitionerId: string; naam: string; rol?: string }>;
    carePlanId?: string;
    status?: string;
  }>();

  if (!body.datum || !body.onderwerp) {
    return c.json(operationOutcome("error", "invalid", "Datum en onderwerp zijn verplicht"), 400);
  }

  if (!body.deelnemers?.length) {
    return c.json(operationOutcome("error", "invalid", "Minimaal 1 deelnemer is verplicht"), 400);
  }

  const encounter = {
    resourceType: "Encounter",
    status: body.status ?? "planned",
    class: {
      system: "https://openzorg.nl/CodeSystem/encounter-class",
      code: "MDO",
      display: "Multidisciplinair Overleg",
    },
    subject: { reference: `Patient/${patientId}` },
    period: { start: `${body.datum}T00:00:00Z` },
    reasonCode: [{ text: body.onderwerp }],
    participant: body.deelnemers.map((d) => ({
      individual: {
        reference: `Practitioner/${d.practitionerId}`,
        display: d.naam,
      },
      type: d.rol
        ? [{ text: d.rol }]
        : undefined,
    })),
    ...(body.carePlanId
      ? { reasonReference: [{ reference: `CarePlan/${body.carePlanId}` }] }
      : {}),
  };

  return medplumProxy(c, "/fhir/R4/Encounter", {
    method: "POST",
    body: JSON.stringify(encounter),
  });
});

/**
 * PUT /api/clients/:patientId/mdo/:id — Update an MDO (status, add notes).
 */
mdoRoutes.put("/:patientId/mdo/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  return medplumProxy(c, `/fhir/R4/Encounter/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...body, id }),
  });
});

/**
 * POST /api/clients/:patientId/mdo/:mdoId/verslag — Add meeting notes.
 *
 * Body: { tekst: string }
 * Stored as Observation linked to the Encounter.
 */
mdoRoutes.post("/:patientId/mdo/:mdoId/verslag", async (c) => {
  const patientId = c.req.param("patientId");
  const mdoId = c.req.param("mdoId");
  const body = await c.req.json<{ tekst: string }>();

  if (!body.tekst) {
    return c.json(operationOutcome("error", "invalid", "Verslagtekst is verplicht"), 400);
  }

  const observation = {
    resourceType: "Observation",
    status: "final",
    code: {
      coding: [{
        system: "https://openzorg.nl/CodeSystem/observation-type",
        code: "mdo-verslag",
        display: "MDO Verslag",
      }],
    },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${mdoId}` },
    effectiveDateTime: new Date().toISOString(),
    valueString: body.tekst,
  };

  return medplumProxy(c, "/fhir/R4/Observation", {
    method: "POST",
    body: JSON.stringify(observation),
  });
});
