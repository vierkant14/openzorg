# AI Chat Assistent + Configuratie

> **Status:** Approved 2026-04-16
> **Branch:** plan-2a-execute

## Problem

OpenZorg heeft een Ollama-backend maar geen manier voor:
1. Tenant admins om de AI-verbinding te configureren (URL, model, aan/uit)
2. Gebruikers om contextbewuste vragen te stellen vanuit de applicatie

De AI samenvatting-knop op rapportages is een eerste stap, maar gebruikers willen vragen kunnen stellen over cliënten, taken, instellingen en de applicatie zelf.

## Solution

Twee onderdelen:
- **Spec A:** Admin-pagina voor AI configuratie (tenant admin)
- **Spec B:** Contextbewuste chat-assistent als zijpaneel

## Design Decisions

1. **Zijpaneel (slide-in rechts)** — gebruiker ziet de huidige pagina naast de chat, essentieel als de AI antwoorden geeft over wat op het scherm staat.
2. **Read-only v1** — AI beantwoordt vragen en geeft instructies. Geen acties uitvoeren (rapportage aanmaken, afspraak plannen). Actie-framework is v2.
3. **Drie-laags context** — vaste OpenZorg-kennis + dynamische wiki-sectie + cliënt-FHIR-data. Betrouwbaar en schaalbaar.
4. **Ollama lokaal** — data verlaat nooit het netwerk. NEN 7513 audit op elke interactie.
5. **Per-tenant configureerbaar** — elke organisatie kiest eigen model en URL (eigen GPU, eigen keuze).

---

## Spec A: AI Configuratie

### Admin-pagina

**Route:** `/admin/ai-instellingen` (onder "Systeem" nav sectie, tenant-admin only)

**Velden:**
- **AI inschakelen** — toggle (aan/uit voor de hele tenant)
- **Ollama URL** — text input, default `http://host.docker.internal:11434`. Placeholder: "bv. http://192.168.1.20:11434"
- **Model** — dropdown, gevuld via `GET /api/ai/models` (haalt beschikbare modellen op van de geconfigureerde Ollama URL). Fallback: vrij tekstveld als de URL niet bereikbaar is.
- **Verbinding testen** — knop die `GET /api/ai/health` aanroept en groen/rood feedback toont
- **Standaard system prompt aanvulling** — textarea (optioneel). Tenant kan eigen context toevoegen aan de system prompt, bv. "Wij zijn een thuiszorgorganisatie in regio Utrecht met focus op dementiezorg."

### Opslag

Bestaande `openzorg.tenant_configurations` tabel:

```json
{
  "config_type": "ai_settings",
  "config_data": {
    "enabled": true,
    "ollamaUrl": "http://192.168.1.20:11434",
    "model": "gemma3:4b",
    "tenantPrompt": "Wij zijn Zorggroep Horizon..."
  }
}
```

### Backend

- `GET /api/admin/ai-settings` — lees huidige configuratie
- `PUT /api/admin/ai-settings` — update configuratie
- `POST /api/admin/ai-settings/test` — test verbinding met de geconfigureerde URL + model

De bestaande `getTenantModel()` functie in `services/ecd/src/routes/ai.ts` wordt uitgebreid naar `getTenantAiSettings()` die alle velden retourneert. De `OLLAMA_BASE_URL` uit env vars wordt de fallback als de tenant geen custom URL heeft.

### Permissie

Nieuwe permission: `ai-config:read` / `ai-config:write`. Alleen `tenant-admin` krijgt deze.

### Route permission entry

```typescript
{ pattern: "/api/admin/ai-settings", GET: "ai-config:read", PUT: "ai-config:write", POST: "ai-config:write" }
```

### Nav entry

Onder "Systeem" sectie in AppShell:
```typescript
{ href: "/admin/ai-instellingen", label: "AI Instellingen", icon: IconBrain, permission: "ai-config:read" }
```

---

## Spec B: AI Chat Assistent

### Architectuur

```
[ChatPanel (React, zijpaneel)]
    ↓ POST /api/ai/chat (SSE stream)
[ECD service — ai.ts]
    → getTenantAiSettings() → Ollama URL + model
    → buildSystemPrompt()
        → Laag 1: vaste OpenZorg kennis (~2000 tokens)
        → Laag 2: wiki-sectie match op vraag (~500 tokens)
        → Laag 3: cliënt FHIR-data als clientId aanwezig (~500 tokens)
    → ollamaChat() met streaming
    → audit_log: gebruiker, prompt-hash, model, duur
    ↓ SSE chunks terug naar frontend
[ChatPanel rendert streaming Markdown]
```

