# OpenZorg — Verkoopbare MVP (VVT + Thuiszorg): ontwerp & traject

**Versie**: 1.0
**Datum**: 2026-07-10
**Status**: Autonoom opgesteld en in uitvoering genomen in opdracht van Kevin (zie §0); ter review bij terugkomst.
**Relatie**: bouwt voort op `2026-05-01-openzorg-vvt-volwassenheid-gap-analyse.md` (functionele bron van waarheid), `2026-06-11-production-ready-traject-design.md` (fase-raamwerk) en `docs/design/informatie-architectuur.md` (IA-doelbeeld). Vervangt geen van deze documenten; dit is de uitvoeringsspec voor de MVP-eindsprint.

---

## §0 — Opdracht & mandaat

Kevin's opdracht (2026-07-10, letterlijk samengevat):

1. **"Ga autonoom verder tot dat er een MVP staat dat we kunnen verkopen"** — focus VVT + thuiszorg.
2. **"Alles moet werken"** — met nadruk op het procesmanagement-deel, dat "buggy eruit ziet en echt gerevampt moet worden".
3. **"Het platform/hosting-gedeelte wil ik nu live zien staan."**
4. **"Begin met een uitgebreid plan zodat we dit ook na Fable 5 kunnen laten bouwen door Opus of andere modellen"** — dit document plus de bijbehorende plannen in `docs/superpowers/plans/` zijn dat plan: zelfstandig leesbaar, zonder impliciete context.

De normale spec-goedkeuringsgate (brainstorming-skill) is door deze opdracht expliciet overgeslagen; alle beslissingen die normaal aan Kevin voorgelegd zouden worden staan in §7 (genomen besluiten + rationale) en §8 (open punten voor Kevin).

**Notion-kanttekening**: de Notion-MCP was in deze sessie niet verbonden. Conform het production-ready-traject (§1 aldaar) is de gap-analyse in de repo "de functionele bron van waarheid" die de Notion-backlog spiegelt; aangevuld met `docs/backlog.md` (lokale Notion-spiegel, laatste sync 2026-04-13) en de project-memory. Notion-statussen worden bijgewerkt zodra de koppeling terug is (§8).

---

## §1 — Doel: wat is "een MVP dat we kunnen verkopen"?

Verkopen in de VVT betekent: **een pilot-overeenkomst tekenen bij één instelling**. Daarvoor is nodig — en dit zijn de vier meetbare pijlers van dit traject:

| Pijler | Definitie van klaar |
|---|---|
| **P1. Demo die overtuigt** | Een verkoopdemo van 30 minuten langs alle werkruimtes kan zonder één dode knop, lege pagina, dev-jargon of visuele inconsistentie. Procesmanagement (Kevins pijnpunt) is gerevamped. |
| **P2. Alles wat er is, werkt aantoonbaar** | Elke pagina in de navigatie voldoet aan het design-systeem (patroonlaag, states, a11y) en elke kernflow is gedekt door een E2E-test die in CI draait (per rol een golden path + de proces-keten). |
| **P3. Live platform** | De productie-compose-stack draait publiek bereikbaar (Unraid + Cloudflare Tunnel), met werkende backups, een geteste restore en een release-tag als deploy-eenheid. |
| **P4. Pilot-runbaar & eerlijk** | Tenant-onboarding werkt end-to-end; een "feature vs. roadmap"-matrix maakt eerlijk onderscheid tussen wat werkt, wat gemockt is en wat licentie-geblokkeerd is (G-Standaard, Vecozo, iWlz). |

**Wat dit traject bewust NIET is**: het bouwen van de licentie-geblokkeerde Tier-1-diepte (B-01..B-04 medicatieveiligheid met G-Standaard, H-01..H-06 Vektis/iWlz, I-01..I-03 SBV-Z/Vecozo). Die vereisen externe contracten (gap-analyse §3.5, R-01..R-05) en zijn per Kevins besluit van 2026-06-12 eigen builds met mock-laag, ná pilot-tekening. Een MVP verkoop je op wat er wél is — vlekkeloos — plus een geloofwaardige roadmap. Zie §8 voor de verkooppositionering.

