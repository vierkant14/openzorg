import { pool } from "./db.js";

/**
 * Proces-catalogus — de éne bron van waarheid voor de proces-taxonomie
 * (spec §4.3.4). Laag 1 (hieronder, leveranciersvoorschrift) beschrijft per
 * zorgpad de domeinnaam, omschrijving, trigger en stappen mét formulier-
 * velden. Laag 2 (tenant-overrides uit openzorg.tenant_configurations,
 * config_type 'task_form_options') merget hier server-side overheen, zodat
 * élke consument — werkbak, Processen-hub, taakformulieren-editor — exact
 * hetzelfde effectieve formulier ziet.
 *
 * De stappen/rollen zijn vastgelegd conform de BPMN-templates in
 * routes/bpmn-templates.ts (geen runtime-XML-parsing). Wijzigt een template,
 * dan wijzigt deze catalogus mee — de catalogus-test bewaakt de koppeling.
 */

export interface TaakVeld {
  name: string;
  label: string;
  type: "boolean" | "text" | "select" | "number";
  options?: Array<{ value: string; label: string }>;
  /** Verplicht bij het afronden van de stap (gateway-beslissingen zijn altijd verplicht). */
  verplicht?: boolean;
}

export interface CatalogusStap {
  taskKey: string;
  naam: string;
  rol: string;
  velden: TaakVeld[];
}

export interface CatalogusProces {
  key: string;
  naam: string;
  omschrijving: string;
  trigger: string;
  stappen: CatalogusStap[];
}

const OPMERKING: TaakVeld = { name: "opmerking", label: "Opmerking", type: "text" };

export const CATALOGUS: CatalogusProces[] = [
  {
    key: "intake-proces",
    naam: "Intake nieuwe cliënt",
    omschrijving:
      "Van aanmelding tot start van de zorg: de aanmelding wordt beoordeeld, en bij akkoord wordt het intakegesprek gepland.",
    trigger: "Start automatisch wanneer een nieuwe cliënt wordt aangemeld.",
    stappen: [
      {
        taskKey: "aanmeldingBeoordelen",
        naam: "Aanmelding beoordelen",
        rol: "planner",
        velden: [
          { name: "goedgekeurd", label: "Goedgekeurd?", type: "boolean", verplicht: true },
          OPMERKING,
        ],
      },
      {
        taskKey: "intakeGesprekPlannen",
        naam: "Intake gesprek plannen",
        rol: "zorgmedewerker",
        velden: [OPMERKING],
      },
      {
        taskKey: "afwijzingCommuniceren",
        naam: "Afwijzing communiceren",
        rol: "beheerder",
        velden: [OPMERKING],
      },
    ],
  },
  {
    key: "zorgplan-evaluatie",
    naam: "Zorgplan-evaluatie",
    omschrijving:
      "Periodieke evaluatie van het zorgplan: voorbereiden, MDO plannen en uitvoeren, evaluatie vastleggen en zo nodig het zorgplan bijstellen.",
    trigger: "Start automatisch wanneer de evaluatiedatum van een zorgplan nadert.",
    stappen: [
      { taskKey: "voorbereiding", naam: "Evaluatie voorbereiden", rol: "zorgmedewerker", velden: [OPMERKING] },
      { taskKey: "mdoPlannen", naam: "MDO inplannen", rol: "planner", velden: [OPMERKING] },
      { taskKey: "mdoUitvoeren", naam: "MDO uitvoeren", rol: "teamleider", velden: [OPMERKING] },
      {
        taskKey: "evaluatieVastleggen",
        naam: "Evaluatie vastleggen",
        rol: "zorgmedewerker",
        velden: [
          { name: "bijstellingNodig", label: "Bijstelling nodig?", type: "boolean", verplicht: true },
          OPMERKING,
        ],
      },
      { taskKey: "zorgplanBijstellen", naam: "Zorgplan bijstellen", rol: "zorgmedewerker", velden: [OPMERKING] },
    ],
  },
  {
    key: "herindicatie",
    naam: "Herindicatie",
    omschrijving:
      "Wanneer een indicatie afloopt of niet meer passend is: signalering controleren, gegevens actualiseren, aanvraag indienen bij het CIZ en het besluit verwerken.",
    trigger: "Start bij een herindicatie-signalering (aflopende indicatie).",
    stappen: [
      {
        taskKey: "signaleringControleren",
        naam: "Signalering controleren",
        rol: "planner",
        velden: [
          { name: "herindicatieNodig", label: "Herindicatie nodig?", type: "boolean", verplicht: true },
          OPMERKING,
        ],
      },
      { taskKey: "gegevensActualiseren", naam: "Cliëntgegevens actualiseren", rol: "zorgmedewerker", velden: [OPMERKING] },
      { taskKey: "aanvraagIndienen", naam: "Herindicatie aanvragen bij CIZ", rol: "beheerder", velden: [OPMERKING] },
      { taskKey: "besluitVerwerken", naam: "Indicatiebesluit verwerken", rol: "planner", velden: [OPMERKING] },
    ],
  },
  {
    key: "mic-afhandeling",
    naam: "MIC-afhandeling",
    omschrijving:
      "Afhandeling van een incident-melding: analyseren, ernst bepalen, maatregelen registreren of verbetermaatregelen uitvoeren en evalueren.",
    trigger: "Start automatisch bij een nieuwe MIC-melding.",
    stappen: [
      {
        taskKey: "meldingAnalyseren",
        naam: "Melding analyseren",
        rol: "teamleider",
        velden: [
          {
            name: "ernstNiveau",
            label: "Ernstniveau",
            type: "select",
            verplicht: true,
            options: [
              { value: "laag", label: "Laag" },
              { value: "hoog", label: "Hoog" },
            ],
          },
          OPMERKING,
        ],
      },
      { taskKey: "maatregelenRegistreren", naam: "Maatregelen registreren", rol: "teamleider", velden: [OPMERKING] },
      { taskKey: "maatregelenBepalen", naam: "Verbetermaatregelen bepalen", rol: "beheerder", velden: [OPMERKING] },
      { taskKey: "maatregelenUitvoeren", naam: "Maatregelen uitvoeren", rol: "zorgmedewerker", velden: [OPMERKING] },
      { taskKey: "evalueren", naam: "Effectiviteit evalueren", rol: "teamleider", velden: [OPMERKING] },
    ],
  },
  {
    key: "vaccinatie-campagne",
    naam: "Vaccinatiecampagne",
    omschrijving:
      "Een campagne van inventarisatie tot registratie: doelgroep inventariseren, afspraken inplannen, vaccinaties toedienen en vastleggen in het dossier.",
    trigger: "Wordt handmatig gestart door de beheerder.",
    stappen: [
      { taskKey: "clientenInventariseren", naam: "Cliënten inventariseren", rol: "zorgmedewerker", velden: [OPMERKING] },
      { taskKey: "afsprakenInplannen", naam: "Afspraken inplannen", rol: "planner", velden: [OPMERKING] },
      { taskKey: "vaccinatieToedienen", naam: "Vaccinatie toedienen", rol: "zorgmedewerker", velden: [OPMERKING] },
      { taskKey: "registratieInDossier", naam: "Registratie in dossier", rol: "zorgmedewerker", velden: [OPMERKING] },
    ],
  },
];

