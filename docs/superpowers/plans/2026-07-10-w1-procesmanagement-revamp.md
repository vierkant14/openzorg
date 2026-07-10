# W1 — Procesmanagement-revamp: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De proces-keten (Flowable-bridge → werkbak → beheer-UI) van aantoonbaar kapot naar aantoonbaar werkend en verkoopbaar: fail-closed tenant-isolatie, persoonlijke identiteit, één proces-catalogus, werkbak- en Processen-hub-revamp in domeintaal, en een E2E-test die de hele keten bewijst.

**Architecture:** Zes opeenvolgende PR's (W1-1 … W1-6), elk zelfstandig mergebaar met groene CI. Backend eerst (isolatie → identiteit → catalogus), daarna UI (werkbak → hub), daarna keten-reparaties en het E2E-bewijs. Flowable krijgt per-tenant-deployments (native `tenantId` = Medplum project-ID); "een zorgpad activeren" in de UI = de template voor déze tenant deployen. FHIR-Tasks blijven een tweede taakbron met eigen claim/complete-routes in de ECD-service.

**Tech Stack:** Hono (bridge + ECD), Flowable REST 7.1 (`flowable/flowable-rest:7.1.0`), Medplum FHIR R4, Next.js 15 App Router, `@openzorg/shared-ui` patroonlaag, Vitest, Playwright (CI draait de volledige Docker-stack).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-10-verkoopbare-mvp-vvt-thuiszorg-design.md` (§4 is het ontwerp dat dit plan implementeert).
- Alle UI-teksten Nederlands; domeintaal ("zorgpad activeren"), geen engine-jargon buiten "Geavanceerd".
- Design-systeem verplicht: semantische tokens (`bg-page`/`bg-raised`/`text-fg`/`border-default`), patroonlaag `PageHeader`/`Section`/`EmptyState`/`ErrorState`/`LoadingSkeleton` uit `@openzorg/shared-ui`. Nooit `alert()`/`confirm()`.
- TypeScript strict; `no-explicit-any`; ongebruikte parameters prefixen met `_`. Import-volgorde ESLint-conform (builtin → external → internal → parent → sibling → index, alfabetisch).
- Verboden woorden (CI): geen concurrent-namen in code/docs.
- Windows-omgeving: voor élk pnpm-commando eerst `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` (PowerShell). Geen lokale Docker: stack-verificatie via CI (E2E-job) of Unraid-staging indien bereikbaar.
- Per PR: `pnpm typecheck && pnpm lint && pnpm test` lokaal groen vóór push; CI (incl. E2E-job) groen vóór merge; branch vanaf actuele `main`.
- Commits eindigen met `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Route-mount-volgorde in Hono: specifieke routes vóór `/:id`-catch-alls.
- Eerlijkheidsregel + timebox: twijfelitems (DMN-save, herindicatie-timer) max één dagdeel; anders uitzetten met roadmap-label (spec §4.5).

## Bestandskaart (wat raakt dit plan)

```
services/workflow-bridge/src/
  middleware/auth.ts          NIEUW   token-verificatie via Medplum + tenant-crosscheck
  middleware/tenant.ts        WIJZIG  blijft, maar ná auth in de keten
  lib/flowable-client.ts      WIJZIG  tenant-native API, claim/unclaim, instanties, cancel
  lib/proces-catalogus.ts     NIEUW   Laag-1 catalogus (bron van waarheid) + Laag-2 merge
  routes/taken.ts             WIJZIG  scope-API (mijn/beschikbaar/alle), persoon-claims, unclaim
  routes/processen.ts         WIJZIG  per-tenant deploy/start, ensure-deployed, cancel, definities-per-tenant
  routes/catalogus.ts         NIEUW   GET /api/catalogus(/:key) met effectieve formuliervelden
  routes/bpmn-templates.ts    WIJZIG  DI-generator toegepast op alle 5 templates
  lib/bpmn-di.ts              NIEUW   lineaire DI-generator
  __tests__/*.test.ts         NIEUW   route- en client-tests
services/ecd/src/
  routes/me.ts                NIEUW   GET /api/me (identiteitslaag)
  routes/fhir-taken.ts        NIEUW   POST /api/fhir-taken/:id/claim|complete (+ GET verhuist hierheen)
  routes/zorgplan.ts          WIJZIG  GET /api/fhir-taken verhuist naar fhir-taken.ts
  lib/timer-service.ts        WIJZIG  header-fix, variabelen-fix, idempotentie
  app.ts                      WIJZIG  nieuwe routes mounten (vóór catch-alls)
apps/web/src/
  lib/api.ts                  WIJZIG  X-User-Id meesturen, sessie-uitbreiding, haalMe()
  lib/workflow-api.ts         WIJZIG  X-User-Id + X-User-Role meesturen
  app/login/page.tsx          WIJZIG  /api/me na token; serverrol wint; demo-fallback-markering
  app/werkbak/                HERBOUW page.tsx (dun) + useWerkbak.ts + TaakKaart.tsx + TaakFormulier.tsx
  app/admin/workflows/        HERBOUW page.tsx (hub met tabs) + components/{ProcessenActief,SjablonenGalerij,LopendeZorgpaden,GeavanceerdPaneel}.tsx
  app/admin/workflows/instanties/page.tsx   WIJZIG redirect naar hub-tab "lopend"
  app/admin/workflows/voorbeelden/page.tsx  WIJZIG redirect naar hub-tab "sjablonen"
  app/admin/workflows/canvas/page.tsx       WIJZIG deploy-identiteit, dode velden weg, workflowFetch
  app/admin/task-form-options/page.tsx      WIJZIG catalogus-gedreven + patroonlaag
  app/admin/state-machines/page.tsx         WIJZIG patroonlaag, rollen uit shared-domain, guard-label
  components/werkruimtes.ts   WIJZIG  Werkbak-nav-item in vandaag/rooster/team
  components/AppShell.tsx     WIJZIG  icoon "werkbak" toevoegen aan icon-map
  tests/e2e/proces-keten.spec.ts  NIEUW  keten-bewijs
  tests/e2e/fhir-taak.spec.ts     NIEUW  FHIR-taakbron-bewijs
infra/scripts/seed-processen.sh   NIEUW  demo-zorgpaden + lopende instanties per tenant
```

