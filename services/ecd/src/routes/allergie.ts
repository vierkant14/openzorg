import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy } from "../lib/medplum-client.js";

export const allergieRoutes = new Hono<AppEnv>();

/**
 * GET /api/clients/:patientId/allergieen — List allergies for a patient.
 */
allergieRoutes.get("/:patientId/allergieen", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(c, `/fhir/R4/AllergyIntolerance?patient=Patient/${patientId}`);
});

/**
 * POST /api/clients/:patientId/allergieen — Create an allergy record.
 */
allergieRoutes.post("/:patientId/allergieen", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<Record<string, unknown>>();

  const resource = {
    resourceType: "AllergyIntolerance",
    patient: { reference: `Patient/${patientId}` },
    ...body,
  };

  return medplumProxy(c, "/fhir/R4/AllergyIntolerance", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * DELETE /api/clients/:patientId/allergieen/:id — Remove an allergy record.
 */
allergieRoutes.delete("/:patientId/allergieen/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/AllergyIntolerance/${id}`, {
    method: "DELETE",
  });
});
