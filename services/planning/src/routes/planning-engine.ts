import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  type BezettingsEis,
  type Dienst,
  type Medewerker,
  type Toewijzing,
  genereerRooster,
  optimaliseer,
  validateBezetting,
} from "../lib/planning-engine.js";

export const planningEngineRoutes = new Hono<AppEnv>();

const MEDPLUM_BASE_URL = process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103";

interface PlanningContext {
  eisen: BezettingsEis[];
  diensten: Dienst[];
  medewerkers: Medewerker[];
  toewijzingen: Toewijzing[];
  dagen: string[];
  orgId: string;
  orgNaam: string;
}

/**
 * Generate ISO date strings for a week (Monday–Sunday).
 * Week format: "2026-W16" or "2026-04-13" (start date).
 */
function weekDagen(week: string): string[] {
  let startDate: Date;

  if (week.includes("W")) {
    // ISO week format: "2026-W16"
    const [yearStr, weekStr] = week.split("-W");
    const year = parseInt(yearStr!, 10);
    const weekNum = parseInt(weekStr!, 10);
    // Jan 4 is always in week 1
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Monday = 1
    startDate = new Date(jan4);
    startDate.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
  } else {
    // ISO date format: start of week
    startDate = new Date(week);
  }

  const dagen: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dagen.push(d.toISOString().slice(0, 10));
  }
  return dagen;
}

/**
 * Load all planning context data for an organization and week.
 */
async function loadPlanningContext(
  orgId: string,
  week: string,
  authHeader: string,
): Promise<PlanningContext> {
  const headers = { Authorization: authHeader, Accept: "application/fhir+json" };
  const dagen = weekDagen(week);
  const startDate = dagen[0]!;
  const endDate = dagen[6]!;

  // Fetch bezettingsprofiel
  const bezettingRes = await fetch(
    `${MEDPLUM_BASE_URL}/fhir/R4/Basic?code=bezettingsprofiel&subject=Organization/${orgId}&_count=1`,
    { headers },
  );
  let eisen: BezettingsEis[] = [];
  if (bezettingRes.ok) {
    const bundle = (await bezettingRes.json()) as {
      entry?: Array<{
        resource: { extension?: Array<{ url: string; valueString?: string }> };
      }>;
    };
    const resource = bundle.entry?.[0]?.resource;
    const ext = resource?.extension?.find(
      (e) => e.url === "https://openzorg.nl/extensions/bezettingsprofiel",
    );
    if (ext?.valueString) {
      const profiel = JSON.parse(ext.valueString) as { eisen: BezettingsEis[] };
      eisen = profiel.eisen;
    }
  }

  // Fetch dienst-config
  const dienstRes = await fetch(
    `${MEDPLUM_BASE_URL}/fhir/R4/Basic?code=dienst-config&subject=Organization/${orgId}&_count=10`,
    { headers },
  );
  let diensten: Dienst[] = [];
  if (dienstRes.ok) {
    const bundle = (await dienstRes.json()) as {
      entry?: Array<{
        resource: { extension?: Array<{ url: string; valueString?: string }> };
      }>;
    };
    for (const entry of bundle.entry ?? []) {
      const ext = entry.resource.extension?.find(
        (e) => e.url === "https://openzorg.nl/extensions/dienst-config",
      );
      if (ext?.valueString) {
        const d = JSON.parse(ext.valueString) as Dienst;
        diensten.push(d);
      }
    }
  }
  // Fallback defaults if no diensten configured
  if (diensten.length === 0) {
    diensten = [
      { code: "vroeg", naam: "Vroege dienst", start: "07:00", eind: "15:00" },
      { code: "laat", naam: "Late dienst", start: "15:00", eind: "23:00" },
      { code: "nacht", naam: "Nachtdienst", start: "23:00", eind: "07:00" },
    ];
  }

  // Fetch practitioners
  const practRes = await fetch(
    `${MEDPLUM_BASE_URL}/fhir/R4/Practitioner?_count=50`,
    { headers },
  );
  const medewerkers: Medewerker[] = [];
  if (practRes.ok) {
    const bundle = (await practRes.json()) as {
      entry?: Array<{
        resource: {
          id?: string;
          name?: Array<{ text?: string; given?: string[]; family?: string }>;
          extension?: Array<{ url: string; valueString?: string }>;
        };
      }>;
    };
    for (const entry of bundle.entry ?? []) {
      const r = entry.resource;
      const naam =
        r.name?.[0]?.text ??
        [r.name?.[0]?.given?.join(" "), r.name?.[0]?.family].filter(Boolean).join(" ") ??
        "Onbekend";
      const competenties: string[] = [];
      for (const ext of r.extension ?? []) {
        if (
          ext.url === "https://openzorg.nl/extensions/competentie" &&
          ext.valueString
        ) {
          competenties.push(ext.valueString);
        }
      }
      medewerkers.push({
        id: r.id ?? "",
        naam,
        competenties,
        contractUren: 36, // default; could be enriched from contract data
        geplandUren: 0,
      });
    }
  }

  // Fetch existing appointments for the week to derive toewijzingen
  const apptRes = await fetch(
    `${MEDPLUM_BASE_URL}/fhir/R4/Appointment?date=ge${startDate}&date=le${endDate}&_count=200`,
    { headers },
  );
  const toewijzingen: Toewijzing[] = [];
  if (apptRes.ok) {
    const bundle = (await apptRes.json()) as {
      entry?: Array<{
        resource: {
          start?: string;
          participant?: Array<{
            actor?: { reference?: string; display?: string };
          }>;
          serviceType?: Array<{ coding?: Array<{ code?: string }> }>;
        };
      }>;
    };
    for (const entry of bundle.entry ?? []) {
      const r = entry.resource;
      const datum = r.start?.slice(0, 10) ?? "";
      const dienstCode =
        r.serviceType?.[0]?.coding?.[0]?.code ?? "vroeg";
      for (const p of r.participant ?? []) {
        const ref = p.actor?.reference ?? "";
        if (ref.startsWith("Practitioner/")) {
          toewijzingen.push({
            medewerkerId: ref.replace("Practitioner/", ""),
            medewerkerNaam: p.actor?.display ?? "",
            dienstCode,
            datum,
            orgId,
          });
        }
      }
    }
  }

  // Calculate geplandUren for each medewerker based on existing toewijzingen
  for (const mw of medewerkers) {
    const count = toewijzingen.filter((t) => t.medewerkerId === mw.id).length;
    mw.geplandUren = count * 8; // approximate 8h per shift
  }

  // Fetch org name
  let orgNaam = orgId;
  const orgRes = await fetch(
    `${MEDPLUM_BASE_URL}/fhir/R4/Organization/${orgId}`,
    { headers },
  );
  if (orgRes.ok) {
    const org = (await orgRes.json()) as { name?: string };
    orgNaam = org.name ?? orgId;
  }

  return { eisen, diensten, medewerkers, toewijzingen, dagen, orgId, orgNaam };
}

