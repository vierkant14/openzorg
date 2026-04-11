import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const contactpersoonRoutes = new Hono<AppEnv>();

/**
 * GET /api/clients/:clientId/contactpersonen — List RelatedPerson resources for a patient.
 */
contactpersoonRoutes.get("/clients/:clientId/contactpersonen", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/RelatedPerson?patient=Patient/${clientId}`,
  );
});

/**
 * POST /api/clients/:clientId/contactpersonen — Create a RelatedPerson linked to a patient.
 */
contactpersoonRoutes.post("/clients/:clientId/contactpersonen", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json<Record<string, unknown>>();

  if (!body["name"]) {
    return c.json(
      operationOutcome("error", "required", "Naam van contactpersoon is vereist"),
      400,
    );
  }

  const resource = {
    resourceType: "RelatedPerson",
    ...body,
    patient: { reference: `Patient/${clientId}` },
  };

  return medplumProxy(c, "/fhir/R4/RelatedPerson", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /api/contactpersonen/:id — Update a RelatedPerson.
 */
contactpersoonRoutes.put("/contactpersonen/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  return medplumProxy(c, `/fhir/R4/RelatedPerson/${id}`, {
    method: "PUT",
    body: JSON.stringify({ resourceType: "RelatedPerson", ...body, id }),
  });
});

/**
 * DELETE /api/contactpersonen/:id — Delete a RelatedPerson.
 */
contactpersoonRoutes.delete("/contactpersonen/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/RelatedPerson/${id}`, {
    method: "DELETE",
  });
});
