import { Hono } from "hono";

export const dienstConfigRoutes = new Hono();

interface DienstType {
  code: string;
  naam: string;
  start: string; // "07:00"
  eind: string; // "15:00"
  kleur: string; // hex or tailwind color
}

interface DienstConfig {
  diensttypen: DienstType[];
  erftVan?: string; // parent orgId, null means own config
}

const DEFAULT_DIENSTTYPEN: DienstType[] = [
  { code: "vroeg", naam: "Vroege dienst", start: "07:00", eind: "15:00", kleur: "#0d9488" },
  { code: "laat", naam: "Late dienst", start: "15:00", eind: "23:00", kleur: "#7c3aed" },
  { code: "nacht", naam: "Nachtdienst", start: "23:00", eind: "07:00", kleur: "#1e3a5f" },
  { code: "dag", naam: "Dagdienst", start: "08:30", eind: "17:00", kleur: "#059669" },
  { code: "weekend", naam: "Weekenddienst", start: "07:00", eind: "19:00", kleur: "#d97706" },
];

/**
 * GET / — Return the default shift types (for UI to show what's inherited).
 */
dienstConfigRoutes.get("/", async (c) => {
  return c.json({ diensttypen: DEFAULT_DIENSTTYPEN, isDefault: true });
});

/**
 * GET /:orgId — Get dienst config for an organization level.
 * Implements inheritance: if no config at this level, walk up the tree.
 */
dienstConfigRoutes.get("/:orgId", async (c) => {
  const orgId = c.req.param("orgId");
  const authHeader = c.req.header("Authorization") ?? "";
  const medplumBaseUrl = process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

  // Try to find config for this org level, then walk up parents
  let currentOrgId: string | null = orgId;
  const visited: string[] = [];

  while (currentOrgId && visited.length < 10) {
    visited.push(currentOrgId);

    // Check if this org has its own dienst-config stored as FHIR Basic resource tagged with org
    const searchRes = await fetch(
      `${medplumBaseUrl}/fhir/R4/Basic?code=dienst-config&subject=Organization/${currentOrgId}&_count=1`,
      { headers: { Authorization: authHeader, Accept: "application/fhir+json" } },
    );

    if (searchRes.ok) {
      const bundle = (await searchRes.json()) as {
        entry?: Array<{
          resource: { extension?: Array<{ url: string; valueString?: string }> };
        }>;
      };
      const resource = bundle.entry?.[0]?.resource;
      if (resource) {
        const configExt = resource.extension?.find(
          (e) => e.url === "https://openzorg.nl/extensions/dienst-config",
        );
        if (configExt?.valueString) {
          const config = JSON.parse(configExt.valueString) as DienstConfig;
          return c.json({ ...config, orgId: currentOrgId, inherited: currentOrgId !== orgId });
        }
      }
    }

    // Walk up: get parent via Organization.partOf
    const orgRes = await fetch(`${medplumBaseUrl}/fhir/R4/Organization/${currentOrgId}`, {
      headers: { Authorization: authHeader, Accept: "application/fhir+json" },
    });

    if (!orgRes.ok) break;
    const org = (await orgRes.json()) as { partOf?: { reference?: string } };
    currentOrgId = org.partOf?.reference?.replace("Organization/", "") ?? null;
  }

  // No config found anywhere in the tree — return defaults
  return c.json({ diensttypen: DEFAULT_DIENSTTYPEN, orgId: null, inherited: true, isDefault: true });
});

/**
 * PUT /:orgId — Save dienst config for an organization level.
 */
dienstConfigRoutes.put("/:orgId", async (c) => {
  const orgId = c.req.param("orgId");
  const authHeader = c.req.header("Authorization") ?? "";
  const medplumBaseUrl = process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

  const body = await c.req.json<{ diensttypen: DienstType[] }>();

  if (!body.diensttypen || !Array.isArray(body.diensttypen)) {
    return c.json({ error: "diensttypen array is vereist" }, 400);
  }

  // Validate each dienst
  for (const d of body.diensttypen) {
    if (!d.code || !d.naam || !d.start || !d.eind) {
      return c.json(
        { error: `Diensttype ${d.code || "?"}: code, naam, start en eind zijn verplicht` },
        400,
      );
    }
  }

  const config: DienstConfig = { diensttypen: body.diensttypen };

  // Check if config already exists for this org
  const searchRes = await fetch(
    `${medplumBaseUrl}/fhir/R4/Basic?code=dienst-config&subject=Organization/${orgId}&_count=1`,
    { headers: { Authorization: authHeader, Accept: "application/fhir+json" } },
  );

  let method = "POST";
  let url = `${medplumBaseUrl}/fhir/R4/Basic`;
  let existingId: string | undefined;

  if (searchRes.ok) {
    const bundle = (await searchRes.json()) as {
      entry?: Array<{ resource: { id: string } }>;
    };
    existingId = bundle.entry?.[0]?.resource?.id;
    if (existingId) {
      method = "PUT";
      url = `${medplumBaseUrl}/fhir/R4/Basic/${existingId}`;
    }
  }

  const resource = {
    resourceType: "Basic",
    ...(existingId ? { id: existingId } : {}),
    code: {
      coding: [{ system: "https://openzorg.nl/CodeSystem/config-type", code: "dienst-config" }],
    },
    subject: { reference: `Organization/${orgId}` },
    extension: [
      {
        url: "https://openzorg.nl/extensions/dienst-config",
        valueString: JSON.stringify(config),
      },
    ],
  };

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/fhir+json",
      Accept: "application/fhir+json",
    },
    body: JSON.stringify(resource),
  });

  if (!res.ok) {
    const err = await res.text();
    return c.json({ error: `Opslaan mislukt: ${err.substring(0, 200)}` }, 500);
  }

  return c.json({ ...config, orgId, saved: true });
});

/**
 * DELETE /:orgId — Remove custom config, revert to inheritance.
 */
dienstConfigRoutes.delete("/:orgId", async (c) => {
  const orgId = c.req.param("orgId");
  const authHeader = c.req.header("Authorization") ?? "";
  const medplumBaseUrl = process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

  const searchRes = await fetch(
    `${medplumBaseUrl}/fhir/R4/Basic?code=dienst-config&subject=Organization/${orgId}&_count=1`,
    { headers: { Authorization: authHeader, Accept: "application/fhir+json" } },
  );

  if (searchRes.ok) {
    const bundle = (await searchRes.json()) as {
      entry?: Array<{ resource: { id: string } }>;
    };
    const id = bundle.entry?.[0]?.resource?.id;
    if (id) {
      await fetch(`${medplumBaseUrl}/fhir/R4/Basic/${id}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      });
    }
  }

  return c.json({ deleted: true, orgId });
});

export { DEFAULT_DIENSTTYPEN };
