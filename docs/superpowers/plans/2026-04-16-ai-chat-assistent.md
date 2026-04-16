# AI Chat Assistent + Configuratie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-tenant AI configuration page and a contextual chat assistant side panel that answers questions about clients, tasks, and the platform itself.

**Architecture:** Spec A adds AI settings CRUD to the existing `ai.ts` route and a Systeem admin page. Spec B adds a `ChatPanel` component to AppShell with streaming SSE, a three-layer system prompt (static knowledge + wiki match + FHIR client data), and audit logging. The existing `ollama-client.ts` gets a streaming variant.

**Tech Stack:** Hono (SSE streaming), React (ChatPanel), Ollama API, FHIR R4 (Medplum), existing tenant_configurations table.

**Spec reference:** `docs/superpowers/specs/2026-04-16-ai-chat-assistent-design.md`

---

## File Structure

### To create (new)

```
apps/web/src/app/admin/ai-instellingen/page.tsx   — AI config admin page
apps/web/src/components/ChatPanel.tsx              — Chat side panel component
services/ecd/src/lib/ai-system-prompt.ts           — Static OpenZorg knowledge for system prompt
services/ecd/src/routes/ai-settings.ts             — AI settings CRUD endpoints
```

### To modify (existing)

```
packages/shared-domain/src/roles.ts                — Add ai-config + ai-chat permissions
apps/web/src/components/AppShell.tsx                — Add chat icon in top-bar + ChatPanel + Systeem nav entry
services/ecd/src/lib/ollama-client.ts              — Add ollamaChatStream() + per-tenant URL
services/ecd/src/routes/ai.ts                      — Add POST /api/ai/chat SSE endpoint
services/ecd/src/app.ts                            — Mount ai-settings routes
```

---

## Task 1: Add AI permissions to shared-domain

**Files:**
- Modify: `packages/shared-domain/src/roles.ts`

- [ ] **Step 1.1: Add 4 new permissions**

Add to the `Permission` type union, after `"api-keys:write"`:

```typescript
  | "ai-config:read"
  | "ai-config:write"
  | "ai-chat:read"
```

- [ ] **Step 1.2: Add permissions to role matrix**

In `ROLE_PERMISSIONS`:

- `"tenant-admin"` array: add `"ai-config:read", "ai-config:write", "ai-chat:read"`
- `"beheerder"` array: add `"ai-chat:read"`
- `"teamleider"` array: add `"ai-chat:read"`
- `"zorgmedewerker"` array: add `"ai-chat:read"`
- `"planner"`: no change (no ai-chat)

- [ ] **Step 1.3: Add route permission entry**

Add to `ROUTE_PERMISSIONS` array:

```typescript
  { pattern: "/api/admin/ai-settings", GET: "ai-config:read", PUT: "ai-config:write", POST: "ai-config:write" },
  { pattern: "/api/ai/chat", POST: "ai-chat:read" },
```

- [ ] **Step 1.4: Add nav permission**

Add to `NAV_PERMISSIONS`:

```typescript
  "/admin/ai-instellingen": "ai-config:read" as Permission,
```

- [ ] **Step 1.5: Build and verify**

```bash
pnpm --filter @openzorg/shared-domain build
pnpm typecheck
```

- [ ] **Step 1.6: Commit**

```bash
git add packages/shared-domain/src/roles.ts
git commit -m "feat(rbac): add ai-config and ai-chat permissions"
```

---

## Task 2: AI settings CRUD backend

**Files:**
- Create: `services/ecd/src/routes/ai-settings.ts`
- Modify: `services/ecd/src/app.ts` — mount the new routes

- [ ] **Step 2.1: Create ai-settings route file**

Create `services/ecd/src/routes/ai-settings.ts`:

