import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const medicatieOverzichtRoutes = new Hono<AppEnv>();

/**
 * Medicatieoverzicht stored as FHIR MedicationStatement resources.
 *
 * Key fields:
 * - subject: reference to Patient
 * - medicationCodeableConcept: medicijn naam
 * - dosage: dosering, frequentie, route
 * - effectivePeriod: start/einddatum
 * - status: active | completed | stopped
 * - reasonCode: reden
 * - informationSource: voorschrijver
 * - note: opmerking
 */

const VALID_STATUSES = ["active", "completed", "stopped"];

/**
 * GET /api/clients/:patientId/medicatie-overzicht — List all MedicationStatements for a patient.
 */
medicatieOverzichtRoutes.get("/:patientId/medicatie-overzicht", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(
    c,
    `/fhir/R4/MedicationStatement?subject=Patient/${patientId}&_sort=-_lastUpdated&_count=100`,
  );
});

/**
 * POST /api/clients/:patientId/medicatie-overzicht — Create a medicatie-overzicht entry.
 *
 * Body: {
 *   medicijnNaam: string,
 *   dosering: string,
 *   frequentie: string,
 *   route?: string,
 *   startdatum: string,
 *   einddatum?: string,
 *   status: "active" | "completed" | "stopped",
 *   reden?: string,
 *   voorschrijver?: string,
 *   opmerking?: string,
 * }
 */
medicatieOverzichtRoutes.post("/:patientId/medicatie-overzicht", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<{
    medicijnNaam: string;
    dosering: string;
    frequentie: string;
    route?: string;
    startdatum: string;
    einddatum?: string;
    status: string;
    reden?: string;
    voorschrijver?: string;
    opmerking?: string;
  }>();

  if (!body.medicijnNaam || !body.dosering || !body.frequentie || !body.startdatum || !body.status) {
    return c.json(
      operationOutcome("error", "required", "medicijnNaam, dosering, frequentie, startdatum en status zijn verplicht"),
      400,
    );
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return c.json(
      operationOutcome("error", "invalid", `status moet een van de volgende zijn: ${VALID_STATUSES.join(", ")}`),
      400,
    );
  }

  const resource = buildMedicationStatement(patientId, body);

  return medplumProxy(c, "/fhir/R4/MedicationStatement", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /api/clients/:patientId/medicatie-overzicht/:id — Update a medicatie-overzicht entry.
 */
medicatieOverzichtRoutes.put("/:patientId/medicatie-overzicht/:id", async (c) => {
  const patientId = c.req.param("patientId");
  const id = c.req.param("id");
  const body = await c.req.json<{
    medicijnNaam: string;
    dosering: string;
    frequentie: string;
    route?: string;
    startdatum: string;
    einddatum?: string;
    status: string;
    reden?: string;
    voorschrijver?: string;
    opmerking?: string;
  }>();

  if (!body.medicijnNaam || !body.dosering || !body.frequentie || !body.startdatum || !body.status) {
    return c.json(
      operationOutcome("error", "required", "medicijnNaam, dosering, frequentie, startdatum en status zijn verplicht"),
      400,
    );
  }

  if (!VALID_STATUSES.includes(body.status)) {
    return c.json(
      operationOutcome("error", "invalid", `status moet een van de volgende zijn: ${VALID_STATUSES.join(", ")}`),
      400,
    );
  }

  const resource = buildMedicationStatement(patientId, body);
  resource.id = id;

  return medplumProxy(c, `/fhir/R4/MedicationStatement/${id}`, {
    method: "PUT",
    body: JSON.stringify(resource),
  });
});

/**
 * DELETE /api/clients/:patientId/medicatie-overzicht/:id — Remove a medicatie-overzicht entry.
 */
medicatieOverzichtRoutes.delete("/:patientId/medicatie-overzicht/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/MedicationStatement/${id}`, {
    method: "DELETE",
  });
});

/* ── Helper ── */

interface MedicatieOverzichtBody {
  medicijnNaam: string;
  dosering: string;
  frequentie: string;
  route?: string;
  startdatum: string;
  einddatum?: string;
  status: string;
  reden?: string;
  voorschrijver?: string;
  opmerking?: string;
}

function buildMedicationStatement(
  patientId: string,
  body: MedicatieOverzichtBody,
): Record<string, unknown> {
  const effectivePeriod: Record<string, string> = {
    start: body.startdatum,
  };
  if (body.einddatum) {
    effectivePeriod["end"] = body.einddatum;
  }

  const dosage: Record<string, unknown> = {
    text: `${body.dosering}, ${body.frequentie}`,
    timing: {
      code: {
        text: body.frequentie,
      },
    },
    doseAndRate: [
      {
        type: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/dose-rate-type",
              code: "ordered",
              display: "Ordered",
            },
          ],
        },
      },
    ],
  };

  if (body.route) {
    dosage["route"] = {
      coding: [
        {
          system: "http://snomed.info/sct",
          display: body.route,
        },
      ],
      text: body.route,
    };
  }

  const resource: Record<string, unknown> = {
    resourceType: "MedicationStatement",
    status: body.status,
    medicationCodeableConcept: {
      text: body.medicijnNaam,
    },
    subject: { reference: `Patient/${patientId}` },
    effectivePeriod,
    dateAsserted: new Date().toISOString(),
    dosage: [dosage],
  };

  if (body.reden) {
    resource.reasonCode = [{ text: body.reden }];
  }

  if (body.voorschrijver) {
    resource.informationSource = { display: body.voorschrijver };
  }

  if (body.opmerking) {
    resource.note = [{ text: body.opmerking }];
  }

  return resource;
}