**Doelgroep-scherpte VVT + thuiszorg — het pilotprofiel (Kevin, 2026-07-10)**: de meetlat is een kleine VVT-instelling mét thuiszorg die we als testklant kunnen onboarden: **4 locaties, ~80 cliënten**, zowel intramurale afdelingen als thuiszorg-routes. "Verkoopbaar" betekent dus concreet: voor déze instelling kunnen we (a) de organisatiestructuur inrichten (4 locaties + afdelingen + diensten + bezettingsprofielen), (b) ~80 cliënten opvoeren zonder handwerk-marteling (minimale CSV-cliëntimport — zie W3; data-import was al adoptie-blokker #1 in de backlog, I-05), (c) een planning maken (intramuraal rooster + thuiszorg-dagplanning), en (d) hun zorgprocessen inrichten via de gerevampte Processen-laag. De mobiele tijdregistratie (E-03) en routelijst (E-04) blijven roadmap; de dagplanning draagt het thuiszorg-verhaal in demo en pilot (§5, W5).

---

## §2 — Huidige staat (verkend 2026-07-10)

### 2.1 Wat staat er goed

- **Engineering-fundament af** (Fase 0): trunk-based met verplichte CI (lint, typecheck, tests, forbidden-words, build), release-workflow bouwt 5 images naar GHCR bij `v*`-tags (v0.2.0 staat), `docker-compose.prod.yml` + runbook + geteste backup/restore-scripts.
- **CI draait de volledige stack**: het E2E-job bouwt de Docker-compose-stack (postgres, redis, medplum, 4 services, web) + seed en draait Playwright erin. Dit is het verificatie-vangnet voor deze hele run (zie 2.4).
- **Ontwerp-fundament staat** (Fase 1): OKLCH-tokens, shared-ui patroonlaag (`PageHeader`, `Section`, `EmptyState`, `ErrorState`, `LoadingSkeleton`), werkruimtes-navigatie per rol, referentiescherm `/vandaag`.
- **Genormaliseerde slices**: rapportage (herontwerp + splitsing), cliëntdossier (5 werkgebieden), medicatie (3 pagina's), afspraak-pagina's (gecommit op deze branch); planning-pagina's (4 stuks) staan klaar als uncommitted werk en zijn kwalitatief in orde (patroonlaag + a11y toegepast; typecheck/lint/tests lokaal groen).
- **Baseline groen**: `pnpm typecheck`, `pnpm lint`, `pnpm test` (32 tests) slagen lokaal op de huidige branch inclusief het uncommitted werk.

### 2.2 Procesmanagement: de eerlijke diagnose (Kevins pijnpunt)

Grondige verkenning (alle procespagina's + workflow-bridge + triggers) bevestigt Kevins gevoel. Het "buggy" komt niet van kleuren — het token-gebruik is netjes — maar van **echte functionele bugs, architectonische versnippering en dev-jargon in de UI**. De tien kernproblemen, met vindplaats:

1. **Instanties-pagina dubbel kapot**: de lijst is bij een echte tenant altijd leeg (query filtert op Flowable-native `tenantId` terwijl instanties alleen een proces-variabele meekrijgen — `services/workflow-bridge/src/lib/flowable-client.ts:230` vs `:149-164`); en het "actieve taken"-paneel is altijd leeg (frontend vraagt `/api/taken?processInstanceId=…`, maar de taken-route vereist `userId` en negeert `processInstanceId` — `routes/taken.ts:35-50`).
2. **FHIR-taken zijn onbruikbaar**: de werkbak merget Flowable-taken met FHIR Tasks (`fhir-<id>`), maar claim/voltooi routeert álles naar de workflow-bridge → Flowable kent `fhir-…` niet → 404/500 → `alert()`. De helft van het takenaanbod is dood bij interactie (`apps/web/src/app/werkbak/page.tsx:270,279`).
3. **Timer-service start nooit iets**: de call naar de workflow-bridge mist de `X-Tenant-ID`-header → altijd 400 (`services/ecd/src/lib/timer-service.ts:123-127`). De 6-maandelijkse zorgplan-evaluatie faalt dus structureel stil; de herindicatie-timer is nooit geïmplementeerd (dode config).
4. **Tenant-isolatie lekt fail-open**: taken zonder `tenantId`-variabele zijn voor álle tenants zichtbaar en muteerbaar (legacy-fallback in `flowable-client.ts:159` en `verifyTaskTenant:190`).
5. **Geen authenticatie op de workflow-bridge**: `X-Tenant-ID` wordt blind vertrouwd (`middleware/tenant.ts:13`); Flowable-admin-credentials staan hardcoded (`admin:admin`) i.p.v. in env (bekend backlog-item, prioriteit P1).
6. **Claim-model verwart rol en persoon**: claimen zet `userId = rol` — "door mij geclaimd" betekent "door iemand met mijn rol"; `workflowFetch` stuurt geen `X-User-Id`, dus ook de NEN 7513-audit registreert de rol i.p.v. de persoon. Wortel-oorzaak: er is géén `/api/me` (login → Practitioner-koppeling ontbreekt, backlog ME-01).
7. **Nul hergebruik van de patroonlaag**: geen enkele procespagina importeert `@openzorg/shared-ui`; elk scherm hand-rolt spinner/empty/error/header, plus `alert()`/`confirm()` voor fouten.
8. **Duplicaat- en drift-UI**: `/admin/workflows` bevat een tweede "Taakwerkbak" met vrij-tekst-userId-veld en zes hardcoded variabelenamen (debug-tool in productie-UI); de proces-taxonomie bestaat in vier kopieën (backend-templates, voorbeelden-pagina, task-form-options, werkbak-labels) die al uiteenlopen.
9. **Werkbak ontbreekt in de navigatie**: de kern-takeninbox is alleen bereikbaar via sneltoets of tekstlinks op vandaag/dashboard; een zorgmedewerker vindt hem nauwelijks. Ondertussen staat wel beheer-jargon ("Deployen", "Key", "Versie") prominent in de UI van de beheerder.
10. **Schijn-features wekken wantrouwen**: de DMN-editor kan niets opslaan (ontbrekende `forwardRef`, geen save-knop, "koppeling volgt"); state-machine-guards zijn "alleen informatief"; canvas-velden `formKey`/event-trigger doen niets; templates missen BPMN-DI waardoor de canvas-rendering rommelig oogt; er is geen auto-deploy waardoor de keten op een verse omgeving stilletjes faalt; en geen enkele test bewijst de keten frontend → bridge → Flowable → werkbak.

Daarnaast (kleiner): sequentiële N+1-fetch voor oversight-rollen, key/naam/XML-id-mismatch bij canvas-deploy, rauwe `fetch` zonder auth-header in de template-loader, bpmn-js private-internals-toegang, rol-drift in state-machines (rollen die niet bestaan), React-"0"-render-valstrik in task-form-options.

### 2.3 Design-conformiteit van de overige pagina's (audit 2026-07-10, alle 81 pagina's)

Goed nieuws: de normalisatie-slices hebben hun werk gedaan. **67 van 81 pagina's zijn genormaliseerd** (semantische tokens overal — raw gray is op 3 losse regels na uitgeroeid — plus loading/error/empty-states en redelijke structuur). De werkelijke resten:

- **Echt niet genormaliseerd (3)**: `ecd/[id]/dashboard/page.tsx` (4-regel placeholder-stub met letterlijk "nog niet gemigreerd uit monolith" — dode pagina in het dossier), `ecd/[id]/verzekering` (2 regels raw gray in statusBadge, verder in orde — S), `admin/configuratie/custom-fields` (553-regel monoliet met 2 gray-leftovers — M).
- **Monolieten >500 regels, inhoudelijk wél genormaliseerd (11)**: o.a. `ecd/[id]/page.tsx` (1026), `ecd/[id]/zorgplan` (805), `admin/workflows/canvas` (878, deels inherent door BPMN-XML), `admin/medewerkers` (605), `admin/organisatie` (587), `admin/validatie` (517). Splitsing alleen waar we functioneel aan het bestand werken (eerlijkheidsregel: geen refactor-om-de-refactor).
- **Dashboard (`/dashboard`, 496 regels)**: haalt 5 databronnen op zonder loading-skeleton of error-state — het bestaande P1-backlog-item "landing-scherm" dekt dit.
- **Kruissnijdend**: de shared-ui patroonlaag wordt door slechts 11/81 pagina's geïmporteerd; de ecd-tab-familie dupliceert per bestand een identieke lokale `Spinner()`/`ErrorMsg()`; koppen variëren (`text-2xl`/`text-display-lg`/`text-3xl`). Eén dedupe-pass (lokale Spinner/ErrorMsg → `LoadingSkeleton`/`ErrorState`, kop → `PageHeader`) haalt dit weg zonder herontwerp.

Consequentie voor W2: kleiner en scherper dan aanvankelijk aangenomen — geen brede herontwerp-ronde maar gerichte reparaties + één dedupe/consistentie-pass. De volledige audit-lijsten staan in het W2-plan.

### 2.4 Infrastructuur & omgevingsconstraints (op moment van schrijven)

| Feit | Consequentie |
|---|---|
| Geen Docker op de ontwikkelmachine (Windows) | Stack kan niet lokaal draaien; unit/lint/typecheck wél lokaal. Volledige verificatie loopt via CI (die de complete stack + seed + Playwright draait) en via de Unraid-staging. |
| Unraid (192.168.1.10) is momenteel onbereikbaar (SSH-timeout) | Live-deploy en staging-verificatie zijn geblokkeerd tot de server bereikbaar is. W4 is daarom zo ingericht dat alles voorbereid en elders geverifieerd wordt; de feitelijke uitrol is één commando. Periodiek opnieuw proberen. |
| `node` staat niet op het sessie-PATH | Elke shell-aanroep: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` vooraf (PowerShell). |
| GitHub Actions "Deploy to Production"-workflow bestaat maar de deploy-job is uitgeschakeld (`vars.DEPLOY_ENABLED != 'true'`, doelpad `/opt/openzorg` bestaat vermoedelijk niet op Unraid) | Niet op vertrouwen; W4 regelt deploy expliciet via release-tag + prod-compose. Workflow-opschoning is onderdeel van W4. |
| `gh` CLI geauthenticeerd als vierkant14 (repo+workflow-scope, geen packages-scope) | PR's en CI-monitoring werken; GHCR-package-instellingen niet via CLI. |
| Cloudflare Tunnel bestond eerder → `ecd.windahelden.nl` (85 dagen oude memory) | Verifiëren zodra Unraid bereikbaar is; tunnel-config staat op de server. |

---

## §3 — Aanpak-afweging

Drie mogelijke aanpakken zijn overwogen:

**A. Breedte-eerst ("alles een beetje beter")** — alle pagina's normaliseren, bugs fixen waar je ze tegenkomt, daarna pas procesmanagement. Voordeel: snelle zichtbare vooruitgang overal. Nadeel: Kevins expliciete pijnpunt blijft het langst liggen; de architectuurproblemen in de proces-keten (identiteit, tenant-isolatie) blijven doorwerken in alles wat erop bouwt.

**B. Procesmanagement-eerst, fundament-gedreven (GEKOZEN)** — eerst het lopende planning-werk afronden (schone werkbank), dan de proces-keten van fundament tot UI revampen (identiteit → bridge-hardening → werkbak → beheer-UI → bewijs via E2E), daarna de rest normaliseren, hardenen, live zetten en het verkooppakket maken. Voordeel: het pijnpunt wordt structureel opgelost i.p.v. gecosmetiseerd; de identiteitslaag (/api/me) die de proces-keten nodig heeft, ontgrendelt en passant Vandaag, audit en het demo-login-probleem. Nadeel: de eerste week is minder zichtbaar "breed".

**C. Demo-façade ("maak het mooi, fix later")** — UI-revamp zonder backend-fixes. Verworpen: "alles moet werken" is de opdracht; een demo waarin instanties leeg blijven en taken 500'en bij voltooien is precies wat een VVT-inkoper doorprikt.

Rationale voor B boven A: van de tien kernproblemen in §2.2 zijn er zes backend/architectuur (1-6) en vier UI (7-10). UI-revamp op een kapotte keten is verf op nat hout. Bovendien is de identiteitslaag (probleem 6) een afhankelijkheid van drie andere werkstromen.

---

## §4 — Doelontwerp procesmanagement (werkstroom W1, het hart)

### 4.1 Ontwerpprincipes

1. **Domeintaal, geen engine-taal.** De beheerder ziet "zorgpaden activeren", niet "BPMN deployen". Engine-begrippen (key, versie, DI) blijven bestaan in de "Geavanceerd"-laag (canvas), nergens anders. Dit implementeert backlog-besluit WF-01 (workflow-builder in domeintaal bovenop BPMN; het BPMN-canvas is te technisch voor de functioneel beheerder).
2. **Eén taken-begrip.** De gebruiker ziet één werkbak; dat er twee bronnen achter zitten (Flowable-taken en FHIR-Tasks) is een implementatiedetail met correcte routing per bron — nooit een kapotte knop.
3. **Persoonlijke identiteit.** Taken worden geclaimd door een persoon (Practitioner), kandidaat-stelling blijft op rol (candidateGroup). Audit registreert de persoon. Fundament: `/api/me`.
4. **Fail-closed tenant-isolatie.** Een taak of instantie zonder tenant-context is een bug, geen "toon aan iedereen".
5. **Eerlijke features.** Wat niet werkt, is óf gemaakt werkend, óf verwijderd/uitgezet met een expliciet "roadmap"-label. Geen knoppen die niets doen.
6. **Eén bron van waarheid** voor de proces-taxonomie (namen, omschrijvingen, stappen, formulier-defaults): de backend-catalogus. Frontend-kopieën verdwijnen.

### 4.2 Informatie-architectuur (na revamp)

| Route | Naam (UI) | Doelgroep | Wat het is |
|---|---|---|---|
| `/werkbak` | **Werkbak** | alle rollen; nav-item in werkruimtes vandaag, rooster én team | Persoonlijke taken-inbox: "Mijn taken" / "Beschikbaar voor mijn rol" (+ "Alle taken" voor oversight-rollen), taakkaarten met cliënt-link, deadline-kleuring, claim/voltooi met geconfigureerd formulier |
| `/admin/workflows` | **Processen** | beheerder, tenant-admin (werkruimte bouwen) | Hub met tabs: **Actieve zorgpaden** (wat draait er, hoeveel lopende instanties, laatste activiteit) · **Sjablonen** (galerij met stappen-preview in gewone taal, knop "Activeren") · **Lopend** (voorheen instanties: per lopend zorgpad de cliënt, huidige stap, wie aan zet, doorlooptijd, annuleren-met-reden) · **Geavanceerd** (canvas + beslisregels) |
| `/admin/workflows/canvas` | Proces-ontwerper (geavanceerd) | beheerder die BPMN aankan | Bestaande bpmn-js-editor, opgeschoond: kloppende DI-rendering, geen dode velden, consistente deploy-identiteit |
| `/admin/workflows/dmn` | Beslisregels | idem | Werkend gemaakt (opslaan/deployen) óf uit de nav + feature-flag default uit met "roadmap"-label — beslissing valt in het W1-plan op basis van een timebox (zie 4.5) |
| `/admin/task-form-options` | Taakformulieren | beheerder | Bestaande Laag-2-editor, genormaliseerd en gevoed door de catalogus i.p.v. eigen hardcoded lijst |
| `/admin/state-machines` | State-machines | tenant-admin (systeem) | Genormaliseerd; guards krijgen zichtbaar "informatief"-label (afdwingen = roadmap); rol-lijst uit shared-domain |
| — | *Verwijderd* | — | "Taakwerkbak"-sectie op `/admin/workflows` (duplicaat/debug-tool); `/admin/workflows/ontwerp` (redirect-stub); `/admin/workflows/voorbeelden` gaat op in de Sjablonen-tab (stappen-preview vervangt de statische uitleg) |

### 4.3 Architectuurbeslissingen (backend)

1. **Flowable native tenantId overal.** Deployments en proces-starts krijgen de native `tenantId` mee (naast de bestaande proces-variabele voor compat); alle queries (taken, instanties) filteren native; de legacy-fallback ("geen variabele → zichtbaar") vervalt — fail-closed. Bestaande instanties op staging zijn dev-data en mogen wees worden (gedocumenteerd; geen migratie).
2. **Identiteitslaag `/api/me` (ECD-service).** `GET /api/me` → resolvet het Medplum-token naar profile (Practitioner) + projectmembership → `{ practitionerId, naam, rol }`. Login-flow slaat dit op; `ecdFetch`/`workflowFetch` sturen voortaan `X-User-Id` (practitioner-id) naast `X-User-Role`/`X-Tenant-ID`. Overgangsregel: zolang een account geen membership-rol heeft, valt de UI terug op de bestaande form-rolkeuze met zichtbare "demo-modus"-waarschuwing; de seed wordt in W3 bijgewerkt zodat testaccounts een echte rol + Practitioner-koppeling hebben. Dit lost backlog ME-01 op en de-riskt het demo-login-model (RBAC-rol uit de server i.p.v. een vrij invulveld).
3. **Claim = persoon.** `POST /api/taken/:id/claim` claimt op `X-User-Id`; unclaim toegevoegd; "mijn taken" = assignee == mijn practitioner-id; kandidaat-taken = candidateGroup == mijn rol. De werkbak-filters worden daarmee betekenisvol.
4. **Proces-catalogus als bron van waarheid.** `GET /api/processen/catalogus` (workflow-bridge) levert per proces: key, domeinnaam, omschrijving, stappen (naam, rol, formulier-default-velden = Laag 1), triggers. De vijf bestaande templates voeden de catalogus; `DEFAULT_PROCESS_VARS` verhuist van de werkbak-frontend naar deze catalogus; task-form-options (Laag 2) merget eroverheen op de server zodat élke consument (werkbak, hub, taakformulieren-editor) hetzelfde ziet.
5. **FHIR-taken correct routeren.** Werkbak-taken krijgen een `bron`-veld (`flowable` | `fhir`). Voltooien van een FHIR-taak gaat naar een nieuwe ECD-route (`POST /api/fhir-taken/:id/complete` → Task.status=completed + audit); claimen van een FHIR-taak = Task.owner zetten. Geen enkele knop routeert meer naar de verkeerde engine.
6. **Ensure-deployed.** `POST /api/processen/:key/start` deployt idempotent eerst de template als de definitie ontbreekt (met audit-event), zodat verse omgevingen en tenants nooit stil falen. De beheerder kan sjablonen daarnaast expliciet "Activeren".
7. **Bridge-beveiliging.** Flowable-credentials uit env (compose-secrets, geen `admin:admin` hardcoded); token-aanwezigheid + tenant-header vereist op alle `/api/*`; audit-logging van taak-transities (start/claim/complete/cancel) met persoon, conform NEN 7513 (backlog-items "Flowable-auth uit env", "audit-log taak-transities").
8. **Timer-service gerepareerd.** `X-Tenant-ID` meegeven per tenant; de zorgplan-evaluatie-timer aantoonbaar werkend (test). De herindicatie-timer: implementeren als ServiceRequest-einddatum-query volstaat (S), anders config-entry verwijderen + backlog-item — beslissing in het W1-plan, geen dode config laten staan.
9. **Oversight-fetch parallel** (`Promise.all`) en server-side gededuplicaat; N+1 weg.
10. **Testdekking**: route-tests voor de bridge (gemockte Flowable), unit-tests voor catalogus-merge (Laag 1+2), en een Playwright-E2E "proces-keten" (zie 4.5) die in CI met de echte stack draait.

### 4.4 UX-detail werkbak (referentie voor de uitvoerder)

- **Tabs**: "Mijn taken" (assignee = ik) · "Beschikbaar" (candidateGroup = mijn rol, geen assignee) · "Alle taken" (alleen teamleider/beheerder/tenant-admin). Badge met aantallen.
- **Taakkaart**: zorgpad-badge (domeinnaam uit catalogus), taaknaam, cliënt als klikbare link naar het dossier (uit proces-variabele `clientRef`), aangemaakt/deadline met bestaande urgentie-kleuring, bron-neutraal (FHIR/Flowable onzichtbaar voor de gebruiker), claimer met naam (niet rol).
- **Voltooien**: uitklap-formulier uit de catalogus (Laag 1+2 server-side gemerged): boolean → Ja/Nee-knoppen, select → keuzelijst, number → numeriek veld, text → tekstveld. Verplichte velden afdwingbaar per configuratie. Fouten via `ErrorState`/inline melding — geen `alert()`.
- **Patroonlaag**: `PageHeader`, `LoadingSkeleton`, `EmptyState` (met "alles afgerond"-toon), `ErrorState` met retry. Mobiel bruikbaar (de werkbak is een tablet-scherm bij uitstek).
- **Lege-staat-strategie**: onderscheid "geen taken voor jou" (positief) vs "workflow-engine niet actief" (informatief, met link naar Processen voor de beheerder).

### 4.5 Bewijs: E2E "proces-keten" (definition of done van W1)

Playwright-scenario dat in CI tegen de echte stack draait:

1. Beheerder activeert het intake-zorgpad via de Processen-hub (of: al geactiveerd door ensure-deploy).
2. Nieuwe cliënt wordt aangemaakt → intake-proces start automatisch (trigger-engine).
3. Zorgmedewerker ziet de intake-taak in de werkbak onder "Beschikbaar", claimt hem → verschijnt onder "Mijn taken" met eigen naam.
4. Voltooit de taak met het geconfigureerde formulier (boolean + tekst).
5. De vervolgtaak verschijnt voor de juiste rol; de Processen-hub "Lopend"-tab toont de instantie met cliënt en huidige stap.
6. Na afronden van de laatste stap is de instantie klaar; de audit-log bevat start/claim/complete-events met persoon én tenant.

Plus een tweede kort scenario: FHIR-taak (zorgplan-evaluatie) verschijnt in de werkbak en is voltooibaar zonder fout.

**Timebox-regel voor twijfelgevallen** (DMN werkend maken, herindicatie-timer, canvas-properties-uitbreiding): maximaal één dagdeel onderzoek/bouw per item; lukt het niet binnen de timebox, dan wordt het item eerlijk uitgezet (uit nav/flag, "roadmap"-label, backlog-item) in plaats van half opgeleverd. De MVP-belofte is "alles wat aanstaat werkt", niet "alles bestaat".

---

## §5 — Werkstromen (volgorde en definition of done)

> Elke werkstroom krijgt een eigen plan-document in `docs/superpowers/plans/` (writing-plans-formaat: bite-sized taken met exacte bestanden, stappen en verificatie per taak) — dat is het uitvoeringsniveau voor welk model dan ook. Dit hoofdstuk is het contract per werkstroom.

### W0 — Werkbank schoon (klein)

Planning-slice afronden: de vier uncommitted pagina's (beschikbaarheid, bezetting, herhalingen, wachtlijst) verifiëren, committen op `feat/planning-normalisatie`, PR met groene CI, merge naar main.
**DoD**: main bevat de volledige planning-normalisatie; werkboom schoon.

### W1 — Procesmanagement-revamp (het zwaartepunt)

Zoals ontworpen in §4. Uitvoering in zes PR's (elk met eigen tests, CI groen, elk zelfstandig mergebaar):

| PR | Inhoud |
|---|---|
| W1-1 | Bridge-hardening: native tenantId, fail-closed, `processInstanceId`-filter, claim/unclaim op persoon, env-credentials, audit-persoon, route-tests |
| W1-2 | Identiteitslaag: `/api/me` (ECD), login-flow, `X-User-Id` in beide fetch-clients, demo-fallback met waarschuwing |
| W1-3 | Proces-catalogus (backend, Laag 1+2 server-side merge) + werkbak-revamp (tabs, kaarten, formulieren, FHIR-routing, patroonlaag, nav-item in drie werkruimtes) |
| W1-4 | Processen-hub in domeintaal (Actief/Sjablonen/Lopend/Geavanceerd), verwijdering duplicaat-Taakwerkbak en ontwerp-stub, voorbeelden→Sjablonen, taakformulieren- en state-machines-pagina's genormaliseerd |
| W1-5 | Keten-reparaties: timer-service-fix, ensure-deployed, BPMN-DI voor alle templates, canvas-opschoning (deploy-identiteit, dode velden weg, template-loader via `workflowFetch`), DMN-timebox-beslissing |
| W1-6 | E2E proces-keten (4.5) + demo-seed voor processen (lopende instanties + taken in elke demo-tenant) |

**DoD**: E2E-keten groen in CI; geen dev-jargon meer in beheerder-UI; alle §2.2-problemen aantoonbaar opgelost of eerlijk uitgezet; Notion/backlog-items (P1 workflow-cluster) afvinkbaar.

### W2 — Alles-werkt-pas (gerichte reparaties + consistentie-pass)

Scherper gescoped na de 81-pagina-audit (§2.3):

- **De drie achterblijvers**: `ecd/[id]/dashboard`-stub vullen met de dossier-overzicht-widgets (of de tab verwijderen als het werkgebied "Overzicht" hem vervangt — één beslissing, geen dode pagina laten staan); `ecd/[id]/verzekering` token-fix (2 regels); `admin/configuratie/custom-fields` normaliseren + splitsen (M).
- **Dashboard/landing**: van 5-bronnen-zonder-states naar het "welkomstscherm met taken-teller, snelle acties, signaleringen" (bestaand P1-backlog-item), gevoed door /api/me + werkbak-data uit W1. Dit is het eerste scherm van elke demo.
- **Dedupe/consistentie-pass**: lokale `Spinner()`/`ErrorMsg()`-duplicaten in de ecd-tab-familie vervangen door `LoadingSkeleton`/`ErrorState`; koppen naar `PageHeader`. Mechanisch, laag risico, batch-gewijs.
- **Monoliet-splitsing alleen on-touch**: `ecd/[id]/zorgplan` (805) splitsen omdat het zorgplan demo-kritiek is; de overige monolieten alleen bij functioneel werk (eerlijkheidsregel: geen refactor-om-de-refactor).
- **Dode-knoppenjacht**: elke pagina heeft werkende acties of geen knop (zelfde eerlijkheidsregel als W1).

**DoD**: 0 pagina's in audit-bucket B; dashboard heeft states + nieuw ontwerp; geen dubbele lokale state-componenten meer in de ecd-familie; raw gray = 0 regels; zorgplan-pagina gesplitst.

### W3 — Verkoopklaar hardenen + pilotprofiel-onboarding

- **Pilotprofiel end-to-end** (de meetlat uit §1): een draaiboek + seed-variant "pilotprofiel" dat een verse tenant inricht als de doelklant — 4 locaties met afdelingen, dienst-configuratie en bezettingsprofielen per locatie, intramurale afdelingen én thuiszorg-team, zorgpaden geactiveerd. Aantoonbaar via een E2E die het onboarding-pad doorloopt.
- **Minimale CSV-cliëntimport** (I-05-light): beheerder uploadt CSV (naam, geboortedatum, BSN, adres, locatie-toewijzing) → batch-aanmaak via de bestaande clients-route met BSN-elfproef-validatie en een fouten-rapport per rij. Geen mapping-UI, één vast format met voorbeeldbestand — 80 cliënten opvoeren mag geen dagen kosten. (Volledige import uit externe ECD's blijft roadmap I-05.)
- E2E golden paths per rol uitbreiden: planner (rooster-flow), beheerder (processen-flow, uit W1-6), teamleider (MIC/signaleringen-flow); zorgmedewerker bestaat al.
- Seed verrijken tot demo-kwaliteit: testaccounts met echte rol-membership + Practitioner-koppeling (sluit demo-modus-fallback), lopende zorgpaden, gevulde werkbak, signaleringen, MIC-trends.
- Security-basics binnen bereik: sessie-verloop netjes afhandelen (verlopen token → login i.p.v. kale fouten), geen credentials in repo/logs, rate-limit-sanity op publieke endpoints; SSO/MFA blijft expliciet roadmap (Tier 3).
- Performance-sanity: geen N+1's in kernschermen, bundel-checks, laadtijd dashboard/werkbak acceptabel op staging.

**DoD**: 4 rol-golden-paths groen in CI; pilotprofiel-onboarding aantoonbaar (E2E of gedocumenteerde staging-run) inclusief CSV-import van ≥80 cliënten; demo-tenant "Zorggroep Horizon" oogt bewoond; login-rolkeuze vervangen door serverrol.

### W4 — Live platform (P3)

1. Release voorbereiden: CHANGELOG, versie-bump, tag `v0.3.0` → GHCR-images via release-workflow.
2. Unraid bereikbaar? → `.env.prod` opstellen op de server (secrets via `openssl rand`), `docker-compose.prod.yml` uitrollen volgens runbook; Cloudflare-Tunnel-hostname verifiëren/activeren; seed NIET draaien (prod), wél master-admin + demo-tenant via onboarding-flow.
3. Backup-cron op Unraid + één geteste restore (runbook-eis: "een ongeteste backup is geen backup").
4. Live smoke: E2E-smoke-subset tegen de publieke URL; healthchecks allemaal groen.
5. Deploy-workflow opruimen: `deploy.yml` laten kloppen met de werkelijke flow (release-tag → Unraid-pull) of verwijderen; geen schijn-automation laten staan.
6. **Fallback als Unraid onbereikbaar blijft**: alles t/m stap 1 afronden, deploy-script + exacte instructies klaarzetten (`docs/deployment-production.md` aangevuld), en de uitrol als "wacht op server" markeren in het overdrachtsrapport. Live gaan is dan één commando zodra de server er is.

**DoD**: publieke URL toont de ingelogde demo-omgeving; backup-cron draait; restore getest; release v0.3.0 gedocumenteerd.

### W5 — Verkooppakket (P4, documentatie)

- **Demo-script** (30 min, per rol door de werkruimtes, met het planning- en proces-verhaal als climax en het thuiszorg-pad via dagplanning) — opgebouwd rond het pilotprofiel uit §1: de kijker ziet zijn eigen instelling (4 locaties, intramuraal + thuiszorg) terug, niet een abstracte demo.
- **Feature vs. roadmap-matrix**: wat werkt (aantoonbaar, met E2E-verwijzing), wat gemockt is, wat licentie-geblokkeerd is (R-01..R-05 met doorlooptijden uit de gap-analyse §3.5) — het eerlijke verkoopverhaal.
- **Pilot-onboarding-runbook**: van getekende pilot naar draaiende tenant (stappen, verantwoordelijkheden, R-01/R-02/R-08-acties die de instelling zelf moet starten).
- Wiki/Notion-sync van de statussen zodra de koppeling terug is.

**DoD**: drie documenten in `docs/verkoop/`, gereviewd op forbidden words, gelinkt vanuit README.

### Volgorde en parallellisatie

W0 → W1 → W2 → W3 → W4 → W5, met twee uitzonderingen: W4-stap-1-voorbereiding (changelog-discipline) loopt continu mee, en de Unraid-bereikbaarheidscheck wordt bij elke werkstroom-grens herhaald zodat W4 naar voren kan schuiven zodra de server er is. Binnen werkstromen zijn PR's de parallelliseerbare eenheid.

---

## §6 — Uitvoeringsprotocol (voor élk uitvoerend model)

Dit protocol maakt het traject model-agnostisch uitvoerbaar. Het geldt voor Fable, Opus of welk model dan ook dat een werkstroom oppakt.

1. **Lees eerst**: dit document; het plan-document van de actieve werkstroom; `CLAUDE.md` (hard rules — Dutch UI, FHIR-native, forbidden words, tokens, route-mount-volgorde); memory `project_state`.
2. **Werkwijze per PR**: korte feature-branch vanaf actuele main → TDD waar logica (test eerst, rood, dan groen) → patroonlaag en tokens verplicht in UI-werk → `pnpm typecheck && pnpm lint && pnpm test` lokaal → push → PR → **CI moet volledig groen** (inclusief E2E-job; die is niet formeel verplicht maar in dit traject behandelen we hem als verplicht) → merge → volgende.
3. **Omgeving**: Windows; `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` vóór elk pnpm-commando (PowerShell). Geen lokale Docker: gebruik CI voor stack-verificatie; als Unraid (192.168.1.10) bereikbaar is, is staging-verificatie via `ssh root@192.168.1.10` + `http://192.168.1.10:13000` beschikbaar (deploy-workflow in memory `reference_unraid`).
4. **Verificatie-eerlijkheid**: geen "werkt"-claim zonder draaiende verificatie (test-output, CI-run, screenshot). Bij falende CI: eerst diagnose, geen retry-zonder-fix, nooit checks omzeilen.
5. **Eerlijkheidsregel features**: half werkend bestaat niet in dit traject — werkend maken binnen de timebox of uitzetten mét roadmap-label en backlog-notitie.
6. **Scope-discipline**: geen nieuwe functionaliteit buiten dit document; verleidingen (nieuwe features, refactors buiten de slice) → backlog-notitie in het overdrachtsrapport. Diepte boven breedte bij twijfel (Kevins besluit 2026-06-12).
7. **Voortgangsborging**: na elke gemergde PR het projectgeheugen bijwerken (memory `project_state`: wat af, wat volgende); na elke werkstroom het overdrachtsrapport aanvullen. Een vers model moet vanaf main + memory + dit document kunnen doorwerken zonder deze sessie.
8. **Als Kevin terugkomt**: §8 (open punten) actief voorleggen; niet wachten met mergen van al-groene PR's.
9. **Limieten-protocol (Kevin, 2026-07-10)**: nadert de sessie zijn gebruikslimiet, dan pauzeren op een PR-grens — alles gecommit/gepusht, memory + overdrachtsrapport bijgewerkt — en hervatten zodra het weer kan. Nooit half werk in de werkboom achterlaten bij een pauze.

---

## §7 — Besluiten genomen in Kevins afwezigheid (met rationale)

| # | Besluit | Rationale |
|---|---|---|
| 1 | Procesmanagement-eerst (aanpak B, §3) | Kevins expliciete pijnpunt; zes van de tien problemen zijn architectureel en werken door in alles erboven |
| 2 | `/api/me` binnen W1 getrokken (was backlog ME-01) | Wortel-oorzaak van claim-verwarring, audit-anonimiteit, Vandaag-lege-staat én demo-login-zwakte; klein genoeg om nu te doen |
| 3 | Flowable native tenantId, fail-closed, zonder migratie van bestaande instanties | Bestaande instanties zijn dev-data; fail-open is een tenant-lek dat een pilot-audit niet overleeft |
| 4 | FHIR-Tasks blijven een tweede taakbron (met correcte routing) i.p.v. migratie naar Flowable | Migratie is riskant en levert de gebruiker niets; correcte routing wel |
| 5 | Licentie-geblokkeerde Tier-1-features buiten MVP-scope; eerlijke roadmap-matrix in plaats daarvan | Kevins besluit 2026-06-12 (diepte-product ná pilot-tekening); randvoorwaarden R-01..R-05 hebben maandenlange doorlooptijden die pas bij pilot starten |
| 6 | Live = Unraid + prod-compose + Cloudflare Tunnel; hosting-leverancierskeuze blijft uitgesteld | Conform production-ready-traject (portable); Unraid is de enige beschikbare server en "live zien staan" is daar realiseerbaar zonder nieuwe kosten/accounts |
| 7 | Duplicaat-Taakwerkbak, ontwerp-stub en statische voorbeelden-pagina verwijderd | Duplicatie is de bron van de drift; functionaliteit blijft bereikbaar via werkbak resp. Sjablonen-tab |
| 8 | DMN/herindicatie-timer/canvas-extra's onder timebox-regel | "Alles moet werken" > "alles moet bestaan"; §4.5 |
| 9 | E2E-job de facto verplicht behandeld in dit traject | Zonder lokale Docker is CI de enige stack-verificatie; de keten-bewijzen zijn de kern van P2 |

## §8 — Open punten voor Kevin (bij terugkomst)

1. **Domein voor live**: is `ecd.windahelden.nl` (bestaande tunnel) acceptabel als pilot-/demo-URL, of komt er een eigen domein (bijv. demo.openzorg.nl)? Tunnel-hostname is één config-regel.
2. **Unraid-bereikbaarheid**: server was 2026-07-10 onbereikbaar vanaf de dev-machine (SSH-timeout). Staat hij uit, of is het netwerk gewijzigd? W4 wacht hierop (al het overige is voorbereid).
3. **Beheerder-IA-bevestiging** (openstaand reviewpunt uit Fase 1): beheerder = werkruimtes [bouwen, organisatie] — akkoord? Werkbak-nav-item toegevoegd aan vandaag/rooster/team (W1-3): akkoord?
4. **DEPLOY_ENABLED / deploy.yml**: automatische main-deploy naar een server willen we die (naar staging), of blijft deploy release-tag-gedreven? (W4 ruimt de workflow op basis van dit antwoord op; default: release-tag-gedreven, main-autodeploy uit.)
5. **Login-rolkeuze verdwijnt** (W3) zodra serverrollen staan — de demo-flow "kies je rol bij inloggen" verandert dan in vijf testaccounts. Akkoord? (Voor sales-demo's is per-rol inloggen met echte accounts overtuigender.)
6. **Notion-sync**: MCP her-koppelen zodat backlog-statussen (workflow-cluster, ME-01, gedane slices) bijgewerkt worden; tot die tijd is dit document + overdrachtsrapport de status.
7. **Verkooppakket-review** (W5): demo-script en roadmap-matrix zijn concept tot Kevin ze reviewt — m.n. pricing/positionering blijven bewust buiten dit traject.

## §9 — Risico's & mitigaties

| Risico | Kans | Impact | Mitigatie |
|---|---|---|---|
| Unraid blijft onbereikbaar | reëel | W4 (P3) niet afrondbaar | Alles voorbereid; uitrol = één commando; expliciet gemarkeerd in overdrachtsrapport; rest van traject onafhankelijk |
| CI-E2E flaky met uitgebreide proces-keten | middel | vertraging per PR | Keten-test gefaseerd opbouwen (per PR een deel); retries in CI staan al op 1; testdata per test geïsoleerd |
| Flowable-native-tenant blijkt beperkingen te hebben (bv. definitie-per-tenant-duplicatie) | laag/middel | W1-1 herontwerp | Vroeg in W1-1 een spike-taak: tenant-gedrag verifiëren tegen draaiende Flowable in CI vóór de rest van de PR |
| /api/me-rolmapping botst met bestaand demo-login-model | middel | login breekt voor testers | Overgangsregel met fallback + waarschuwing (§4.3.2); seed-update pas in W3 wanneer alles staat |
| Scope-kruip in normalisatie (W2 is breed) | hoog | traject rekt uit | Batches met vaste DoD; eerlijkheidsregel; monoliet-splitsing alleen bij >500 regels |
| bpmn-js private-internals breken bij dependency-update | laag | canvas-regressie | Geen bpmn-js-upgrade in dit traject; opschoning beperkt zich tot eigen code |

## §10 — Buiten scope van dit document

- Functionele Tier-1/2-diepte-epics (medicatieveiligheid, declaratie-pijplijn, HR-sync, externe koppelingen) — volgen per epic-build ná pilot, conform gap-analyse.
- Hosting-leverancierskeuze, NEN-certificeringstrajecten, juridische templates (R-06..R-08).
- Native app, cliëntportaal, offline-modus (post-v1.0).
- Prijsstelling en commerciële voorwaarden (Kevin + B.V.).

---

*Uitvoeringsplannen: `docs/superpowers/plans/2026-07-10-w*-*.md` (per werkstroom). Voortgang: memory `project_state` + overdrachtsrapport.*
