import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const toedieningRoutes = new Hono<AppEnv>();

/**
 * Toedienregistratie: MedicationAdministration resources.
 *
 * Links a MedicationRequest (voorschrift) to an actual administration event.
 * Records: who gave it, when, dose, status (completed/not-done/on-hold).
 */

const TOEDIEN_STATUSSEN = ["completed", "not-done", "on-hold", "entered-in-error"] as const;

/**
 * GET /api/clients/:patientId/toedieningen — All administrations for a patient.
 * Optional: ?medicationRequestId=xxx to filter by prescription.
 */
toedieningRoutes.get("/:patientId/toedieningen", async (c) => {
  const patientId = c.req.param("patientId");
  const mrId = c.req.query("medicationRequestId");

  let query = `/fhir/R4/MedicationAdministration?subject=Patient/${patientId}&_sort=-effective&_count=100`;
  if (mrId) {
    query += `&request=MedicationRequest/${mrId}`;
  }

  return medplumProxy(c, query);
});

/**
 * GET /api/clients/:patientId/toedienlijst — Today's medication schedule.
 *
 * Combines active MedicationRequests with today's administrations
 * to show what still needs to be given.
 */
toedieningRoutes.get("/:patientId/toedienlijst", async (c) => {
  const patientId = c.req.param("patientId");
  const datum = c.req.query("datum") ?? new Date().toISOString().slice(0, 10);

  // 1. Get active medications
  const medRes = await medplumFetch(
    c,
    `/fhir/R4/MedicationRequest?subject=Patient/${patientId}&status=active&_count=50`,
  );

  if (!medRes.ok) {
    return c.json({ datum, items: [] });
  }

  const medBundle = (await medRes.json()) as {
    entry?: Array<{
      resource: {
        id: string;
        medicationCodeableConcept?: { text?: string };
        dosageInstruction?: Array<{
          text?: string;
          timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
          route?: { text?: string };
        }>;
        requester?: { display?: string };
      };
    }>;
  };

  // 2. Get today's administrations
  const adminRes = await medplumFetch(
    c,
    `/fhir/R4/MedicationAdministration?subject=Patient/${patientId}&effective=ge${datum}T00:00:00Z&effective=le${datum}T23:59:59Z&_count=200`,
  );

  const adminBundle = adminRes.ok
    ? ((await adminRes.json()) as {
        entry?: Array<{
          resource: {
            id: string;
            request?: { reference?: string };
            status: string;
            effectiveDateTime?: string;
            performer?: Array<{ actor?: { display?: string } }>;
          };
        }>;
      })
    : { entry: [] };

  const administrations = adminBundle.entry?.map((e) => e.resource) ?? [];

  // 3. Build toedienlijst
  const items = (medBundle.entry ?? []).map((entry) => {
    const med = entry.resource;
    const dosage = med.dosageInstruction?.[0];
    const freq = dosage?.timing?.repeat?.frequency ?? 1;

    // How many times today should this be given?
    const timesPerDay = freq;

    // How many times has it been given today?
    const givenToday = administrations.filter(
      (a) => a.request?.reference === `MedicationRequest/${med.id}` && a.status === "completed",
    );

    const notGivenToday = administrations.filter(
      (a) => a.request?.reference === `MedicationRequest/${med.id}` && a.status === "not-done",
    );

    return {
      medicationRequestId: med.id,
      medicatienaam: med.medicationCodeableConcept?.text ?? "Onbekend",
      dosering: dosage?.text ?? "",
      toedieningsweg: dosage?.route?.text ?? "",
      frequentie: timesPerDay,
      voorschrijver: med.requester?.display ?? "",
      vandaagGegeven: givenToday.length,
      vandaagNietGegeven: notGivenToday.length,
      vandaagOpenstaand: Math.max(0, timesPerDay - givenToday.length - notGivenToday.length),
      toedieningen: givenToday.map((a) => ({
        id: a.id,
        tijdstip: a.effectiveDateTime,
        door: a.performer?.[0]?.actor?.display ?? "",
      })),
    };
  });

  return c.json({ datum, items });
});

/**
 * POST /api/clients/:patientId/toedieningen — Record a medication administration.
 *
 * Body: {
 *   medicationRequestId: string,
 *   status: "completed" | "not-done",
 *   tijdstip?: string,   // ISO datetime, defaults to now
 *   reden?: string,      // reason for not-done
 * }
 */
toedieningRoutes.post("/:patientId/toedieningen", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<{
    medicationRequestId: string;
    status: string;
    tijdstip?: string;
    reden?: string;
  }>();

  if (!body.medicationRequestId) {
    return c.json(operationOutcome("error", "invalid", "medicationRequestId is verplicht"), 400);
  }

  if (!TOEDIEN_STATUSSEN.includes(body.status as typeof TOEDIEN_STATUSSEN[number])) {
    return c.json(operationOutcome("error", "invalid", `Status moet zijn: ${TOEDIEN_STATUSSEN.join(", ")}`), 400);
  }

  // Get the MedicationRequest to copy medication info
  const mrRes = await medplumFetch(c, `/fhir/R4/MedicationRequest/${body.medicationRequestId}`);
  if (!mrRes.ok) {
    return c.json(operationOutcome("error", "not-found", "MedicationRequest niet gevonden"), 404);
  }

  const mr = (await mrRes.json()) as {
    medicationCodeableConcept?: { text?: string; coding?: Array<{ system?: string; code?: string; display?: string }> };
    dosageInstruction?: Array<{ text?: string; dose?: { value?: number; unit?: string } }>;
  };

  const resource = {
    resourceType: "MedicationAdministration",
    status: body.status,
    medicationCodeableConcept: mr.medicationCodeableConcept,
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: body.tijdstip ?? new Date().toISOString(),
    request: { reference: `MedicationRequest/${body.medicationRequestId}` },
    dosage: mr.dosageInstruction?.[0]?.dose
      ? { dose: mr.dosageInstruction[0].dose }
      : undefined,
    ...(body.status === "not-done" && body.reden
      ? {
          statusReason: [{
            coding: [{ display: body.reden }],
          }],
        }
      : {}),
  };

  return medplumProxy(c, "/fhir/R4/MedicationAdministration", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});
