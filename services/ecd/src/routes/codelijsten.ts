import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { searchSnomed } from "../lib/snomed.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const codelijstenRoutes = new Hono<AppEnv>();

/**
 * Code list types that can be managed by administrators.
 * Each type maps to a SNOMED semantic tag filter.
 */
const CODELIJST_TYPES: Record<string, { label: string; snomedTags: string[] }> = {
  diagnoses: { label: "Diagnoses & Aandoeningen", snomedTags: ["disorder", "finding"] },
  allergieen: { label: "Allergieën & Intoleranties", snomedTags: ["substance", "product", "organism"] },
  medicatie: { label: "Medicatie", snomedTags: ["product", "substance"] },
  verrichtingen: { label: "Verrichtingen", snomedTags: ["procedure"] },
};

/**
 * GET /api/admin/codelijsten/types — List available code list types.
 */
codelijstenRoutes.get("/types", (c) => {
  const types = Object.entries(CODELIJST_TYPES).map(([key, val]) => ({
    key,
    label: val.label,
  }));
  return c.json({ types });
});

/**
 * GET /api/admin/codelijsten/snomed/search?q=...&type=diagnoses
 * Search SNOMED CT. Used by beheerder to find terms to add to the org list.
 */
codelijstenRoutes.get("/snomed/search", async (c) => {
  const query = c.req.query("q") ?? "";
  const type = c.req.query("type") ?? "diagnoses";
  const config = CODELIJST_TYPES[type];

  const results = await searchSnomed(query, {
    semanticTags: config?.snomedTags,
    limit: 15,
  });

  return c.json({ results });
});

/**
 * GET /api/admin/codelijsten/:type — Get the tenant's curated code list.
 * Stored as a FHIR ValueSet resource per tenant per type.
 */
codelijstenRoutes.get("/:type", async (c) => {
  const type = c.req.param("type");
  const tenantId = c.get("tenantId");

  // Search for existing ValueSet for this tenant + type
  const res = await medplumFetch(
    c,
    `/fhir/R4/ValueSet?name=codelijst-${type}&_tag=tenant:${tenantId}`,
  );

  if (!res.ok) {
    return c.json({ items: [] });
  }

  const bundle = (await res.json()) as {
    entry?: Array<{
      resource: {
        id: string;
        compose?: {
          include?: Array<{
            concept?: Array<{
              code: string;
              display: string;
            }>;
          }>;
        };
      };
    }>;
  };

  const valueSet = bundle.entry?.[0]?.resource;
  if (!valueSet) {
    return c.json({ items: [], valueSetId: null });
  }

  const items = valueSet.compose?.include?.[0]?.concept?.map((c) => ({
    code: c.code,
    display: c.display,
  })) ?? [];

  return c.json({ items, valueSetId: valueSet.id });
});

/**
 * POST /api/admin/codelijsten/:type — Add a SNOMED concept to the tenant's list.
 * Body: { code: "12345678", display: "Diabetes mellitus" }
 */
codelijstenRoutes.post("/:type", async (c) => {
  const type = c.req.param("type");
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{ code: string; display: string }>();

  if (!body.code || !body.display) {
    return c.json(operationOutcome("error", "invalid", "Code en display zijn verplicht"), 400);
  }

  // Find or create the ValueSet
  const searchRes = await medplumFetch(
    c,
    `/fhir/R4/ValueSet?name=codelijst-${type}&_tag=tenant:${tenantId}`,
  );

  let valueSet: Record<string, unknown>;

  if (searchRes.ok) {
    const searchBundle = (await searchRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
    const existing = searchBundle.entry?.[0]?.resource;

    if (existing) {
      // Add to existing ValueSet
      const compose = (existing["compose"] as {
        include?: Array<{ system?: string; concept?: Array<{ code: string; display: string }> }>;
      }) ?? { include: [] };

      const concepts = compose.include?.[0]?.concept ?? [];

      // Check for duplicates
      if (concepts.some((c) => c.code === body.code)) {
        return c.json({ message: "Code bestaat al in de lijst" }, 409);
      }

      concepts.push({ code: body.code, display: body.display });

      valueSet = {
        ...existing,
        compose: {
          include: [{
            system: "http://snomed.info/sct",
            concept: concepts,
          }],
        },
      };

      return medplumProxy(c, `/fhir/R4/ValueSet/${existing["id"] as string}`, {
        method: "PUT",
        body: JSON.stringify(valueSet),
      });
    }
  }

  // Create new ValueSet
  valueSet = {
    resourceType: "ValueSet",
    name: `codelijst-${type}`,
    title: CODELIJST_TYPES[type]?.label ?? type,
    status: "active",
    meta: {
      tag: [{ system: "https://openzorg.nl/tenant", code: `tenant:${tenantId}` }],
    },
    compose: {
      include: [{
        system: "http://snomed.info/sct",
        concept: [{ code: body.code, display: body.display }],
      }],
    },
  };

  return medplumProxy(c, "/fhir/R4/ValueSet", {
    method: "POST",
    body: JSON.stringify(valueSet),
  });
});

/**
 * DELETE /api/admin/codelijsten/:type/:code — Remove a concept from the list.
 */
codelijstenRoutes.delete("/:type/:code", async (c) => {
  const type = c.req.param("type");
  const code = c.req.param("code");
  const tenantId = c.get("tenantId");

  const searchRes = await medplumFetch(
    c,
    `/fhir/R4/ValueSet?name=codelijst-${type}&_tag=tenant:${tenantId}`,
  );

  if (!searchRes.ok) {
    return c.json(operationOutcome("error", "not-found", "Codelijst niet gevonden"), 404);
  }

  const searchBundle = (await searchRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
  const existing = searchBundle.entry?.[0]?.resource;

  if (!existing) {
    return c.json(operationOutcome("error", "not-found", "Codelijst niet gevonden"), 404);
  }

  const compose = (existing["compose"] as {
    include?: Array<{ system?: string; concept?: Array<{ code: string; display: string }> }>;
  }) ?? { include: [] };

  const concepts = compose.include?.[0]?.concept ?? [];
  const filtered = concepts.filter((c) => c.code !== code);

  const updated = {
    ...existing,
    compose: {
      include: [{
        system: "http://snomed.info/sct",
        concept: filtered,
      }],
    },
  };

  return medplumProxy(c, `/fhir/R4/ValueSet/${existing["id"] as string}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  });
});
