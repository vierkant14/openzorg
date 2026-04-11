import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const dagplanningRoutes = new Hono<AppEnv>();

/**
 * GET /api/dagplanning/medewerker/:practitionerId — Daily schedule for a practitioner.
 * Query param: datum (YYYY-MM-DD)
 */
dagplanningRoutes.get("/medewerker/:practitionerId", async (c) => {
  const practitionerId = c.req.param("practitionerId");
  const datum = c.req.query("datum");

  if (!datum) {
    return c.json(
      operationOutcome("error", "required", "Datum is vereist als query parameter"),
      400,
    );
  }

  const params = new URLSearchParams();
  params.set("practitioner", `Practitioner/${practitionerId}`);
  params.set("date", datum);

  return medplumProxy(c, `/fhir/R4/Appointment?${params.toString()}`);
});

/**
 * GET /api/dagplanning/medewerker/:practitionerId/week — Weekly schedule for a practitioner.
 * Query param: startDatum (YYYY-MM-DD, Monday of the week)
 */
dagplanningRoutes.get("/medewerker/:practitionerId/week", async (c) => {
  const practitionerId = c.req.param("practitionerId");
  const startDatum = c.req.query("startDatum");

  if (!startDatum) {
    return c.json(
      operationOutcome("error", "required", "startDatum is vereist als query parameter"),
      400,
    );
  }

  // Calculate end of week (7 days from start)
  const start = new Date(startDatum);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const endDatum = end.toISOString().split("T")[0];

  const params = new URLSearchParams();
  params.set("practitioner", `Practitioner/${practitionerId}`);
  params.set("date", `ge${startDatum}`);
  params.set("date", `lt${endDatum}`);

  return medplumProxy(c, `/fhir/R4/Appointment?${params.toString()}`);
});
