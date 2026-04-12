import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";
import { searchSnomed } from "../lib/snomed.js";

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
  observaties: { label: "Observaties & Metingen", snomedTags: ["observable entity", "finding"] },
  lichaamsdelen: { label: "Lichaamsdelen & Locaties", snomedTags: ["body structure"] },
  wondtypen: { label: "Wondtypen & Huidletsel", snomedTags: ["morphologic abnormality", "disorder"] },
  hulpmiddelen: { label: "Hulpmiddelen", snomedTags: ["physical object"] },
  voeding: { label: "Voeding & Diëten", snomedTags: ["regime/therapy", "substance"] },
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

  // Collect concepts from all include blocks (supports multiple code systems)
  const items = (valueSet.compose?.include ?? []).flatMap((inc) =>
    (inc.concept ?? []).map((concept) => ({
      code: concept.code,
      display: concept.display,
    })),
  );

  return c.json({ items, valueSetId: valueSet.id });
});

/**
 * POST /api/admin/codelijsten/:type — Add a concept to the tenant's list.
 * Body: { code: "12345678", display: "Diabetes mellitus", system?: string }
 * system defaults to SNOMED CT but supports custom codes for non-SNOMED concepts
 * (e.g. voeding, hulpmiddelen).
 */
codelijstenRoutes.post("/:type", async (c) => {
  const type = c.req.param("type");
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{ code: string; display: string; system?: string }>();

  if (!body.code || !body.display) {
    return c.json(operationOutcome("error", "invalid", "Code en display zijn verplicht"), 400);
  }

  const codeSystem = body.system || "http://snomed.info/sct";

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
      // Add to existing ValueSet — support multiple code systems in includes
      const compose = (existing["compose"] as {
        include?: Array<{ system?: string; concept?: Array<{ code: string; display: string }> }>;
      }) ?? { include: [] };

      const includes = compose.include ?? [];

      // Find the include block for this code system, or create one
      let targetInclude = includes.find((inc) => inc.system === codeSystem);
      if (!targetInclude) {
        targetInclude = { system: codeSystem, concept: [] };
        includes.push(targetInclude);
      }

      const concepts = targetInclude.concept ?? [];

      // Check for duplicates
      if (concepts.some((c) => c.code === body.code)) {
        return c.json({ message: "Code bestaat al in de lijst" }, 409);
      }

      concepts.push({ code: body.code, display: body.display });
      targetInclude.concept = concepts;

      valueSet = {
        ...existing,
        compose: { include: includes },
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
        system: codeSystem,
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

  // Remove the code from whichever include block contains it
  const updatedIncludes = (compose.include ?? []).map((inc) => ({
    ...inc,
    concept: (inc.concept ?? []).filter((c) => c.code !== code),
  })).filter((inc) => (inc.concept?.length ?? 0) > 0);

  const updated = {
    ...existing,
    compose: {
      include: updatedIncludes.length > 0 ? updatedIncludes : [{ system: "http://snomed.info/sct", concept: [] }],
    },
  };

  return medplumProxy(c, `/fhir/R4/ValueSet/${existing["id"] as string}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  });
});
