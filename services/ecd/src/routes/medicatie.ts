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
 * GET /api/medicatie-voorschriften — Cross-client overview of all MedicationRequest resources.
 * Supports optional query params: status (active/stopped), _count.
 */
medicatieRoutes.get("/medicatie-voorschriften", async (c) => {
  const status = c.req.query("status");
  const count = c.req.query("_count") ?? "200";

  let url = `/fhir/R4/MedicationRequest?_count=${count}&_sort=-_lastUpdated&_include=MedicationRequest:subject`;
  if (status) {
    url += `&status=${status}`;
  }

  return medplumProxy(c, url);
});

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
 * POST /api/medicatie/:id/controle — Record double-check verification (Wet BIG).
 */
medicatieRoutes.post("/medicatie/:id/controle", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    controleur: string;
    akkoord: boolean;
    opmerking?: string;
  }>();

  if (!body.controleur) {
    return c.json(operationOutcome("error", "required", "Controleur is vereist"), 400);
  }

  // Fetch current MedicationRequest and add controle extension
  const current = await medplumFetch(c, `/fhir/R4/MedicationRequest/${id}`);
  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const med = (await current.json()) as Record<string, unknown>;
  const exts = (med["extension"] as Array<Record<string, unknown>>) ?? [];
  exts.push({
    url: "https://openzorg.nl/extensions/dubbele-controle",
    extension: [
      { url: "controleur", valueString: body.controleur },
      { url: "datum", valueDateTime: new Date().toISOString() },
      { url: "akkoord", valueBoolean: body.akkoord },
      ...(body.opmerking ? [{ url: "opmerking", valueString: body.opmerking }] : []),
    ],
  });
  med["extension"] = exts;

  return medplumProxy(c, `/fhir/R4/MedicationRequest/${id}`, {
    method: "PUT",
    body: JSON.stringify(med),
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
