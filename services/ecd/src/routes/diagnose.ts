import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy } from "../lib/medplum-client.js";

export const diagnoseRoutes = new Hono<AppEnv>();

/**
 * GET /api/clients/:patientId/diagnoses — List conditions for a patient.
 */
diagnoseRoutes.get("/:patientId/diagnoses", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(c, `/fhir/R4/Condition?subject=Patient/${patientId}`);
});

/**
 * POST /api/clients/:patientId/diagnoses — Create a condition.
 */
diagnoseRoutes.post("/:patientId/diagnoses", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<Record<string, unknown>>();

  const resource = {
    resourceType: "Condition",
    subject: { reference: `Patient/${patientId}` },
    ...body,
  };

  return medplumProxy(c, "/fhir/R4/Condition", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /api/clients/:patientId/diagnoses/:id — Update a condition.
 */
diagnoseRoutes.put("/:patientId/diagnoses/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  return medplumProxy(c, `/fhir/R4/Condition/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...body, id }),
  });
});