### Frontend: ChatPanel component

**Bestand:** `apps/web/src/components/ChatPanel.tsx`

**Trigger:** Chat-icoon in de top-bar van AppShell (naast gebruikersnaam/logout). Icoon is alleen zichtbaar als:
1. De tenant AI heeft ingeschakeld (`ai_settings.enabled === true`)
2. De gebruiker de `ai-chat:read` permissie heeft

**Gedrag:**
- Klik op icoon → paneel schuift in van rechts (350px breed, volle hoogte)
- Klik op icoon als paneel open is → paneel sluit
- Keyboard shortcut: `Ctrl+.` opent/sluit het paneel
- Paneel overlapt de pagina-content NIET — de main content krimpt om ruimte te maken (flexbox)

**Chat UI:**
- Berichten-lijst (user rechts, assistent links, Markdown rendered)
- Input-veld onderaan met submit-knop en Enter-to-send
- "Laden..." indicator met typing-animatie tijdens streaming
- Conversatie-historie blijft binnen de sessie (page navigatie behoudt de chat)
- "Nieuw gesprek" knop bovenaan om historie te wissen
- Maximaal 20 berichten in historie (oudste vallen weg)

**Context meegeven:**
Het ChatPanel leest automatisch de huidige pagina-context:
- `pathname` (van Next.js `usePathname()`)
- `clientId` (als de URL `/ecd/[id]/...` matcht, extract het ID)
- `tab` (het laatste segment van de URL als je in een cliënt-dossier zit)

Deze context wordt meegestuurd met elk bericht.

### Backend: POST /api/ai/chat

**Request:**
```typescript
interface ChatRequest {
  message: string;
  context: {
    page: string;        // "/ecd/abc-123/medicatie"
    clientId?: string;   // "abc-123"
    tab?: string;        // "medicatie"
  };
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}
```

**Response:** Server-Sent Events (SSE) stream:
```
data: {"chunk": "De cliënt"}
data: {"chunk": " heeft"}
data: {"chunk": " de volgende"}
data: {"chunk": " allergieën: ..."}
data: {"done": true}
```

**System prompt opbouw — drie lagen:**

**Laag 1: Vaste OpenZorg kennis (altijd meegegeven)**

Een statisch bestand `services/ecd/src/lib/ai-system-prompt.ts` met:
- Wat OpenZorg is (VVT-platform, FHIR R4, multi-tenant)
- Modulelijst: Cliënten, Zorgplan, Rapportages, Medicatie, Planning, Workflows, etc.
- Navigatie-uitleg: waar vind je wat, welke rollen zien wat
- FHIR-basisconcepten: Patient = cliënt, CarePlan = zorgplan, etc.
- Hoe validatieregels werken (drie lagen: kern, uitbreiding, plugin)
- Hoe state-machines werken (traject-status, transities)
- Hoe workflows werken (BPMN canvas, templates, werkbak)
- Veelgestelde vragen en antwoorden

Formaat: plain text, ~2000 tokens. Wordt als `system` message meegegeven aan Ollama.

**Laag 2: Wiki-sectie (dynamisch, op basis van vraag)**

De backend haalt alle wiki-secties op (of cached ze). Op basis van keyword-match tussen de vraag en wiki-sectie-titels wordt de meest relevante sectie toegevoegd aan de system prompt. Maximaal 1 sectie (~500 tokens).

Fallback: als geen match → laag 2 wordt overgeslagen.

**Laag 3: Cliënt FHIR-data (als clientId aanwezig)**

Als de context een `clientId` bevat, haalt de backend op:
- `Patient/{id}` → naam, BSN, geboortedatum, geslacht, adres
- `AllergyIntolerance?patient={id}&clinical-status=active` → actieve allergieën
- `MedicationRequest?patient={id}&status=active` → actieve medicatie
- `CarePlan?subject=Patient/{id}&status=active` → actief zorgplan + doelen
- `Flag?patient={id}&status=active` → actieve signaleringen

Samengevat als structured text in de system prompt (~500 tokens). Voorbeeld:

```
Cliënt: Wilhelmina Jansen (BSN: 123456789), geb. 1942-03-15, vrouw
Allergieën: Penicilline (hoog risico), Lactose (laag risico)
Medicatie: Paracetamol 500mg 3x daags, Metformine 500mg 2x daags
Zorgplan: "Zorgplan mevrouw Jansen" (actief), 3 doelen: mobiliteit, voeding, sociale participatie
Signaleringen: Valrisico (hoog)
```

