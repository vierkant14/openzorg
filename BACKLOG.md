# OpenZorg Backlog

Laatst bijgewerkt: 2026-04-11

## Sprint 3 — Restant (Planning + Workflows) — COMPLEET

### Hoge prioriteit

- [x] **WFL: Deploy endpoint** — Generieke `POST /api/bpmn-templates/:templateId/deploy` route toegevoegd
- [x] **WFL: Meer BPMN templates** — 4 templates: intake-proces, zorgplan-evaluatie, herindicatie, mic-afhandeling
- [x] **WFL: Flowable tenant-isolatie** — tenantId als process variable + filter op queries (in progress door agent)
- [x] **Custom velden in frontend** — "Extra velden" tab op client-detail die custom fields dynamisch rendert. Implementatie:
  1. Frontend laadt bij openen detailpagina de tenant-configuratie (`GET /api/admin/custom-fields?resourceType=Patient`)
  2. Render per custom field een input (type afhankelijk van fieldType)
  3. Bij opslaan: waarden als FHIR extensions meesturen
  4. Bij laden: extensions uitlezen en tonen

### Middelhoge prioriteit

- [x] **Beschikbaarheid frontend** — `/planning/beschikbaarheid` pagina voor medewerker-roosters met slot-toevoegen en tijd-blokkeren.
- [x] **Dagplanning view** — Visuele dagplanning per medewerker met medewerker-dropdown en tijdlijn. `/planning/dagplanning`.
- [x] **Herhalingen frontend** — UI voor terugkerende afspraken met RRULE, dag-selectie en preview. `/planning/herhalingen`.
- [x] **Procesinstantie details** — UI om lopende workflow-instanties te bekijken (status, taken, variabelen). `/admin/workflows/instanties`.
- [x] **Taakformulieren** — Flowable user tasks met inline formuliervelden (resultaat, opmerking, goedgekeurd). Variables worden doorgegeven bij afronden.

### Lage prioriteit

- [x] **Configuratie persistentie** — Custom fields/validation rules opgeslagen in PostgreSQL `openzorg.tenant_configurations` tabel (was in-memory Map).
- [ ] **Apotheek als Organization** — Nu alleen tekstveld, later koppelen aan FHIR Organization resource.
- [x] **Huisarts als Practitioner** — Dropdown lookup naar medewerkers, opslaat als FHIR Practitioner referentie.

## Sprint 4 — Facturatie + E2E

### Facturatie (hoofdstuk 10 uit requirements)

- [x] **FAC-01: Declaratieregels engine** — Product-catalogi per financieringstype (WLZ, WMO, ZVW, Jeugdwet) met tarieven. PostgreSQL persistentie.
- [ ] **FAC-02: AW319/AW320 berichten** — Vektis standaard declaratieberichten genereren (toekomstige integratie)
- [x] **FAC-03: Facturatie dashboard** — Volledig dashboard met overzicht, prestatie-registratie, declaratie-aanmaak, indienen, statusbeheer
- [ ] **FAC-04: VECOZO koppeling** — Adapter voor declaratie-indiening via VECOZO (toekomstige integratie)
- [ ] **FAC-05: Retourinformatie verwerken** — Retourberichten inlezen en verwerken (toekomstige integratie)

### Koppelingen (hoofdstuk 11 uit requirements)

- [ ] **INT-01: AFAS connector** — HRM/salarisadministratie sync (medewerkergegevens)
- [ ] **INT-02: Exact Online connector** — Financiele administratie sync
- [ ] **INT-03: VECOZO connector** — Indicatie-verificatie en COV-check
- [ ] **INT-04: MAZ-bericht (iWlz)** — Elektronisch bericht voor Wlz-overdracht

### Vaccinaties

- [x] **Vaccinaties tab (FHIR Immunization)** — Volledige CRUD, veelvoorkomende vaccins dropdown, statusbadges

### Master Admin & Navigatie

