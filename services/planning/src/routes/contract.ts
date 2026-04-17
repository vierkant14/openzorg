import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumFetch } from "../lib/medplum-client.js";

export const contractRoutes = new Hono<AppEnv>();

interface ContractResponse {
  medewerkerId: string;
  urenPerWeek: number;
  fte: number;
  contractType: string;
  ingangsdatum: string | null;
  einddatum: string | null;
}

interface FhirExtension {
  url: string;
  valueDecimal?: number;
  valueString?: string;
  valueDate?: string;
}

interface FhirPractitionerRole {
  resourceType: "PractitionerRole";
  extension?: FhirExtension[];
  period?: { start?: string; end?: string };
}

interface FhirBundle {
  entry?: Array<{ resource: FhirPractitionerRole }>;
}

const EXT_BASE = "https://openzorg.nl/extensions";

function extractContract(pracId: string, role: FhirPractitionerRole | undefined): ContractResponse {
  if (!role) {
    return {
      medewerkerId: pracId,
      urenPerWeek: 36,
      fte: 1.0,
      contractType: "onbekend",
      ingangsdatum: null,
      einddatum: null,
    };
  }

  const extensions = role.extension ?? [];
  const urenExt = extensions.find((e) => e.url === `${EXT_BASE}/contract-uren`);
  const fteExt = extensions.find((e) => e.url === `${EXT_BASE}/contract-fte`);
  const typeExt = extensions.find((e) => e.url === `${EXT_BASE}/contract-type`);

  return {
    medewerkerId: pracId,
    urenPerWeek: urenExt?.valueDecimal ?? 36,
    fte: fteExt?.valueDecimal ?? 1.0,
    contractType: typeExt?.valueString ?? "onbekend",
    ingangsdatum: role.period?.start ?? null,
    einddatum: role.period?.end ?? null,
  };
}

/**
 * GET /:id/contract — Get contract info for a single medewerker.
 * Falls back to 36 uur / 1.0 FTE if no PractitionerRole found.
 */
contractRoutes.get("/:id/contract", async (c) => {
  const pracId = c.req.param("id");

  const res = await medplumFetch(
    c,
    `/fhir/R4/PractitionerRole?practitioner=Practitioner/${pracId}&_count=1`,
  );

  if (!res.ok) {
    return c.json(extractContract(pracId, undefined));
  }

  const bundle = (await res.json()) as FhirBundle;
  const role = bundle.entry?.[0]?.resource;

  return c.json(extractContract(pracId, role));
});

/**
 * GET /contracts — Batch endpoint: get contracts for multiple medewerkers.
 * Query: ?ids=abc,def,ghi
 */
contractRoutes.get("/contracts", async (c) => {
  const idsParam = c.req.query("ids") ?? "";
  const ids = idsParam.split(",").filter(Boolean);

  if (ids.length === 0) {
    return c.json({ contracts: [] });
  }

  // Fetch all PractitionerRoles in one query using _id search
  const practitionerParams = ids
    .map((id) => `Practitioner/${id}`)
    .join(",");

  const res = await medplumFetch(
    c,
    `/fhir/R4/PractitionerRole?practitioner=${encodeURIComponent(practitionerParams)}&_count=100`,
  );

  const roleMap = new Map<string, FhirPractitionerRole>();

  if (res.ok) {
    const bundle = (await res.json()) as FhirBundle;
    for (const entry of bundle.entry ?? []) {
      const role = entry.resource;
      // Extract practitioner ID from reference
      const pracRef = (role as unknown as Record<string, unknown>)["practitioner"] as { reference?: string } | undefined;
      const pracId = pracRef?.reference?.replace("Practitioner/", "");
      if (pracId) {
        roleMap.set(pracId, role);
      }
    }
  }

  const contracts = ids.map((id) => extractContract(id, roleMap.get(id)));
  return c.json({ contracts });
});
