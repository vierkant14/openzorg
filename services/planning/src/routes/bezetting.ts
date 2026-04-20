import { Hono } from "hono";

export const bezettingRoutes = new Hono();

interface BezettingsEis {
  dienstCode: string; // "vroeg", "laat", "nacht"
  rollen: Array<{
    competentie: string; // competentie code like "VH-INJECTIES" or function like "verpleegkundige"
    minimum: number;
  }>;
}

interface BezettingsProfiel {
  orgId: string;
  eisen: BezettingsEis[];
}

/**
 * GET /:orgId — Get bezettingsprofiel for an organization level.
 * Returns the profile or empty eisen if none set.
 */
bezettingRoutes.get("/:orgId", async (c) => {
  const orgId = c.req.param("orgId");
  const authHeader = c.req.header("Authorization") ?? "";
  const medplumBaseUrl = process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

  const searchRes = await fetch(
    `${medplumBaseUrl}/fhir/R4/Basic?code=bezettingsprofiel&subject=Organization/${orgId}&_count=1`,
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
      const profielExt = resource.extension?.find(
        (e) => e.url === "https://openzorg.nl/extensions/bezettingsprofiel",
      );
      if (profielExt?.valueString) {
        const profiel = JSON.parse(profielExt.valueString) as BezettingsProfiel;
        return c.json(profiel);
      }
    }
  }

  // No profile found — return empty eisen
  return c.json({ orgId, eisen: [] } satisfies BezettingsProfiel);
});

/**
 * PUT /:orgId — Save/update bezettingsprofiel.
 * Validates that dienstCodes and competentie codes are non-empty.
 */
bezettingRoutes.put("/:orgId", async (c) => {
  const orgId = c.req.param("orgId");
  const authHeader = c.req.header("Authorization") ?? "";
  const medplumBaseUrl = process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

  const body = await c.req.json<{ eisen: BezettingsEis[] }>();

  if (!body.eisen || !Array.isArray(body.eisen)) {
    return c.json({ error: "eisen array is vereist" }, 400);
  }

  for (const eis of body.eisen) {
    if (!eis.dienstCode || eis.dienstCode.trim() === "") {
      return c.json({ error: "dienstCode mag niet leeg zijn" }, 400);
    }
    if (!Array.isArray(eis.rollen)) {
      return c.json({ error: `Eis voor dienst "${eis.dienstCode}": rollen array is vereist` }, 400);
    }
    for (const rol of eis.rollen) {
      if (!rol.competentie || rol.competentie.trim() === "") {
        return c.json(
          { error: `Eis voor dienst "${eis.dienstCode}": competentie mag niet leeg zijn` },
          400,
        );
      }
      if (typeof rol.minimum !== "number" || rol.minimum < 0) {
        return c.json(
          {
            error: `Eis voor dienst "${eis.dienstCode}", competentie "${rol.competentie}": minimum moet een niet-negatief getal zijn`,
          },
          400,
        );
      }
    }
  }

  const profiel: BezettingsProfiel = { orgId, eisen: body.eisen };

  // Check if profile already exists for this org
  const searchRes = await fetch(
    `${medplumBaseUrl}/fhir/R4/Basic?code=bezettingsprofiel&subject=Organization/${orgId}&_count=1`,
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
      coding: [
        { system: "https://openzorg.nl/CodeSystem/config-type", code: "bezettingsprofiel" },
      ],
    },
    subject: { reference: `Organization/${orgId}` },
    extension: [
      {
        url: "https://openzorg.nl/extensions/bezettingsprofiel",
        valueString: JSON.stringify(profiel),
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

  return c.json({ ...profiel, saved: true });
});

/**
 * GET /:orgId/status?week=2026-W17 — Returns current staffing status for a week.
 * Per dienst per dag: how many are needed vs how many are planned.
 *
 * NOTE: Full comparison against live Appointments will be added when the planning
 * engine is built. For now this returns the static requirements.
 */
bezettingRoutes.get("/:orgId/status", async (c) => {
  const orgId = c.req.param("orgId");
  const _week = c.req.query("week"); // e.g. "2026-W17" — used in future planning engine
  const authHeader = c.req.header("Authorization") ?? "";
  const medplumBaseUrl = process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

  const searchRes = await fetch(
    `${medplumBaseUrl}/fhir/R4/Basic?code=bezettingsprofiel&subject=Organization/${orgId}&_count=1`,
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
      const profielExt = resource.extension?.find(
        (e) => e.url === "https://openzorg.nl/extensions/bezettingsprofiel",
      );
      if (profielExt?.valueString) {
        const profiel = JSON.parse(profielExt.valueString) as BezettingsProfiel;
        return c.json({ eisen: profiel.eisen, orgId });
      }
    }
  }

  return c.json({ eisen: [], orgId });
});