---

# Fase W1-1 — Bridge-hardening (branch `feat/w1-bridge-hardening`)

### Task 1: Spike — Flowable per-tenant gedrag verifiëren (timebox: 1 uur)

**Files:**
- Create: `services/workflow-bridge/src/__tests__/SPIKE-tenant-notes.md` (wordt vóór merge verwijderd; alleen werkdocument)

**Waarom eerst:** het hele W1-1-ontwerp hangt op drie Flowable-REST-aannames. Verifieer ze tegen een draaiende Flowable vóór de rest wordt gebouwd. Zonder lokale Docker: push de branch met alleen deze spike-test als tijdelijke CI-verkenning, of draai tegen Unraid-staging (`http://192.168.1.10:18080/flowable-rest`) als die bereikbaar is.

- [ ] **Step 1:** Verifieer met drie curl-achtige calls (of een tijdelijke vitest-test die alleen bij aanwezigheid van `FLOWABLE_SPIKE=1` draait):
  1. Deployment mét tenant: `POST /service/repository/deployments` (multipart, extra form-veld `tenantId=tenant-a`) → response bevat `tenantId: "tenant-a"`.
  2. Start binnen tenant: `POST /service/runtime/process-instances` body `{"processDefinitionKey":"<key>","tenantId":"tenant-a"}` → instance krijgt `tenantId: "tenant-a"`; zelfde start met `tenantId:"tenant-b"` faalt zolang de definitie daar niet deployed is (verwacht 404-achtige fout).
  3. Query's filteren native: `GET /service/runtime/tasks?tenantId=tenant-a` en `GET /service/runtime/process-instances?tenantId=tenant-a` retourneren alleen tenant-a-items; taken hebben zelf een `tenantId`-veld in de response.
- [ ] **Step 2:** Noteer de exacte request/response-vormen in het spike-document. Wijkt gedrag af (bv. form-veldnaam anders), pas Task 2-4 daarop aan vóór implementatie.

### Task 2: `flowable-client.ts` — tenant-native API

**Files:**
- Modify: `services/workflow-bridge/src/lib/flowable-client.ts`
- Test: `services/workflow-bridge/src/__tests__/flowable-client.test.ts` (uitbreiden; bestaand bestand test alleen de Basic-auth-header)

**Interfaces (Produces — dit is het contract voor Task 4, 5 en Fase W1-3/4):**
```ts
export interface FlowableTaak {
  id: string; name: string; description?: string; assignee?: string | null;
  createTime: string; dueDate?: string | null; tenantId?: string;
  processInstanceId?: string; processDefinitionId?: string; taskDefinitionKey?: string;
  variables?: Array<{ name: string; value: unknown; scope?: string }>;
}
export interface TakenQuery {
  tenantId: string;                       // verplicht — fail-closed
  assignee?: string;                      // practitioner-ID
  candidateGroup?: string;                // rol
  processInstanceId?: string;
}
export async function queryTasks(q: TakenQuery): Promise<FlowableTaak[]>
export async function claimTask(taskId: string, assignee: string): Promise<void>
export async function unclaimTask(taskId: string): Promise<void>          // action:"claim", assignee:null
export async function completeTask(taskId: string, variables?: Record<string, unknown>): Promise<void>  // bestaand, ongewijzigd contract
export async function verifyTaskTenant(taskId: string, tenantId: string): Promise<FlowableTaak>
  // native check: taak.tenantId === tenantId, anders throw. GEEN legacy-fallback meer (fail-closed).
  // retourneert de taakdetails zodat routes geen tweede fetch nodig hebben.
export async function deployProcess(bpmnXml: string, name: string, tenantId: string): Promise<unknown>   // + tenantId form-veld
export async function startProcess(processKey: string, variables: Record<string, unknown> | undefined, tenantId: string): Promise<{ id: string }>
  // body: { processDefinitionKey, tenantId, variables:[{name,value}] } — tenantId óók nog als variabele meegeven (FHIR-context/back-compat)
export async function getProcessDefinitions(tenantId: string): Promise<unknown>   // ?tenantId=… native
export async function getProcessInstances(tenantId: string, processKey?: string): Promise<unknown>
export async function cancelProcessInstance(processInstanceId: string, tenantId: string, reden: string): Promise<void>
  // eerst GET instance → tenant-check → DELETE /service/runtime/process-instances/:id?deleteReason=<reden>
```

- [ ] **Step 1: Schrijf falende tests** voor de nieuwe query-semantiek (mock `global.fetch`; volg het patroon van de bestaande auth-header-test). Minimaal:
```ts
it("queryTasks vereist tenantId en filtert native", async () => {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => { calls.push(String(url));
    return new Response(JSON.stringify({ data: [] }), { status: 200 }); }));
  await queryTasks({ tenantId: "proj-1", candidateGroup: "zorgmedewerker" });
  expect(calls[0]).toContain("tenantId=proj-1");
  expect(calls[0]).toContain("candidateGroup=zorgmedewerker");
});
it("verifyTaskTenant gooit bij tenant-mismatch én bij ontbrekende tenant (fail-closed)", async () => {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ id: "t1", tenantId: "" }), { status: 200 })));
  await expect(verifyTaskTenant("t1", "proj-1")).rejects.toThrow(/tenant/i);
});
it("startProcess stuurt native tenantId én tenant-variabele", async () => {
  let sent: Record<string, unknown> = {};
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body ?? "{}")); return new Response(JSON.stringify({ id: "pi-1" }), { status: 200 }); }));
  await startProcess("intake-proces", { clientRef: "Patient/1" }, "proj-1");
  expect(sent["tenantId"]).toBe("proj-1");
  expect(sent["variables"]).toContainEqual({ name: "tenantId", value: "proj-1" });
});
```
- [ ] **Step 2:** `pnpm --filter @openzorg/service-workflow-bridge test` → nieuwe tests FALEN (functies bestaan niet/oude semantiek).
- [ ] **Step 3:** Implementeer de client conform het contract. `getTasksForUser` verwijderen (vervangen door `queryTasks`); interne merge/dedup verdwijnt — één Flowable-call per query-vorm; de route combineert desgewenst assignee- en candidate-resultaten met `Promise.all`.
- [ ] **Step 4:** Tests groen; `pnpm --filter @openzorg/service-workflow-bridge typecheck`.
- [ ] **Step 5:** Commit: `feat(workflow-bridge): tenant-native Flowable-client, fail-closed isolatie`

