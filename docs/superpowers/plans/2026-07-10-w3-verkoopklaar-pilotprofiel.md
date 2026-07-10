# W3 — Verkoopklaar + pilotprofiel: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax voor tracking.

**Goal:** Het product aantoonbaar klaar maken voor de doelklant uit de spec (§1-pilotprofiel: kleine VVT-instelling met thuiszorg, 4 locaties, ~80 cliënten): CSV-cliëntimport, pilotprofiel-inrichting, echte rollen op accounts, en E2E-golden-paths per rol.

**Architecture:** Drie PR's: (1) CSV-cliëntimport, (2) identiteit-afronding (seed-rollen + login zonder rolkeuze) + pilotprofiel-seed, (3) golden-paths per rol + security/performance-sanity. Voorwaarde: W1 + W2 gemerged.

**Tech Stack:** Hono/ECD, Medplum FHIR Batch, Next.js, Playwright, bash-seeds.

## Global Constraints

Identiek aan W1-plan. Extra: BSN's in voorbeeld-/testbestanden zijn altijd test-BSN's die de elfproef doorstaan maar als testreeks herkenbaar zijn (zoals de bestaande seed doet — zelfde bron hergebruiken).

---

# PR W3-1 — CSV-cliëntimport (branch `feat/w3-client-import`)

### Task 1: Backend `POST /api/clients/import`

**Files:**
- Create: `services/ecd/src/routes/client-import.ts`, `services/ecd/src/lib/csv.ts` (mini-parser, geen dependency: split op `;` of `,` met quote-support ~40 regels)
- Modify: `services/ecd/src/app.ts` (mount vóór `/api/clients`-catch-all-achtigen), `packages/shared-domain/src/roles.ts` (ROUTE_PERMISSIONS: `{ pattern: "/api/clients/import", POST: "clients:write" }` — vóór het bestaande `/api/clients`-pattern zodat de match klopt; check de match-volgorde in `getRequiredPermission`)
- Test: `services/ecd/src/__tests__/client-import.test.ts`

**Interfaces (Produces):**
```
POST /api/clients/import  (Content-Type: text/csv of multipart veld "bestand")
Kolommen (verplichte header, exact): achternaam;voornaam;geboortedatum;bsn;straat;huisnummer;postcode;plaats;locatie
→ 200 { totaal: number, aangemaakt: number, fouten: Array<{ rij: number; veld?: string; melding: string }> }
```
Gedrag: per rij valideren (verplicht: achternaam, geboortedatum ISO `YYYY-MM-DD`; BSN optioneel maar indien aanwezig elfproef via bestaande validator uit `@openzorg/shared-domain`; locatie moet matchen op naam van een bestaande Location van de tenant — haal Locations één keer op). Geldige rijen → FHIR Patient-batch naar Medplum (bundel van max 20 per batch-call, `identifier` clientnummer via bestaand auto-genereer-mechanisme in de clients-route — hergebruik die functie, geen duplicaat). Dubbel-detectie: bestaande Patient met zelfde BSN → rij overslaan met fout "BSN bestaat al". Audit-event per import (aantallen in details). Foutrijen blokkeren de rest niet.

- [ ] **Step 1: Falende tests**: (a) happy path 3 rijen → 3 aangemaakt; (b) foute BSN → rij in fouten, rest aangemaakt; (c) onbekende locatie → fout per rij; (d) dubbele BSN → overgeslagen. Mock medplumFetch.
- [ ] **Step 2-4:** TDD-cyclus; typecheck/lint/test groen.
- [ ] **Step 5:** Commit: `feat(ecd): CSV-cliëntimport met validatie en foutenrapport (I-05-light)`

### Task 2: Frontend import-flow

