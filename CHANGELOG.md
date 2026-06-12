# Changelog

Alle noemenswaardige wijzigingen aan OpenZorg worden hier bijgehouden.
Formaat: [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/); versies volgen [SemVer](https://semver.org/lang/nl/).

## [Unreleased]

## [0.2.0] - 2026-06-12

Eerste getagde release. Bevat de volledige plan-2A-reeks:

### Toegevoegd
- ECD-module: cliëntdossier, zorgplannen (SMART-doelen, evaluaties, handtekeningen), rapportages (SOEP/vrij), medicatie, allergieën, vaccinaties, diagnoses, risicoscreenings, wilsverklaringen, VBM, MDO, MIC-meldingen, documenten
- Vijf-rollen RBAC (tenant-admin, beheerder, zorgmedewerker, planner, teamleider) met route-permissiematrix
- Planning: dienst-configuratie, bezettingsprofielen, planning-engine (valideer/optimaliseer/genereer), rooster drag-and-drop, CAO/ATW-regels, herhalingen, wachtlijst
- Facturatie-basis: prestaties, declaraties, NZa 2026-productcatalogus
- Workflow: Flowable BPMN-integratie, werkbak, DMN-editor, intake-template
- AI: lokale Ollama-integratie, contextbewuste chat-assistent, rapportage-samenvattingen, per-tenant AI-configuratie
- Beheer: codelijsten, validatieregels (drielagen), feature flags, vragenlijsten, state-machines, audit-viewer (NEN 7513)
- Multi-tenant: Medplum Projects + PostgreSQL RLS, master-admin-laag
- Productie-deploy: `docker-compose.prod.yml` (GHCR-images, verplichte secrets), backup/restore-scripts met geteste restore
- CI: lint, typecheck, tests, forbidden-words, build, E2E (Playwright); branch-protectie op main

### Gewijzigd
- Licentie gecorrigeerd naar EUPL-1.2 (package.json claimde foutief Apache-2.0)
- Flowable-auth configureerbaar via `FLOWABLE_ADMIN_USER`/`FLOWABLE_ADMIN_PASSWORD` (was hardcoded admin:admin)

### Opgelost
- Zorgmedewerkers (en alle niet-admin-rollen) kregen "geen toegang" bij het openen van een cliëntdossier doordat de traject-status-badge een admin-route aanriep zonder leesrecht
