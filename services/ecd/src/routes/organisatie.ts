import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const organisatieRoutes = new Hono<AppEnv>();

const LOCATIE_TYPES = ["verpleeghuis", "thuiszorg-team", "kantoor"] as const;

interface LocatieInput {
  naam: string;
  adres?: string;
  telefoon?: string;
  type: string;
  parentId: string;
}

/**
 * GET /api/organisatie — Get the organization tree.
 * Returns all Organization resources. The frontend can build the tree from partOf references.
 */
organisatieRoutes.get("/", async (c) => {
  return medplumProxy(c, "/fhir/R4/Organization?_count=200&_sort=name");
});

/**
 * GET /api/organisatie/:id — Get a single Organization.
 */
organisatieRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Organization/${id}`);
});

/**
 * POST /api/organisatie/locaties — Create a child Organization (locatie) with partOf reference.
 */
organisatieRoutes.post("/locaties", async (c) => {
  const body = (await c.req.json()) as LocatieInput;

  if (!body.naam) {
    return c.json(
      operationOutcome("error", "required", "Naam is vereist"),
      400,
    );
  }

  if (!body.parentId) {
    return c.json(
      operationOutcome("error", "required", "Bovenliggende organisatie (parentId) is vereist"),
      400,
    );
  }

  if (body.type && !LOCATIE_TYPES.includes(body.type as typeof LOCATIE_TYPES[number])) {
    return c.json(
      operationOutcome(
        "error",
        "invalid",
        `Type moet een van de volgende zijn: ${LOCATIE_TYPES.join(", ")}`,
      ),
      400,
    );
  }

  // Verify parent exists
  const parentRes = await medplumFetch(c, `/fhir/R4/Organization/${body.parentId}`);
  if (!parentRes.ok) {
    return c.json(
      operationOutcome("error", "not-found", "Bovenliggende organisatie niet gevonden"),
      404,
    );
  }

  const telecom: Array<{ system: string; value: string }> = [];
  if (body.telefoon) {
    telecom.push({ system: "phone", value: body.telefoon });
  }

  const address: Array<{ text: string }> = [];
  if (body.adres) {
    address.push({ text: body.adres });
  }

  const resource: Record<string, unknown> = {
    resourceType: "Organization",
    active: true,
    name: body.naam,
    partOf: { reference: `Organization/${body.parentId}` },
    type: [
      {
        coding: [
          {
            system: "https://openzorg.nl/fhir/CodeSystem/locatie-type",
            code: body.type,
            display: body.type,
          },
        ],
      },
    ],
    ...(telecom.length > 0 ? { telecom } : {}),
    ...(address.length > 0 ? { address } : {}),
  };

  return medplumProxy(c, "/fhir/R4/Organization", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});
