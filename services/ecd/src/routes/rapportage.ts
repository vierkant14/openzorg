import { getExtensionUrl } from "@openzorg/shared-domain";
import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const rapportageRoutes = new Hono<AppEnv>();

interface SoepRapportage {
  type: "soep";
  subjectief: string;
  objectief: string;
  evaluatie: string;
  plan: string;
  goalId?: string;
}

interface VrijRapportage {
  type: "vrij";
  tekst: string;
  goalId?: string;
}

type RapportageInput = SoepRapportage | VrijRapportage;

/**
 * GET /api/rapportages-overzicht — List all clinical notes across all clients.
 * Used by the cross-client rapportages overview page.
 */
rapportageRoutes.get("/rapportages-overzicht", async (c) => {
  const count = c.req.query("_count") ?? "200";
  return medplumProxy(
    c,
    `/fhir/R4/Observation?category=social-history&_sort=-date&_count=${encodeURIComponent(count)}&_include=Observation:subject`,
  );
});

/**
 * GET /api/clients/:clientId/rapportages — List clinical notes (Observation resources) for a client.
 */
rapportageRoutes.get("/clients/:clientId/rapportages", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/Observation?subject=Patient/${clientId}&category=social-history&_sort=-date`,
  );
});

/**
 * POST /api/clients/:clientId/rapportages — Create a clinical note.
 * Supports two formats: SOEP (Subjective, Objective, Evaluation, Plan) and free text.
 */
rapportageRoutes.post("/clients/:clientId/rapportages", async (c) => {
  const clientId = c.req.param("clientId");
  const body = (await c.req.json()) as RapportageInput;

  if (!body.type || !["soep", "vrij"].includes(body.type)) {
    return c.json(
      operationOutcome(
        "error",
        "invalid",
        "Type moet 'soep' of 'vrij' zijn",
      ),
      400,
    );
  }

  let noteText: string;
  const extensions: Array<{ url: string; valueString: string }> = [];

  if (body.type === "soep") {
    const soep = body as SoepRapportage;

    if (!soep.subjectief && !soep.objectief && !soep.evaluatie && !soep.plan) {
      return c.json(
        operationOutcome(
          "error",
          "required",
          "Ten minste een SOEP-veld moet worden ingevuld",
        ),
        400,
      );
    }

    noteText = [
      soep.subjectief ? `S: ${soep.subjectief}` : "",
      soep.objectief ? `O: ${soep.objectief}` : "",
      soep.evaluatie ? `E: ${soep.evaluatie}` : "",
      soep.plan ? `P: ${soep.plan}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (soep.subjectief)
      extensions.push({
        url: getExtensionUrl("soep-subjectief"),
        valueString: soep.subjectief,
      });
    if (soep.objectief)
      extensions.push({
        url: getExtensionUrl("soep-objectief"),
        valueString: soep.objectief,
      });
    if (soep.evaluatie)
      extensions.push({
        url: getExtensionUrl("soep-evaluatie"),
        valueString: soep.evaluatie,
      });
    if (soep.plan)
      extensions.push({
        url: getExtensionUrl("soep-plan"),
        valueString: soep.plan,
      });
  } else {
    const vrij = body as VrijRapportage;
    if (!vrij.tekst) {
      return c.json(
        operationOutcome("error", "required", "Tekst is vereist"),
        400,
      );
    }
    noteText = vrij.tekst;
  }

  const resource: Record<string, unknown> = {
    resourceType: "Observation",
    status: "final",
    category: [
      {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "social-history",
            display: "Social History",
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "34109-9",
          display: "Note",
        },
      ],
      text: body.type === "soep" ? "SOEP rapportage" : "Vrije rapportage",
    },
    subject: { reference: `Patient/${clientId}` },
    effectiveDateTime: new Date().toISOString(),
    valueString: noteText,
  };

  if (extensions.length > 0) {
    resource["extension"] = extensions;
  }

  // Link rapportage to a zorgplan goal if provided
  if (body.goalId) {
    resource["focus"] = [{ reference: `Goal/${body.goalId}` }];
  }

  return medplumProxy(c, "/fhir/R4/Observation", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});
