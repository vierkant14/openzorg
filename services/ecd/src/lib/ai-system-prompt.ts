/**
 * Three-layer system prompt for the OpenZorg AI assistant.
 *
 * Layer 1: Static OpenZorg knowledge (always included, ~2000 tokens)
 * Layer 2: Wiki section match (dynamic, keyword-based, ~500 tokens)
 * Layer 3: Client FHIR data summary (dynamic, when clientId present, ~500 tokens)
 */

import type { Context } from "hono";

import type { AppEnv } from "../app.js";

import { medplumFetch } from "./medplum-client.js";

/* ── Layer 1: Static knowledge ── */

const STATIC_KNOWLEDGE = `Je bent de OpenZorg Assistent, een AI-hulp ingebouwd in het OpenZorg elektronisch clientdossier (ECD). Je beantwoordt vragen in het Nederlands.

## Over OpenZorg
OpenZorg is een open-source zorgplatform voor de Nederlandse VVT-sector (Verpleging, Verzorging, Thuiszorg). Alle klinische data is opgeslagen als FHIR R4 resources in Medplum.

## Modules en navigatie
- **Clienten** (/ecd) — Clientdossiers met tabs: zorgplan, rapportages, medicatie, vaccinaties, allergieen, MIC-meldingen, MDO, documenten, wilsverklaringen, VBM, risicoscreening, indicaties, contactpersonen
- **Zorgplannen** (/zorgplannen) — Overzicht van alle zorgplannen met status en evaluatie-deadlines
- **Planning** (/planning) — Dagplanning, rooster, herhalingen, wachtlijst
- **Werkbak** (/werkbak) — Openstaande taken uit workflows en automatische evaluatie-taken
- **Berichten** (/berichten) — Interne communicatie
- **Overdracht** (/overdracht) — Dienstoverdracht

## Beheer (Functioneel beheerder)
- **Medewerkers** (/admin/medewerkers) — Gebruikers + rollen toewijzen
- **Organisatie** (/admin/organisatie) — Locaties en afdelingen
- **Validatieregels** (/admin/validatie) — Drie-laags model: Kern (wettelijk, niet aanpasbaar), Uitbreiding (per tenant instelbaar), Plugin (toekomstig)
- **Workflows** (/admin/workflows/canvas) — BPMN procesontwerp met visuele canvas editor
- **Codelijsten** (/admin/codelijsten) — Medicatie, diagnoses, allergieen met SNOMED codes
- **Vragenlijsten** (/admin/vragenlijsten) — Templates voor assessments

## Systeem (Tenant admin)
- **State-machines** (/admin/state-machines) — Traject-statussen per resource type met transities en guards
- **Rollen & rechten** (/admin/rollen) — 5 rollen: Tenant admin, Functioneel beheerder, Teamleider, Zorgmedewerker, Planner
- **AI Instellingen** (/admin/ai-instellingen) — Ollama URL, model, aan/uit

## FHIR begrippen
- Patient = Client
- CarePlan = Zorgplan
- Goal = Doel (met leefgebied en SMART-criteria)
- MedicationRequest = Medicatievoorschrift
- AllergyIntolerance = Allergie
- Observation = Rapportage (SOEP/vrij)
- Encounter = MDO
- Consent = Wilsverklaring of handtekening
- Task = Werkbak-taak
- Flag = Signalering

## Zorgplan en doelen
Zorgplannen volgen de Omaha-methodiek met 12 leefgebieden. Doelen moeten SMART zijn:
- Specifiek: beschrijving minimaal 20 tekens, concreet gedrag
- Meetbaar: target met meetbare waarde
- Tijdgebonden: dueDate of tijdterm in beschrijving
Bij het aanmaken van een zorgplan wordt automatisch een evaluatie-taak aangemaakt (6-maandelijks, kwaliteitskader VVT).

## Regels
- Antwoord ALLEEN op basis van de aangeleverde data over de client. Verzin geen informatie.
- Als je iets niet weet, zeg dat eerlijk.
- Verwijs naar de juiste pagina als de gebruiker iets wil doen (geef het pad).
- Gebruik Nederlandse termen, geen Engels.
- Wees beknopt maar volledig.`;

/* ── Layer 2: Wiki section matching ── */

