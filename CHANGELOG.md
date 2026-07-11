# Changelog

Alle noemenswaardige wijzigingen aan OpenZorg worden hier bijgehouden.
Formaat: [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/); versies volgen [SemVer](https://semver.org/lang/nl/).

## [Unreleased]

### Toegevoegd
- Procesmanagement-revamp (W1): proces-catalogus in domeintaal (Laag 1 ⊕ tenant-overrides, één bron van waarheid voor zorgpad-namen/stappen/formulieren); werkbak als persoonlijke inbox (tabs Mijn/Beschikbaar/Alle, formulieren uit de catalogus, cliënt-links, deadline-urgentie) mét plek in de navigatie; Processen-hub met tabs Actieve zorgpaden/Sjablonen ("Activeren")/Lopend (voortgang per cliënt, annuleren met reden)/Geavanceerd
- Identiteitslaag `/api/me` (ME-01): login → Practitioner + rol; serverrol wint van de demo-rolkeuze; `X-User-Id` op alle API-calls; audit op persoon
- Token-verificatie op de workflow-bridge (Medplum `auth/me` + tenant-crosscheck; super-admin voor systeemactoren)
- Per-tenant zorgpad-deployments met ensure-deployed (verse omgevingen falen nooit stil); annuleren van lopende instanties; unclaim ("Teruggeven")
- FHIR-taken zijn opneembaar en afrondbaar in de werkbak (eigen claim/complete-routes)
- Volledige BPMN-diagrammen voor alle vijf zorgpad-templates (DI-generator)
- E2E-keten-bewijs: intake van activeren → automatische start → persoonlijke claim → formulier → voortgang in de hub; plus FHIR-taak-flow
- Demo-seed `seed-processen.sh` (gevulde werkbak + lopende zorgpaden per tenant)

### Gewijzigd
- Fail-closed tenant-isolatie in de proces-engine (taken/instanties zonder tenant zijn nergens zichtbaar; was fail-open met legacy-fallback)
- Taakformulieren-beheer is catalogus-gedreven (oude hardcoded takenlijst bevatte niet-bestaande taak-keys)
- Canvas: deploy/start-identiteit volgt de XML-proces-id; template-laden met auth; dode velden vervangen door eerlijke verwijzingen; DMN gelabeld "Experimenteel"
- Login zonder reload-loop bij een haperende identiteits-call; sessies tonen een "demo-rol"-label zolang het account geen serverrol heeft

### Opgelost
- Instanties-overzicht was dubbel kapot (native-vs-variabele-tenantfilter + genegeerde `processInstanceId`) — "Lopend" toont nu echt de lopende zorgpaden
- FHIR-taken gaven 500 bij oppakken/afronden (routeerden naar de verkeerde engine)
- Timer-service startte nooit iets (ontbrekende tenant-header), corrumpeerde variabelen (array door `Object.entries`) en dupliceerde processen (geen idempotentie)
- Trigger-engine stuurde geen token mee (automatische intake-start faalde na de bridge-hardening) en had dezelfde variabelen-bug
- Oversight-rollen laadden de werkbak met vijf sequentiële calls (nu één tenant-brede query)
- Raw-gray-restjes in verzekering- en rapportages-badges; verweesde dashboard-tab-stub in het cliëntdossier verwijderd

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
