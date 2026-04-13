import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";

export const signaleringRoutes = new Hono<AppEnv>();

const VALID_CATEGORIEEN = new Set([
  "valrisico",
  "allergie",
  "mrsa",
  "infectie",
  "agressie",
  "dieet",
  "anders",
]);

/**
 * GET /api/clients/:clientId/signaleringen — List active flags for a client.
 */
signaleringRoutes.get("/:clientId/signaleringen", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/Flag?subject=Patient/${clientId}&status=active&_sort=-date`,
  );
});

/**
 * POST /api/clients/:clientId/signaleringen — Create a new alert flag.
 */
signaleringRoutes.post("/:clientId/signaleringen", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json<{
    code: string;
    categorie: string;
    ernst: string;
    toelichting?: string;
  }>();

  if (!body.code || !body.categorie) {
    return c.json(
      operationOutcome("error", "required", "Code en categorie zijn vereist"),
      400,
    );
  }

  if (!VALID_CATEGORIEEN.has(body.categorie)) {
    return c.json(
      operationOutcome("error", "invalid", `Ongeldige categorie. Kies uit: ${[...VALID_CATEGORIEEN].join(", ")}`),
      400,
    );
  }

  const resource = {
    resourceType: "Flag",
    status: "active",
    category: [
      {
        coding: [
          {
            system: "https://openzorg.nl/CodeSystem/signalering-categorie",
            code: body.categorie,
            display: body.categorie.charAt(0).toUpperCase() + body.categorie.slice(1),
          },
        ],
      },
    ],
    code: { text: body.code },
    subject: { reference: `Patient/${clientId}` },
    period: { start: new Date().toISOString().split("T")[0] },
    extension: [
      {
        url: "https://openzorg.nl/extensions/signalering-ernst",
        valueString: body.ernst ?? "midden",
      },
      ...(body.toelichting
        ? [{ url: "https://openzorg.nl/extensions/signalering-toelichting", valueString: body.toelichting }]
        : []),
    ],
  };

  return medplumProxy(c, "/fhir/R4/Flag", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * DELETE /api/signaleringen/:id — Deactivate a flag.
 */
signaleringRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const current = await medplumFetch(c, `/fhir/R4/Flag/${id}`);
  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const flag = (await current.json()) as Record<string, unknown>;
  flag["status"] = "inactive";

  return medplumProxy(c, `/fhir/R4/Flag/${id}`, {
    method: "PUT",
    body: JSON.stringify(flag),
  });
});
