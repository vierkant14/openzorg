/**
 * Coverage (Verzekeringsdekking) per client.
 *
 * Separate from indicaties — this focuses on insurance/payor information
 * for billing purposes: verzekeraar, polisnummer, financieringstype,
 * and WLZ-specific fields (ZZP-klasse, toewijzingsnummer, indicatiebesluit).
 *
 * Stored as FHIR Coverage resources via Medplum.
 */

import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumFetch, medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const coverageRoutes = new Hono<AppEnv>();

interface CoverageBody {
  verzekeraar?: string;
  polisnummer?: string;
  financieringstype?: string;
  ingangsdatum?: string;
  einddatum?: string;
  zzpKlasse?: string;
  toewijzingsnummer?: string;
  indicatiebesluit?: string;
  status?: string;
}

function buildExtensions(body: CoverageBody): Array<{ url: string; valueString: string }> {
  const extensions: Array<{ url: string; valueString: string }> = [];
  if (body.financieringstype) {
    extensions.push({
      url: "https://openzorg.nl/extensions/financieringstype",
      valueString: body.financieringstype,
    });
  }
  if (body.indicatiebesluit) {
    extensions.push({
      url: "https://openzorg.nl/extensions/indicatiebesluit",
      valueString: body.indicatiebesluit,
    });
  }
  if (body.zzpKlasse) {
    extensions.push({
      url: "https://openzorg.nl/extensions/zzp-klasse",
      valueString: body.zzpKlasse,
    });
  }
  if (body.toewijzingsnummer) {
    extensions.push({
      url: "https://openzorg.nl/extensions/toewijzingsnummer",
      valueString: body.toewijzingsnummer,
    });
  }
  return extensions;
}

/**
 * GET /clients/:clientId/verzekering — List all Coverage for a client
 */
coverageRoutes.get("/:clientId/verzekering", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/Coverage?beneficiary=Patient/${clientId}&_sort=-_lastUpdated`,
  );
});

/**
 * POST /clients/:clientId/verzekering — Create new Coverage
 */
coverageRoutes.post("/:clientId/verzekering", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json<CoverageBody>();

  if (!body.verzekeraar && !body.financieringstype) {
    return c.json(
      operationOutcome("error", "required", "Verzekeraar of financieringstype is vereist"),
      400,
    );
  }

  const classEntries: Array<Record<string, unknown>> = [];
  if (body.polisnummer) {
    classEntries.push({
      type: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/coverage-class",
          code: "policy",
        }],
      },
      value: body.polisnummer,
      name: "Polisnummer",
    });
  }

  const resource = {
    resourceType: "Coverage",
    status: body.status ?? "active",
    beneficiary: { reference: `Patient/${clientId}` },
    payor: body.verzekeraar ? [{ display: body.verzekeraar }] : [],
    ...(classEntries.length > 0 ? { class: classEntries } : {}),
    period: body.ingangsdatum
      ? {
          start: body.ingangsdatum,
          ...(body.einddatum ? { end: body.einddatum } : {}),
        }
      : undefined,
    extension: buildExtensions(body),
  };

  return medplumProxy(c, "/fhir/R4/Coverage", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /clients/:clientId/verzekering/:coverageId — Update existing Coverage
 */
coverageRoutes.put("/:clientId/verzekering/:coverageId", async (c) => {
  const coverageId = c.req.param("coverageId");
  const body = await c.req.json<CoverageBody>();

  // Fetch current resource for merge
  const currentRes = await medplumFetch(c, `/fhir/R4/Coverage/${coverageId}`);
  if (!currentRes.ok) {
    return c.json(operationOutcome("error", "not-found", "Coverage niet gevonden"), 404);
  }
  const existing = (await currentRes.json()) as Record<string, unknown>;

  // Build updated resource
  const classEntries: Array<Record<string, unknown>> = [];
  if (body.polisnummer) {
    classEntries.push({
      type: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/coverage-class",
          code: "policy",
        }],
      },
      value: body.polisnummer,
      name: "Polisnummer",
    });
  }

  const newExtensions = buildExtensions(body);
  const updated = {
    ...existing,
    status: body.status ?? existing.status,
    payor: body.verzekeraar ? [{ display: body.verzekeraar }] : existing.payor,
    ...(classEntries.length > 0 ? { class: classEntries } : {}),
    period: body.ingangsdatum
      ? {
          start: body.ingangsdatum,
          ...(body.einddatum ? { end: body.einddatum } : {}),
        }
      : existing.period,
    extension: newExtensions.length > 0 ? newExtensions : existing.extension,
  };

  return medplumProxy(c, `/fhir/R4/Coverage/${coverageId}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  });
});