```typescript
import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const aiSettingsRoutes = new Hono<AppEnv>();

interface AiSettings {
  enabled: boolean;
  ollamaUrl: string;
  model: string;
  tenantPrompt: string;
}

const DEFAULT_SETTINGS: AiSettings = {
  enabled: false,
  ollamaUrl: "",
  model: "",
  tenantPrompt: "",
};

async function resolveTenantUuid(tenantIdOrProjectId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
    [tenantIdOrProjectId],
  );
  return result.rows[0]?.id ?? null;
}

/**
 * GET / — Get AI settings for the current tenant.
 */
aiSettingsRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantId);
  if (!tenantUuid) {
    return c.json(DEFAULT_SETTINGS);
  }

  const result = await pool.query<{ config_data: AiSettings }>(
    `SELECT config_data FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'ai_settings' LIMIT 1`,
    [tenantUuid],
  );

  return c.json(result.rows[0]?.config_data ?? DEFAULT_SETTINGS);
});

/**
 * PUT / — Update AI settings for the current tenant.
 */
aiSettingsRoutes.put("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantId);
  if (!tenantUuid) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }

  const body = await c.req.json<Partial<AiSettings>>();

  const settings: AiSettings = {
    enabled: body.enabled ?? false,
    ollamaUrl: body.ollamaUrl ?? "",
    model: body.model ?? "",
    tenantPrompt: body.tenantPrompt ?? "",
  };

  // Upsert: insert or update
  await pool.query(
    `INSERT INTO openzorg.tenant_configurations (tenant_id, config_type, config_data, version)
     VALUES ($1, 'ai_settings', $2, 1)
     ON CONFLICT (tenant_id, config_type) DO UPDATE SET config_data = $2`,
    [tenantUuid, JSON.stringify(settings)],
  );

  return c.json(settings);
});

/**
 * POST /test — Test connection to the configured Ollama URL.
 */
aiSettingsRoutes.post("/test", async (c) => {
  const body = await c.req.json<{ ollamaUrl?: string }>();
  const url = body.ollamaUrl || process.env["OLLAMA_BASE_URL"] || "http://ollama:11434";

  try {
    const res = await fetch(`${url}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return c.json({ healthy: false, error: `Status ${res.status}`, models: [] });
    }
    const data = (await res.json()) as { models: Array<{ name: string }> };
    return c.json({
      healthy: true,
      models: data.models.map((m) => m.name),
    });
  } catch (err) {
    return c.json({
      healthy: false,
      error: err instanceof Error ? err.message : "Onbereikbaar",
      models: [],
    });
  }
});
```

- [ ] **Step 2.2: Mount in app.ts**

In `services/ecd/src/app.ts`, add the import and mount. Find the existing imports near the top and add:

```typescript
import { aiSettingsRoutes } from "./routes/ai-settings.js";
```

Find where other admin routes are mounted (look for `aiRoutes` or similar `/api/ai` mounts) and add:

```typescript
app.route("/api/admin/ai-settings", aiSettingsRoutes);
```

Make sure this is mounted BEFORE the `/:id` catch-all routes.

- [ ] **Step 2.3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2.4: Commit**

```bash
git add services/ecd/src/routes/ai-settings.ts services/ecd/src/app.ts
git commit -m "feat(ai): settings CRUD backend (enable/disable, URL, model per tenant)"
```

---

## Task 3: Extend ollama-client with streaming + per-tenant URL

**Files:**
- Modify: `services/ecd/src/lib/ollama-client.ts`

- [ ] **Step 3.1: Add getTenantAiSettings helper**

Add this function after the existing constants (line 14):

```typescript
import { pool } from "./db.js";

interface TenantAiSettings {
  enabled: boolean;
  ollamaUrl: string;
  model: string;
  tenantPrompt: string;
}

export async function getTenantAiSettings(tenantIdOrProjectId: string): Promise<TenantAiSettings | null> {
  const tenantResult = await pool.query<{ id: string }>(
    "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
    [tenantIdOrProjectId],
  );
  const tenantUuid = tenantResult.rows[0]?.id;
  if (!tenantUuid) return null;

  const result = await pool.query<{ config_data: TenantAiSettings }>(
    `SELECT config_data FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'ai_settings' LIMIT 1`,
    [tenantUuid],
  );
  return result.rows[0]?.config_data ?? null;
}

export function resolveOllamaUrl(tenantSettings: TenantAiSettings | null): string {
  return tenantSettings?.ollamaUrl || OLLAMA_BASE_URL;
}

export function resolveModel(tenantSettings: TenantAiSettings | null): string {
  return tenantSettings?.model || DEFAULT_MODEL;
}
```

- [ ] **Step 3.2: Add ollamaChatStream function**

Add after the existing `ollamaChat` function:

```typescript
/**
 * Streaming chat. Returns a ReadableStream of OllamaChatResponse chunks.
 * Each chunk has `done: false` until the final chunk which has `done: true`.
 */
export async function ollamaChatStream(
  messages: OllamaMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number; baseUrl?: string } = {},
): Promise<ReadableStream<Uint8Array>> {
  const url = options.baseUrl ?? OLLAMA_BASE_URL;
  const body: OllamaChatRequest = {
    model: options.model ?? DEFAULT_MODEL,
    messages,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.3,
      num_predict: options.maxTokens ?? 2048,
    },
  };

  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama stream faalde (${res.status}): ${text}`);
  }

  if (!res.body) {
    throw new Error("Ollama response heeft geen body stream");
  }

  return res.body;
}
```

