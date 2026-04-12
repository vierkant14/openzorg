import { getExtensionUrl } from "@openzorg/shared-domain";
import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";
import { fireWorkflowTriggers } from "../lib/workflow-trigger-engine.js";

export const micMeldingRoutes = new Hono<AppEnv>();

interface MicMeldingInput {
  datum: string;
  ernst: string;
  beschrijving: string;
  betrokkenClient: string;
  betrokkenMedewerker: string;
}

/**
 * GET /api/mic-meldingen — List all MIC incident reports.
 */
micMeldingRoutes.get("/", async (c) => {
  const queryString = new URL(c.req.url).search;
  return medplumProxy(
    c,
    `/fhir/R4/AuditEvent?type=110113${queryString ? "&" + queryString.slice(1) : ""}&_sort=-date`,
  );
});

/**
 * POST /api/mic-meldingen — Create a MIC incident report.
 * Maps to FHIR AuditEvent with OpenZorg extensions.
 */
micMeldingRoutes.post("/", async (c) => {
  const body = (await c.req.json()) as MicMeldingInput;

  if (!body.datum) {
    return c.json(
      operationOutcome("error", "required", "Datum is vereist"),
      400,
    );
  }

  if (!body.ernst) {
    return c.json(
      operationOutcome("error", "required", "Ernst is vereist"),
      400,
    );
  }

  if (!body.betrokkenClient) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        "Betrokken client is vereist",
      ),
      400,
    );
  }

  if (!body.betrokkenMedewerker) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        "Betrokken medewerker is vereist",
      ),
      400,
    );
  }

  const resource = {
    resourceType: "AuditEvent",
    type: {
      system: "http://dicom.nema.org/resources/ontology/DCM",
      code: "110113",
      display: "Security Alert",
    },
    subtype: [
      {
        system: getExtensionUrl("mic-type"),
        code: "mic-melding",
        display: "MIC Melding",
      },
    ],
    action: "C",
    recorded: body.datum,
    outcome: "0",
    outcomeDesc: body.beschrijving ?? "",
    agent: [
      {
        who: { reference: `Practitioner/${body.betrokkenMedewerker}` },
        requestor: true,
      },
    ],
    entity: [
      {
        what: { reference: `Patient/${body.betrokkenClient}` },
        type: {
          system: "http://terminology.hl7.org/CodeSystem/audit-entity-type",
          code: "1",
          display: "Person",
        },
      },
    ],
    source: {
      observer: { reference: `Practitioner/${body.betrokkenMedewerker}` },
      type: [
        {
          system: "http://terminology.hl7.org/CodeSystem/security-source-type",
          code: "4",
          display: "Application Server",
        },
      ],
    },
    extension: [
      {
        url: getExtensionUrl("mic-ernst"),
        valueString: body.ernst,
      },
    ],
  };

  const result = await medplumFetch(c, "/fhir/R4/AuditEvent", {
    method: "POST",
    headers: { "Content-Type": "application/fhir+json" },
    body: JSON.stringify(resource),
  });

  const resultBody = (await result.json()) as Record<string, unknown>;

  // Fire-and-forget: evaluate workflow triggers for the new MIC melding
  if (result.ok && resultBody.id) {
    const tenantId = c.get("tenantId");
    fireWorkflowTriggers(
      "resource.created",
      "AuditEvent",
      resultBody,
      tenantId,
    ).catch(() => {
      // Workflow failure should never block MIC melding creation
    });
  }

  return c.json(resultBody, result.ok ? 201 : (result.status as 400));
});
