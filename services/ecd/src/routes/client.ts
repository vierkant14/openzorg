import { isValidBSN } from "@openzorg/shared-domain";
import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";
import { fireWorkflowTriggers } from "../lib/workflow-trigger-engine.js";

export const clientRoutes = new Hono<AppEnv>();

const CLIENTNUMMER_SYSTEM = "https://openzorg.nl/NamingSystem/clientnummer";

/**
 * Generate the next clientnummer by querying existing patients.
 * Format: C-00001, C-00002, etc.
 */
async function generateClientnummer(c: Parameters<typeof medplumFetch>[0]): Promise<string> {
  // Search for all patients that have a clientnummer, sorted desc
  const res = await medplumFetch(
    c,
    `/fhir/R4/Patient?identifier=${encodeURIComponent(CLIENTNUMMER_SYSTEM)}|&_count=1&_sort=-_lastUpdated&_elements=identifier`,
  );

  let nextNum = 1;

  if (res.ok) {
    const bundle = (await res.json()) as {
      entry?: Array<{
        resource: {
          identifier?: Array<{ system?: string; value?: string }>;
        };
      }>;
    };

    // Find the highest existing clientnummer
    const existing = bundle.entry
      ?.flatMap((e) => e.resource.identifier ?? [])
      .filter((id) => id.system === CLIENTNUMMER_SYSTEM)
      .map((id) => {
        const match = id.value?.match(/^C-(\d+)$/);
        return match ? parseInt(match[1] ?? "0", 10) : 0;
      }) ?? [];

    const max = Math.max(0, ...existing);
    nextNum = max + 1;
  }

  return `C-${String(nextNum).padStart(5, "0")}`;
}

/**
 * GET /api/clients — List all Patient resources.
 */
clientRoutes.get("/", async (c) => {
  const queryString = new URL(c.req.url).search;
  return medplumProxy(c, `/fhir/R4/Patient${queryString}`);
});

/**
 * GET /api/clients/:id — Get a single Patient.
 */
clientRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Patient/${id}`);
});

/**
 * POST /api/clients — Create a Patient with optional BSN validation + auto-generated clientnummer.
 */
clientRoutes.post("/", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();

  // Extract BSN from FHIR Patient identifier array
  const identifiers = (body["identifier"] as
    | Array<{ system?: string; value?: string }>
    | undefined) ?? [];

  const bsnIdentifier = identifiers.find(
    (id) => id.system === "http://fhir.nl/fhir/NamingSystem/bsn",
  );

  if (bsnIdentifier?.value) {
    if (!isValidBSN(bsnIdentifier.value)) {
      return c.json(
        operationOutcome(
          "error",
          "invalid",
          "BSN voldoet niet aan de elfproef",
        ),
        400,
      );
    }
  }

  // Auto-generate clientnummer
  const clientnummer = await generateClientnummer(c);
  const updatedIdentifiers = [
    { system: CLIENTNUMMER_SYSTEM, value: clientnummer },
    ...identifiers.filter((id) => id.system !== CLIENTNUMMER_SYSTEM),
  ];

  const patientBody = {
    ...body,
    identifier: updatedIdentifiers,
  };

  // Create the patient via medplumFetch so we can extract the ID for workflow trigger
  const result = await medplumFetch(c, "/fhir/R4/Patient", {
    method: "POST",
    headers: { "Content-Type": "application/fhir+json" },
    body: JSON.stringify(patientBody),
  });

  const resultBody = await result.json() as Record<string, unknown> & { id?: string; name?: Array<{ given?: string[]; family?: string }> };

  // Fire-and-forget: evaluate workflow triggers for the new patient
  if (result.ok && resultBody.id) {
    const tenantId = c.get("tenantId");
    fireWorkflowTriggers(
      "resource.created",
      "Patient",
      resultBody as Record<string, unknown>,
      tenantId,
    ).catch(() => {
      // Workflow failure should never block patient creation
    });
  }

  return c.json(resultBody, result.ok ? 201 : result.status as 400);
});

/**
 * PUT /api/clients/:id — Update a Patient.
 */
clientRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  // Validate BSN if present in the update
  const identifiers = body["identifier"] as
    | Array<{ system?: string; value?: string }>
    | undefined;

  const bsnIdentifier = identifiers?.find(
    (id) => id.system === "http://fhir.nl/fhir/NamingSystem/bsn",
  );

  if (bsnIdentifier?.value) {
    if (!isValidBSN(bsnIdentifier.value)) {
      return c.json(
        operationOutcome(
          "error",
          "invalid",
          "BSN voldoet niet aan de elfproef",
        ),
        400,
      );
    }
  }

  return medplumProxy(c, `/fhir/R4/Patient/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...body, id }),
  });
});

/**
 * POST /api/clients/:id/foto — Upload a photo for a patient.
 *
 * Body: {
 *   foto: string,        // base64-encoded image data
 *   contentType: string,  // e.g. "image/jpeg", "image/png"
 * }
 */
clientRoutes.post("/:id/foto", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    foto: string;
    contentType: string;
  }>();

  if (!body.foto || !body.contentType) {
    return c.json(
      operationOutcome("error", "required", "foto en contentType zijn verplicht"),
      400,
    );
  }

  // Fetch current patient resource
  const current = await medplumFetch(c, `/fhir/R4/Patient/${id}`);

  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const patient = (await current.json()) as Record<string, unknown>;

  // Set photo on the patient resource
  patient["photo"] = [
    {
      contentType: body.contentType,
      data: body.foto,
    },
  ];

  return medplumProxy(c, `/fhir/R4/Patient/${id}`, {
    method: "PUT",
    body: JSON.stringify(patient),
  });
});

/**
 * DELETE /api/clients/:id/foto — Remove a patient's photo.
 */
clientRoutes.delete("/:id/foto", async (c) => {
  const id = c.req.param("id");

  // Fetch current patient resource
  const current = await medplumFetch(c, `/fhir/R4/Patient/${id}`);

  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const patient = (await current.json()) as Record<string, unknown>;

  // Remove photo
  patient["photo"] = [];

  return medplumProxy(c, `/fhir/R4/Patient/${id}`, {
    method: "PUT",
    body: JSON.stringify(patient),
  });
});

/**
 * DELETE /api/clients/:id — Soft delete: sets Patient.active = false.
 */
clientRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Fetch current resource
  const current = await medplumFetch(c, `/fhir/R4/Patient/${id}`);

  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const patient = (await current.json()) as Record<string, unknown>;

  // Soft delete by setting active = false
  patient["active"] = false;

  return medplumProxy(c, `/fhir/R4/Patient/${id}`, {
    method: "PUT",
    body: JSON.stringify(patient),
  });
});
