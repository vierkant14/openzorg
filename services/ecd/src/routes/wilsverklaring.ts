import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const wilsverklaringRoutes = new Hono<AppEnv>();

/**
 * Wilsverklaringen / BOPZ-status stored as FHIR Consent resources.
 *
 * Key fields:
 * - scope: Advance Directive
 * - category: wilsverklaring type (behandelverbod, euthanasieverklaring, etc.)
 * - patient: reference to Patient
 * - dateTime: datum ondertekening
 * - provision.period.end: geldig tot
 * - performer: vertegenwoordiger
 * - note: opmerking
 */

const WILSVERKLARING_TYPES: Record<string, string> = {
  behandelverbod: "Behandelverbod",
  euthanasieverklaring: "Euthanasieverklaring",
  volmacht: "Volmacht",
  levenswensverklaring: "Levenswensverklaring",
  donorcodicil: "Donorcodicil",
  "bopz-mentorschap": "BOPZ Mentorschap",
  "bopz-curatele": "BOPZ Curatele",
  "bopz-beschermingsbewind": "BOPZ Beschermingsbewind",
};

const VALID_TYPES = Object.keys(WILSVERKLARING_TYPES);

/**
 * GET /api/wilsverklaringen-overzicht — Cross-client overview of all Consent (wilsverklaring) resources.
 * Supports optional query params: type, status, _count.
 */
wilsverklaringRoutes.get("/wilsverklaringen-overzicht", async (c) => {
  const type = c.req.query("type");
  const status = c.req.query("status");
  const count = c.req.query("_count") ?? "200";

  let url = `/fhir/R4/Consent?category=https://openzorg.nl/CodeSystem/wilsverklaring-type|&_count=${count}&_sort=-date&_include=Consent:patient`;
  if (type) {
    url += `&category=https://openzorg.nl/CodeSystem/wilsverklaring-type|${type}`;
  }
  if (status) {
    url += `&status=${status}`;
  }

  return medplumProxy(c, url);
});

/**
 * GET /api/clients/:patientId/wilsverklaringen — List all wilsverklaringen for a patient.
 */
wilsverklaringRoutes.get("/:patientId/wilsverklaringen", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(
    c,
    `/fhir/R4/Consent?patient=Patient/${patientId}&category=https://openzorg.nl/CodeSystem/wilsverklaring-type|&_sort=-date&_count=100`,
  );
});

/**
 * POST /api/clients/:patientId/wilsverklaringen — Create a wilsverklaring.
 *
 * Body: {
 *   type: "behandelverbod" | "euthanasieverklaring" | "volmacht" | "levenswensverklaring" | "donorcodicil" | "bopz-mentorschap" | "bopz-curatele" | "bopz-beschermingsbewind",
 *   beschrijving: string,
 *   datum: string,
 *   geldigTot?: string,
 *   vertegenwoordiger?: string,
 *   opmerking?: string,
 * }
 */
wilsverklaringRoutes.post("/:patientId/wilsverklaringen", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<{
    type: string;
    beschrijving: string;
    datum: string;
    geldigTot?: string;
    vertegenwoordiger?: string;
    opmerking?: string;
  }>();

  if (!body.type || !body.beschrijving || !body.datum) {
    return c.json(
      operationOutcome("error", "required", "type, beschrijving en datum zijn verplicht"),
      400,
    );
  }

  if (!VALID_TYPES.includes(body.type)) {
    return c.json(
      operationOutcome("error", "invalid", `type moet een van de volgende zijn: ${VALID_TYPES.join(", ")}`),
      400,
    );
  }

  const display = WILSVERKLARING_TYPES[body.type] ?? body.type;

  const resource: Record<string, unknown> = {
    resourceType: "Consent",
    status: "active",
    scope: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/consentscope",
          code: "adr",
          display: "Advance Directive",
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: "https://openzorg.nl/CodeSystem/wilsverklaring-type",
            code: body.type,
            display,
          },
        ],
        text: display,
      },
    ],
    patient: { reference: `Patient/${patientId}` },
    dateTime: body.datum,
    policy: [
      {
        authority: "https://openzorg.nl",
        uri: "https://openzorg.nl/wilsverklaring",
      },
    ],
  };

  if (body.beschrijving) {
    (resource as Record<string, unknown>)["sourceAttachment"] = {
      title: body.beschrijving,
    };
  }

  if (body.geldigTot) {
    resource.provision = {
      period: {
        end: body.geldigTot,
      },
    };
  }

  if (body.vertegenwoordiger) {
    resource.performer = [
      {
        display: body.vertegenwoordiger,
      },
    ];
  }

  if (body.opmerking) {
    resource.extension = [
      {
        url: "https://openzorg.nl/extensions/opmerking",
        valueString: body.opmerking,
      },
    ];
  }

  return medplumProxy(c, "/fhir/R4/Consent", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * DELETE /api/clients/:patientId/wilsverklaringen/:id — Remove a wilsverklaring.
 */
wilsverklaringRoutes.delete("/:patientId/wilsverklaringen/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Consent/${id}`, {
    method: "DELETE",
  });
});