### Task 3: Auth-middleware op de bridge

**Files:**
- Create: `services/workflow-bridge/src/middleware/auth.ts`
- Modify: `services/workflow-bridge/src/app.ts` (volgorde: auth → tenant → routes; `/health` blijft open)
- Test: `services/workflow-bridge/src/__tests__/auth-middleware.test.ts`

**Interfaces (Produces):** context-variabelen `c.get("userId")` (Medplum profile-reference, bv. `Practitioner/abc`), `c.get("projectId")`. `AppEnv` in `app.ts` uitbreiden: `Variables: { tenantId: string; userId: string; projectId: string }`.

Gedrag: `Authorization: Bearer <token>` verplicht (anders 401). Verifieer het token met `GET {MEDPLUM_BASE_URL}/auth/me` (met dat token); cache het resultaat per token 60 s in een module-level `Map` (max 500 entries, oudste eruit). Cross-check: `X-Tenant-ID`-header moet gelijk zijn aan het project-ID uit auth/me (anders 403 "Tenant komt niet overeen met token"). Medplum onbereikbaar → 503. `MEDPLUM_BASE_URL` default `http://localhost:8103` (zelfde als ECD).

- [ ] **Step 1: Falende tests** (Hono `app.request()`, gemockte fetch):
```ts
it("weigert zonder Authorization-header", async () => {
  const res = await app.request("/api/taken?scope=mijn", { headers: { "X-Tenant-ID": "p1" } });
  expect(res.status).toBe(401);
});
it("weigert wanneer X-Tenant-ID niet bij het token-project hoort", async () => {
  mockAuthMe({ project: { reference: "Project/p1" }, profile: { reference: "Practitioner/u1" } });
  const res = await app.request("/api/taken?scope=mijn", { headers: { Authorization: "Bearer t", "X-Tenant-ID": "ander-project" } });
  expect(res.status).toBe(403);
});
it("zet userId en projectId op de context bij geldig token", /* 200-pad met gemockte flowable */);
```
- [ ] **Step 2:** Tests falen. **Step 3:** Implementeer middleware + app-wiring. **Step 4:** Tests groen. Let op: bestaande route-tests krijgen een `mockAuthMe`-helper in `__tests__/helpers.ts`.
- [ ] **Step 5:** Commit: `feat(workflow-bridge): token-verificatie + tenant-crosscheck via Medplum`

### Task 4: Taken-route — scope-API met persoons-identiteit

**Files:**
- Modify: `services/workflow-bridge/src/routes/taken.ts`
- Test: `services/workflow-bridge/src/__tests__/taken-route.test.ts`

**Interfaces (Produces — frontend-contract voor W1-3):**
- `GET /api/taken?scope=mijn|beschikbaar|alle` → `{ data: FlowableTaak[], total: number }`
  - `mijn` = `queryTasks({tenantId, assignee: userId})`
  - `beschikbaar` = `queryTasks({tenantId, candidateGroup: role})` gefilterd op `!assignee`
  - `alle` = `queryTasks({tenantId})` — alleen voor rollen teamleider/beheerder/tenant-admin (anders 403); dit vervangt de oude sequentiële 5-rollen-lus
- `GET /api/taken?processInstanceId=<id>` → taken van één instantie (tenant-gecheckt) — fixt de instanties-detailweergave
- `POST /api/taken/:id/claim` (géén body nodig) → claimt op `c.get("userId")`; audit met persoon
- `POST /api/taken/:id/unclaim` → geeft taak terug aan de groep; audit
- `POST /api/taken/:id/complete` body `{ variables? }` → ongewijzigd extern, maar audit-userId = context-userId, en `verifyTaskTenant` levert de details (geen dubbele fetch)
- De rol komt uit header `X-User-Role`; identiteit uit context (Task 3). Query-param `userId` bestaat niet meer (alle aanroepers worden in W1-3/4 aangepast; de oude admin-workflows-"Taakwerkbak" verdwijnt).

- [ ] **Step 1: Falende route-tests** — minimaal: scope=mijn gebruikt context-userId; scope=alle geeft 403 voor zorgmedewerker; processInstanceId-query werkt; claim zonder body claimt op context-userId en schrijft audit met die persoon (mock `writeWorkflowAudit`, assert argument).
- [ ] **Step 2:** Falen. **Step 3:** Implementeren. **Step 4:** Groen + typecheck.
- [ ] **Step 5:** Commit: `feat(workflow-bridge): scope-taken-API met persoonlijke claims en instantie-filter`

### Task 5: Processen-route — per-tenant deploy/start/instanties/cancel + env-hardening

**Files:**
- Modify: `services/workflow-bridge/src/routes/processen.ts`, `services/workflow-bridge/src/lib/flowable-client.ts` (alleen indien spike afwijkingen gaf), `infra/compose/docker-compose.yml` + `docker-compose.unraid.yml` (FLOWABLE_ADMIN_USER/PASSWORD expliciet als env door naar de bridge; prod-compose heeft ze al)
- Test: `services/workflow-bridge/src/__tests__/processen-route.test.ts`

**Interfaces (Produces):**
- `GET /api/processen` → definities van déze tenant (native filter)
- `POST /api/processen/deploy` body `{ xml, name }` → deployt binnen tenant
- `POST /api/processen/:key/start` body `{ variables? }` → start binnen tenant; **ensure-deployed**: bij Flowable-fout die op ontbrekende definitie duidt (statusbericht bevat `no processes deployed with key`), en de key bestaat in de template-registry (`getTemplateById` in `bpmn-templates.ts`), dan eerst `deployProcess(templateXml, key, tenantId)` + audit `workflow.task.deploy`, daarna één retry van de start
- `GET /api/processen/:key/instances` en nieuw `GET /api/processen/instances` (alle lopende van de tenant, voor de "Lopend"-tab)
- `DELETE /api/processen/instances/:id` body `{ reden }` → `cancelProcessInstance` + audit-actie `workflow.instance.cancel` (voeg toe aan het `WorkflowAuditEntry["action"]`-union in `lib/audit.ts`)
- Flowable-credentials: bij opstart een `console.warn` wanneer user/password op de `admin`-default staan; compose-bestanden zetten ze expliciet zodat de default alleen nog een lokale-dev-vangnet is.

