import { isValidBSN } from "@openzorg/shared-domain";
import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { formatteerClientnummer, hoogsteClientnummer, CLIENTNUMMER_SYSTEM } from "../lib/clientnummer.js";
import { parseCsv } from "../lib/csv.js";
import { pool } from "../lib/db.js";
import { medplumFetch, operationOutcome } from "../lib/medplum-client.js";

/**
 * CSV-cliëntimport (W3-1, I-05-light): 80 cliënten opvoeren mag geen dagen
 * kosten. Eén vast formaat, per rij gevalideerd, met een foutenrapport dat
 * exact zegt welke rij waarom faalde. Volledige import uit externe ECD's
 * (mapping-UI, meer bronformaten) blijft roadmap-item I-05.
 *
 * Vast formaat (kolomnamen verplicht in de header, volgorde vrij):
 *   achternaam;voornaam;geboortedatum;bsn;straat;huisnummer;postcode;plaats;locatie
 * - verplicht: achternaam, geboortedatum (JJJJ-MM-DD)
 * - bsn: optioneel; indien aanwezig elfproef + duplicaatcontrole
 * - locatie: optioneel; moet de naam van een bestaande locatie
 *   (Organization) van de tenant zijn
 */
export const clientImportRoutes = new Hono<AppEnv>();

const BSN_SYSTEM = "http://fhir.nl/fhir/NamingSystem/bsn";
const LOCATIE_EXTENSION_URL = "https://openzorg.nl/extensions/locatie-toewijzing";

const VERPLICHTE_KOLOMMEN = ["achternaam", "geboortedatum"] as const;
const BEKENDE_KOLOMMEN = [
  "achternaam",
  "voornaam",
  "geboortedatum",
  "bsn",
  "straat",
  "huisnummer",
  "postcode",
  "plaats",
  "locatie",
] as const;

export interface ImportFout {
  rij: number;
  veld?: string;
  melding: string;
}

interface ImportRij {
  achternaam: string;
  voornaam: string;
  geboortedatum: string;
  bsn: string;
  straat: string;
  huisnummer: string;
  postcode: string;
  plaats: string;
  locatie: string;
}

function leesRij(header: string[], velden: string[]): ImportRij {
  const waarde = (kolom: string): string => {
    const index = header.indexOf(kolom);
    return index >= 0 ? (velden[index] ?? "") : "";
  };
  return {
    achternaam: waarde("achternaam"),
    voornaam: waarde("voornaam"),
    geboortedatum: waarde("geboortedatum"),
    bsn: waarde("bsn"),
    straat: waarde("straat"),
    huisnummer: waarde("huisnummer"),
    postcode: waarde("postcode"),
    plaats: waarde("plaats"),
    locatie: waarde("locatie"),
  };
}

/** Locaties (Organizations) van de tenant, naam → id, één keer opgehaald. */
async function haalLocaties(c: Parameters<typeof medplumFetch>[0]): Promise<Map<string, string>> {
  const res = await medplumFetch(c, "/fhir/R4/Organization?_count=200&_elements=name");
  const map = new Map<string, string>();
  if (!res.ok) return map;
  const bundle = (await res.json()) as {
    entry?: Array<{ resource: { id?: string; name?: string } }>;
  };
  for (const entry of bundle.entry ?? []) {
    if (entry.resource.id && entry.resource.name) {
      map.set(entry.resource.name.toLowerCase(), entry.resource.id);
    }
  }
  return map;
}

/** Bestaat er al een cliënt met deze BSN in de tenant? */
async function bsnBestaat(c: Parameters<typeof medplumFetch>[0], bsn: string): Promise<boolean> {
  const res = await medplumFetch(
    c,
    `/fhir/R4/Patient?identifier=${encodeURIComponent(`${BSN_SYSTEM}|${bsn}`)}&_count=1&_elements=identifier`,
  );
  if (!res.ok) return false;
  const bundle = (await res.json()) as { entry?: unknown[] };
  return (bundle.entry?.length ?? 0) > 0;
}

/**
 * POST /api/clients/import — importeer cliënten uit CSV (request-body =
 * CSV-tekst; de frontend leest het bestand client-side en post de inhoud).
 */
