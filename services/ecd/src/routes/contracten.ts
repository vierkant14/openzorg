import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const contractenRoutes = new Hono<AppEnv>();

/**
 * Contracten are stored as PractitionerRole resources with extensions
 * for contract-specific data (type, FTE, hours, start/end dates).
 *
 * Extension base: https://openzorg.nl/extensions/contract
 */
const CONTRACT_EXT = "https://openzorg.nl/extensions/contract";

const CONTRACT_TYPES = ["vast", "flex", "oproep", "zzp", "stage", "vrijwilliger"] as const;

/**
 * GET /api/contracten — List all contracts (PractitionerRoles with contract extension).
 */
contractenRoutes.get("/", async (c) => {
  return medplumProxy(c, `/fhir/R4/PractitionerRole?_count=200`);
});

/**
 * GET /api/contracten/medewerker/:practitionerId — Contracts for a specific practitioner.
 */
contractenRoutes.get("/medewerker/:practitionerId", async (c) => {
  const practId = c.req.param("practitionerId");
  return medplumProxy(c, `/fhir/R4/PractitionerRole?practitioner=Practitioner/${practId}`);
});

/**
 * POST /api/contracten — Create a new contract.
 *
 * Body: {
 *   practitionerId: string,
 *   organizationId?: string,
 *   contractType: "vast" | "flex" | "oproep" | "zzp" | "stage" | "vrijwilliger",
 *   fte: number,           // e.g. 0.8
 *   urenPerWeek: number,   // e.g. 32
 *   startdatum: string,    // ISO date
 *   einddatum?: string,    // ISO date (optional for indefinite)
 *   functie?: string,
 * }
 */
contractenRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    practitionerId: string;
    organizationId?: string;
    contractType: string;
    fte: number;
    urenPerWeek: number;
    startdatum: string;
    einddatum?: string;
    functie?: string;
  }>();

  if (!body.practitionerId || !body.contractType || !body.startdatum) {
    return c.json(operationOutcome("error", "invalid", "practitionerId, contractType en startdatum zijn verplicht"), 400);
  }

  if (!CONTRACT_TYPES.includes(body.contractType as typeof CONTRACT_TYPES[number])) {
    return c.json(operationOutcome("error", "invalid", `Ongeldig contracttype. Kies uit: ${CONTRACT_TYPES.join(", ")}`), 400);
  }

  const resource = {
    resourceType: "PractitionerRole",
    practitioner: { reference: `Practitioner/${body.practitionerId}` },
    ...(body.organizationId ? { organization: { reference: `Organization/${body.organizationId}` } } : {}),
    ...(body.functie ? { code: [{ text: body.functie }] } : {}),
    period: {
      start: body.startdatum,
      ...(body.einddatum ? { end: body.einddatum } : {}),
    },
    active: true,
    extension: [
      {
        url: CONTRACT_EXT,
        extension: [
          { url: "type", valueString: body.contractType },
          { url: "fte", valueDecimal: body.fte },
          { url: "urenPerWeek", valueDecimal: body.urenPerWeek },
        ],
      },
    ],
  };

  return medplumProxy(c, "/fhir/R4/PractitionerRole", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /api/contracten/:id — Update a contract.
 */
contractenRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  return medplumProxy(c, `/fhir/R4/PractitionerRole/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...body, id }),
  });
});

/**
 * DELETE /api/contracten/:id — Deactivate a contract (soft delete).
 */
contractenRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const current = await medplumFetch(c, `/fhir/R4/PractitionerRole/${id}`);
  if (!current.ok) {
    return c.json(operationOutcome("error", "not-found", "Contract niet gevonden"), 404);
  }

  const role = (await current.json()) as Record<string, unknown>;
  role["active"] = false;

  return medplumProxy(c, `/fhir/R4/PractitionerRole/${id}`, {
    method: "PUT",
    body: JSON.stringify(role),
  });
});

/**
 * GET /api/contracten/overzicht — Overview: total FTE, hours per org.
 */
contractenRoutes.get("/overzicht/samenvatting", async (c) => {
  const res = await medplumFetch(c, "/fhir/R4/PractitionerRole?active=true&_count=500");

  if (!res.ok) {
    return c.json({ totalFte: 0, totalUren: 0, perOrganisatie: [] });
  }

  const bundle = (await res.json()) as {
    entry?: Array<{
      resource: {
        organization?: { reference?: string; display?: string };
        extension?: Array<{
          url: string;
          extension?: Array<{ url: string; valueDecimal?: number; valueString?: string }>;
        }>;
      };
    }>;
  };

  let totalFte = 0;
  let totalUren = 0;
  const orgMap = new Map<string, { name: string; fte: number; uren: number; count: number }>();

  for (const entry of bundle.entry ?? []) {
    const contractExt = entry.resource.extension?.find((e) => e.url === CONTRACT_EXT);
    if (!contractExt) continue;

    const fte = contractExt.extension?.find((e) => e.url === "fte")?.valueDecimal ?? 0;
    const uren = contractExt.extension?.find((e) => e.url === "urenPerWeek")?.valueDecimal ?? 0;

    totalFte += fte;
    totalUren += uren;

    const orgRef = entry.resource.organization?.reference ?? "onbekend";
    const orgName = entry.resource.organization?.display ?? orgRef;
    const existing = orgMap.get(orgRef) ?? { name: orgName, fte: 0, uren: 0, count: 0 };
    existing.fte += fte;
    existing.uren += uren;
    existing.count += 1;
    orgMap.set(orgRef, existing);
  }

  return c.json({
    totalFte: Math.round(totalFte * 100) / 100,
    totalUren: Math.round(totalUren * 100) / 100,
    totalContracten: bundle.entry?.length ?? 0,
    perOrganisatie: Array.from(orgMap.values()),
  });
});