- [ ] **Step 3.3: Update exports**

Update the export line at the bottom:

```typescript
export { DEFAULT_MODEL, OLLAMA_BASE_URL };
```

The new functions (`getTenantAiSettings`, `resolveOllamaUrl`, `resolveModel`, `ollamaChatStream`) are already exported via their `export` keyword.

- [ ] **Step 3.4: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3.5: Commit**

```bash
git add services/ecd/src/lib/ollama-client.ts
git commit -m "feat(ai): streaming chat + per-tenant Ollama URL resolution"
```

---

## Task 4: Static system prompt (OpenZorg knowledge base)

**Files:**
- Create: `services/ecd/src/lib/ai-system-prompt.ts`

- [ ] **Step 4.1: Create the system prompt builder**

Create `services/ecd/src/lib/ai-system-prompt.ts`:

```typescript
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

const STATIC_KNOWLEDGE = `Je bent de OpenZorg Assistent, een AI-hulp ingebouwd in het OpenZorg elektronisch cliëntdossier (ECD). Je beantwoordt vragen in het Nederlands.

## Over OpenZorg
OpenZorg is een open-source zorgplatform voor de Nederlandse VVT-sector (Verpleging, Verzorging, Thuiszorg). Alle klinische data is opgeslagen als FHIR R4 resources in Medplum.

## Modules en navigatie
- **Cliënten** (/ecd) — Cliëntdossiers met tabs: zorgplan, rapportages, medicatie, vaccinaties, allergieën, MIC-meldingen, MDO, documenten, wilsverklaringen, VBM, risicoscreening, indicaties, contactpersonen
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
- **Codelijsten** (/admin/codelijsten) — Medicatie, diagnoses, allergieën met SNOMED codes
- **Vragenlijsten** (/admin/vragenlijsten) — Templates voor assessments

## Systeem (Tenant admin)
- **State-machines** (/admin/state-machines) — Traject-statussen per resource type met transities en guards
- **Rollen & rechten** (/admin/rollen) — 5 rollen: Tenant admin, Functioneel beheerder, Teamleider, Zorgmedewerker, Planner
- **AI Instellingen** (/admin/ai-instellingen) — Ollama URL, model, aan/uit

## FHIR begrippen
- Patient = Cliënt
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
- **S**pecifiek: beschrijving minimaal 20 tekens, concreet gedrag
- **M**eetbaar: target met meetbare waarde
- **T**ijdgebonden: dueDate of tijdterm in beschrijving
Bij het aanmaken van een zorgplan wordt automatisch een evaluatie-taak aangemaakt (6-maandelijks, kwaliteitskader VVT).

