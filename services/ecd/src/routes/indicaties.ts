/**
 * Indicaties (CIZ / Wlz / Zvw / Wmo / Jeugdwet) per cliënt.
 *
 * Opgeslagen als FHIR Coverage resources met:
 * - beneficiary → Patient
 * - status → active | cancelled | draft
 * - type → coding met financieringsstelsel (Wlz/Zvw/Wmo/Jeugdwet)
 * - class[] → ZZP-klasse, modules (bv. Meerzorg, PGB), leveringsvorm
 * - period → looptijd van de indicatie
 * - payor → CAK / zorgverzekeraar / gemeente (Organization)
 *
 * Voor Wlz bevat de coverage de ZZP-code (VV1-VV10, LG, LVG, ZG, GGZ etc.)
 * die de bandbreedte aan uren bepaalt. Deze uren moeten matchen met de som
 * van de interventies in het zorgplan (ZZP-bandbreedte validatie, komt
 * later).
 */

import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumFetch, medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const indicatieRoutes = new Hono<AppEnv>();

/** Financieringsstelsels in Nederland */
const FINANCIERING_TYPES = {
  wlz: { code: "wlz", display: "Wet langdurige zorg (Wlz)" },
  zvw: { code: "zvw", display: "Zorgverzekeringswet (Zvw)" },
  wmo: { code: "wmo", display: "Wet maatschappelijke ondersteuning (Wmo)" },
  jeugdwet: { code: "jeugdwet", display: "Jeugdwet" },
  wfz: { code: "wfz", display: "Wet forensische zorg (Wfz)" },
} as const;

/** ZZP-klassen VVT (meest gebruikt). Volledige lijst komt later uit CIZ. */
const ZZP_KLASSEN: Record<string, { label: string; uren: number }> = {
  "VV01": { label: "VV01 - Beschut wonen met enige begeleiding", uren: 9 },
  "VV02": { label: "VV02 - Beschut wonen met begeleiding en verzorging", uren: 11 },
  "VV03": { label: "VV03 - Beschut wonen met intensieve begeleiding en verzorging", uren: 14 },
  "VV04": { label: "VV04 - Beschut wonen met dementiezorg", uren: 14 },
  "VV05": { label: "VV05 - Beschermd wonen met intensieve dementiezorg", uren: 18 },
  "VV06": { label: "VV06 - Beschermd wonen met intensieve verzorging en verpleging", uren: 19 },
  "VV07": { label: "VV07 - Beschermd wonen met zeer intensieve zorg (dementie)", uren: 24 },
  "VV08": { label: "VV08 - Beschermd wonen met zeer intensieve zorg (somatisch)", uren: 24 },
  "VV09A": { label: "VV9a - Herstelzorg", uren: 20 },
  "VV09B": { label: "VV9b - Revalidatiezorg", uren: 22 },
  "VV10": { label: "VV10 - Beschermd wonen met intensieve palliatieve zorg", uren: 28 },
};

/** Leveringsvormen Wlz */
const LEVERINGSVORMEN = {
  zin: { code: "zin", display: "Zorg in natura (intramuraal)" },
  vpt: { code: "vpt", display: "Volledig Pakket Thuis (VPT)" },
  mpt: { code: "mpt", display: "Modulair Pakket Thuis (MPT)" },
  pgb: { code: "pgb", display: "Persoonsgebonden budget (PGB)" },
};

/**
 * GET /api/clients/:clientId/indicaties — List indicaties voor een cliënt.
 */