/**
 * POST /validate — Check current staffing against requirements, return gaps.
 */
planningEngineRoutes.post("/validate", async (c) => {
  const body = (await c.req.json()) as { orgId: string; week: string };
  const authHeader = c.req.header("Authorization") ?? "";

  if (!body.orgId || !body.week) {
    return c.json({ error: "orgId en week zijn verplicht" }, 400);
  }

  const ctx = await loadPlanningContext(body.orgId, body.week, authHeader);
  const gaps = validateBezetting(
    ctx.eisen,
    ctx.toewijzingen,
    ctx.medewerkers,
    ctx.dagen,
    ctx.orgId,
    ctx.orgNaam,
    ctx.diensten,
  );

  return c.json({
    orgId: ctx.orgId,
    orgNaam: ctx.orgNaam,
    week: body.week,
    dagen: ctx.dagen,
    gaps,
    totaalTekorten: gaps.length,
    kritiek: gaps.filter((g) => g.severity === "kritiek").length,
  });
});

/**
 * POST /optimaliseer — Suggest practitioners to fill gaps.
 */
planningEngineRoutes.post("/optimaliseer", async (c) => {
  const body = (await c.req.json()) as { orgId: string; week: string };
  const authHeader = c.req.header("Authorization") ?? "";

  if (!body.orgId || !body.week) {
    return c.json({ error: "orgId en week zijn verplicht" }, 400);
  }

  const ctx = await loadPlanningContext(body.orgId, body.week, authHeader);
  const gaps = validateBezetting(
    ctx.eisen,
    ctx.toewijzingen,
    ctx.medewerkers,
    ctx.dagen,
    ctx.orgId,
    ctx.orgNaam,
    ctx.diensten,
  );

  const suggesties = optimaliseer(gaps, ctx.medewerkers, ctx.toewijzingen);

  return c.json({
    orgId: ctx.orgId,
    orgNaam: ctx.orgNaam,
    week: body.week,
    gaps,
    suggesties,
  });
});

/**
 * POST /genereer — Generate a full roster from scratch.
 */
planningEngineRoutes.post("/genereer", async (c) => {
  const body = (await c.req.json()) as { orgId: string; week: string };
  const authHeader = c.req.header("Authorization") ?? "";

  if (!body.orgId || !body.week) {
    return c.json({ error: "orgId en week zijn verplicht" }, 400);
  }

  const ctx = await loadPlanningContext(body.orgId, body.week, authHeader);

  // Reset geplandUren for generation (we're building from scratch)
  for (const mw of ctx.medewerkers) {
    mw.geplandUren = 0;
  }

  const result = genereerRooster(
    ctx.eisen,
    ctx.medewerkers,
    ctx.dagen,
    ctx.orgId,
    ctx.orgNaam,
    ctx.diensten,
  );

  return c.json({
    orgId: ctx.orgId,
    orgNaam: ctx.orgNaam,
    week: body.week,
    dagen: ctx.dagen,
    toewijzingen: result.toewijzingen,
    onoplosbaar: result.onoplosbaar,
    totaalToewijzingen: result.toewijzingen.length,
    totaalOnoplosbaar: result.onoplosbaar.length,
  });
});