### FHIR data ophalen

De backend gebruikt de bestaande `medplumFetch()` functie met de auth token van de gebruiker. Hierdoor respecteert het:
- Tenant-isolatie (Medplum Project scope)
- RBAC (gebruiker kan alleen zien wat hun rol toestaat)

### Audit logging

Elke chat-interactie wordt gelogd naar `openzorg.audit_log`:
- `action`: "ai.chat"
- `user_id`: de ingelogde gebruiker
- `resource_type`: "AI-Chat"
- `resource_id`: clientId (als aanwezig, anders null)
- `details`: `{ model, promptTokens, responseTokens, durationMs, questionHash }` — de vraag zelf wordt gehasht (SHA-256), niet plain opgeslagen, tenzij de tenant dit expliciet aanzet in ai_settings.

### Permissie

Nieuwe permission: `ai-chat:read`. Standaard-toewijzing:
- `tenant-admin`: ja
- `beheerder`: ja
- `teamleider`: ja
- `zorgmedewerker`: ja
- `planner`: nee (geen cliënt-context, beperkt nut)

### Streaming

Ollama ondersteunt native streaming via `"stream": true` in de chat API. De ECD service zet dit door als SSE naar de frontend. De frontend rendert chunks incrementeel.

De bestaande `ollamaChat()` functie in `services/ecd/src/lib/ollama-client.ts` moet worden uitgebreid met een streaming variant `ollamaChatStream()` die een `ReadableStream` retourneert.

### Voorbeeldinteracties

| Vraag | Context | Antwoord gebruikt |
|-------|---------|-------------------|
| "Wie is deze cliënt?" | clientId aanwezig | Laag 3 (FHIR Patient) |
| "Welke allergieën heeft deze cliënt?" | clientId aanwezig | Laag 3 (AllergyIntolerance) |
| "Hoe maak ik een validatieregel?" | admin/validatie pagina | Laag 1 (vaste kennis) + Laag 2 (wiki) |
| "Wat is een state-machine?" | geen specifieke context | Laag 1 (vaste kennis) |
| "Welke taken staan open?" | werkbak pagina | Laag 1 + eventueel API call naar taken |
| "Wat betekent SMART bij doelen?" | zorgplan pagina | Laag 1 (vaste kennis) |

### Niet in scope (v2)

- Acties uitvoeren (rapportage aanmaken, afspraak plannen)
- Persistent chat-historie (over sessies heen)
- Multi-cliënt vragen ("vergelijk medicatie van cliënt A en B")
- Voice input
- RAG over documenten (PDFs in het dossier)

---

## Files to create/modify

### Spec A (Configuratie)
- Create: `apps/web/src/app/admin/ai-instellingen/page.tsx`
- Modify: `services/ecd/src/routes/ai.ts` — add settings CRUD endpoints
- Modify: `services/ecd/src/lib/ollama-client.ts` — use tenant URL override
- Modify: `packages/shared-domain/src/roles.ts` — add `ai-config:read/write` permissions
- Modify: `apps/web/src/components/AppShell.tsx` — add nav entry under Systeem

### Spec B (Chat Assistent)
- Create: `apps/web/src/components/ChatPanel.tsx`
- Create: `services/ecd/src/lib/ai-system-prompt.ts`
- Modify: `services/ecd/src/routes/ai.ts` — add `/api/ai/chat` SSE endpoint
- Modify: `services/ecd/src/lib/ollama-client.ts` — add `ollamaChatStream()`
- Modify: `packages/shared-domain/src/roles.ts` — add `ai-chat:read` permission
- Modify: `apps/web/src/components/AppShell.tsx` — add chat icon in top-bar

## Risks

1. **Ollama performance** — grote modellen (13B+) kunnen traag zijn zonder goede GPU. Mitigatie: streaming maakt de wachttijd draaglijk, en tenant admin kiest het model.
2. **FHIR data te groot voor context window** — een cliënt met 50 medicatievoorschriften past niet in 500 tokens. Mitigatie: limiteer tot top 10 actieve items per resource type.
3. **Hallucinatie** — de AI kan verkeerde info geven over een cliënt. Mitigatie: system prompt benadrukt "antwoord alleen op basis van de aangeleverde data, zeg eerlijk als je het niet weet". Plus audit trail.
4. **Wiki nog niet compleet** — laag 2 is afhankelijk van wiki-content. Mitigatie: laag 1 (vaste kennis) vangt de meeste vragen. Wiki-integratie is een bonus.