type FormOptionsConfig = Record<string, Record<string, TaakVeld[]>>;

/** Leest de Laag-2-overrides van een tenant (zelfde opslag als /api/task-form-options in de ECD-service). */
async function haalTenantOverrides(tenantId: string): Promise<FormOptionsConfig> {
  try {
    const tenant = await pool.query<{ id: string }>(
      "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
      [tenantId],
    );
    const tenantUuid = tenant.rows[0]?.id;
    if (!tenantUuid) return {};

    const result = await pool.query<{ config_data: FormOptionsConfig }>(
      `SELECT config_data FROM openzorg.tenant_configurations
         WHERE tenant_id = $1 AND config_type = 'task_form_options'
         ORDER BY version DESC LIMIT 1`,
      [tenantUuid],
    );
    return result.rows[0]?.config_data ?? {};
  } catch {
    // Config-opslag onbereikbaar → Laag 1 blijft gewoon werken
    return {};
  }
}

/** Merge per stap: tenant-veld vervangt Laag-1-veld met dezelfde name, rest blijft; nieuwe velden komen erbij. */
function mergeVelden(laag1: TaakVeld[], override: TaakVeld[] | undefined): TaakVeld[] {
  if (!override || override.length === 0) return laag1;
  const opNaam = new Map<string, TaakVeld>();
  for (const veld of laag1) opNaam.set(veld.name, veld);
  for (const veld of override) opNaam.set(veld.name, veld);
  return Array.from(opNaam.values());
}

/** De effectieve catalogus voor een tenant: Laag 1 ⊕ Laag 2. */
export async function haalCatalogus(tenantId: string): Promise<CatalogusProces[]> {
  const overrides = await haalTenantOverrides(tenantId);

  return CATALOGUS.map((proces) => ({
    ...proces,
    stappen: proces.stappen.map((stap) => ({
      ...stap,
      velden: mergeVelden(stap.velden, overrides[proces.key]?.[stap.taskKey]),
    })),
  }));
}

export async function haalCatalogusProces(
  tenantId: string,
  key: string,
): Promise<CatalogusProces | undefined> {
  const catalogus = await haalCatalogus(tenantId);
  return catalogus.find((p) => p.key === key);
}