- [x] **Master admin management** — Meerdere admins via DB, niet meer hardcoded
- [x] **Tenant switcher voor master admins**
- [x] **Navigation redesign** — Aparte Planning tab, Beheer sectie, Platform master-only

### Open Source & ADRs

- [x] **EUPL 1.2 licentie + CONTRIBUTING.md** toegevoegd
- [x] **ADR-005: OTAP deployment strategie**
- [x] **ADR-006: Open-source business model**

### E2E Tests (Playwright)

- [ ] **E2E-01: Login flow** — Medplum PKCE login
- [ ] **E2E-02: Client CRUD** — Aanmaken, bekijken, bewerken, archiveren
- [ ] **E2E-03: Zorgplan workflow** — Zorgplan aanmaken, doelen, interventies, evaluatie
- [ ] **E2E-04: Planning** — Afspraak aanmaken, dagplanning, beschikbaarheid
- [ ] **E2E-05: Workflow** — Proces deployen, starten, taken afhandelen
- [ ] **E2E-06: Multi-tenant** — Twee tenants, data-isolatie verificatie

## Sprint 4b — Zorgplan Verrijking & Overig

- [ ] Evaluatiehistorie per doel (versioning, was doel bereikt?)
- [ ] Digitale handtekening client/vertegenwoordiger (consent)
- [ ] PDF export van zorgplan
- [ ] MDO-verslagen koppelen aan zorgplan
- [ ] Wilsverklaring / BOPZ-status
- [ ] Foto van client (Patient.photo)
- [ ] Medicatieoverzicht (MedicationStatement)

## Verbeteringen aan bestaande functionaliteit

### ECD — Clientregistratie verrijken

Het huidige formulier bevat nu:
- Persoonsgegevens: voornaam, tussenvoegsel, achternaam, geboortedatum, geslacht, BSN, burgerlijke staat
- Contactgegevens: telefoon (vast+mobiel), e-mail
- Adres: straat, huisnummer, toevoeging, postcode, woonplaats
- Zorgcontext: huisarts, apotheek, verzekeraar, polisnummer
- Indicatie: type (Wlz/Wmo/Zvw/Jeugdwet), CIZ besluitnummer, start/einddatum, zorgprofiel

Nog toe te voegen (gebaseerd op VVT-processen):
- [x] Allergieen/intoleranties tab (FHIR AllergyIntolerance)
- [ ] Medicatieoverzicht tab (FHIR MedicationStatement) — zie Sprint 4b
- [x] Diagnoses/aandoeningen tab (FHIR Condition)
- [x] Risicoscreenings (valrisico, decubitus, ondervoeding) — FHIR RiskAssessment
- [ ] Wilsverklaring / BOPZ-status — zie Sprint 4b
- [ ] Foto van client (FHIR Patient.photo) — zie Sprint 4b

### Zorgplan verrijken

Het zorgplan bevat nu:
- Titel, beschrijving, periode, verantwoordelijke
- Doelen per leefgebied (12 leefgebieden)
- Interventies per doel

Nog toe te voegen:
- [ ] Evaluatiehistorie per doel (was doel bereikt? wat is de nieuwe status?) — zie Sprint 4b
- [ ] MDO-verslagen (multidisciplinair overleg) gekoppeld aan zorgplan — zie Sprint 4b
- [ ] Betrokken disciplines per zorgplan
- [ ] Handtekening client/vertegenwoordiger (consent) — zie Sprint 4b
- [ ] Export naar PDF — zie Sprint 4b

### Configuratie verrijken

- [x] **Dropdown/multi-select veldtypes** — Nieuw: dropdown, multi-select, textarea als CustomFieldType met options editor
- [x] **Veld aan/uitzetten** — Active/inactive toggle per custom field (PATCH endpoint + frontend toggle)
- [x] **Verplicht-vlag** — Required checkbox bij aanmaken custom field

### Workflows verrijken