## Regels
- Antwoord ALLEEN op basis van de aangeleverde data over de cliënt. Verzin geen informatie.
- Als je iets niet weet, zeg dat eerlijk.
- Verwijs naar de juiste pagina als de gebruiker iets wil doen (geef het pad).
- Gebruik Nederlandse termen, geen Engels.
- Wees beknopt maar volledig.`;

/* ── Layer 2: Wiki section matching ── */

/** Simplified wiki sections for keyword matching. */
const WIKI_KEYWORDS: Array<{ keywords: string[]; title: string; content: string }> = [
  {
    keywords: ["dashboard", "widget", "client overzicht", "startpagina"],
    title: "Client dashboard aanpassen",
    content: "Het clientoverzicht toont widgets (persoonlijke gegevens, zorgplan, rapportages, medicatie, allergieën, vaccinaties, contactpersonen, afspraken). Beheerders kunnen via /admin/client-dashboard-config instellen welke widgets zichtbaar zijn.",
  },
  {
    keywords: ["validatie", "validatieregel", "verplicht veld", "controle"],
    title: "Validatieregels",
    content: "Validatieregels staan op /admin/validatie. Drie lagen: Kern (wettelijk, niet aanpasbaar, bv. BSN elfproef), Uitbreiding (per tenant instelbaar via admin UI), Plugin (toekomstig). Maak een regel: kies resource type (Patient, MedicationRequest, etc.), veldpad, operator (required, regex, min_length, etc.), foutmelding. Test de regel met de 'Test deze regel' knop.",
  },
  {
    keywords: ["workflow", "bpmn", "proces", "canvas", "taak"],
    title: "Workflows en BPMN",
    content: "Workflows staan op /admin/workflows/canvas. Gebruik de visuele editor: sleep User Tasks, Beslissingen (gateways), Parallel taken en Eind-events. Laad een template (intake, evaluatie, herindicatie, MIC-afhandeling) of maak een nieuw proces. Condities op gateways configureer je met de visuele conditie-builder. Taken verschijnen in de werkbak (/werkbak).",
  },
  {
    keywords: ["state-machine", "traject", "status", "transitie"],
    title: "State-machines",
    content: "State-machines staan op /admin/state-machines (Systeem, alleen tenant admin). Kies een resource type (Patient, CarePlan, etc.) en definieer statussen met transities. Guards bepalen of een transitie mag (bv. handtekening aanwezig). De cliënt traject-status badge in het dossier volgt de Patient state-machine.",
  },
  {
    keywords: ["medicatie", "voorschrift", "dosering", "stoppen"],
    title: "Medicatie",
    content: "Medicatie staat op /ecd/{id}/medicatie. Voeg voorschriften toe met CodelijstPicker (SNOMED). Dosering, frequentie, start/einddatum. Stopknop zet einddatum. Medicatieoverzicht op /ecd/{id}/medicatie-overzicht combineert voorschriften en toedieningen.",
  },
  {
    keywords: ["rapportage", "soep", "verslag", "notitie"],
    title: "Rapportages",
    content: "Rapportages staan op /ecd/{id}/rapportages. Twee typen: SOEP (Subjectief, Objectief, Evaluatie, Plan) en vrije tekst. AI samenvatting beschikbaar als Ollama draait.",
  },
  {
    keywords: ["rol", "recht", "permissie", "toegang"],
    title: "Rollen en rechten",
    content: "5 rollen: Tenant admin (technisch beheer), Functioneel beheerder (zorginhoudelijk beheer), Teamleider (monitoring + escalatie), Zorgmedewerker (dossiervoering), Planner (roostering). Rollen beheren via /admin/rollen (alleen tenant admin). Elke rol heeft vaste permissies die bepalen welke menu-items en API endpoints toegankelijk zijn.",
  },
  {
    keywords: ["zorgplan", "doel", "smart", "evaluatie", "leefgebied"],
    title: "Zorgplan en doelen",
    content: "Zorgplan per cliënt op /ecd/{id}/zorgplan. Maak een plan met titel, periode, verantwoordelijke behandelaar. Voeg doelen toe per leefgebied (12 leefgebieden conform Omaha). Doelen moeten SMART zijn (backend valideert). Interventies (ServiceRequests) koppelen aan het plan. Evaluaties loggen voortgang. Handtekeningen via Consent resources.",
  },
  {
    keywords: ["codelijst", "snomed", "allergie", "diagnose"],
    title: "Codelijsten",
    content: "Codelijsten op /admin/codelijsten. Per type (medicatie, diagnoses, allergieën, etc.) een curated lijst met SNOMED codes. De CodelijstPicker zoekt eerst in de tenant-lijst, dan in SNOMED CT live. Beheerders kunnen items toevoegen/verwijderen.",
  },
  {
    keywords: ["planning", "rooster", "afspraak", "dagplanning", "beschikbaarheid"],
    title: "Planning",
    content: "Planning module: Dagplanning (/planning/dagplanning) toont afspraken per medewerker per dag. Rooster (/planning/rooster) is weekoverzicht. Wachtlijst (/planning/wachtlijst) voor cliënten die wachten op zorg. Herhalingen (/planning/herhalingen) voor terugkerende afspraken.",
  },
];

export function matchWikiSection(question: string): string | null {
  const q = question.toLowerCase();
  let bestMatch: { score: number; entry: (typeof WIKI_KEYWORDS)[number] } | null = null;

  for (const entry of WIKI_KEYWORDS) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.length; // longer matches score higher
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
    // Fetch patient + allergies + medication + careplan + flags in parallel
    const [patientRes, allergyRes, medRes, planRes, flagRes] = await Promise.all([
      medplumFetch(c, `/fhir/R4/Patient/${clientId}`),
      medplumFetch(c, `/fhir/R4/AllergyIntolerance?patient=Patient/${clientId}&clinical-status=active&_count=10`),
      medplumFetch(c, `/fhir/R4/MedicationRequest?patient=Patient/${clientId}&status=active&_count=10`),
      medplumFetch(c, `/fhir/R4/CarePlan?subject=Patient/${clientId}&status=active&_count=1&_sort=-_lastUpdated`),
      medplumFetch(c, `/fhir/R4/Flag?patient=Patient/${clientId}&status=active&_count=5`),
    ]);

    const lines: string[] = ["\n## Cliëntgegevens (uit het dossier)"];

    // Patient
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

    // Allergies
    if (allergyRes.ok) {
      const bundle = (await allergyRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const allergies = (bundle.entry ?? []).map((e) => {
        const r = e.resource;
        const substance = ((r.code as Record<string, unknown>)?.text as string) ??
          ((r.code as Record<string, unknown>)?.coding as Array<{ display?: string }> | undefined)?.[0]?.display ?? "?";
        const criticality = (r.criticality as string) ?? "";
        return criticality === "high" ? `${substance} (HOOG RISICO)` : substance;
      });
      lines.push(`Allergieën: ${allergies.length > 0 ? allergies.join(", ") : "Geen geregistreerd"}`);
    }

    // Medication
    if (medRes.ok) {
      const bundle = (await medRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const meds = (bundle.entry ?? []).map((e) => {
        const r = e.resource;
        const med = ((r.medicationCodeableConcept as Record<string, unknown>)?.text as string) ??
          ((r.medicationCodeableConcept as Record<string, unknown>)?.coding as Array<{ display?: string }> | undefined)?.[0]?.display ?? "?";
        return med;
      });
      lines.push(`Actieve medicatie: ${meds.length > 0 ? meds.join(", ") : "Geen"}`);
    }

    // CarePlan
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

    // Flags
    if (flagRes.ok) {
      const bundle = (await flagRes.json()) as { entry?: Array<{ resource: Record<string, unknown> }> };
      const flags = (bundle.entry ?? []).map((e) => {
        const r = e.resource;
        return ((r.code as Record<string, unknown>)?.text as string) ?? "Signalering";
      });
      if (flags.length > 0) {
        lines.push(`Signaleringen: ${flags.join(", ")}`);
      }
    }

    return lines.join("\n");
  } catch (err) {
    console.error("[AI] Failed to build client context:", err);
    return null;
  }
}

export { STATIC_KNOWLEDGE };
```

