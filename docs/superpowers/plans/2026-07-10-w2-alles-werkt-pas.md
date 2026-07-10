# W2 — Alles-werkt-pas: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De laatste niet-genormaliseerde plekken repareren, het dashboard tot demo-waardig landingsscherm maken, en de resterende inconsistenties (dubbele lokale states, koppen-wildgroei) in één pass wegwerken.

**Architecture:** Twee PR's: (1) reparaties + dashboard, (2) dedupe/consistentie-pass + zorgplan-splitsing. Voorwaarde: W1 gemerged (dashboard consumeert `useWerkbak` en `/api/me`).

**Tech Stack:** Next.js 15, `@openzorg/shared-ui`, Playwright (CI).

## Global Constraints

Identiek aan W1-plan (zie `2026-07-10-w1-procesmanagement-revamp.md`): Nederlands, patroonlaag, tokens, strict TS, PATH-fix, CI groen per PR, co-author-regel, eerlijkheidsregel.

## Audit-referentie (verkenning 2026-07-10, 81 pagina's)

- **Bucket B (niet genormaliseerd)**: `ecd/[id]/dashboard` (4-regel stub), `ecd/[id]/verzekering` (raw gray regel 71-72), `admin/configuratie/custom-fields` (553 regels, gray op 310/317).
- **Raw-gray-restjes**: bovenstaande + 1× `bg-slate-100` in `rapportages/page.tsx`.
- **Dubbele lokale `Spinner()`/`ErrorMsg()`**: hele ecd-tab-familie (allergieen, contactpersonen, vaccinaties, diagnoses, mdo, verzekering, documenten, indicaties, e.a. — grep `function Spinner()` onder `apps/web/src/app/ecd/[id]/`).
- **Koppen-wildgroei**: `text-2xl` (werkbak/berichten/medicatie-overzicht), `text-display-lg` (facturatie/contracten/overdracht/ecd-lijst/dashboard), `text-3xl` (admin/configuratie), `text-display-md` (wiki/geen-toegang/onboarding) — `PageHeader` standaardiseert.
- **Monolieten inhoudelijk oké**: `ecd/[id]/page.tsx` 1026, `ecd/[id]/zorgplan` 805, `admin/medewerkers` 605, `admin/organisatie` 587, `admin/validatie` 517 — alleen zorgplan wordt gesplitst (demo-kritiek), rest on-touch.

---

# PR W2-1 — Reparaties + dashboard (branch `feat/w2-reparaties-dashboard`)

### Task 1: De drie bucket-B-pagina's

**Files:** `apps/web/src/app/ecd/[id]/dashboard/page.tsx`, `apps/web/src/app/ecd/[id]/verzekering/page.tsx`, `apps/web/src/app/admin/configuratie/custom-fields/page.tsx`, `apps/web/src/app/ecd/[id]/werkgebieden.ts` (check hoe de dashboard-tab in de werkgebied-nav hangt)

- [ ] **Step 1 — dashboard-tab-besluit:** het werkgebied "Overzicht" van het cliëntdossier (`ecd/[id]/page.tsx`) is het echte dashboard. Controleer in `werkgebieden.ts` + `TabNav.tsx` of `/ecd/[id]/dashboard` nog ergens gelinkt is. Zo nee: verwijder de stub-route en klaar. Zo ja: vervang de stub door `redirect` naar `/ecd/[id]` (Next `redirect()` in een server component). Geen dode pagina laten bestaan.
- [ ] **Step 2 — verzekering:** regel 71-72 `bg-gray-100 text-gray-600` → `bg-surface-100 text-fg-muted dark:bg-surface-800`. Voeg meteen `PageHeader` toe als de pagina nog een losse `<h1>` heeft.
- [ ] **Step 3 — custom-fields:** splits naar `custom-fields/VeldenLijst.tsx` + `VeldEditor.tsx` + dunne `page.tsx`; gray-regels 310/317 naar tokens; patroonlaag-states toevoegen; gedrag ongewijzigd (geen functionele wijziging — puur herstructurering, dus geen nieuwe tests vereist naast bestaande CI).
- [ ] **Step 4:** `pnpm typecheck && pnpm lint` groen; grep-verificatie: `grep -rn "bg-gray-\|text-gray-\|border-gray-\|bg-slate-" apps/web/src/app` → 0 hits (fix ook de rapportages-slate-badge).
- [ ] **Step 5:** Commit: `refactor(web): laatste niet-genormaliseerde pagina's naar design-systeem`

### Task 2: Dashboard als landingsscherm