Huidige workflow-templates:
- [x] Intake-proces (aanmelding beoordelen → goedkeuring/afwijzing → intake plannen)
- [x] Zorgplan-evaluatie (6-maandelijks)
- [x] Herindicatie-proces
- [x] MIC-afhandeling

Toe te voegen VVT-processen:
- [ ] Overlijden/uitschrijving
- [ ] Klachtenafhandeling
- [ ] Onboarding nieuwe medewerker

## Sprint 5 — Roostering, Contracten & Capaciteit (gepland)

### Contractbeheer
- [ ] **ROS-01: Contractregistratie** — Contract per medewerker: type (vast/flex/oproep/ZZP), FTE, uren per week, ingangsdatum, einddatum
- [ ] **ROS-02: Contracturen dashboard** — Overzicht beschikbare uren vs geplande uren per medewerker
- [ ] **ROS-03: Contract als FHIR** — PractitionerRole.extension met contractgegevens

### Roostering
- [ ] **ROS-04: Weekrooster** — Rooster per medewerker per week met diensttypen (vroeg/laat/nacht/weekend)
- [ ] **ROS-05: Roostersjablonen** — Herbruikbare rooster-templates per locatie/afdeling
- [ ] **ROS-06: Ruilverzoeken** — Medewerkers kunnen diensten onderling ruilen (goedkeuring teamleider)
- [ ] **ROS-07: Beschikbaarheidsvoorkeur** — Medewerker geeft voorkeursdagen/-tijden aan
- [ ] **ROS-08: Roostervalidatie** — Automatische check: minimale bezetting, max uren, rusttijdnorm (ATW), vakantie

### Capaciteitsplanning
- [ ] **CAP-01: Locatiecapaciteit** — Bedden/plaatsen per locatie registreren
- [ ] **CAP-02: Bezettingsgraad** — Dashboard: capaciteit × bezetting × beschikbare medewerkers
- [ ] **CAP-03: Onderbezetting signalering** — Waarschuwing bij onvoldoende personeel voor geplande zorg
- [ ] **CAP-04: Overbezetting signalering** — Waarschuwing bij teveel clienten voor beschikbaar personeel

### Locatiegebonden regels
- [ ] **LOC-01: Roosterregels per locatie** — Intramuraal: nachtdiensten verplicht; extramuraal: wijkindeling
- [ ] **LOC-02: Zorgproces-specifiek** — Roosterregels per zorgtype (verpleeghuiszorg vs wijkverpleging vs dagbesteding)
- [ ] **LOC-03: Reistijdberekening** — Extramuraal: reistijd tussen clienten meenemen in planning

## Sprint 6 — Integraties & API Platform (gepland)

**Status: Niet nu — geparkeerd voor later**

Dit zijn backlog-items die pas opgepakt worden nadat de kernfunctionaliteit solide is.

### API Platform
- [ ] **API-01: OpenAPI spec** — Automatische OpenAPI 3.0 documentatie voor alle endpoints
- [ ] **API-02: API sleutels per integratie** — Service accounts met specifieke RBAC-permissies
- [ ] **API-03: Webhook events** — Uitgangende events bij CRUD-acties (client aangemaakt, afspraak gewijzigd, etc.)
- [ ] **API-04: FHIR Subscriptions** — Standaard FHIR subscription mechanisme voor real-time notificaties
- [ ] **API-05: Rate limiting per tenant** — Bescherming tegen overmatig API-gebruik
- [ ] **API-06: API documentatieportaal** — Interactieve API docs voor integrators (Swagger UI)

### Externe koppelingen
- [ ] **INT-05: Roosterpakket adapter** — Import/export van roosters naar/van externe roosterpakketten
- [ ] **INT-06: HRM adapter** — Medewerker + contractdata sync met HR-systemen
- [ ] **INT-07: CSV/Excel import** — Bulk import van clienten, medewerkers, locaties