- [ ] **Step 4.2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4.3: Commit**

```bash
git add services/ecd/src/lib/ai-system-prompt.ts
git commit -m "feat(ai): three-layer system prompt (static knowledge + wiki match + FHIR client data)"
```

---

## Task 5: POST /api/ai/chat SSE endpoint

**Files:**
- Modify: `services/ecd/src/routes/ai.ts`

- [ ] **Step 5.1: Add imports**

At the top of `services/ecd/src/routes/ai.ts`, add to the existing imports:

```typescript
import { streamSSE } from "hono/streaming";

import {
  getTenantAiSettings,
  ollamaChatStream,
  resolveModel,
  resolveOllamaUrl,
  type OllamaMessage,
} from "../lib/ollama-client.js";
import {
  buildClientContext,
  matchWikiSection,
  STATIC_KNOWLEDGE,
} from "../lib/ai-system-prompt.js";
```

Remove duplicated imports that are already imported (like `OllamaMessage`, `OLLAMA_BASE_URL`, etc.) to avoid conflicts.

- [ ] **Step 5.2: Add the chat endpoint**

Add at the bottom of `ai.ts`, before the export:

```typescript
/**
 * POST /chat — Contextual AI chat with SSE streaming.
 *
 * Request body:
 *   { message: string, context: { page, clientId?, tab? }, history: OllamaMessage[] }
 *
 * Response: Server-Sent Events stream with JSON chunks:
 *   data: {"chunk":"text"}
 *   data: {"done":true}
 */
aiRoutes.post("/chat", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantId);
  const userId = c.req.header("X-User-Id") ?? "anonymous";

  // Get tenant AI settings
  const aiSettings = await getTenantAiSettings(tenantId);
  if (aiSettings && !aiSettings.enabled) {
    return c.json({ error: "AI is niet ingeschakeld voor deze organisatie" }, 403);
  }

  const body = await c.req.json<{
    message: string;
    context: { page: string; clientId?: string; tab?: string };
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }>();

  if (!body.message) {
    return c.json({ error: "Bericht is vereist" }, 400);
  }

  const ollamaUrl = resolveOllamaUrl(aiSettings);
  const model = resolveModel(aiSettings);

  // Build system prompt (3 layers)
  let systemPrompt = STATIC_KNOWLEDGE;

  // Layer 2: wiki match
  const wikiMatch = matchWikiSection(body.message);
  if (wikiMatch) {
    systemPrompt += "\n" + wikiMatch;
  }

  // Tenant custom prompt
  if (aiSettings?.tenantPrompt) {
    systemPrompt += `\n\n## Over deze organisatie\n${aiSettings.tenantPrompt}`;
  }

  // Layer 3: client FHIR data
  if (body.context.clientId) {
    const clientContext = await buildClientContext(c, body.context.clientId);
    if (clientContext) {
      systemPrompt += "\n" + clientContext;
    }
  }

  // Add page context
  systemPrompt += `\n\n## Huidige pagina\nDe gebruiker bekijkt: ${body.context.page}`;
  if (body.context.tab) {
    systemPrompt += ` (tab: ${body.context.tab})`;
  }

  // Build messages array
  const messages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    ...(body.history ?? []).slice(-18).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: body.message },
  ];

  const startTime = Date.now();

  try {
    const stream = await ollamaChatStream(messages, {
      model,
      baseUrl: ollamaUrl,
      maxTokens: 2048,
    });

    return streamSSE(c, async (sseStream) => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          // Ollama streams newline-delimited JSON
          const lines = text.split("\n").filter(Boolean);

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line) as { message?: { content: string }; done: boolean };
              if (parsed.message?.content) {
                fullResponse += parsed.message.content;
                await sseStream.writeSSE({
                  data: JSON.stringify({ chunk: parsed.message.content }),
                });
              }
              if (parsed.done) {
                await sseStream.writeSSE({
                  data: JSON.stringify({ done: true }),
                });
              }
            } catch {
              // Partial JSON line, skip
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Audit log (fire-and-forget)
      if (tenantUuid) {
        const durationMs = Date.now() - startTime;
        logAiCall(tenantUuid, userId, "ai.chat", model, durationMs, {
          page: body.context.page,
          clientId: body.context.clientId ?? null,
          responseLength: fullResponse.length,
        }).catch(() => {});
      }
    });
  } catch (err) {
    return c.json(
      {
        error: "AI niet bereikbaar",
        hint: `Controleer of Ollama draait op ${ollamaUrl}`,
        details: err instanceof Error ? err.message : "Onbekende fout",
      },
      503,
    );
  }
});
```

- [ ] **Step 5.3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5.4: Commit**

```bash
git add services/ecd/src/routes/ai.ts
git commit -m "feat(ai): POST /api/ai/chat with SSE streaming + 3-layer context"
```

---

## Task 6: AI Instellingen admin page

**Files:**
- Create: `apps/web/src/app/admin/ai-instellingen/page.tsx`
- Modify: `apps/web/src/components/AppShell.tsx` — add nav entry

- [ ] **Step 6.1: Create the admin page**

Create `apps/web/src/app/admin/ai-instellingen/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface AiSettings {
  enabled: boolean;
  ollamaUrl: string;
  model: string;
  tenantPrompt: string;
}