- [ ] **Step 1: Falende tests**: start-zonder-definitie triggert deploy+retry (mock flowableFetch-sequentie: eerst 404-throw met die boodschap, dan deploy-OK, dan start-OK); cancel verifieert tenant vóór delete; GET-definities stuurt tenantId-param mee.
- [ ] **Step 2:** Falen. **Step 3:** Implementeren. **Step 4:** Groen. **Step 5:** Commit: `feat(workflow-bridge): per-tenant zorgpaden met ensure-deployed en annuleren`
- [ ] **Step 6 (PR-afronding W1-1):** Spike-notities verwijderen, `pnpm typecheck && pnpm lint && pnpm test`, push, PR openen met verwijzing naar spec §4.3, CI groen afwachten (E2E-job bewijst dat bestaande flows niet breken), mergen.

---

# Fase W1-2 — Identiteitslaag `/api/me` (branch `feat/w1-identiteit`)

### Task 6: ECD-route `GET /api/me`

**Files:**
- Create: `services/ecd/src/routes/me.ts`
- Modify: `services/ecd/src/app.ts` (mount `meRoutes` op `/api` — vóór eventuele catch-alls)
- Test: `services/ecd/src/__tests__/me.test.ts`

**Interfaces (Produces — frontend-contract):**
```ts
// GET /api/me →
interface MeResponse {
  practitionerId: string | null;    // "abc-123" (zonder "Practitioner/"-prefix) of null
  naam: string | null;              // Practitioner.name[0] geformatteerd "Voornaam Achternaam"
  rol: OpenZorgRole | null;         // uit Practitioner-extension https://openzorg.nl/extensions/rol
  projectId: string | null;         // Medplum project-ID (= tenant)
}
```
Implementatie: `medplumFetch(c, "/auth/me")` → `{ profile, project }`. Is `profile.resourceType === "Practitioner"`, haal dan de volledige Practitioner op (`/fhir/R4/Practitioner/:id`) voor naam + rol-extensie. Geen Practitioner-profiel (bv. super-admin) → alle velden null behalve projectId. Rol-extensie: `extension[url=https://openzorg.nl/extensions/rol].valueCode`, gevalideerd tegen `OpenZorgRole`-union uit `@openzorg/shared-domain` (ongeldig → null). Geen ROUTE_PERMISSIONS-entry nodig (route is voor elke ingelogde rol; tenant- en audit-middleware gelden gewoon).

- [ ] **Step 1: Falende tests** (mock `medplumFetch` zoals bestaande ECD-route-tests): (a) Practitioner-profiel met rol-extensie → volledige MeResponse; (b) profiel zonder rol-extensie → `rol: null`; (c) auth/me 401 → route geeft 401 door.
- [ ] **Step 2:** Falen. **Step 3:** Implementeren. **Step 4:** Groen. **Step 5:** Commit: `feat(ecd): /api/me — login naar Practitioner + rol (ME-01)`

### Task 7: Frontend-identiteit — sessie, headers, login-flow

**Files:**
- Modify: `apps/web/src/lib/api.ts`, `apps/web/src/lib/workflow-api.ts`, `apps/web/src/app/login/page.tsx`
- Test: geen unit-test-infra voor web (vitest heeft er geen testbestanden); verificatie via typecheck + de E2E-suite in CI (bestaande `auth-helper.spec.ts` + golden path blijven het bewijs dat login werkt)

**Interfaces (Produces):**
```ts
// lib/api.ts
export function setSession(token: string, tenantId: string, role?: string): void        // bestaand
export function setIdentiteit(me: { practitionerId: string | null; naam: string | null; rol: string | null }): void
  // localStorage: openzorg_user_id, openzorg_user_name, openzorg_role (alleen overschrijven als me.rol non-null),
  // openzorg_role_source = "server" | "demo"
export function getUserId(): string | null
export function getRoleSource(): "server" | "demo"
export async function haalMe(): Promise<MeResponse | null>   // ecdFetch("/api/me"), null bij fout
```
- `getAuthHeaders()` in **beide** clients stuurt voortaan ook `X-User-Id` (indien aanwezig) en `X-User-Role`; `clearSession()` ruimt de nieuwe sleutels op.
- Login-flow (`login/page.tsx`): na token-opslag `haalMe()` aanroepen. `me.rol` aanwezig → die rol gebruiken (rol-keuzeveld wordt genegeerd/verborgen bij succes) en `openzorg_role_source=server`; `me.rol` null → bestaande form-rol als fallback en `openzorg_role_source=demo`. In het AppShell-gebruikersblok een klein "demo-rol"-label tonen wanneer source=demo (`apps/web/src/components/AppShell.tsx`).

- [ ] **Step 1:** Implementeer bovenstaand (klein genoeg om zonder aparte falende-test-cyclus te bouwen; het E2E-vangnet dekt de login-flow).
- [ ] **Step 2:** `pnpm typecheck && pnpm lint` groen; push; **CI-E2E moet groen** (bewijst dat login met demo-accounts blijft werken via de fallback).
- [ ] **Step 3:** Commit: `feat(web): identiteitslaag — X-User-Id overal, serverrol wint bij login` → PR → merge.

---

# Fase W1-3 — Proces-catalogus + werkbak-revamp (branch `feat/w1-werkbak`)

### Task 8: Proces-catalogus (bron van waarheid, Laag 1 + Laag 2 server-side)

**Files:**
- Create: `services/workflow-bridge/src/lib/proces-catalogus.ts`, `services/workflow-bridge/src/routes/catalogus.ts`
- Modify: `services/workflow-bridge/src/app.ts` (mount `/api/catalogus`)
- Test: `services/workflow-bridge/src/__tests__/catalogus.test.ts`