### Procesconfiguratie (onboarding)
- [ ] **OBD-01: Visuele procesweergave** — Standaard VVT-processen tonen tijdens onboarding, client kan bevestigen/aanpassen
- [ ] **OBD-02: Processjablonen per sector** — VVT, GGZ, GHZ hebben elk standaard procesflows
- [ ] **OBD-03: Bestaande systemen inventarisatie** — Tijdens onboarding vragen welke systemen al in gebruik zijn, per module

## Technische schuld

- [ ] Configuratie opslag: in-memory Map → database
- [x] Dashboard stats — Afspraken vandaag, open taken en wachtlijst tellen nu daadwerkelijk mee
- [ ] API error handling: meer specifieke foutmeldingen
- [ ] Frontend state management: overwegen React Query of SWR voor data fetching
- [ ] Medplum auth tokens: refresh mechanisme toevoegen
- [ ] Docker health checks: workflow-bridge toevoegen aan compose
- [ ] Logging: gestructureerde logging (JSON) voor productie
- [ ] Rate limiting: API rate limiting toevoegen per tenant

## Inspiratie: ONS DB Schema Analyse (v4219)

Uit analyse van het ONS DB schema (754 pagina's, openbaar). **Let op**: Nooit termen/namen overnemen (forbidden words CI check).

### Zorgplan-architectuur (belangrijkste les)
ONS gebruikt een **domein → doel → actie** hierarchie met DEFINITIE-tabellen:
- Organisaties configureren domeinen, aandachtspunten, doelen, en acties als herbruikbare definities
- Per client worden deze geinstantieerd in zorgplanregels
- Voortgang bijgehouden met `percentageRealized` (0-100)
- `linkId` persisteert over zorgplan-versies voor historie
- Digitale handtekeningen met rol, datum, immutable flag
- Client akkoord-types: ondertekend / besproken / niet akkoord / later bespreken

**Toepassing voor OpenZorg:** Onze leefgebieden-structuur is een goede start, maar we missen:
- [ ] Configureerbare domein/doel/actie definities (admin kan templates maken)
- [ ] Voortgangspercentage per doel
- [ ] Versiehistorie van zorgplannen (linkId concept)
- [ ] Digitale handtekening/akkoord workflow
- [ ] Evaluatiehistorie

### Client-gegevens die we nog missen
- [ ] Genderidentiteit + voornaamwoorden (zij/haar, hij/hem, die/diens, anders) — inclusiviteit
- [ ] BSN verificatie audit trail (WID check, geverifieerd door wie, wanneer)
- [ ] Roepnaam (preferredName)
- [ ] Opleiding, woonsituatie, religie, nationaliteit
- [ ] Burgerlijke staat MET ingangsdatum
- [ ] Privacy-instellingen per client (toestemming/consent tracking)
- [ ] Vertrouwelijkheidsvlag (secret) voor beschermde clienten

### Modules die ONS heeft (roadmap-inspiratie)
Prioriteit 1 (VVT-essentieel):
- [ ] Medicatieoverzicht (toedienlijsten, G-standaard)
- [ ] Vragenlijsten/screenings (configureerbaar, gekoppeld aan zorgplan)
- [ ] MDO/overleggen (deelnemers, onderwerpen, verslagen)
- [ ] Vrijheidsbeperkende maatregelen (Wvggz/Wzd, met evaluaties)

Prioriteit 2 (nice to have):
- [ ] Groepszorg (activiteiten, tijdlijnen, registraties)
- [ ] Zorgpaden (tijdsgebonden modules met intenties)
- [ ] Zorgtrajecten/episodes (met subdoelen, acties, documenten)
- [ ] Planningsoptimalisatie (geautomatiseerd roosteren)

### Technisch verschil
ONS gebruikt openEHR (ADL2/JSON) + SNOMED CT. OpenZorg gebruikt FHIR R4 + Zib.
Dit betekent dat we FHIR-resources moeten gebruiken voor wat ONS in openEHR-composities opslaat.
Relevante FHIR mappings: AllergyIntolerance, MedicationStatement, Questionnaire/QuestionnaireResponse, RiskAssessment, Consent.
