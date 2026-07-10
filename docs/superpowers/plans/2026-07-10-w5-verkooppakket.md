# W5 — Verkooppakket: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) of superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax voor tracking.

**Goal:** Drie verkoop-/pilotdocumenten die het eerlijke verhaal vertellen en een pilot operationeel maken, opgebouwd rond het pilotprofiel (kleine VVT-instelling met thuiszorg, 4 locaties, ~80 cliënten).

**Architecture:** Eén docs-PR. Bronnen: spec §1/§8, gap-analyse §3.5 (randvoorwaarden R-01..R-08 met doorlooptijden), W3-pilot-inrichtingsdraaiboek, E2E-suite als bewijsregister.

**Tech Stack:** Markdown in `docs/verkoop/`; forbidden-words-check geldt (geen concurrentnamen).

## Global Constraints

Identiek aan W1-plan. Toon: eerlijk en concreet; elk "werkt"-claim verwijst naar een E2E-test of draaiboek-stap; elk "roadmap"-item benoemt zijn blokkade (licentie/certificering) en doorlooptijd. Pricing en commerciële voorwaarden blijven buiten scope (Kevin).

---

### Task 1: Demo-script

**Files:** Create `docs/verkoop/demo-script.md`

- [ ] **Step 1:** Schrijf het 30-minuten-script rond het pilotprofiel, opgebouwd als verhaal van één instelling ("Zorggroep Horizon, 4 locaties, intramuraal + thuiszorg"): (1) login teamleider → dashboard (signalen, taken); (2) zorgmedewerker-flow: vandaag → cliëntdossier → rapportage met AI-samenvatting; (3) climax planning: rooster per locatie, bezettingscheck, dagplanning als thuiszorg-route; (4) climax processen: Processen-hub → zorgpad activeren → nieuwe cliënt → taak verschijnt in werkbak → afronden → Lopend-tab; (5) beheer: organisatie-inrichting, CSV-import (80 cliënten in minuten), taakformulieren; (6) afsluiter: open source, FHIR-native, lokale AI, roadmap-matrix. Per stap: exacte route, account, verwacht scherm, één kernzin voor de verkoper, en valkuilen (wat niet aanklikken + waarom).
- [ ] **Step 2:** Doorloop het script zelf tegen staging/live en corrigeer elke afwijking (het script mag nooit voorlopen op het product).

### Task 2: Feature- vs. roadmap-matrix

**Files:** Create `docs/verkoop/feature-roadmap-matrix.md`

- [ ] **Step 1:** Tabel per domein (dossier, rapportage, zorgplan, medicatie, planning intramuraal, planning thuiszorg, processen/taken, beheer/configuratie, facturatie, koppelingen, security/compliance) met kolommen: **Werkt nu** (met verwijzing naar E2E-test of demo-stap), **Gemockt/gedeeltelijk** (wat wel/niet), **Roadmap** (met blokkade + doorlooptijd uit gap-analyse §3.5: G-Standaard R-01 4-8wk, Vecozo R-02 6-12wk, UZI R-03, iWlz-acceptatie R-04 8-16wk, Vektis R-05, NEN-certificering R-07 6-12mnd). Sluit af met de pilot-boodschap: welke randvoorwaarden de instelling zelf bij pilot-tekening in gang zet (R-01/R-02/R-08).
- [ ] **Step 2:** Kruis-check tegen de spec §1-pijlers en het overdrachtsrapport: niets claimen wat niet in CI bewezen is.

### Task 3: Pilot-onboarding-runbook

**Files:** Create `docs/verkoop/pilot-onboarding-runbook.md` (bouwt op W3-inrichtingsdraaiboek — niet dupliceren, ernaar verwijzen)

- [ ] **Step 1:** Van handtekening naar draaiende pilot in genummerde stappen met eigenaar (wij/instelling) en doorlooptijd: (1) bewerkersovereenkomst (R-08, instelling+wij); (2) randvoorwaarden-aanvragen starten (R-01/R-02 — instelling, parallel); (3) tenant + master-config (wij, dag 1); (4) organisatie-inrichting via draaiboek (samen, dag 1-2); (5) CSV-cliëntimport (instelling levert export, wij importeren, dag 2); (6) accounts + rollen (dag 2); (7) zorgpaden + taakformulieren afstemmen op hun werkwijze (week 1); (8) schaduwdraaien + evaluatiemomenten (week 2-6); (9) go/no-go-criteria. Plus support-afspraken-sectie (verwijzing naar R-06: op te tuigen vóór echte productie — eerlijk benoemen).
- [ ] **Step 2:** README.md: sectie "Voor zorginstellingen" met links naar de drie documenten.

### Task 4: Afronding

- [ ] `pnpm forbidden-words` lokaal; PR `docs/w5-verkooppakket`; CI groen; merge.
- [ ] Notion/backlog-notities bijwerken (of markeren voor sync zodra MCP terug is); memory `project_state` bijwerken (W5 af → traject-eindcheck tegen spec §1-pijlers P1-P4).
