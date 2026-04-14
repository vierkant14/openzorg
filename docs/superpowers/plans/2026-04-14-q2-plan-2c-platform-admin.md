# Q2-Plan 2C: Platform Admin — Per-tenant feature toggles & settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een functioneel beheerder moet een OpenZorg-tenant zelf grotendeels kunnen aanzetten, aanpassen en terugschroeven zonder code of deploy. Dit plan bouwt het platform-niveau admin-paneel (`/master/tenants/:id/settings`) waarin een master-admin per tenant feature-flags, sessie-instellingen, branding en validatie-regels kan beheren. Dit is laag 2 uit hoofdstuk 7 van de requirements — de "vrij configureerbare uitbreidingslaag" — zichtbaar gemaakt als UI.

**Architecture:** Settings worden als JSONB opgeslagen in `openzorg.tenants.platform_settings` (nieuwe kolom). Frontend leest via `/api/master/tenants/:id/settings` en schrijft via PATCH. Wijzigingen worden geaudit-logged. Feature-flags worden door de web-app geconsumeerd via een kleine `useFeatureFlag(slug)` hook die bij login in localStorage wordt gecachet samen met de andere tenant-info.

**Tech Stack:** Postgres (JSONB kolom, migratie), Hono (`services/ecd/src/routes/master.ts`), Next.js (`/master/tenants/[id]/settings/page.tsx`), React hook voor feature-flag consumptie.

**Spec referenties:**
- `docs/openzorg-requirements-claude-code.docx` — hoofdstuk 7 (drielagen-model), hoofdstuk 8 (workflow-engine als laag 2)
- `docs/superpowers/plans/2026-04-14-q2-plan-2b-werkbak-workflow-audit.md` — levert de workflow-engine die hier aan/uit gezet moet kunnen worden
- `docs/enterprise-onboarding.md` — tenant-provisioning context

**Branch:** `plan-2c-platform-admin`, afgeleid van `plan-2a-execute` nadat 2A gemerged is naar main.

**Dependencies:**
- Plan 2A moet af zijn (monolith-split) zodat de admin-pagina's op de nieuwe per-route-architectuur draaien.
- Plan 2B moet ten minste de werkbak end-to-end laten werken zodat "workflow engine aan/uit" betekenisvol is.

---

## Waarom dit plan nu

Drie samenhangende drivers:

1. **Dev-ergonomie** — Kevin raakte irritatie door de Medplum session-timeout (1 uur default). Dat is een instelling die hoort thuis onder platform-settings, niet hardcoded.
2. **Fan-factor voor de functioneel beheerder** (H8.6): het moet mogelijk zijn om modules/features stap voor stap uit te rollen naar een tenant. Niet alles-of-niets. Een beheerder wil kunnen zeggen "vandaag test-tenant op Canvas-editor, volgende week productie".
3. **Multi-tenant scale-up naar ziekenhuizen** (H3 doelgroep): een grotere organisatie heeft andere eisen dan een kleine VVT-stichting. Feature-flags en tenant-branding maken tenant-specifieke configuratie mogelijk zonder code-forks.

Zonder dit plan blijft elke tenant een kopie van de default-config en is elke "uitzondering" een code-wijziging.

---

## Scope

### In scope
- Nieuwe kolom `openzorg.tenants.platform_settings JSONB` met schema voor:
  - `featureFlags`: `{ slug: { enabled: bool, rolloutDate?: date, notes?: string } }`
  - `session`: `{ accessTokenLifetime: string, refreshTokenLifetime: string, idleTimeoutMinutes: number }`
  - `branding`: `{ logoUrl: string, primaryColor: string, organizationNameOverride: string }`
- Migratie + default-seed voor bestaande tenants
- Master-routes: `GET /api/master/tenants/:id/settings`, `PATCH /api/master/tenants/:id/settings`
- Master-UI pagina `/master/tenants/[id]/settings` met tabs (Features / Sessie / Branding)
- React hook `useFeatureFlag(slug)` + `useTenantBranding()` die bij login in localStorage worden gecachet
- 6-8 initiële feature-flags: `workflow-engine`, `bpmn-canvas`, `dmn-editor`, `facturatie-module`, `planning-module`, `mic-meldingen`, `rapportages-ai`, `sales-canvas`
- Audit-log entry bij elke setting-wijziging (wie, welke tenant, welke flag, oude vs. nieuwe waarde)