const WIKI_KEYWORDS: Array<{ keywords: string[]; title: string; content: string }> = [
  {
    keywords: ["dashboard", "widget", "client overzicht", "startpagina"],
    title: "Client dashboard aanpassen",
    content: "Het clientoverzicht toont widgets (persoonlijke gegevens, zorgplan, rapportages, medicatie, allergieen, vaccinaties, contactpersonen, afspraken). Beheerders kunnen via /admin/client-dashboard-config instellen welke widgets zichtbaar zijn.",
  },
  {
    keywords: ["validatie", "validatieregel", "verplicht veld", "controle"],
    title: "Validatieregels",
    content: "Validatieregels staan op /admin/validatie. Drie lagen: Kern (wettelijk, niet aanpasbaar, bv. BSN elfproef), Uitbreiding (per tenant instelbaar via admin UI), Plugin (toekomstig). Maak een regel: kies resource type, veldpad, operator (required, regex, min_length, etc.), foutmelding. Test met de 'Test deze regel' knop.",
  },
  {
    keywords: ["workflow", "bpmn", "proces", "canvas", "taak"],
    title: "Workflows en BPMN",
    content: "Workflows staan op /admin/workflows/canvas. Gebruik de visuele editor: sleep User Tasks, Beslissingen (gateways), Parallel taken en Eind-events. Laad een template of maak een nieuw proces. Condities op gateways configureer je met de visuele conditie-builder. Taken verschijnen in de werkbak (/werkbak).",
  },
  {
    keywords: ["state-machine", "traject", "status", "transitie"],
    title: "State-machines",
    content: "State-machines staan op /admin/state-machines (Systeem, alleen tenant admin). Kies een resource type en definieer statussen met transities. Guards bepalen of een transitie mag. De client traject-status badge in het dossier volgt de Patient state-machine.",
  },
  {
    keywords: ["medicatie", "voorschrift", "dosering", "stoppen"],
    title: "Medicatie",
    content: "Medicatie staat op /ecd/{id}/medicatie. Voeg voorschriften toe met CodelijstPicker (SNOMED). Dosering, frequentie, start/einddatum. Stopknop zet einddatum. Medicatieoverzicht op /ecd/{id}/medicatie-overzicht.",
  },
  {
    keywords: ["rapportage", "soep", "verslag", "notitie"],
    title: "Rapportages",
    content: "Rapportages staan op /ecd/{id}/rapportages. Twee typen: SOEP (Subjectief, Objectief, Evaluatie, Plan) en vrije tekst. AI samenvatting beschikbaar als Ollama draait.",
  },
  {
    keywords: ["rol", "recht", "permissie", "toegang"],
    title: "Rollen en rechten",
    content: "5 rollen: Tenant admin (technisch beheer), Functioneel beheerder (zorginhoudelijk beheer), Teamleider (monitoring + escalatie), Zorgmedewerker (dossiervoering), Planner (roostering). Rollen beheren via /admin/rollen (alleen tenant admin).",
  },
  {
    keywords: ["zorgplan", "doel", "smart", "evaluatie", "leefgebied"],
    title: "Zorgplan en doelen",
    content: "Zorgplan per client op /ecd/{id}/zorgplan. Maak een plan met titel, periode, verantwoordelijke behandelaar. Voeg doelen toe per leefgebied (12 leefgebieden conform Omaha). Doelen moeten SMART zijn. Interventies koppelen aan het plan. Evaluaties loggen voortgang. Handtekeningen via Consent resources.",
  },
  {
    keywords: ["codelijst", "snomed", "allergie", "diagnose"],
    title: "Codelijsten",
    content: "Codelijsten op /admin/codelijsten. Per type een curated lijst met SNOMED codes. De CodelijstPicker zoekt eerst in de tenant-lijst, dan in SNOMED CT live. Beheerders kunnen items toevoegen/verwijderen.",
  },
  {
    keywords: ["planning", "rooster", "afspraak", "dagplanning", "beschikbaarheid"],
    title: "Planning",
    content: "Planning module: Dagplanning (/planning/dagplanning) per medewerker per dag. Rooster (/planning/rooster) weekoverzicht. Wachtlijst (/planning/wachtlijst). Herhalingen (/planning/herhalingen) voor terugkerende afspraken.",
  },
];

export function matchWikiSection(question: string): string | null {
  const q = question.toLowerCase();
  let bestMatch: { score: number; entry: (typeof WIKI_KEYWORDS)[number] } | null = null;

  for (const entry of WIKI_KEYWORDS) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.length;
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { score, entry };
    }
  }

  if (!bestMatch) return null;
  return `\n## Relevante help: ${bestMatch.entry.title}\n${bestMatch.entry.content}`;
}

/* ── Layer 3: Client FHIR data ── */