interface TestResult {
  healthy: boolean;
  error?: string;
  models: string[];
}

export default function AiInstellingenPage() {
  const [settings, setSettings] = useState<AiSettings>({
    enabled: false,
    ollamaUrl: "",
    model: "",
    tenantPrompt: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    ecdFetch<AiSettings>("/api/admin/ai-settings").then(({ data }) => {
      if (data) setSettings(data);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await ecdFetch("/api/admin/ai-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const { data } = await ecdFetch<TestResult>("/api/admin/ai-settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ollamaUrl: settings.ollamaUrl }),
    });
    setTestResult(data ?? { healthy: false, error: "Geen response", models: [] });
    setTesting(false);
  }

  if (loading) return <AppShell><div className="p-8 text-fg-muted">Laden...</div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-fg">AI Instellingen</h1>
        <p className="mt-2 text-fg-muted">
          Configureer de AI-assistent voor je organisatie. De AI draait lokaal via Ollama — data verlaat nooit je netwerk.
        </p>

        <div className="mt-8 space-y-6">
          {/* Enable toggle */}
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="h-5 w-5 rounded border-default accent-brand-600"
            />
            <span className="text-fg font-medium">AI-assistent inschakelen</span>
          </label>

          {/* Ollama URL */}
          <div>
            <label className="block text-sm font-medium text-fg">Ollama URL</label>
            <input
              type="text"
              value={settings.ollamaUrl}
              onChange={(e) => setSettings({ ...settings, ollamaUrl: e.target.value })}
              placeholder="http://192.168.1.20:11434"
              className="mt-1 w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            />
            <p className="mt-1 text-xs text-fg-subtle">
              Laat leeg voor de standaard server. Vul het IP van je eigen machine in als je een lokale GPU wilt gebruiken.
            </p>
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg hover:bg-sunken disabled:opacity-50"
            >
              {testing ? "Testen..." : "Verbinding testen"}
            </button>
            {testResult && (
              <span className={testResult.healthy ? "text-sm text-emerald-600" : "text-sm text-coral-600"}>
                {testResult.healthy
                  ? `Verbonden — ${testResult.models.length} model(len) beschikbaar`
                  : `Niet bereikbaar: ${testResult.error}`}
              </span>
            )}
          </div>

          {/* Model selection */}
          <div>
            <label className="block text-sm font-medium text-fg">Model</label>
            {testResult?.healthy && testResult.models.length > 0 ? (
              <select
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="mt-1 w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
              >
                <option value="">Standaard (gemma3:4b)</option>
                {testResult.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                placeholder="gemma3:4b"
                className="mt-1 w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
              />
            )}
          </div>

          {/* Tenant prompt */}
          <div>
            <label className="block text-sm font-medium text-fg">Organisatie-context (optioneel)</label>
            <textarea
              value={settings.tenantPrompt}
              onChange={(e) => setSettings({ ...settings, tenantPrompt: e.target.value })}
              rows={4}
              placeholder="Wij zijn een thuiszorgorganisatie in regio Utrecht met focus op dementiezorg..."
              className="mt-1 w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            />
            <p className="mt-1 text-xs text-fg-subtle">
              Extra context die de AI meekrijgt bij elke vraag. Beschrijf je organisatie, specialisaties of werkwijzen.
            </p>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
            {saved && <span className="text-sm text-emerald-600">Instellingen opgeslagen</span>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 6.2: Add nav entry in AppShell**

In `apps/web/src/components/AppShell.tsx`, find the "Systeem" nav section and add the AI entry. Add it after the existing items:

```typescript
{ href: "/admin/ai-instellingen", label: "AI Instellingen", icon: IconSettings, permission: "ai-config:read" },
```

- [ ] **Step 6.3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6.4: Commit**

```bash
git add apps/web/src/app/admin/ai-instellingen/page.tsx apps/web/src/components/AppShell.tsx
git commit -m "feat(ai): admin page voor AI instellingen (URL, model, aan/uit)"
```

---

## Task 7: ChatPanel frontend component

**Files:**
- Create: `apps/web/src/components/ChatPanel.tsx`
- Modify: `apps/web/src/components/AppShell.tsx` — add chat icon + mount ChatPanel

- [ ] **Step 7.1: Create ChatPanel component**

Create `apps/web/src/components/ChatPanel.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { ecdFetch, getUserRole } from "../lib/api";
import { ROLE_PERMISSIONS } from "@openzorg/shared-domain";
import type { OpenZorgRole } from "@openzorg/shared-domain";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract context from current URL
  const context = {
    page: pathname ?? "/",
    clientId: pathname?.match(/\/ecd\/([^/]+)/)?.[1],
    tab: pathname?.match(/\/ecd\/[^/]+\/([^/]+)/)?.[1],
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const tenantId = typeof window !== "undefined" ? localStorage.getItem("openzorg_tenant_id") ?? "" : "";
      const token = typeof window !== "undefined" ? localStorage.getItem("openzorg_token") ?? "" : "";

      const history = messages.slice(-18).map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ecd/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId,
          "X-User-Role": getUserRole(),
        },
        body: JSON.stringify({ message: msg, context, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI niet bereikbaar" }));
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Fout: ${(err as Record<string, string>).error ?? "Onbekende fout"}. ${(err as Record<string, string>).hint ?? ""}`,
          };
          return updated;
        });
        setStreaming(false);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setStreaming(false);
        return;
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data) as { chunk?: string; done?: boolean };
            if (parsed.chunk) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.chunk };
                }
                return updated;
              });
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Fout: ${err instanceof Error ? err.message : "Kan AI niet bereiken"}`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, context]);

  if (!open) return null;

  return (
    <div className="w-[350px] shrink-0 border-l border-default bg-raised flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-default">
        <div>
          <h2 className="text-sm font-semibold text-fg">AI Assistent</h2>
          {context.clientId && (
            <p className="text-xs text-fg-subtle">Context: cliënt dossier</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMessages([])}
            className="text-xs text-fg-subtle hover:text-fg"
            title="Nieuw gesprek"
          >
            Wissen
          </button>
          <button onClick={onClose} className="text-fg-muted hover:text-fg text-lg leading-none">&times;</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-fg-subtle py-8">
            <p className="font-medium">Stel een vraag</p>
            <p className="mt-2 text-xs">
              Bijvoorbeeld: &quot;Wie is deze cliënt?&quot;, &quot;Hoe maak ik een validatieregel?&quot;, &quot;Welke medicatie gebruikt deze cliënt?&quot;
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-sunken text-fg"
              }`}
            >
              {msg.role === "assistant" && msg.content === "" && streaming ? (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle animate-bounce [animation-delay:0.1s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle animate-bounce [animation-delay:0.2s]" />
                </span>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-default px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Stel een vraag..."
            disabled={streaming}
            className="flex-1 rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hook to check if AI chat is available for the current user. */
export function useAiChatAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const role = getUserRole() as OpenZorgRole;
    const perms = ROLE_PERMISSIONS[role] ?? [];
    if (!perms.includes("ai-chat:read")) {
      setAvailable(false);
      return;
    }
    // Check if tenant has AI enabled
    ecdFetch<{ enabled: boolean }>("/api/admin/ai-settings").then(({ data }) => {
      setAvailable(data?.enabled ?? false);
    });
  }, []);

  return available;
}
```

- [ ] **Step 7.2: Mount ChatPanel in AppShell**

In `apps/web/src/components/AppShell.tsx`:

**Add import at top:**
```typescript
import { ChatPanel, useAiChatAvailable } from "./ChatPanel";
```

**Add state inside the AppShell component** (after existing state declarations around line 108):
```typescript
const [chatOpen, setChatOpen] = useState(false);
const aiAvailable = useAiChatAvailable();
```

**Add chat icon in the top bar**, before the User section (around line 376, before `{/* User */}`):

```typescript
          {/* AI Chat toggle */}
          {aiAvailable && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`p-2 rounded-lg transition-colors ${chatOpen ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300" : "text-fg-muted hover:text-fg hover:bg-sunken"}`}
              title="AI Assistent (Ctrl+.)"
            >
              <IconChat className="w-5 h-5" />
            </button>
          )}
