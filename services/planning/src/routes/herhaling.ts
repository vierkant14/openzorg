import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumFetch, medplumProxy, operationOutcome, proxyMedplumResponse } from "../lib/medplum-client.js";

export const herhalingRoutes = new Hono<AppEnv>();

/** Extension URL for linking recurring appointment series. */
const SERIE_EXTENSION_URL = "https://openzorg.nl/fhir/StructureDefinition/appointment-serie-id";

/** Days of the week mapped to JS Date.getDay() values. */
const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

interface RRuleParts {
  freq: "DAILY" | "WEEKLY";
  byDay: string[];
  count?: number;
  until?: Date;
}

/**
 * Parses a simple iCal RRULE string.
 * Supports FREQ (DAILY/WEEKLY), BYDAY, COUNT, and UNTIL.
 */
function parseRRule(rrule: string): RRuleParts {
  const parts: Partial<RRuleParts> = {};

  // Remove RRULE: prefix if present
  const rule = rrule.replace(/^RRULE:/, "");

  for (const segment of rule.split(";")) {
    const [key, value] = segment.split("=");
    if (!key || !value) continue;

    switch (key.toUpperCase()) {
      case "FREQ":
        if (value === "DAILY" || value === "WEEKLY") {
          parts.freq = value;
        }
        break;
      case "BYDAY":
        parts.byDay = value.split(",").map((d) => d.trim().toUpperCase());
        break;
      case "COUNT":
        parts.count = parseInt(value, 10);
        break;
      case "UNTIL": {
        // Parse UNTIL in format YYYYMMDD or YYYYMMDDTHHMMSSZ
        const y = value.substring(0, 4);
        const m = value.substring(4, 6);
        const d = value.substring(6, 8);
        parts.until = new Date(`${y}-${m}-${d}T23:59:59Z`);
        break;
      }
    }
  }

  if (!parts.freq) {
    parts.freq = "WEEKLY";
  }

  return parts as RRuleParts;
}

/**
 * Generates occurrence dates from an RRULE starting from a base date.
 */
function generateOccurrences(baseDate: Date, rrule: RRuleParts, maxOccurrences = 365): Date[] {
  const occurrences: Date[] = [];
  const current = new Date(baseDate);

  // Safety limit
  const limit = rrule.count ?? maxOccurrences;
  let iterations = 0;
  const maxIterations = limit * 10; // Prevent infinite loops

  while (occurrences.length < limit && iterations < maxIterations) {
    iterations++;

    if (rrule.until && current > rrule.until) {
      break;
    }

    if (rrule.freq === "DAILY") {
      occurrences.push(new Date(current));
      current.setDate(current.getDate() + 1);
    } else if (rrule.freq === "WEEKLY") {
      if (rrule.byDay && rrule.byDay.length > 0) {
        const dayOfWeek = current.getDay();
        const dayAbbr = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0];

        if (dayAbbr && rrule.byDay.includes(dayAbbr)) {
          occurrences.push(new Date(current));
        }
      } else {
        // No BYDAY: same day each week
        occurrences.push(new Date(current));
        current.setDate(current.getDate() + 6); // Will be +7 after the +1 below
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return occurrences;
}

interface HerhalingBody {
  rrule: string;
  appointment: {
    status?: string;
    appointmentType?: Record<string, unknown>;
    start: string;
    end: string;
    participant: Array<{
      actor: { reference: string };
      status?: string;
    }>;
    [key: string]: unknown;
  };
}

/**
 * POST /api/herhalingen — Create a recurring appointment series.
 */
herhalingRoutes.post("/", async (c) => {
  const body = await c.req.json<HerhalingBody>();

  if (!body.rrule) {
    return c.json(
      operationOutcome("error", "required", "RRULE is vereist"),
      400,
    );
  }

  if (!body.appointment) {
    return c.json(
      operationOutcome("error", "required", "Afspraak gegevens zijn vereist"),
      400,
    );
  }

  const baseStart = new Date(body.appointment.start);
  const baseEnd = new Date(body.appointment.end);

  if (baseStart >= baseEnd) {
    return c.json(
      operationOutcome("error", "invalid", "Starttijd moet voor eindtijd liggen"),
      400,
    );
  }

  const durationMs = baseEnd.getTime() - baseStart.getTime();

  const rruleParts = parseRRule(body.rrule);
  const occurrences = generateOccurrences(baseStart, rruleParts);

  if (occurrences.length === 0) {
    return c.json(
      operationOutcome("error", "invalid", "RRULE levert geen afspraken op"),
      400,
    );
  }

  // Generate a unique series ID
  const serieId = crypto.randomUUID();

  const created: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  for (const occurrence of occurrences) {
    const appointmentStart = occurrence.toISOString();
    const appointmentEnd = new Date(occurrence.getTime() + durationMs).toISOString();

    const appointment = {
      ...body.appointment,
      resourceType: "Appointment",
      start: appointmentStart,
      end: appointmentEnd,
      extension: [
        {
          url: SERIE_EXTENSION_URL,
          valueString: serieId,
        },
      ],
    };

    const res = await medplumFetch(c, "/fhir/R4/Appointment", {
      method: "POST",
      body: JSON.stringify(appointment),
    });

    if (res.ok) {
      const resource = (await res.json()) as Record<string, unknown>;
      created.push(resource);
    } else {
      errors.push(`Fout bij aanmaken afspraak op ${appointmentStart}`);
    }
  }

  return c.json(
    {
      serieId,
      aantalGepland: created.length,
      aantalFouten: errors.length,
      afspraken: created,
      ...(errors.length > 0 ? { fouten: errors } : {}),
    },
    201,
  );
});

/**
 * GET /api/herhalingen/:serieId — Get all appointments in a series.
 */
herhalingRoutes.get("/:serieId", async (c) => {
  const serieId = c.req.param("serieId");

  // Search for appointments with the serie extension
  const params = new URLSearchParams();
  params.set("_filter", `extension.valueString eq ${serieId}`);

  // Fallback: use a general search since _filter may not be supported
  // Search using the extension URL
  const searchUrl = `/fhir/R4/Appointment?_extension=${encodeURIComponent(SERIE_EXTENSION_URL)}|${serieId}`;

  return medplumProxy(c, searchUrl);
});

/**
 * DELETE /api/herhalingen/:serieId — Cancel entire series.
 */
herhalingRoutes.delete("/:serieId", async (c) => {
  const serieId = c.req.param("serieId");

  // Find all appointments in the series
  const searchUrl = `/fhir/R4/Appointment?_extension=${encodeURIComponent(SERIE_EXTENSION_URL)}|${serieId}`;

  const searchRes = await medplumFetch(c, searchUrl);
  if (!searchRes.ok) {
    return proxyMedplumResponse(c, searchRes);
  }

  const bundle = (await searchRes.json()) as Record<string, unknown>;
  const entries = (bundle["entry"] as Array<{ resource: Record<string, unknown> }>) ?? [];

  let cancelled = 0;
  let errorCount = 0;

  for (const entry of entries) {
    const appointment = entry.resource;
    appointment["status"] = "cancelled";

    const id = appointment["id"] as string;
    const res = await medplumFetch(c, `/fhir/R4/Appointment/${id}`, {
      method: "PUT",
      body: JSON.stringify(appointment),
    });

    if (res.ok) {
      cancelled++;
    } else {
      errorCount++;
    }
  }

  return c.json({
    serieId,
    aantalGeannuleerd: cancelled,
    aantalFouten: errorCount,
  });
});
