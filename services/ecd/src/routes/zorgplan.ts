import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const zorgplanRoutes = new Hono<AppEnv>();

/**
 * GET /api/clients/:clientId/zorgplan — Get the CarePlan for a client.
 */
zorgplanRoutes.get("/clients/:clientId/zorgplan", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/CarePlan?subject=Patient/${clientId}&_sort=-_lastUpdated&_count=1`,
  );
});

/**
 * POST /api/clients/:clientId/zorgplan — Create a CarePlan with Omaha system classification.
 */
zorgplanRoutes.post("/clients/:clientId/zorgplan", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json<Record<string, unknown>>();

  if (!body["title"]) {
    return c.json(
      operationOutcome("error", "required", "Titel van het zorgplan is vereist"),
      400,
    );
  }

  const resource = {
    resourceType: "CarePlan",
    status: "active",
    intent: "plan",
    ...body,
    subject: { reference: `Patient/${clientId}` },
    category: [
      {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "734163000",
            display: "Care plan",
          },
        ],
      },
    ],
  };

  return medplumProxy(c, "/fhir/R4/CarePlan", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * POST /api/zorgplan/:id/doelen — Add a Goal to a care plan.
 */
zorgplanRoutes.post("/zorgplan/:id/doelen", async (c) => {
  const carePlanId = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  if (!body["description"]) {
    return c.json(
      operationOutcome("error", "required", "Beschrijving van het doel is vereist"),
      400,
    );
  }

  // Expect body.subject to be passed, or we look it up from the CarePlan
  const goalResource = {
    resourceType: "Goal",
    lifecycleStatus: "active",
    ...body,
    addresses: [{ reference: `CarePlan/${carePlanId}` }],
  };

  const goalResponse = await fetch(
    `${process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103"}/fhir/R4/Goal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/fhir+json",
        Accept: "application/fhir+json",
        ...(c.req.header("Authorization")
          ? { Authorization: c.req.header("Authorization")! }
          : {}),
      },
      body: JSON.stringify(goalResource),
    },
  );

  const goal = (await goalResponse.json()) as Record<string, unknown>;

  if (!goalResponse.ok) {
    return c.json(goal, goalResponse.status as 200);
  }

  // Update the CarePlan to reference the new Goal
  const goalId = goal["id"] as string;
  await fetch(
    `${process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103"}/fhir/R4/CarePlan/${carePlanId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json-patch+json",
        Accept: "application/fhir+json",
        ...(c.req.header("Authorization")
          ? { Authorization: c.req.header("Authorization")! }
          : {}),
      },
      body: JSON.stringify([
        {
          op: "add",
          path: "/goal/-",
          value: { reference: `Goal/${goalId}` },
        },
      ]),
    },
  );

  return c.json(goal, goalResponse.status as 200);
});

/**
 * POST /api/zorgplan/:id/interventies — Add a ServiceRequest (intervention) to a care plan.
 */
zorgplanRoutes.post("/zorgplan/:id/interventies", async (c) => {
  const carePlanId = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  if (!body["code"]) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        "Code van de interventie is vereist",
      ),
      400,
    );
  }

  const serviceRequestResource = {
    resourceType: "ServiceRequest",
    status: "active",
    intent: "plan",
    ...body,
    basedOn: [{ reference: `CarePlan/${carePlanId}` }],
  };

  return medplumProxy(c, "/fhir/R4/ServiceRequest", {
    method: "POST",
    body: JSON.stringify(serviceRequestResource),
  });
});