export async function buildClientContext(c: Context<AppEnv>, clientId: string): Promise<string | null> {
  try {
    const [patientRes, allergyRes, medRes, planRes, flagRes, vaccRes, diagRes, rapRes] = await Promise.all([
      medplumFetch(c, `/fhir/R4/Patient/${clientId}`),
      medplumFetch(c, `/fhir/R4/AllergyIntolerance?patient=Patient/${clientId}&clinical-status=active&_count=10`),
      medplumFetch(c, `/fhir/R4/MedicationRequest?patient=Patient/${clientId}&status=active&_count=10`),
      medplumFetch(c, `/fhir/R4/CarePlan?subject=Patient/${clientId}&status=active&_count=1&_sort=-_lastUpdated`),
      medplumFetch(c, `/fhir/R4/Flag?patient=Patient/${clientId}&status=active&_count=5`),
      medplumFetch(c, `/fhir/R4/Immunization?patient=Patient/${clientId}&_count=10&_sort=-date`),
      medplumFetch(c, `/fhir/R4/Condition?patient=Patient/${clientId}&_count=10`),
      medplumFetch(c, `/fhir/R4/Observation?subject=Patient/${clientId}&code=https://openzorg.nl/CodeSystem/observation-type|rapportage&_count=5&_sort=-date`),
    ]);

    const lines: string[] = ["\n## Clientgegevens (uit het dossier)"];

    if (patientRes.ok) {
      const patient = (await patientRes.json()) as Record<string, unknown>;
      const name = patient.name as Array<{ given?: string[]; family?: string }> | undefined;
      const n = name?.[0];
      const displayName = n ? `${(n.given ?? []).join(" ")} ${n.family ?? ""}`.trim() : "Onbekend";
      const bsn = (patient.identifier as Array<{ system?: string; value?: string }> | undefined)
        ?.find((i) => i.system?.includes("bsn"))?.value ?? "—";
      const birthDate = (patient.birthDate as string) ?? "—";
      const gender = (patient.gender as string) ?? "—";
      lines.push(`Naam: ${displayName} | BSN: ${bsn} | Geboortedatum: ${birthDate} | Geslacht: ${gender}`);
    }

    if (allergyRes.ok) {
      const bundle = (await allergyRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const allergies = (bundle.entry ?? []).map((e) => {
        const r = e.resource;
        const substance = ((r.code as Record<string, unknown>)?.text as string) ??
          ((r.code as Record<string, unknown>)?.coding as Array<{ display?: string }> | undefined)?.[0]?.display ?? "?";
        const criticality = (r.criticality as string) ?? "";
        return criticality === "high" ? `${substance} (HOOG RISICO)` : substance;
      });
      lines.push(`Allergieen: ${allergies.length > 0 ? allergies.join(", ") : "Geen geregistreerd"}`);
    }

    if (medRes.ok) {
      const bundle = (await medRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const meds = (bundle.entry ?? []).map((e) => {
        const r = e.resource;
        return ((r.medicationCodeableConcept as Record<string, unknown>)?.text as string) ??
          ((r.medicationCodeableConcept as Record<string, unknown>)?.coding as Array<{ display?: string }> | undefined)?.[0]?.display ?? "?";
      });
      lines.push(`Actieve medicatie: ${meds.length > 0 ? meds.join(", ") : "Geen"}`);
    }

    if (planRes.ok) {
      const bundle = (await planRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const plan = bundle.entry?.[0]?.resource;
      if (plan) {
        const title = (plan.title as string) ?? "Zonder titel";
        const status = (plan.status as string) ?? "?";
        const goalCount = (plan.goal as unknown[] | undefined)?.length ?? 0;
        lines.push(`Zorgplan: "${title}" (${status}), ${goalCount} doelen`);
      } else {
        lines.push("Zorgplan: Geen actief zorgplan");
      }
    }

    if (flagRes.ok) {
      const bundle = (await flagRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const flags = (bundle.entry ?? []).map((e) => {
        return ((e.resource.code as Record<string, unknown>)?.text as string) ?? "Signalering";
      });
      if (flags.length > 0) {
        lines.push(`Signaleringen: ${flags.join(", ")}`);
      }
    }

    // Vaccinaties
    if (vaccRes.ok) {
      const bundle = (await vaccRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const vaccs = (bundle.entry ?? []).map((e) => {
        const r = e.resource;
        const vaccine = ((r.vaccineCode as Record<string, unknown>)?.text as string) ??
          ((r.vaccineCode as Record<string, unknown>)?.coding as Array<{ display?: string }> | undefined)?.[0]?.display ?? "?";
        const date = (r.occurrenceDateTime as string)?.split("T")[0] ?? "";
        return date ? `${vaccine} (${date})` : vaccine;
      });
      lines.push(`Vaccinaties: ${vaccs.length > 0 ? vaccs.join(", ") : "Geen geregistreerd"}`);
    }

    // Diagnoses
    if (diagRes.ok) {
      const bundle = (await diagRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const diags = (bundle.entry ?? []).map((e) => {
        const r = e.resource;
        return ((r.code as Record<string, unknown>)?.text as string) ??
          ((r.code as Record<string, unknown>)?.coding as Array<{ display?: string }> | undefined)?.[0]?.display ?? "?";
      });
      if (diags.length > 0) {
        lines.push(`Diagnoses: ${diags.join(", ")}`);
      }
    }

    // Laatste rapportages
    if (rapRes.ok) {
      const bundle = (await rapRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const raps = (bundle.entry ?? []).map((e) => {
        const r = e.resource;
        const date = (r.effectiveDateTime as string)?.split("T")[0] ?? "";
        const text = ((r.valueString as string) ?? "").substring(0, 100);
        return `${date}: ${text}${text.length >= 100 ? "..." : ""}`;
      });
      if (raps.length > 0) {
        lines.push(`Laatste rapportages:\n${raps.map((r) => `  - ${r}`).join("\n")}`);
      }
    }

    return lines.join("\n");
  } catch (err) {
    console.error("[AI] Failed to build client context:", err);
    return null;
  }
}

export { STATIC_KNOWLEDGE };