**Interfaces (Produces — frontend-contract voor werkbak én hub én taakformulieren):**
```ts
export interface TaakVeld { name: string; label: string; type: "boolean" | "text" | "select" | "number"; options?: Array<{ value: string; label: string }>; verplicht?: boolean }
export interface CatalogusStap { taskKey: string; naam: string; rol: OpenZorgRole; velden: TaakVeld[] }
export interface CatalogusProces {
  key: string;                 // = BPMN process id = template-id (bv. "intake-proces")
  naam: string;                // domeinnaam: "Intake nieuwe cliënt"
  omschrijving: string;        // één zin, gewone taal
  stappen: CatalogusStap[];
  trigger: string;             // gewone taal: "Start automatisch bij een nieuwe cliënt"
}
// GET /api/catalogus            → { processen: CatalogusProces[] }   (velden = Laag1 ⊕ tenant-override uit openzorg.tenant_configurations)
// GET /api/catalogus/:key       → CatalogusProces (404 bij onbekend)
```
Inhoud Laag 1: de vijf processen uit `routes/bpmn-templates.ts` (intake-proces, zorgplan-evaluatie, herindicatie, mic-afhandeling, vaccinatie-campagne). Verplaats de formulier-defaults die nu hardcoded in `apps/web/src/app/werkbak/page.tsx` (`DEFAULT_PROCESS_VARS`, regel 111-134) staan naar deze catalogus, per stap. De stappen/rollen lees je uit de template-XML-generatoren in `bpmn-templates.ts` (userTask-id's + `flowable:candidateGroups`) — leg ze expliciet vast in de catalogus (geen runtime-XML-parsing). Laag-2-merge: lees `openzorg.tenant_configurations` (zelfde tabel/vorm als `services/ecd/src/routes/task-form-options.ts` schrijft; config-key en JSON-vorm exact overnemen uit dat bestand) via de bestaande `pool` uit `lib/db.ts`; override per `processKey.taskKey` vervangt velden met gelijke `name`, voegt nieuwe toe.

- [ ] **Step 1: Falende tests**: (a) catalogus bevat 5 processen en elke stap heeft ≥1 veld; (b) tenant-override op `mic-afhandeling.beoordeel-melding` (voorbeeld: extra optie "middel" op `ernstNiveau`) wint van Laag 1 (mock `pool.query`); (c) onbekende key → 404.
- [ ] **Step 2:** Falen. **Step 3:** Implementeren. **Step 4:** Groen. **Step 5:** Commit: `feat(workflow-bridge): proces-catalogus in domeintaal (Laag 1+2)`

### Task 9: FHIR-taken claim/complete in ECD

**Files:**
- Create: `services/ecd/src/routes/fhir-taken.ts` (GET verhuist uit `zorgplan.ts:829`; + POST-routes)
- Modify: `services/ecd/src/app.ts` (mount vóór catch-alls), `services/ecd/src/routes/zorgplan.ts` (oude GET verwijderen)
- Test: `services/ecd/src/__tests__/fhir-taken.test.ts`

**Interfaces (Produces):**
- `GET /api/fhir-taken` → ongewijzigd contract (Bundle van Task-resources; bestaande werkbak-consument blijft werken tijdens de overgang)
- `POST /api/fhir-taken/:id/claim` → PATCH Task: `owner = { reference: "Practitioner/<X-User-Id>" }`, status `requested→accepted`; 409 als al geclaimd door ander
- `POST /api/fhir-taken/:id/complete` body `{ opmerking?: string }` → status → `completed`, opmerking als `Task.note`; audit via bestaand ECD-audit-middleware
- Beide routes weigeren zonder `X-User-Id`-header (400 met NL-melding)

- [ ] **Step 1: Falende tests** (mock medplumFetch): claim zet owner+status; complete zet status; claim door tweede persoon → 409.
- [ ] **Step 2-4:** TDD-cyclus zoals hierboven. **Step 5:** Commit: `feat(ecd): FHIR-taken claim/complete — werkbak-bron 2 werkend`

### Task 10: Werkbak-herbouw (dunne container + hook + kaart + formulier)

**Files:**
- Create: `apps/web/src/app/werkbak/useWerkbak.ts`, `apps/web/src/app/werkbak/TaakKaart.tsx`, `apps/web/src/app/werkbak/TaakFormulier.tsx`
- Rewrite: `apps/web/src/app/werkbak/page.tsx`
- Modify: `apps/web/src/components/werkruimtes.ts`, `apps/web/src/components/AppShell.tsx` (icon-map + demo-rol-label uit Task 7 als dat nog openstond)

**Interfaces:**
- Consumes: `GET /api/taken?scope=…` (Task 4), `GET /api/catalogus` (Task 8), FHIR-taken-routes (Task 9), `getUserId()/getUserRole()` (Task 7).
- Produces (voor W2-dashboard): `useWerkbak()` retourneert `{ taken: WerkbakTaak[], aantallen: { mijn: number; beschikbaar: number; alle?: number }, laden, fout, herlaad, claim, unclaim, voltooi }`.
```ts
export interface WerkbakTaak {
  id: string; bron: "flowable" | "fhir";
  naam: string; omschrijving?: string;
  processKey: string; procesNaam: string;          // uit catalogus; fhir → processKey "zorgplan-evaluatie-taak", procesNaam "Zorgplan-evaluatie"
  clientRef?: string; clientNaam?: string;          // uit proces-variabelen clientRef/clientNaam of Task.for
  aangemaakt: string; deadline?: string | null;
  assignee?: string | null; assigneeNaam?: string | null;
  taskDefinitionKey?: string;
  velden: TaakVeld[];                               // effectief formulier (catalogus); fhir-taken → [{name:"opmerking",label:"Opmerking",type:"text"}]
}
```
Gedrag/UX (spec §4.4): drie tabs met aantallen-badges — "Mijn taken" / "Beschikbaar" / "Alle taken" (derde alleen voor teamleider/beheerder/tenant-admin); patroonlaag verplicht (PageHeader, LoadingSkeleton, ErrorState met herlaad, EmptyState met positieve toon per tab); taakkaart toont procesNaam-badge, deadline-badge (bestaande `formatDueDate`-urgentielogica overnemen), cliënt als `<Link href={/ecd/${id}}>`, claimer-náám; acties per staat: onbeclaimd → "Oppakken", mijn → "Teruggeven" + "Afronden"; formulier rendert `velden` (boolean → Ja/Nee-knoppen zoals de bestaande implementatie op regel 525-549 — die interactie is goed, behouden; select → keuzelijst; number → numeriek input; verplichte velden blokkeren submit met inline melding). Bron-routing in `voltooi`/`claim`: `bron==="fhir"` → ECD-routes; anders bridge. Fouten inline (ErrorState), nooit `alert()`. Oversight-tab gebruikt één `scope=alle`-call (geen 5-rollen-lus). `filteredTasks`/afgeleiden in `useMemo`.
Navigatie: nieuw icoon-key `"werkbak"` in `WerkruimteIcoon` + SVG in AppShell-icon-map (inbox-tray-vorm); nav-items: `vandaag` krijgt `{ href: "/werkbak", label: "Werkbak", icon: "werkbak", featureFlag: "workflow-engine" }` als 2e item; in `rooster` vervangt Werkbak het item Medewerkers; in `team` vervangt Werkbak het item Cliënten (max-5-regel; vervangen items blijven per IA-principe bereikbaar via URL/sneltoets — genoteerd als open punt 3 in de spec §8).

- [ ] **Step 1:** Bouw hook + componenten + pagina conform bovenstaand contract (states-first: eerst laad/fout/leeg-paden).
- [ ] **Step 2:** `pnpm typecheck && pnpm lint` groen.
- [ ] **Step 3:** Voeg een gerichte Playwright-test toe `apps/web/tests/e2e/werkbak.spec.ts`: inloggen als zorgmedewerker → werkbak opent via nav → tabs zichtbaar → lege-staat of taken-lijst rendert zonder consolefouten (de volle keten-test komt in W1-6; deze test bewijst de pagina zelf).
- [ ] **Step 4:** Push; CI inclusief E2E groen. **Step 5:** Commit: `feat(web): werkbak-revamp — persoonlijke inbox in domeintaal` → PR → merge.

---

# Fase W1-4 — Processen-hub in domeintaal (branch `feat/w1-processen-hub`)

### Task 11: Hub met vier tabs

**Files:**
- Rewrite: `apps/web/src/app/admin/workflows/page.tsx` (dunne container, tab-state via `?tab=`)
- Create: `apps/web/src/app/admin/workflows/components/ProcessenActief.tsx`, `SjablonenGalerij.tsx`, `LopendeZorgpaden.tsx`, `GeavanceerdPaneel.tsx`
- Modify: `apps/web/src/app/admin/workflows/instanties/page.tsx` → `router.replace("/admin/workflows?tab=lopend")`; `apps/web/src/app/admin/workflows/voorbeelden/page.tsx` → `router.replace("/admin/workflows?tab=sjablonen")` (volg het redirect-patroon van `ontwerp/page.tsx`)

**Interfaces:**
- Consumes: `GET /api/catalogus` (naam/omschrijving/stappen/trigger), `GET /api/processen` (gedeployede definities per tenant), `GET /api/processen/instances` + `GET /api/taken?processInstanceId=` (lopend), `POST /api/processen/:key/start`, `DELETE /api/processen/instances/:id`, `POST /api/bpmn-templates/:id/deploy` (bestaand; deployt nu per tenant via Task 5).

Gedrag per tab (alles patroonlaag + domeintaal):
- **Actief** (`ProcessenActief`): kaart per geactiveerd zorgpad — domeinnaam + omschrijving (catalogus-match op key; onbekende keys = eigen canvas-processen, toon key als naam met label "Eigen proces"), versie, aantal lopende instanties (tel uit instances-call), knop "Start proefinstantie" (start met variabele `proef: true`) en "Bekijk stappen" (uitklap: stappen-lijst als verticale genummerde stepper — stap-naam + rol-chip + veldenlijst). Lege staat: "Nog geen zorgpaden actief" + actie naar Sjablonen-tab.
- **Sjablonen** (`SjablonenGalerij`): kaart per catalogus-proces met naam, omschrijving, trigger-zin en stappen-preview; knop **"Activeren"** (i.p.v. "Deployen") → bestaande deploy-endpoint; al-geactiveerd (key in definities) → "Geactiveerd ✓"-staat met versie i.p.v. knop. Dit vervangt de voorbeelden-pagina; de educatieve toelichting (wat is een zorgpad) wordt een korte intro-alinea bovenaan de tab.
- **Lopend** (`LopendeZorgpaden`): tabel/kaarten per instantie — zorgpad-naam, cliënt (variabele `clientNaam`/`clientRef` → link), gestart op, doorlooptijd, huidige stap = taak-naam uit `?processInstanceId=`-call + "wie is aan zet" (assigneeNaam of rol-chip), actie "Annuleren" met reden-formulier (inline, verplichte reden) → DELETE. Lege staat: "Er lopen nu geen zorgpaden".
- **Geavanceerd** (`GeavanceerdPaneel`): korte uitleg + links naar `/admin/workflows/canvas` ("Proces-ontwerper — voor gevorderden") en DMN (afhankelijk van Task 14-besluit), plus de rauwe definitie-tabel (key/versie) die nu op de hoofdpagina staat.
- De oude "Taakwerkbak"-sectie (regel 244-367 van de huidige page.tsx) **verdwijnt volledig**.

- [ ] **Step 1:** Bouw de vier componenten + container (states-first).
- [ ] **Step 2:** typecheck + lint groen; korte Playwright-test `admin-processen.spec.ts`: als beheerder naar Processen via nav → vier tabs → Sjablonen toont 5 kaarten met "Activeren" of "Geactiveerd".
- [ ] **Step 3:** Commit: `feat(web): Processen-hub in domeintaal — activeren, lopend, geavanceerd`

### Task 12: Taakformulieren- en state-machines-pagina normaliseren

**Files:**
- Modify: `apps/web/src/app/admin/task-form-options/page.tsx` — hardcoded `PROCESSES` (regel 21-61) vervangen door `GET /api/catalogus` (keys+stappen+Laag-1-velden als referentie naast de override-editor); patroonlaag; de `…?.length && (…)`-valstrik op regel 209 vervangen door `(x?.length ?? 0) > 0 && (…)`; pagina heet in de UI "Taakformulieren".
- Modify: `apps/web/src/app/admin/state-machines/page.tsx` — `alert()`/`confirm()` weg (inline bevestigingsstaat), `AVAILABLE_ROLES` uit `@openzorg/shared-domain` (`OPENZORG_ROLES`-export; check de exacte export-naam in `packages/shared-domain/src/roles.ts` en gebruik die), guards-veld krijgt zichtbaar label "Informatief — wordt nog niet afgedwongen", patroonlaag-states.

- [ ] **Step 1:** Implementeer beide; typecheck + lint groen.
- [ ] **Step 2:** Commit: `refactor(web): taakformulieren catalogus-gedreven, state-machines genormaliseerd` → PR W1-4 → CI → merge.

---

# Fase W1-5 — Keten-reparaties (branch `feat/w1-keten`)

### Task 13: Timer-service repareren

**Files:**
- Modify: `services/ecd/src/lib/timer-service.ts`
- Test: `services/ecd/src/__tests__/timer-service.test.ts`

Drie bugs fixen (regels 113-131 + aanroep): (1) `X-Tenant-ID`-header ontbreekt; (2) variabelen worden als array door `Object.entries` gehaald → bridge ontvangt keys "0","1"; (3) geen idempotentie → elke run start een duplicaatproces. Oplossing:
- Bepaal per CarePlan het project: Medplum zet `meta.project` op elke resource (super-admin-query levert dat mee via `_project`-compartment; verifieer het exacte veld — `meta.project` — in de bestaande seed-data; alternatief: query per tenant door eerst `openzorg.tenants` te lezen en per `medplum_project_id` te zoeken met `X-Medplum-Project`-scope). Kies de eenvoudigste die aantoonbaar werkt in CI en documenteer de keuze in het bestand.
- `startProcess(processKey, variables: Record<string,unknown>, tenantId)` — stuur `{ variables }` als **Record** (de bridge mapt zelf) en headers `{ "X-Tenant-ID": tenantId, Authorization: Bearer <MEDPLUM_SUPER_ADMIN_TOKEN> }` (de bridge-auth uit Task 3 accepteert het super-admin-token; de tenant-crosscheck moet super-admin toestaan voor élke tenant — regel dit in `auth.ts`: project-ID uit auth/me is bij super-admin de systeemproject-ID; sta expliciet toe wanneer `profile.resourceType !== "Practitioner"` én token super-admin is, gedocumenteerd).
- Idempotentie: na succesvolle start PATCH de CarePlan-extensie `https://openzorg.nl/extensions/evaluatie-gesignaleerd-op = <evalDateStr>`; de check slaat CarePlans over waar die extensie al gelijk is aan de huidige `evalDateStr`.
- Herindicatie-timer (timebox, spec §4.5): implementeer alleen als een enkele Medplum-query op ServiceRequest-einddatums volstaat; anders: verwijder `HERINDICATIE_WARNING_DAYS` + trigger-config-entry en noteer als backlog-item in het overdrachtsrapport.

- [ ] **Step 1: Falende tests**: (a) start-call bevat X-Tenant-ID + Record-variabelen (mock fetch, assert body/headers); (b) tweede run met zelfde evalDate start géén tweede proces (mock CarePlan mét extensie).
- [ ] **Step 2-4:** TDD-cyclus. **Step 5:** Commit: `fix(ecd): timer-service — tenant-header, variabelen en idempotentie`

### Task 14: BPMN-DI-generator + canvas-opschoning + DMN-besluit

**Files:**
- Create: `services/workflow-bridge/src/lib/bpmn-di.ts`
- Modify: `services/workflow-bridge/src/routes/bpmn-templates.ts` (DI toevoegen aan alle 5 template-generatoren), `apps/web/src/app/admin/workflows/canvas/page.tsx`, `apps/web/src/app/admin/workflows/dmn/page.tsx` + `DmnEditor.tsx`
- Test: `services/workflow-bridge/src/__tests__/bpmn-di.test.ts`

**DI-generator (Produces):**
```ts
export interface DiElement { id: string; type: "event" | "task" | "gateway"; }
export interface DiFlow { id: string; from: string; to: string; }
export function genereerLineaireDi(processId: string, elementen: DiElement[], flows: DiFlow[]): string
// Retourneert een <bpmndi:BPMNDiagram>-XML-blok: elementen op één horizontale lijn
// (x = 60 + index*160; event 36×36 op y=100+22, task 100×80 op y=100, gateway 50×50 op y=100+15),
// flows als rechte waypoint-paren tussen elementranden. Vertakkingen (gateway met 2 uitgaande flows):
// tweede tak krijgt y-offset +140 en buigt met een extra waypoint terug.
```
Elke template-generator in `bpmn-templates.ts` roept dit aan met zijn elementen i.p.v. de huidige gedeeltelijke/afwezige DI — daarmee rendert bpmn-js (canvas "Bekijken/Bewerken") en de hub-stepper-fallback netjes (backlog-item "volledige BPMN-DI").

**Canvas-opschoning:** (a) `loadTemplate` (regel 319-323) via `workflowFetch` i.p.v. rauwe fetch zonder auth; (b) deploy-identiteit: de proces-key wordt geparsed uit de XML (`<process id="…">`) en is de énige bron — het naam-invoerveld hernoemt alleen de weergavenaam (`<process name=…>`), en "Test dit proces" start de geparste key (fixt de key/naam-mismatch, regel 367/404); (c) dode velden verwijderen: `formKey`-veld (regel ~772) en event-trigger-select (regel ~896) — vervangen door één infozin die naar Taakformulieren verwijst.

**DMN (timebox één dagdeel):** probeer: `DmnEditor` naar `forwardRef` + save-knop op de pagina → `POST /api/dmn/deploy` (nieuwe bridge-route naar Flowable `/dmn-repository/deployments`, zelfde multipart-patroon als `deployProcess`, bestandsnaam `<naam>.dmn`). Lukt dit niet binnen de timebox: verwijder de DMN-link uit `GeavanceerdPaneel` en `admin/configuratie`-tegel, zet feature-flag `dmn-editor` default uit, en laat op de pagina zelf een "Roadmap"-EmptyState achter.

- [ ] **Step 1: Falende test DI**: gegenereerde XML bevat voor elk element een `BPMNShape` met `dc:Bounds` en voor elke flow een `BPMNEdge` met ≥2 waypoints; template `intake-proces` bevat na integratie `bpmndi:BPMNDiagram`.
- [ ] **Step 2-4:** TDD voor DI; canvas/DMN-werk daarna; typecheck + lint groen.
- [ ] **Step 5:** Commit: `feat(workflow): volledige BPMN-DI, canvas-identiteit gefixt, DMN-besluit uitgevoerd` → PR W1-5 → CI → merge.

---

# Fase W1-6 — Keten-bewijs + demo-seed (branch `feat/w1-keten-bewijs`)

### Task 15: Demo-seed voor processen

**Files:**
- Create: `infra/scripts/seed-processen.sh` (patroon volgen van `infra/scripts/seed-planning.sh`: bash, PKCE-login per tenant-admin, curl-calls)
- Modify: `.github/workflows/ci.yml` E2E-job: na de bestaande seed-stap `docker compose … run --rm` de nieuwe seed draaien (of opnemen in de seed-container-entrypoint — volg hoe seed-planning nu wél/niet in CI draait en doe hetzelfde)

Inhoud per tenant (Horizon + De Linde): activeer `intake-proces` en `zorgplan-evaluatie` via `POST /api/processen/:key/deploy-template`-equivalent (= `POST /api/bpmn-templates/:id/deploy` met tenant-headers), start 2 intake-instanties met variabelen `{ clientRef: "Patient/<seed-client-id>", clientNaam: "<naam>" }`, en laat 1 taak geclaimd door een seed-medewerker (claim-call met diens practitioner-ID). Resultaat: de demo-tenant toont direct een gevulde werkbak en een gevulde "Lopend"-tab.

- [ ] **Step 1:** Script schrijven + lokaal syntax-checken (`bash -n`).
- [ ] **Step 2:** In CI-flow hangen; groene run bewijst het script.
- [ ] **Step 3:** Commit: `feat(seed): demo-zorgpaden — gevulde werkbak en lopende instanties`

### Task 16: E2E proces-keten + FHIR-taak

**Files:**
- Create: `apps/web/tests/e2e/proces-keten.spec.ts`, `apps/web/tests/e2e/fhir-taak.spec.ts`
- Referentie: bestaande `apps/web/tests/e2e/golden-path-zorgmedewerker.spec.ts` en `auth-helper.spec.ts` voor login-helpers/selectors — hergebruik die helpers exact.

Scenario `proces-keten.spec.ts` (spec §4.5, één `test.describe.serial`):
1. Login beheerder (Horizon) → `/admin/workflows?tab=sjablonen` → kaart "Intake nieuwe cliënt" → staat "Geactiveerd ✓" (door seed) of klik "Activeren".
2. Login zorgmedewerker → nieuwe cliënt aanmaken via `/ecd/nieuw` (minimale velden; volg golden-path-selectors) → trigger start intake.
3. `/werkbak` → tab "Beschikbaar" bevat intake-taak met de cliëntnaam → "Oppakken" → verschijnt onder "Mijn taken" met eigen naam als claimer.
4. "Afronden" → formulier: Ja/Nee-veld "Goedgekeurd?" op Ja + opmerking → submit → taak weg uit "Mijn taken".
5. Login teamleider → `/werkbak` tab "Beschikbaar"/"Alle taken" bevat de vervolgstap van het intake-proces.
6. Login beheerder → `/admin/workflows?tab=lopend` → instantie zichtbaar met cliëntnaam en huidige stap.
Scenario `fhir-taak.spec.ts`: login zorgmedewerker → open bestaande seed-cliënt → zorgplan aanmaken (of bestaande) → `/werkbak` toont de FHIR-evaluatietaak → "Oppakken" en "Afronden" slagen zonder foutmelding (dit was vóór W1 kapot: 500 via alert).

- [ ] **Step 1:** Schrijf beide specs; draai lokaal wat kan (`pnpm --filter @openzorg/web test:e2e` faalt lokaal zonder stack — dat is verwacht; de specs moeten in elk geval compileren via typecheck).
- [ ] **Step 2:** Push → CI-E2E is de verificatie. Bij flakiness: seriële modus staat al aan (workers: 1); gebruik `expect.poll`/`toBeVisible`-waits, geen sleeps.
- [ ] **Step 3:** Commit: `test(e2e): proces-keten en FHIR-taak — het werkbewijs van W1` → PR W1-6 → CI groen → merge.

### Task 17: W1-afronding

- [ ] Spec §2.2-checklist nalopen: elk van de 10 problemen → opgelost (met verwijzing naar PR) of eerlijk uitgezet (met roadmap-label). Vastleggen in het overdrachtsrapport.
- [ ] Memory `project_state` bijwerken (W1 af, W2 volgende).
- [ ] `docs/backlog.md`: workflow-cluster-items afvinken/annoteren (Notion volgt zodra MCP terug is).

---

## Self-review (uitgevoerd bij schrijven)

- **Spec-dekking**: §4.1-principes → Tasks 8/10/11 (domeintaal, één taakbegrip, catalogus); §4.2-IA-tabel → Tasks 10-12; §4.3.1-10 → Tasks 2-5 (1,3,4,7,9,10), 6-7 (2), 4 (3), 10 (5), 5 (6), 3+5 (7), 13 (8), 4 (9), alle test-steps (10); §4.4 → Task 10; §4.5 → Task 16; timebox-regel → Tasks 13/14. Geen gaten gevonden.
- **Type-consistentie**: `FlowableTaak`/`TakenQuery` (Task 2) ↔ routes (Task 4) ↔ `WerkbakTaak` (Task 10); `TaakVeld` gedefinieerd in Task 8 en geconsumeerd in Task 10/12 — namen gelijk gehouden.
- **Aannames die de uitvoerder moet verifiëren (expliciet in tasks):** Flowable-tenant-gedrag (Task 1-spike), exacte export-naam rollenlijst shared-domain (Task 12), `meta.project`-veld (Task 13), hoe seed-planning in CI draait (Task 15).
