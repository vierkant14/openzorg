import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";

export const medicatieRoutes = new Hono<AppEnv>();

/**
 * GET /api/clients/:clientId/medicatie — List MedicationRequest resources for a patient.
 */
medicatieRoutes.get("/clients/:clientId/medicatie", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/MedicationRequest?subject=Patient/${clientId}`,
  );
});

/**
 * POST /api/clients/:clientId/medicatie — Create a MedicationRequest linked to a patient.
 */
medicatieRoutes.post("/clients/:clientId/medicatie", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json<Record<string, unknown>>();

  if (!body["medicationCodeableConcept"]) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        "Medicatienaam is vereist",
      ),
      400,
    );
  }

  const resource = {
    resourceType: "MedicationRequest",
    ...body,
    subject: { reference: `Patient/${clientId}` },
    status: body["status"] ?? "active",
    intent: body["intent"] ?? "order",
  };

  return medplumProxy(c, "/fhir/R4/MedicationRequest", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /api/medicatie/:id — Update a MedicationRequest.
 */
medicatieRoutes.put("/medicatie/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  return medplumProxy(c, `/fhir/R4/MedicationRequest/${id}`, {
    method: "PUT",
    body: JSON.stringify({ resourceType: "MedicationRequest", ...body, id }),
  });
});

/**
 * DELETE /api/medicatie/:id — Stop medication (set status to stopped).
 */
medicatieRoutes.delete("/medicatie/:id", async (c) => {
  const id = c.req.param("id");

  const current = await medplumFetch(c, `/fhir/R4/MedicationRequest/${id}`);

  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const medicationRequest = (await current.json()) as Record<string, unknown>;
  medicationRequest["status"] = "stopped";

  return medplumProxy(c, `/fhir/R4/MedicationRequest/${id}`, {
    method: "PUT",
    body: JSON.stringify(medicationRequest),
  });
});