### Out of scope (aparte plans)
- Validatie-regel editor Layer 2 (H7.2: BSN verplicht, gewicht-range) — eigen UI, komt in Plan 2D
- Custom fields editor Layer 2 (H7.2: "Lievelingsmuziek bij Client") — bestaat al deels, eigen plan
- Plugin-laag (H7.3) — Layer 3, later
- SSO / OIDC integratie — Plan 3A
- Tenant branding voor het login-scherm (tenant-specifieke URL) — Plan 3B

---

## Fase 1 — Datamodel & migratie

- [ ] Nieuwe SQL-migratie `infra/postgres/migrations/2026-04-XX-platform-settings.sql` met:
  - `ALTER TABLE openzorg.tenants ADD COLUMN platform_settings JSONB NOT NULL DEFAULT '{}'::jsonb;`
  - Backfill default-settings voor bestaande tenants (alle featureFlags `enabled: true`, default sessie-waarden, lege branding)
- [ ] TypeScript type `PlatformSettings` in `packages/shared-config/src/platform-settings.ts` met Zod-schema voor validatie
- [ ] Enum `FEATURE_FLAG_SLUGS` centraal beheerd (voorkomt typo's)
- [ ] Default-values constants zodat backend en frontend dezelfde fallbacks gebruiken
- [ ] Unit-tests voor de Zod-schema met happy path, missing fields, invalid durations

## Fase 2 — Backend: master-routes

- [ ] `GET /api/master/tenants/:id/settings` → JSON met volledige `platform_settings` voor die tenant
- [ ] `PATCH /api/master/tenants/:id/settings` → partial update, valideert via Zod, audit-logt wijziging met diff
- [ ] Master-key middleware toepassen (`X-Master-Key` header), zoals andere `/api/master/*` routes
- [ ] Audit-entry format: `action = "platform.settings.update"`, `resource_type = "Tenant"`, `details = { before: {...}, after: {...}, changedKeys: [...] }`
- [ ] Test: PATCH met ongeldig feature-flag-slug → 400, PATCH met geldig → 200 + audit-entry aanwezig
- [ ] Endpoint `GET /api/tenant-features` (tenant-scoped, niet master-only) die alleen `featureFlags` en `branding` teruggeeft — gebruikt door web-app bij login

## Fase 3 — Frontend: master-UI

- [ ] Pagina `/master/tenants/[id]/settings/page.tsx` met drie tabs:
  - **Features** — lijst van alle flags met toggle-switch, `rolloutDate`-datepicker, en notities-veld
  - **Sessie** — dropdowns voor accessTokenLifetime (1h / 8h / 24h / 7d), refresh lifetime, idle-timeout slider
  - **Branding** — logo-upload (naar `/api/binaries`), color picker, organisatie-naam-override
- [ ] Op save: PATCH call, toast met bevestiging of fout
- [ ] "Reset naar default"-knop per tab die bevestiging vraagt en de hele sectie terugzet
- [ ] Link naar deze pagina toevoegen vanuit `/master/tenants` overzicht (nieuwe kolom "Instellingen" met settings-icoontje)
- [ ] Audit-history sectie onderaan: laatste 20 wijzigingen uit `openzorg.audit_log` waar `action LIKE 'platform.settings.%'` gefilterd op deze tenant

## Fase 4 — Consumer-hook voor feature-flags in de web-app

- [ ] `apps/web/src/lib/features.ts`:
  - `loadFeatureFlags()` — fetcht `/api/tenant-features` bij login, schrijft naar `localStorage.openzorg_features`
  - `useFeatureFlag(slug: FeatureFlagSlug): boolean` — React hook die leest uit localStorage, valt terug op default (true) als niet gevonden
  - `useTenantBranding(): TenantBranding` — idem voor branding
- [ ] Login-flow (`/api/auth/login`) uitbreiden om features direct mee te sturen, zodat er geen extra request nodig is
- [ ] Navigation in `AppShell.tsx` filtert nav-items ook op feature-flag naast rol (bv. "Facturatie" verdwijnt als `facturatie-module` uit staat)
- [ ] Admin-workflow-pagina's zijn verborgen als `workflow-engine` uit staat

## Fase 5 — Applicatie-integratie

- [ ] Medplum ClientApplication `accessTokenLifetime` dynamisch zetten tijdens login-flow op basis van `platform_settings.session.accessTokenLifetime` — vereist ofwel pre-login lookup op tenant (via email → project) OF bij project-creatie de waarde zetten
- [ ] Eén-keer-per-dev script `infra/scripts/set-client-app-lifetime.ts` dat de bestaande ClientApplications in medplum patched (zoals ik vandaag handmatig deed in het canvas-werk)
- [ ] `/admin/workflows/canvas` + `/admin/workflows/ontwerp` verbergen als `bpmn-canvas` feature uit staat
- [ ] `/admin/facturatie` verbergen als `facturatie-module` uit staat

## Fase 6 — Verification & docs

- [ ] E2E test: master-admin logt in → navigeert naar tenants → opent settings → toggelt `bpmn-canvas` uit → logt uit → logt in als tenant-admin → `/admin/workflows/canvas` redirect naar `/geen-toegang`
- [ ] E2E test: master-admin zet accessTokenLifetime op 7d → tenant-user logt in → token in localStorage is 7d geldig
- [ ] `docs/wiki/technisch/platform-settings.md` met setting-schema, upgrade-pad voor nieuwe flags, en beslisboom "waar hoort deze setting thuis: Layer 1 / Layer 2 / Layer 3"
- [ ] Update `docs/enterprise-onboarding.md` met de nieuwe tenant-settings stap in het onboarding-proces
- [ ] Screenshot van de drie tabs + korte demo-video (~30 sec) voor sales-gebruik

---

## Acceptatiecriteria

Plan 2C is af als:

1. Master-admin kan via UI per tenant minstens 8 features aan-/uitzetten
2. Wijzigingen zijn direct zichtbaar in de tenant-UI (navigatie verandert, modules verdwijnen) zonder page-refresh of deploy
3. Elke wijziging staat in `audit_log` met diff en user-id
4. `accessTokenLifetime` is per tenant instelbaar en wordt door de login-flow gerespecteerd
5. Een tenant met alle modules uit heeft nog steeds toegang tot de kern (cliëntenlijst, dossier-basis, werkbak)
6. `useFeatureFlag()` faalt veilig (fallback `true`) als feature-slug niet in settings staat, zodat nieuwe features niet per ongeluk verbergen
7. Type-check + lint groen, minimaal 80% coverage op `platform-settings.ts`, `master.ts` routes en `features.ts` hook

---

## Risico's

| Risico | Impact | Mitigatie |
|---|---|---|
| Medplum ClientApplication-lifetime is niet dynamisch instelbaar per login, alleen per app | Middel | Fase 5 punt 1 onderzoeken; fallback is één vaste default + jaarlijkse review |
| Feature-flag in localStorage raakt out-of-sync als admin wijzigt terwijl user ingelogd is | Laag | Polling elke 5 min + forceer opnieuw laden bij 403 op een flag-afhankelijke route |
| JSONB schema-evolutie: nieuwe flag die niet in oude tenants staat | Middel | Fallback-default in `useFeatureFlag`, backfill-migratie bij release |
| Audit-log groeit snel als één flag vaak wijzigt | Laag | Later TTL + archivering; voor nu accepteren |
| Master-admin zet per ongeluk `workflow-engine` uit terwijl er lopende taken zijn | Middel | Waarschuwing in UI: "er zijn N open taken in deze engine, weet je zeker dat je 'm uit wilt zetten?" |

---

## Stappen hierna (na 2C)

Zodra 2C af is, loopt de roadmap door naar:

- **Plan 2D — Validation-rule editor** (H7.2): UI voor Layer 2 validatieregels met operator-dropdowns. Bouwt op het bestaande `shared-config/validation-engine.ts`.
- **Plan 2E — DMN-editor**: `dmn-js` (zuster van `bpmn-js`) inbouwen, beslissingstabellen per process koppelen aan gateways in de BPMN.
- **Plan 2F — Form-keys per userTask**: JSONForms-integratie zodat elke userTask een eigen formulier kan hebben (H8.3 eis: "welke velden in welke stap verplicht zijn").
- **Plan 3A — SSO/OIDC** voor ziekenhuis-scale, aan-te-schakelen via feature-flag uit 2C.
- **Plan 3B — Tenant-branding login-scherm**: tenant-specifieke URL + logo op /login.

Het vroegere "fase 2C" uit het requirements-document (MVP afronding) valt daarmee uiteen in 2C tot 2F als meer haalbare deelprojecten.
