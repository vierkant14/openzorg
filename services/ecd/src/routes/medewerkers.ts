import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";

export const medewerkerRoutes = new Hono<AppEnv>();

const AGB_SYSTEM = "http://fhir.nl/fhir/NamingSystem/agb";

const FUNCTIES = [
  "wijkverpleegkundige",
  "verzorgende",
  "verpleegkundige",
  "fysiotherapeut",
  "ergotherapeut",
  "arts",
  "teamleider",
  "planner",
] as const;

interface MedewerkerInput {
  voornaam: string;
  achternaam: string;
  agbCode?: string;
  email?: string;
  telefoon?: string;
  functie: string;
}

/**
 * GET /api/medewerkers — List all Practitioner resources.
 */
medewerkerRoutes.get("/", async (c) => {
  const queryString = new URL(c.req.url).search;
  return medplumProxy(c, `/fhir/R4/Practitioner${queryString}`);
});

/**
 * GET /api/medewerkers/:id — Get a single Practitioner.
 */
medewerkerRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Practitioner/${id}`);
});

/**
 * POST /api/medewerkers — Create a Practitioner with AGB identifier.
 */
medewerkerRoutes.post("/", async (c) => {
  const body = (await c.req.json()) as MedewerkerInput;

  if (!body.voornaam || !body.achternaam) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        "Voornaam en achternaam zijn vereist",
      ),
      400,
    );
  }

  if (body.functie && !FUNCTIES.includes(body.functie as typeof FUNCTIES[number])) {
    return c.json(
      operationOutcome(
        "error",
        "invalid",
        `Functie moet een van de volgende zijn: ${FUNCTIES.join(", ")}`,
      ),
      400,
    );
  }

  const identifiers: Array<{ system: string; value: string }> = [];

  if (body.agbCode) {
    if (!/^\d{8}$/.test(body.agbCode)) {
      return c.json(
        operationOutcome(
          "error",
          "invalid",
          "AGB-code moet exact 8 cijfers bevatten",
        ),
        400,
      );
    }
    identifiers.push({ system: AGB_SYSTEM, value: body.agbCode });
  }

  const telecom: Array<{ system: string; value: string; use?: string }> = [];
  if (body.email) {
    telecom.push({ system: "email", value: body.email, use: "work" });
  }
  if (body.telefoon) {
    telecom.push({ system: "phone", value: body.telefoon, use: "work" });
  }

  const qualification: Array<{ code: { text: string } }> = [];
  if (body.functie) {
    qualification.push({ code: { text: body.functie } });
  }

  const resource: Record<string, unknown> = {
    resourceType: "Practitioner",
    active: true,
    name: [
      {
        family: body.achternaam,
        given: [body.voornaam],
      },
    ],
    ...(identifiers.length > 0 ? { identifier: identifiers } : {}),
    ...(telecom.length > 0 ? { telecom } : {}),
    ...(qualification.length > 0 ? { qualification } : {}),
  };

  return medplumProxy(c, "/fhir/R4/Practitioner", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * DELETE /api/medewerkers/:id — Soft delete: sets Practitioner.active = false.
 */
medewerkerRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const current = await medplumFetch(c, `/fhir/R4/Practitioner/${id}`);
  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const practitioner = (await current.json()) as Record<string, unknown>;
  practitioner["active"] = false;

  return medplumProxy(c, `/fhir/R4/Practitioner/${id}`, {
    method: "PUT",
    body: JSON.stringify(practitioner),
  });
});