**Files:**
- Create: `apps/web/src/app/ecd/import/page.tsx` (+ `ImportResultaat.tsx` als de pagina anders >300 regels wordt)
- Modify: `apps/web/src/app/ecd/page.tsx` (knop "Importeren (CSV)" naast "Nieuwe cliënt" voor rollen met clients:write), `public/voorbeelden/clienten-import-voorbeeld.csv` (NIEUW: 3 voorbeeldrijen met test-BSN's)

Gedrag: upload-veld + download-link voorbeeldbestand + uitleg van het vaste format; na upload een resultaatscherm: totaal/aangemaakt/fouten-tabel (rij, veld, melding, NL). Patroonlaag; foutentabel is de kern — een beheerder moet exact zien welke rij waarom faalde.

- [ ] **Step 1:** Bouwen; typecheck+lint groen.
- [ ] **Step 2:** Playwright `client-import.spec.ts`: login beheerder → import-pagina → upload voorbeeldbestand (fixture met 5 rijen waarvan 1 foute BSN) → resultaat toont 4 aangemaakt + 1 fout; cliëntenlijst bevat een geïmporteerde naam.
- [ ] **Step 3:** Commit: `feat(web): cliëntimport-flow met foutenrapport` → PR → CI → merge.

# PR W3-2 — Echte rollen + pilotprofiel-seed (branch `feat/w3-pilotprofiel`)

### Task 3: Seed-accounts krijgen Practitioner + rol-extensie

**Files:**
- Modify: `infra/scripts/seed.sh` (na gebruikers-aanmaak: per testgebruiker een Practitioner met `https://openzorg.nl/extensions/rol` en de ProjectMembership-profile daaraan koppelen — onderzoek in de seed hoe membership nu gezet wordt; Medplum: membership `profile`-veld naar de Practitioner-reference), en de rol-mapping: jan@horizon.nl → tenant-admin, maria@delinde.nl → tenant-admin, seed-medewerkers → hun rol.
- Modify: `apps/web/src/app/login/page.tsx`: wanneer `/api/me` een rol geeft, de rolkeuze-UI volledig verbergen; alleen bij `rol: null` de keuze tonen mét demo-label (W1-2-fallback blijft de vangrail).

- [ ] **Step 1:** Seed aanpassen; CI-E2E is de verificatie (auth-helper + golden paths loggen in en krijgen serverrollen).
- [ ] **Step 2:** E2E-check toevoegen aan `auth-helper.spec.ts`: na login is er géén rolkeuze zichtbaar en toont het AppShell-gebruikersblok geen "demo-rol"-label.
- [ ] **Step 3:** Commit: `feat(seed): echte rol-membership per account — login zonder rolkeuze`

### Task 4: Pilotprofiel-seed (4 locaties, intramuraal + thuiszorg, 80 cliënten)

**Files:**
- Create: `infra/scripts/seed-pilotprofiel.sh` — bouwt op tenant "Zorggroep Horizon": 4 Locations ("Horizon Centrum", "Horizon Oost", "Horizon West" intramuraal; "Thuiszorg Regio Noord" extramuraal) elk met 2 afdelingen/teams, dienst-config + bezettingsprofielen per intramurale locatie (hergebruik patronen uit `seed-planning-config.sh`), en 80 cliënten via… **de CSV-import-route van Task 1** (genereer het CSV in het script; ~60 intramuraal verdeeld over locaties, ~20 thuiszorg) — zo test de seed meteen het import-endpoint op volume.
- Create: `docs/verkoop/pilot-inrichtingsdraaiboek.md` — stap-voor-stap hoe je dit voor een échte klant doet via de UI (tenant aanmaken → organisatie → diensten/bezetting → CSV-import → zorgpaden activeren → accounts), met per stap de schermroute. Dit document is het bewijs van "wij kunnen jouw instelling inrichten".

- [ ] **Step 1:** Script + draaiboek schrijven; `bash -n` syntax-check.
- [ ] **Step 2:** In CI optioneel maken (env-vlag `SEED_PILOTPROFIEL=1`) — de volle 80-cliënten-run draait minstens één keer aantoonbaar in CI of op staging; resultaat (aantallen) in de PR-beschrijving.
- [ ] **Step 3:** Commit: `feat(seed): pilotprofiel — 4 locaties, VVT+thuiszorg, 80 cliënten via import` → PR → CI → merge.

# PR W3-3 — Golden paths + sanity (branch `test/w3-golden-paths`)

### Task 5: E2E per rol

**Files:** Create `apps/web/tests/e2e/golden-path-planner.spec.ts`, `golden-path-beheerder.spec.ts`, `golden-path-teamleider.spec.ts` (zorgmedewerker bestaat; beheerder-pad kan grotendeels verwijzen naar `proces-keten.spec.ts` maar dekt óók organisatie-inrichting: locatie aanmaken → dienst koppelen).

Scenario's (kern, één per rol): planner: rooster openen → dienst toewijzen aan medewerker → bezettingscheck zichtbaar → dagplanning bekijken. beheerder: organisatie → nieuwe afdeling toevoegen → Processen → sjabloon activeren → Taakformulieren → veld toevoegen. teamleider: dashboard → signalering bekijken → MIC-melding aanmaken → werkbak "Alle taken".

- [ ] **Step 1:** Specs schrijven (hergebruik login-helpers); push; CI-E2E groen (flaky-beleid: expect.poll, geen sleeps).
- [ ] **Step 2:** Commit: `test(e2e): golden paths planner, beheerder, teamleider`

### Task 6: Security- en performance-sanity

- [ ] **Step 1 — sessie-verloop:** verifieer dat 401-redirect (`lib/api.ts:47` en `workflow-api.ts:42`) op álle fetch-paden zit (grep naar losse `fetch(`-calls in `apps/web/src` buiten de twee clients + proxy-routes; vervang door client-helpers — de canvas-loadTemplate is in W1 al gefixt).
- [ ] **Step 2 — secrets-scan:** `grep -rn "password\|secret\|token" infra/ services/ --include=*.ts --include=*.yml -i` handmatig nalopen: geen echte secrets hardcoded (env-refs zijn oké); bevindingen fixen.
- [ ] **Step 3 — N+1-check kernschermen:** dashboard, werkbak, rooster, cliëntenlijst: netwerk-calls per pageload tellen in de Playwright-trace (of code-review van de hooks); >6 sequentiële calls per scherm → parallelliseren met `Promise.all`.
- [ ] **Step 4:** Bevindingen + fixes in PR-beschrijving; CI groen → merge; memory bijwerken (W3 af).
