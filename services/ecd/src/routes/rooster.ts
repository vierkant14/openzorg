import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
} from "../lib/medplum-client.js";

export const roosterRoutes = new Hono<AppEnv>();

/**
 * Rooster entries are stored as Schedule + Slot resources.
 * - Schedule: represents a medewerker's weekly template
 * - Slot: individual shifts (diensten) with type and times
 *
 * Diensttypen are stored as Slot.serviceType
 */

const DIENST_TYPES = [
  { code: "vroeg", display: "Vroege dienst", defaultStart: "07:00", defaultEnd: "15:00" },
  { code: "laat", display: "Late dienst", defaultStart: "15:00", defaultEnd: "23:00" },
  { code: "nacht", display: "Nachtdienst", defaultStart: "23:00", defaultEnd: "07:00" },
  { code: "dag", display: "Dagdienst", defaultStart: "08:30", defaultEnd: "17:00" },
  { code: "weekend", display: "Weekenddienst", defaultStart: "07:00", defaultEnd: "19:00" },
  { code: "kort", display: "Korte dienst", defaultStart: "09:00", defaultEnd: "13:00" },
  { code: "bereikbaar", display: "Bereikbaarheidsdienst", defaultStart: "00:00", defaultEnd: "23:59" },
] as const;

/**
 * GET /api/rooster/diensttypen — List available shift types.
 */
roosterRoutes.get("/diensttypen", (c) => {
  return c.json({ diensttypen: DIENST_TYPES });
});

/**
 * GET /api/rooster/week?medewerker=:id&datum=2026-04-14
 * Get the weekly roster for a practitioner starting at the given Monday.
 */
roosterRoutes.get("/week", async (c) => {
  const medewerkerId = c.req.query("medewerker");
  const datumStr = c.req.query("datum");

  if (!medewerkerId) {
    return c.json(operationOutcome("error", "invalid", "medewerker parameter is verplicht"), 400);
  }

  // Calculate week range (Monday to Sunday)
  const startDate = datumStr ? new Date(datumStr) : new Date();
  const dayOfWeek = startDate.getDay();
  const monday = new Date(startDate);
  monday.setDate(startDate.getDate() - ((dayOfWeek + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = monday.toISOString().slice(0, 10);
  const endIso = sunday.toISOString().slice(0, 10);

  // Fetch slots for this practitioner in the week range
  const res = await medplumFetch(
    c,
    `/fhir/R4/Slot?schedule.actor=Practitioner/${medewerkerId}&start=ge${startIso}T00:00:00Z&start=le${endIso}T23:59:59Z&_count=100&_sort=start`,
  );

  if (!res.ok) {
    return c.json({ week: startIso, diensten: [] });
  }

  const bundle = (await res.json()) as {
    entry?: Array<{
      resource: {
        id: string;
        start: string;
        end: string;
        status: string;
        serviceType?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
        comment?: string;
      };
    }>;
  };

  const diensten = (bundle.entry ?? []).map((e) => ({
    id: e.resource.id,
    start: e.resource.start,
    end: e.resource.end,
    status: e.resource.status,
    dienstType: e.resource.serviceType?.[0]?.coding?.[0]?.code ?? "dag",
    dienstLabel: e.resource.serviceType?.[0]?.coding?.[0]?.display ?? "Dagdienst",
    opmerking: e.resource.comment,
  }));

  return c.json({
    medewerker: medewerkerId,
    week: startIso,
    totEnMet: endIso,
    diensten,
  });
});

/**
 * POST /api/rooster/dienst — Plan a shift for a practitioner.
 *
 * Body: {
 *   medewerkerId: string,
 *   datum: string,        // ISO date e.g. "2026-04-14"
 *   dienstType: string,   // "vroeg" | "laat" | "nacht" | etc.
 *   startTijd?: string,   // Override default start time "HH:mm"
 *   eindTijd?: string,    // Override default end time "HH:mm"
 *   opmerking?: string,
 *   locatieId?: string,
 * }
 */
roosterRoutes.post("/dienst", async (c) => {
  const body = await c.req.json<{
    medewerkerId: string;
    datum: string;
    dienstType: string;
    startTijd?: string;
    eindTijd?: string;
    opmerking?: string;
    locatieId?: string;
  }>();

  if (!body.medewerkerId || !body.datum || !body.dienstType) {
    return c.json(operationOutcome("error", "invalid", "medewerkerId, datum en dienstType zijn verplicht"), 400);
  }

  const dienstDef = DIENST_TYPES.find((d) => d.code === body.dienstType);
  if (!dienstDef) {
    return c.json(operationOutcome("error", "invalid", `Ongeldig diensttype. Kies uit: ${DIENST_TYPES.map((d) => d.code).join(", ")}`), 400);
  }

  const startTime = body.startTijd ?? dienstDef.defaultStart;
  const endTime = body.eindTijd ?? dienstDef.defaultEnd;

  // For night shifts that cross midnight, end date is next day
  let endDate = body.datum;
  if (endTime <= startTime) {
    const nextDay = new Date(body.datum);
    nextDay.setDate(nextDay.getDate() + 1);
    endDate = nextDay.toISOString().slice(0, 10);
  }

  // First, ensure a Schedule exists for this practitioner
  const scheduleSearch = await medplumFetch(
    c,
    `/fhir/R4/Schedule?actor=Practitioner/${body.medewerkerId}&_count=1`,
  );

  let scheduleRef: string;

  if (scheduleSearch.ok) {
    const schedBundle = (await scheduleSearch.json()) as { entry?: Array<{ resource: { id: string } }> };
    if (schedBundle.entry?.[0]) {
      scheduleRef = `Schedule/${schedBundle.entry[0].resource.id}`;
    } else {
      // Create schedule for this practitioner
      const schedRes = await medplumFetch(c, "/fhir/R4/Schedule", {
        method: "POST",
        body: JSON.stringify({
          resourceType: "Schedule",
          active: true,
          actor: [{ reference: `Practitioner/${body.medewerkerId}` }],
        }),
      });
      if (!schedRes.ok) {
        return c.json(operationOutcome("error", "exception", "Kan schema niet aanmaken"), 500);
      }
      const newSched = (await schedRes.json()) as { id: string };
      scheduleRef = `Schedule/${newSched.id}`;
    }
  } else {
    return c.json(operationOutcome("error", "exception", "Kan schema niet ophalen"), 500);
  }

  // Create the slot (dienst)
  const slot = {
    resourceType: "Slot",
    schedule: { reference: scheduleRef },
    status: "busy",
    start: `${body.datum}T${startTime}:00Z`,
    end: `${endDate}T${endTime}:00Z`,
    serviceType: [{
      coding: [{
        system: "https://openzorg.nl/CodeSystem/diensttype",
        code: body.dienstType,
        display: dienstDef.display,
      }],
    }],
    ...(body.opmerking ? { comment: body.opmerking } : {}),
  };

  return medplumProxy(c, "/fhir/R4/Slot", {
    method: "POST",
    body: JSON.stringify(slot),
  });
});

/**
 * DELETE /api/rooster/dienst/:id — Remove a shift.
 */
roosterRoutes.delete("/dienst/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Slot/${id}`, { method: "DELETE" });
});
