import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy } from "../lib/medplum-client.js";

export const risicoscreeningRoutes = new Hono<AppEnv>();

/**
 * GET /api/clients/:patientId/risicoscreenings — List risk assessments for a patient.
 */
risicoscreeningRoutes.get("/:patientId/risicoscreenings", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(c, `/fhir/R4/RiskAssessment?subject=Patient/${patientId}`);
});

/**
 * POST /api/clients/:patientId/risicoscreenings — Create a risk assessment.
 */
risicoscreeningRoutes.post("/:patientId/risicoscreenings", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<Record<string, unknown>>();

  const resource = {
    resourceType: "RiskAssessment",
    subject: { reference: `Patient/${patientId}` },
    status: "final",
    ...body,
  };

  return medplumProxy(c, "/fhir/R4/RiskAssessment", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});
