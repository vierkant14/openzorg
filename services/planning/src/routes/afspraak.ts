import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";

export const afspraakRoutes = new Hono<AppEnv>();

interface AppointmentBody {
  resourceType?: string;
  status?: string;
  appointmentType?: Record<string, unknown>;
  start?: string;
  end?: string;
  participant?: Array<{
    actor?: { reference?: string };
    status?: string;
  }>;
  [key: string]: unknown;
}

function validateAppointmentBody(body: AppointmentBody): string | null {
  const participants = body.participant ?? [];

  const hasPatient = participants.some(
    (p) => p.actor?.reference?.startsWith("Patient/"),
  );
  if (!hasPatient) {
    return "Client referentie is vereist";
  }

  const hasPractitioner = participants.some(
    (p) => p.actor?.reference?.startsWith("Practitioner/"),
  );
  if (!hasPractitioner) {
    return "Medewerker referentie is vereist";
  }

  if (!body.start) {
    return "Starttijd is vereist";
  }

  if (!body.end) {
    return "Eindtijd is vereist";
  }

  if (new Date(body.start) >= new Date(body.end)) {
    return "Starttijd moet voor eindtijd liggen";
  }

  if (!body.status) {
    return "Status is vereist";
  }

  return null;
}

/**
 * GET /api/afspraken — List all appointments with optional filters.
 */
afspraakRoutes.get("/", async (c) => {
  const params = new URLSearchParams();

  const date = c.req.query("date");
  if (date) {
    params.set("date", date);
  }

  const practitioner = c.req.query("practitioner");
  if (practitioner) {
    params.set("practitioner", practitioner);
  }

  const patient = c.req.query("patient");
  if (patient) {
    params.set("patient", patient);
  }

  const queryString = params.toString();
  const path = `/fhir/R4/Appointment${queryString ? `?${queryString}` : ""}`;

  return medplumProxy(c, path);
});

/**
 * GET /api/afspraken/:id — Get a single appointment.
 */
afspraakRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Appointment/${id}`);
});

/**
 * POST /api/afspraken — Create an appointment.
 */
afspraakRoutes.post("/", async (c) => {
  const body = await c.req.json<AppointmentBody>();

  const error = validateAppointmentBody(body);
  if (error) {
    return c.json(operationOutcome("error", "invalid", error), 400);
  }

  const resource = {
    ...body,
    resourceType: "Appointment",
  };

  return medplumProxy(c, "/fhir/R4/Appointment", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /api/afspraken/:id — Update an appointment.
 */
afspraakRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<AppointmentBody>();

  const error = validateAppointmentBody(body);
  if (error) {
    return c.json(operationOutcome("error", "invalid", error), 400);
  }

  const resource = {
    ...body,
    resourceType: "Appointment",
    id,
  };

  return medplumProxy(c, `/fhir/R4/Appointment/${id}`, {
    method: "PUT",
    body: JSON.stringify(resource),
  });
});

/**
 * DELETE /api/afspraken/:id — Cancel an appointment (set status to cancelled).
 */
afspraakRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const current = await medplumFetch(c, `/fhir/R4/Appointment/${id}`);
  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const appointment = (await current.json()) as Record<string, unknown>;
  appointment["status"] = "cancelled";

  return medplumProxy(c, `/fhir/R4/Appointment/${id}`, {
    method: "PUT",
    body: JSON.stringify(appointment),
  });
});