**Files:** Rewrite `apps/web/src/app/dashboard/page.tsx` → dunne container + `apps/web/src/app/dashboard/components/{WelkomKop,TakenTeller,SnelleActies,SignaleringenCard,ActiviteitenFeed}.tsx`

**Interfaces:** Consumes `haalMe()`/`getUserId()` (W1-2), `useWerkbak().aantallen` (W1-3), bestaande endpoints voor signaleringen (`/api/signaleringen`-vorm overnemen uit `apps/web/src/app/signaleringen/page.tsx`) en audit-feed (`/api/admin/audit`-vorm uit `admin/audit/page.tsx`, gefilterd op eigen userId, max 10).

Gedrag (bestaand P1-backlog-item "Home-pagina / landing-scherm"): begroeting met naam uit /api/me ("Goedemorgen, [naam]" op dagdeel), taken-teller-kaart (aantallen uit werkbak + link), 3-4 snelle acties per rol (zorgmedewerker: nieuwe rapportage/cliënten/werkbak; teamleider: MIC/signaleringen/werkbak; via `getUserRole()`), signaleringen-card (open hoog-risico), activiteiten-feed (laatste 10 audit-events van deze gebruiker, NL-geformuleerd). Elke sectie eigen LoadingSkeleton + stille degradatie (sectie verbergen bij fout, ErrorState alleen als álles faalt). Volledige states — de audit vond hier "5 bronnen zonder loading/error".

- [ ] **Step 1:** Bouw componenten states-first; typecheck + lint groen.
- [ ] **Step 2:** Playwright: bestaande smoke/vandaag-spec uitbreiden of `dashboard.spec.ts`: login teamleider → dashboard toont begroeting + taken-teller zonder consolefouten.
- [ ] **Step 3:** Commit: `feat(web): dashboard als landingsscherm met taken, acties en signalen` → PR → CI → merge.

# PR W2-2 — Consistentie-pass (branch `refactor/w2-consistentie`)

### Task 3: Dedupe lokale states + koppen

**Files:** alle `apps/web/src/app/ecd/[id]/*/page.tsx` met lokale `Spinner`/`ErrorMsg` (grep-lijst uit audit); koppen-pagina's uit de audit-lijst.

- [ ] **Step 1:** Mechanische vervanging per bestand: lokale `Spinner()` → `LoadingSkeleton` (regels-aantal passend bij content), lokale `ErrorMsg` → `ErrorState` (met `onOpnieuw` waar een load-functie bestaat), losse `<h1>`-blokken → `PageHeader`. Batch van ~6 bestanden per commit, na elke batch typecheck+lint.
- [ ] **Step 2:** Grep-verificatie: `grep -rln "function Spinner()" apps/web/src/app` → 0; koppen-grep (`text-3xl\|text-display-lg` in page-koppen) alleen nog waar bewust (landing/visie/wiki statisch mag afwijken — documenteer welke bewust blijven in de PR-beschrijving).
- [ ] **Step 3:** Commit(s): `refactor(web): dedupe states en koppen naar patroonlaag (batch N)`

### Task 4: Zorgplan-pagina splitsen (demo-kritiek)

**Files:** `apps/web/src/app/ecd/[id]/zorgplan/page.tsx` (805 regels) → `zorgplan/useZorgplan.ts` (data + acties), `zorgplan/DoelenLijst.tsx`, `zorgplan/DoelKaart.tsx` (incl. evaluaties), `zorgplan/HandtekeningenPaneel.tsx`, dunne `page.tsx`. Recept: exact zoals de rapportage-splitsing (zie `ecd/[id]/rapportages/` als referentie-structuur).

- [ ] **Step 1:** Splitsen zonder gedragswijziging; typecheck + lint groen.
- [ ] **Step 2:** Bestaande e2e (golden path raakt zorgplan? check `golden-path-zorgmedewerker.spec.ts`) blijft groen in CI — dat is het regressiebewijs.
- [ ] **Step 3:** Commit: `refactor(web): zorgplan-pagina gesplitst (hook + componenten)` → PR → CI → merge.

### Task 5: Dode-knoppenjacht

- [ ] **Step 1:** Loop de werkruimte-navigatie per rol langs (vandaag/rooster/team/bouwen/organisatie/systeem/platform) en noteer elke knop/link die niets doet of naar een fout leidt; fix klein leed direct, groter leed → eerlijkheidsregel (verwijderen + roadmap-notitie in overdrachtsrapport).
- [ ] **Step 2:** Bevindingen + fixes in de PR-beschrijving; CI groen; merge. Memory bijwerken (W2 af).