```

**Modify the main content area** to include ChatPanel. Find the structure around line 400:

```typescript
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
```

Replace with:

```typescript
        {/* Page content + chat panel */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        </div>
```

**Add keyboard shortcut** (add this `useEffect` after the existing ones in AppShell):

```typescript
  // Ctrl+. to toggle AI chat
  useEffect(() => {
    if (!aiAvailable) return;
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === ".") {
        e.preventDefault();
        setChatOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [aiAvailable]);
```

**Add IconChat SVG** at the bottom with the other icons:

```typescript
function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
```

- [ ] **Step 7.3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 7.4: Commit**

```bash
git add apps/web/src/components/ChatPanel.tsx apps/web/src/components/AppShell.tsx
git commit -m "feat(ai): ChatPanel zijpaneel met streaming + context-aware chat"
```

---

## Task 8: Verify and deploy

- [ ] **Step 8.1: Full check**

```bash
pnpm check-all
```

Expected: exit 0.

- [ ] **Step 8.2: Push and rebuild**

```bash
git push
ssh root@192.168.1.10 "cd /mnt/user/appdata/openzorg && git pull && docker compose -f docker-compose.unraid.yml up -d --build ecd web"
```

- [ ] **Step 8.3: Manual verification**

1. Login als tenant-admin → "Systeem" → "AI Instellingen" zichtbaar
2. Vul Ollama URL in → klik "Verbinding testen" → groen resultaat
3. Schakel AI in → opslaan
4. Ga naar een cliëntdossier → chat-icoon verschijnt in top-bar
5. Open chat → stel vraag "Wie is deze cliënt?" → antwoord met cliëntgegevens
6. Stel vraag "Hoe maak ik een validatieregel?" → antwoord met instructies
7. Login als planner → geen chat-icoon (geen ai-chat:read permissie)

- [ ] **Step 8.4: Commit verification**

```bash
git commit --allow-empty -m "chore: AI chat assistent verified and deployed"
```

---

## Risks

1. **Hono streamSSE compatibility** — verify that `hono/streaming` works with the current Hono version. If not, fall back to raw Response with ReadableStream.
2. **Ollama CORS** — if the tenant URL points to a different host, the frontend proxy route must forward the request (it already does via `/api/ecd/*` proxy).
3. **Token budget** — the system prompt (2000) + wiki (500) + client (500) + history (variable) may exceed small model context windows. The 18-message history limit and 2048 max_tokens help.
4. **ecdFetch in ChatPanel** — the ChatPanel uses raw `fetch` instead of `ecdFetch` for SSE streaming since `ecdFetch` wraps JSON parsing. This is intentional.