clientImportRoutes.post("/import", async (c) => {
  const tekst = await c.req.text();

  if (!tekst.trim()) {
    return c.json(operationOutcome("error", "required", "Leeg bestand: er is geen CSV-inhoud ontvangen"), 400);
  }

  const { header, rijen } = parseCsv(tekst);

  const ontbrekend = VERPLICHTE_KOLOMMEN.filter((kolom) => !header.includes(kolom));
  if (ontbrekend.length > 0) {
    return c.json(
      operationOutcome(
        "error",
        "invalid",
        `Header mist verplichte kolom(men): ${ontbrekend.join(", ")}. Verwacht formaat: ${BEKENDE_KOLOMMEN.join(";")}`,
      ),
      400,
    );
  }

  if (rijen.length === 0) {
    return c.json(operationOutcome("error", "invalid", "Het bestand bevat een header maar geen gegevensrijen"), 400);
  }

  const locaties = await haalLocaties(c);
  let volgendNummer = (await hoogsteClientnummer(c)) + 1;

  const fouten: ImportFout[] = [];
  let aangemaakt = 0;
  const gezieneBsns = new Set<string>();

  for (let i = 0; i < rijen.length; i++) {
    const rijNummer = i + 2; // 1-based + header-regel
    const rij = leesRij(header, rijen[i]!);

    // — validatie —
    if (!rij.achternaam) {
      fouten.push({ rij: rijNummer, veld: "achternaam", melding: "Achternaam is verplicht" });
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rij.geboortedatum) || isNaN(new Date(rij.geboortedatum).getTime())) {
      fouten.push({ rij: rijNummer, veld: "geboortedatum", melding: "Geboortedatum moet JJJJ-MM-DD zijn" });
      continue;
    }
    if (rij.bsn) {
      if (!isValidBSN(rij.bsn)) {
        fouten.push({ rij: rijNummer, veld: "bsn", melding: "BSN voldoet niet aan de elfproef" });
        continue;
      }
      if (gezieneBsns.has(rij.bsn)) {
        fouten.push({ rij: rijNummer, veld: "bsn", melding: "BSN komt dubbel voor in het bestand" });
        continue;
      }
      if (await bsnBestaat(c, rij.bsn)) {
        fouten.push({ rij: rijNummer, veld: "bsn", melding: "Er bestaat al een cliënt met deze BSN" });
        continue;
      }
    }
    let locatieOrgId: string | undefined;
    if (rij.locatie) {
      locatieOrgId = locaties.get(rij.locatie.toLowerCase());
      if (!locatieOrgId) {
        fouten.push({
          rij: rijNummer,
          veld: "locatie",
          melding: `Onbekende locatie "${rij.locatie}" — maak de locatie eerst aan onder Organisatie`,
        });
        continue;
      }
    }

    // — opbouw Patient —
    const identifier: Array<{ system: string; value: string }> = [
      { system: CLIENTNUMMER_SYSTEM, value: formatteerClientnummer(volgendNummer) },
    ];
    if (rij.bsn) identifier.push({ system: BSN_SYSTEM, value: rij.bsn });

    const adresRegel = [rij.straat, rij.huisnummer].filter(Boolean).join(" ");
    const patient: Record<string, unknown> = {
      resourceType: "Patient",
      identifier,
      name: [
        {
          family: rij.achternaam,
          ...(rij.voornaam ? { given: rij.voornaam.split(" ").filter(Boolean) } : {}),
        },
      ],
      birthDate: rij.geboortedatum,
      ...(adresRegel || rij.postcode || rij.plaats
        ? {
            address: [
              {
                ...(adresRegel ? { line: [adresRegel] } : {}),
                ...(rij.postcode ? { postalCode: rij.postcode } : {}),
                ...(rij.plaats ? { city: rij.plaats } : {}),
              },
            ],
          }
        : {}),
      ...(locatieOrgId
        ? {
            extension: [
              {
                url: LOCATIE_EXTENSION_URL,
                extension: [{ url: "orgId", valueString: locatieOrgId }],
              },
            ],
          }
        : {}),
    };

    const res = await medplumFetch(c, "/fhir/R4/Patient", {
      method: "POST",
      headers: { "Content-Type": "application/fhir+json" },
      body: JSON.stringify(patient),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        issue?: Array<{ diagnostics?: string }>;
      };
      fouten.push({
        rij: rijNummer,
        melding: body.issue?.[0]?.diagnostics ?? `Aanmaken mislukt (HTTP ${res.status})`,
      });
      continue;
    }

    if (rij.bsn) gezieneBsns.add(rij.bsn);
    volgendNummer++;
    aangemaakt++;
  }

  // Import-samenvatting in de audit-log (naast de generieke request-audit)
  try {
    const tenant = await pool.query<{ id: string }>(
      "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
      [c.get("tenantId")],
    );
    const tenantUuid = tenant.rows[0]?.id;
    if (tenantUuid) {
      await pool.query(
        `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'clients.import', 'Patient', NULL, $3)`,
        [
          tenantUuid,
          c.req.header("X-User-Id") ?? c.req.header("X-User-Role") ?? "onbekend",
          JSON.stringify({ totaal: rijen.length, aangemaakt, fouten: fouten.length }),
        ],
      );
    }
  } catch {
    // audit-fout blokkeert het importresultaat niet
  }

  return c.json({ totaal: rijen.length, aangemaakt, fouten });
});
