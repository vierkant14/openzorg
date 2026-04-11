import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const documentenRoutes = new Hono<AppEnv>();

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

/**
 * GET /api/clients/:clientId/documenten — List DocumentReference resources for a client.
 */
documentenRoutes.get("/clients/:clientId/documenten", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/DocumentReference?subject=Patient/${clientId}&_sort=-date`,
  );
});

/**
 * POST /api/clients/:clientId/documenten — Upload a document (creates Binary + DocumentReference).
 * Expects multipart form data with a 'file' field and optional 'description' field.
 */
documentenRoutes.post("/clients/:clientId/documenten", async (c) => {
  const clientId = c.req.param("clientId");

  const formData = await c.req.formData();
  const file = formData.get("file");
  const description = formData.get("description");

  if (!file || !(file instanceof File)) {
    return c.json(
      operationOutcome("error", "required", "Bestand is vereist"),
      400,
    );
  }

  // Validate content type
  if (!ALLOWED_CONTENT_TYPES[file.type]) {
    return c.json(
      operationOutcome(
        "error",
        "invalid",
        `Bestandstype '${file.type}' is niet toegestaan. Toegestaan: PDF, JPG, PNG`,
      ),
      400,
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return c.json(
      operationOutcome(
        "error",
        "too-long",
        `Bestand is te groot. Maximaal ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      ),
      400,
    );
  }

  const authHeader = c.req.header("Authorization") ?? "";
  const medplumBaseUrl =
    process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

  // Step 1: Upload file as FHIR Binary
  const fileBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(fileBuffer).toString("base64");

  const binaryResource = {
    resourceType: "Binary",
    contentType: file.type,
    data: base64Data,
  };

  const binaryResponse = await fetch(`${medplumBaseUrl}/fhir/R4/Binary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/fhir+json",
      Accept: "application/fhir+json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(binaryResource),
  });

  if (!binaryResponse.ok) {
    const errorBody = (await binaryResponse.json()) as Record<string, unknown>;
    return c.json(errorBody, binaryResponse.status as 200);
  }

  const binary = (await binaryResponse.json()) as Record<string, unknown>;
  const binaryId = binary["id"] as string;

  // Step 2: Create DocumentReference pointing to the Binary
  const documentReference: Record<string, unknown> = {
    resourceType: "DocumentReference",
    status: "current",
    subject: { reference: `Patient/${clientId}` },
    date: new Date().toISOString(),
    content: [
      {
        attachment: {
          contentType: file.type,
          url: `Binary/${binaryId}`,
          title: file.name,
          size: file.size,
        },
      },
    ],
  };

  if (description) {
    documentReference["description"] = String(description);
  }

  return medplumProxy(c, "/fhir/R4/DocumentReference", {
    method: "POST",
    body: JSON.stringify(documentReference),
  });
});