indicatieRoutes.get("/clients/:clientId/indicaties", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/Coverage?beneficiary=Patient/${clientId}&_sort=-_lastUpdated`,
  );
});

/**
 * GET /api/indicaties/referentie — Referentiedata voor de UI (ZZP-klassen,
 * financieringstypen, leveringsvormen). Geen tenant-context vereist.
 */
indicatieRoutes.get("/indicaties/referentie", (c) => {
  return c.json({
    financiering: Object.values(FINANCIERING_TYPES),
    zzpKlassen: Object.entries(ZZP_KLASSEN).map(([code, info]) => ({
      code,
      label: info.label,
      urenPerWeek: info.uren,
    })),
    leveringsvormen: Object.values(LEVERINGSVORMEN),
  });
});

/**
 * POST /api/clients/:clientId/indicaties — Create a new indicatie.
 *
 * Body: {
 *   financiering: "wlz" | "zvw" | "wmo" | "jeugdwet" | "wfz",
 *   zzpKlasse?: string,       // Alleen voor Wlz
 *   leveringsvorm?: string,   // Alleen voor Wlz
 *   startdatum: string,       // ISO
 *   einddatum?: string,       // ISO
 *   indicatienummer?: string, // CIZ-indicatienummer
 *   toelichting?: string,
 * }
 */
indicatieRoutes.post("/clients/:clientId/indicaties", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json<{
    financiering: keyof typeof FINANCIERING_TYPES;
    zzpKlasse?: string;
    leveringsvorm?: string;
    startdatum: string;
    einddatum?: string;
    indicatienummer?: string;
    toelichting?: string;
  }>();

  if (!body.financiering || !(body.financiering in FINANCIERING_TYPES)) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        `financiering is vereist, één van: ${Object.keys(FINANCIERING_TYPES).join(", ")}`,
      ),
      400,
    );
  }
  if (!body.startdatum) {
    return c.json(operationOutcome("error", "required", "startdatum is vereist"), 400);
  }
  if (body.financiering === "wlz" && body.zzpKlasse && !(body.zzpKlasse in ZZP_KLASSEN)) {
    return c.json(
      operationOutcome(
        "error",
        "value",
        `Ongeldige ZZP-klasse '${body.zzpKlasse}'. Geldige waarden: ${Object.keys(ZZP_KLASSEN).join(", ")}`,
      ),
      400,
    );
  }

  const financieringInfo = FINANCIERING_TYPES[body.financiering];
  const classEntries: Array<Record<string, unknown>> = [];

  if (body.zzpKlasse && body.zzpKlasse in ZZP_KLASSEN) {
    const zzpInfo = ZZP_KLASSEN[body.zzpKlasse]!;
    classEntries.push({
      type: {
        coding: [
          {
            system: "https://openzorg.nl/CodeSystem/zzp-klasse",
            code: body.zzpKlasse,
            display: zzpInfo.label,
          },
        ],
      },
      value: body.zzpKlasse,
      name: zzpInfo.label,
    });
  }

  if (body.leveringsvorm && body.leveringsvorm in LEVERINGSVORMEN) {
    const lvInfo = LEVERINGSVORMEN[body.leveringsvorm as keyof typeof LEVERINGSVORMEN];
    classEntries.push({
      type: {
        coding: [
          {
            system: "https://openzorg.nl/CodeSystem/leveringsvorm",
            code: body.leveringsvorm,
            display: lvInfo.display,
          },
        ],
      },
      value: body.leveringsvorm,
      name: lvInfo.display,
    });
  }

  const extensions: Array<Record<string, unknown>> = [];
  if (body.indicatienummer) {
    extensions.push({
      url: "https://openzorg.nl/extensions/indicatienummer",
      valueString: body.indicatienummer,
    });
  }
  if (body.toelichting) {
    extensions.push({
      url: "https://openzorg.nl/extensions/indicatie-toelichting",
      valueString: body.toelichting,
    });
  }
  if (body.zzpKlasse && body.zzpKlasse in ZZP_KLASSEN) {
    extensions.push({
      url: "https://openzorg.nl/extensions/zzp-uren-per-week",
      valueInteger: ZZP_KLASSEN[body.zzpKlasse]!.uren,
    });
  }

  const resource = {
    resourceType: "Coverage",
    status: "active",
    type: {
      coding: [
        {
          system: "https://openzorg.nl/CodeSystem/financiering",
          code: financieringInfo.code,
          display: financieringInfo.display,
        },
      ],
    },
    beneficiary: { reference: `Patient/${clientId}` },
    period: {
      start: body.startdatum,
      ...(body.einddatum ? { end: body.einddatum } : {}),
    },
    ...(classEntries.length > 0 ? { class: classEntries } : {}),
    ...(extensions.length > 0 ? { extension: extensions } : {}),
  };

  return medplumProxy(c, "/fhir/R4/Coverage", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * DELETE /api/indicaties/:id — Cancel een indicatie (status naar cancelled).
 */
indicatieRoutes.delete("/indicaties/:id", async (c) => {
  const id = c.req.param("id");
  const currentRes = await medplumFetch(c, `/fhir/R4/Coverage/${id}`);
  if (!currentRes.ok) {
    return c.json(operationOutcome("error", "not-found", "Indicatie niet gevonden"), 404);
  }
  const current = (await currentRes.json()) as Record<string, unknown>;
  const updated = { ...current, status: "cancelled" };
  return medplumProxy(c, `/fhir/R4/Coverage/${id}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  });
});
