import { ALL_ROLES, type OpenZorgRole } from "@openzorg/shared-domain";
import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumFetch } from "../lib/medplum-client.js";

export const meRoutes = new Hono<AppEnv>();

/**
 * Identiteitslaag (ME-01, spec §4.3.2): wie is de ingelogde gebruiker?
 *
 * Resolvet het Bearer-token via Medplum /auth/me naar het Practitioner-
 * profiel en leest de OpenZorg-rol uit de Practitioner-extensie
 * https://openzorg.nl/extensions/rol. Accounts zonder Practitioner-profiel
 * of zonder rol-extensie krijgen null-velden terug — de frontend valt dan
 * terug op de demo-rolkeuze (met zichtbare markering).
 */

const ROL_EXTENSION_URL = "https://openzorg.nl/extensions/rol";

export interface MeResponse {
  practitionerId: string | null;
  naam: string | null;
  rol: OpenZorgRole | null;
  projectId: string | null;
}

interface AuthMeAntwoord {
  profile?: { reference?: string; resourceType?: string; id?: string; display?: string };
  project?: { reference?: string; id?: string };
}

interface PractitionerResource {
  resourceType: "Practitioner";
  id?: string;
  name?: Array<{ text?: string; given?: string[]; family?: string }>;
  extension?: Array<{ url?: string; valueCode?: string; valueString?: string }>;
}

function isOpenZorgRole(value: string | undefined): value is OpenZorgRole {
  return !!value && (ALL_ROLES as readonly string[]).includes(value);
}

function formatteerNaam(practitioner: PractitionerResource): string | null {
  const naam = practitioner.name?.[0];
  if (!naam) return null;
  if (naam.text) return naam.text;
  const delen = [...(naam.given ?? []), naam.family].filter(Boolean);
  return delen.length > 0 ? delen.join(" ") : null;
}

function profielReferentie(profile: AuthMeAntwoord["profile"]): string {
  if (!profile) return "";
  if (profile.reference) return profile.reference;
  if (profile.resourceType && profile.id) return `${profile.resourceType}/${profile.id}`;
  return "";
}

meRoutes.get("/me", async (c) => {
  const authRes = await medplumFetch(c, "/auth/me");

  if (!authRes.ok) {
    return c.json({ error: "Ongeldig of verlopen token" }, authRes.status === 401 ? 401 : 500);
  }

  const me = (await authRes.json()) as AuthMeAntwoord;
  const profielRef = profielReferentie(me.profile);
  const projectId = me.project?.id ?? me.project?.reference?.split("/")[1] ?? null;

  const leeg: MeResponse = { practitionerId: null, naam: null, rol: null, projectId };

  if (!profielRef.startsWith("Practitioner/")) {
    // Geen Practitioner-profiel (bv. super-admin of client-app) → geen zorg-identiteit
    return c.json(leeg);
  }

  const practitionerId = profielRef.split("/")[1] ?? null;
  if (!practitionerId) {
    return c.json(leeg);
  }

  const practRes = await medplumFetch(c, `/fhir/R4/Practitioner/${practitionerId}`);
  if (!practRes.ok) {
    return c.json({ ...leeg, practitionerId });
  }

  const practitioner = (await practRes.json()) as PractitionerResource;
  const rolExtensie = practitioner.extension?.find((e) => e.url === ROL_EXTENSION_URL);
  const rolWaarde = rolExtensie?.valueCode ?? rolExtensie?.valueString;

  const antwoord: MeResponse = {
    practitionerId,
    naam: formatteerNaam(practitioner),
    rol: isOpenZorgRole(rolWaarde) ? rolWaarde : null,
    projectId,
  };

  return c.json(antwoord);
});
