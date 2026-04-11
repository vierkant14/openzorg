# Enterprise Onboarding & Multi-Tenant Design

> Versie 1.0 — 10 april 2026
> Status: Ontwerp (ter review)

Dit document beschrijft hoe een nieuwe zorgorganisatie wordt aangemeld, ingericht en live gebracht op het OpenZorg-platform. Het omvat de technische tenant-isolatie, het datamodel per klant, en de gefaseerde roadmap van handmatige onboarding naar self-service.

---

## Inhoudsopgave

1. [Overzicht multi-tenancy architectuur](#1-overzicht-multi-tenancy-architectuur)
2. [Onboarding stappen](#2-onboarding-stappen)
3. [Datamodel per tenant](#3-datamodel-per-tenant)
4. [Technische implementatie](#4-technische-implementatie)
5. [Roadmap](#5-roadmap)

---

## 1. Overzicht multi-tenancy architectuur

OpenZorg isoleert klantgegevens op drie niveaus:

| Laag | Mechanisme | Toelichting |
|------|-----------|-------------|
| **FHIR-data** | Medplum Projects | Elke zorgorganisatie krijgt een eigen Medplum Project. Alle FHIR-resources (Patient, CarePlan, Practitioner, etc.) leven binnen dat project. Cross-project access is onmogelijk. |
| **Applicatie-data** | PostgreSQL RLS | De tabel `openzorg.tenants` bevat de tenant-registratie. Alle tenant-specifieke tabellen (`tenant_configurations`, `audit_log`) zijn beveiligd met Row-Level Security op basis van `openzorg.current_tenant_id`. |
| **API-laag** | `X-Tenant-ID` header + middleware | Elke API-call bevat een `X-Tenant-ID` header. De `tenantMiddleware` in Hono valideert dit en zet de tenant-context. Zonder geldig header: HTTP 400. |
| **Workflows** | Flowable `tenantId` | Procesinstanties krijgen een `tenantId` procesvariabele. De `verifyTaskTenant()` guard voorkomt cross-tenant taaktoewijzing. |

### Drie-laags configuratiemodel

```
Laag 1 — Kern (onwijzigbaar)
  BSN elfproef, AGB-validatie, verplichte Zib-velden per resourcetype
  Kan niet door tenant worden uitgeschakeld

Laag 2 — Uitbreiding (tenant-configureerbaar)
  Extra velden, validatieregels, workflowdefinities
  Beheerd via /api/admin/custom-fields en /api/admin/validation-rules

Laag 3 — Plugin (toekomst)
  Code-level extensies via gepubliceerde plugin-interfaces
```

---

## 2. Onboarding stappen

Wanneer een nieuwe zorgorganisatie klant wordt, doorloopt het platform de volgende stappen. Momenteel handmatig (scripts + admin-acties); op termijn geautomatiseerd via een onboarding-API.

### Stap 0: Sector & Module selectie

**Doel:** Bepalen welk type zorgorganisatie de klant is en welke modules nodig zijn.

OpenZorg ondersteunt meerdere zorgsectoren. De sectorkeuze bepaalt welke modules standaard worden geactiveerd, welke financieringsstromen van toepassing zijn, en welke BPMN-workflow-templates worden gedeployed. Zie `docs/zorglandschap-strategie.md` voor het volledige overzicht.

| Keuze | Opties | Toelichting |
|-------|--------|-------------|
| **Sector** | VVT, GGZ, GHZ, Ziekenhuis, Jeugdzorg, Huisartsenzorg, Revalidatie | Bepaalt sectormodules + UI-profiel |
| **Subsector** | Per sector, bijv. VVT → Verpleeghuis / Thuiszorg / Wijkverpleging | Verfijnt default configuratie |
| **Financiering** | Wlz, Wmo, Zvw, Jeugdwet, Wpg, Particulier (meerdere mogelijk) | Bepaalt facturatieregels + indicatietypes |
| **Extra modules** | Medicatieoverzicht, Vragenlijsten, MDO, Groepszorg, Caseload, etc. | Optioneel, onafhankelijk van sector |

**Modulearchitectuur (type-definities in `packages/shared-config/src/configuration.ts`):**

```
┌──────────────────────────────────────────────────────┐
│                    OpenZorg Kern                      │
│  Altijd actief: clientregistratie, medewerkers,       │
│  organisatie, rapportage, planning, configuratie,     │
│  toegangsbeheer, berichten                            │
├─────────┬──────────┬───────────┬────────┬────────────┤
│ VVT     │ GGZ      │ Ziekenhuis│ GHZ    │ Jeugdzorg  │
│ Module  │ Module   │ Module    │ Module │ Module     │
├─────────┴──────────┴───────────┴────────┴────────────┤
│              Optionele modules                        │
│  medicatieoverzicht, vragenlijsten, mdo, groepszorg,  │
│  documentbeheer, wachtlijst, kwaliteitsregistratie    │
└──────────────────────────────────────────────────────┘
```

**Principe: deploy alleen wat je nodig hebt.** Een thuiszorgorganisatie hoeft geen OK-planning of DBC-registratie te laden. De sectorkeuze bepaalt welke pnpm-packages, API-routes, frontend-componenten en BPMN-templates worden geactiveerd.

### Stap 1: Tenant provisionering

**Doel:** Een volledige technische omgeving klaarzetten op basis van de sectorkeuze.

| Actie | Waar | Details |
|-------|------|---------|
| Medplum Project aanmaken | Medplum admin API | Nieuw project met unieke project-ID. Bevat alle FHIR-resources van deze klant. |
| Tenant-rij in PostgreSQL | `openzorg.tenants` | `INSERT INTO openzorg.tenants (name, slug, medplum_project_id, sector, subsector, financieringstypen, enabled_modules)` |
| Initialisatie configuratie | `openzorg.tenant_configurations` | Default validatieregels (Laag 2) + sectorspecifieke custom fields |
| Sectormodules activeren | Module-registry | Kern-modules + sector-defaults (zie `SECTOR_DEFAULT_MODULES` in `configuration.ts`) |
| Flowable tenant-namespace | Flowable REST API | Deploy sectorspecifieke BPMN-procesmodellen met tenant-prefix |

**Bestaand schema (init.sql) — bijgewerkt voor multi-sector:**

```sql
CREATE TABLE openzorg.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                        -- "Zorggroep Horizon"
    slug TEXT NOT NULL UNIQUE,                 -- "zorggroep-horizon"
    medplum_project_id TEXT NOT NULL UNIQUE,   -- Koppeling naar Medplum Project
    sector TEXT NOT NULL DEFAULT 'vvt',        -- Zorgsector
    subsector TEXT,                            -- Bijv. 'thuiszorg', 'verpleeghuis'
    financieringstypen TEXT[] NOT NULL DEFAULT ARRAY['wlz'],
    enabled_modules TEXT[] NOT NULL DEFAULT ARRAY['clientregistratie','medewerkers','organisatie','rapportage','planning','configuratie','toegangsbeheer','berichten'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Beschikbare modules** — per categorie (volledig gedefinieerd in `packages/shared-config/src/configuration.ts`):

| Categorie | Modules | Wanneer |
|-----------|---------|---------|
| **Kern** (altijd) | clientregistratie, medewerkers, organisatie, rapportage, planning, configuratie, toegangsbeheer, berichten | Automatisch |
| **VVT** | zorgplan-leefgebieden, indicatieverwerking, soep-rapportage, mic-meldingen, vbm, vvt-facturatie, iwlz | Bij sector=vvt |
| **GGZ** | behandelplan, rom-vragenlijsten, dbc-registratie, crisiskaart, ggz-scores, medicatiebewaking, wvggz, ggz-facturatie | Bij sector=ggz |
| **Ziekenhuis** | order-entry, dbc-dot, ok-planning, sbar-overdracht, polikliniek, seh-triage, zkh-facturatie | Bij sector=ziekenhuis |
| **GHZ** | ondersteuningsplan, gedragsanalyse, dagbesteding, zzp-registratie, ghz-facturatie | Bij sector=ghz |
| **Jeugdzorg** | gezinsplan, veiligheidsplan, ijw, jeugd-facturatie | Bij sector=jeugdzorg |
| **Optioneel** | medicatieoverzicht, vragenlijsten, mdo, documentbeheer, wachtlijst, kwaliteitsregistratie, groepszorg, caseload | Op aanvraag |

### Stap 2: Gebruikersbeheer

**Doel:** Eerste gebruikers aanmaken en rollen toewijzen.

Er wordt minimaal 1 beheerder-account aangemaakt. Deze beheerder kan vervolgens zelf overige gebruikers uitnodigen.

| Rol | Systeemnaam | Beschrijving |
|-----|-------------|-------------|
| **Beheerder** | `beheerder` | Functioneel beheerder: beheert processen, formulieren, validatieregels en gebruikers |
| **Zorgmedewerker** | `zorgmedewerker` | Wijkverpleegkundige of verzorgende: raadpleegt dossiers, rapporteert, bekijkt planning |
| **Planner** | `planner` | Maakt roosters, beheert beschikbaarheid, plant afspraken |
| **Teamleider** | `teamleider` | Monitort caseload, bekijkt kwaliteitsindicatoren, handelt escalaties af |

**Technische implementatie rollen:**
- Rollen worden gemapped naar Medplum `AccessPolicy`-resources binnen het Medplum Project
- Elke rol bepaalt welke FHIR-resources de gebruiker mag lezen/schrijven
- Authenticatie via Medplum PKCE — token + projectId in localStorage, verstuurd als `Authorization: Bearer` + `X-Tenant-ID`

**Onboarding acties:**
1. Beheerder-account aanmaken in Medplum Project met `beheerder`-rol
2. Welkomstmail versturen met activatielink
3. Beheerder logt in en maakt overige gebruikers aan via beheerpaneel
4. Elke gebruiker wordt gekoppeld aan een `Practitioner`-resource in FHIR

### Stap 3: Basisconfiguratie organisatie

**Doel:** Organisatieprofiel, locaties en teams vastleggen.

Deze gegevens worden als FHIR-resources aangemaakt in het Medplum Project van de tenant:

```
Organization (Zorgaanbieder)
  ├── AGB-code (verplicht, Laag 1 validatie)
  ├── KvK-nummer
  ├── Naam, adres, contactgegevens
  │
  ├── Organization/Location (Locatie)
  │     ├── Naam, adres
  │     └── Type (hoofdvestiging, wijkteam, dagbesteding, etc.)
  │
  └── Organization (Team/Afdeling)
        ├── Naam
        ├── Type (wijkteam, specialistisch team, etc.)
        └── Gekoppelde Practitioners
```

**Volgorde:**
1. Hoofdorganisatie (`Organization`) aanmaken met AGB-code
2. Locaties (`Location`) aanmaken en koppelen
3. Teams/afdelingen als sub-`Organization` aanmaken
4. Zorgmedewerkers (`Practitioner`) aanmaken met BIG/AGB-nummers en koppelen aan teams

### Stap 4: Module-activering

**Doel:** Bepalen welke modules voor deze klant actief zijn.

De `enabled_modules` array in de `tenants`-tabel bepaalt welke functionaliteit beschikbaar is. De functie `isModuleEnabled(tenant, module)` uit `shared-domain` wordt door alle services gecheckt.

| Module | Wat wordt geactiveerd | Afhankelijkheden |
|--------|----------------------|------------------|
| `ecd` | Clientdossier, zorgplannen, rapportages, contactpersonen, documenten, MIC-meldingen | Geen (basismodule) |
| `planning` | Roosters, beschikbaarheid, afspraken, wachtlijst | `ecd` (voor clientgegevens) |
| `facturatie` | Declaraties, iWMO/iJW/iWLZ-berichten | `ecd` + `planning` |
| `rapportage` | Dashboards, kwaliteitsindicatoren | `ecd` |

**Per module worden bijbehorende standaard-items ingericht:**
- Validatieregels (Laag 2 defaults)
- Workflowdefinities (BPMN-processen)
- UI-navigatie-items
- API-routes (services weigeren requests voor niet-geactiveerde modules)

### Stap 5: Datamigratie

**Doel:** Bestaande clientdata importeren vanuit het huidige ECD-systeem.

Dit is het meest complexe onderdeel van de onboarding. Veel zorgorganisaties stappen over van een bestaand ECD. De `adapters/ons-import`-package biedt een startpunt voor importfunctionaliteit.

**FHIR-resources die geimporteerd worden:**

| Prioriteit | Resource | Toelichting |
|-----------|----------|-------------|
| **P1 — Verplicht** | `Patient` | BSN, naam, geboortedatum, adres, verzekeringsgegevens, indicatie |
| **P1 — Verplicht** | `Practitioner` | Medewerkers met AGB/BIG-nummers |
| **P1 — Verplicht** | `RelatedPerson` | Contactpersonen per client |
| **P2 — Belangrijk** | `CarePlan` + `Goal` + `ServiceRequest` | Lopende zorgplannen met doelen en acties |
| **P2 — Belangrijk** | `Condition` | Aandoeningen en problemen |
| **P2 — Belangrijk** | `AllergyIntolerance` | Allergieen |
| **P3 — Wenselijk** | `Observation` | Historische rapportages (SOEP/vrij) |
| **P3 — Wenselijk** | `DocumentReference` + `Binary` | Documenten en bestanden |
| **P3 — Wenselijk** | `Appointment` | Historische afspraken |
| **P4 — Optioneel** | `AuditEvent` | MIC-meldingen (historisch) |

**Migratieproces:**
1. Export uit bronsysteem (CSV, XML, HL7v2, of database-dump)
2. Mapping naar FHIR R4 resources conform Zib-profielen
3. BSN-validatie (elfproef, Laag 1)
4. Dry-run import met validatierapport
5. Productie-import in het Medplum Project
6. Verificatie door functioneel beheerder van de klant

**Aandachtspunten:**
- BSN is een wettelijk beschermd gegeven — verwerking vereist verwerkersovereenkomst
- Historische data moet gekoppeld blijven aan de juiste `Practitioner`-references
- FHIR extensions voor OpenZorg-specifieke velden (`https://openzorg.nl/extensions/...`)
- Audit-trail (NEN 7513) moet ook voor geimporteerde data worden bijgehouden

### Stap 6: Workflowconfiguratie

**Doel:** BPMN-processen deployen en configureren voor de tenant.

OpenZorg gebruikt Flowable Community voor gestructureerde zorgprocessen. Standaardprocessen worden vanuit templates gedeployed; beheerders kunnen deze aanpassen.

**Standaardprocessen (MVP):**

| Proces | Beschrijving | Stappen |
|--------|-------------|---------|
| **Intake** | Nieuwe clientaanmelding | Aanmelding registreren, beoordeling wijkverpleegkundige, goedkeuring/afwijzing teamleider |
| **Zorgplanbeoordeling** | Periodieke evaluatie | Signaal vanuit planner, evaluatie zorgmedewerker, akkoord client, bijstelling plan |
| **MIC-afhandeling** | Incident-melding verwerken | Melding registreren, analyse, maatregelen, terugkoppeling |

**Workflow-isolatie:**
- Elk proces wordt gedeployed met `tenantId` als procesvariabele
- De `verifyTaskTenant()` guard controleert bij elke taakactie of de tenant overeenkomt
- Taken verschijnen in de werkbak (`/api/taken`) gefilterd op tenant en rol

**Onboarding acties:**
1. Standaard BPMN-templates deployen naar Flowable voor deze tenant
2. Eventueel klantspecifieke aanpassingen aan procesflow (extra goedkeuringsstap, andere rolverdeling)
3. Testrun met dummy-data om proces te valideren
4. Activeren voor productiegebruik

### Stap 7: Extra velden configureren

**Doel:** Tenant-specifieke uitbreidingsvelden toevoegen.

Via de configuratie-API (`/api/admin/custom-fields`) kan de beheerder extra velden toevoegen aan FHIR-resources. Dit zijn Laag 2 uitbreidingen.

**Beschikbare veldtypen** (type `CustomFieldType`):
- `string`, `number`, `boolean`, `date`
- `codeable-concept` (gecodeerd gegeven)
- `dropdown`, `multi-select` (met optielijst)
- `textarea` (lang tekstveld)

**Voorbeeld — extra veld "voorkeurstaal" op Patient:**

```json
{
  "resourceType": "Patient",
  "fieldName": "voorkeurstaal",
  "fieldType": "dropdown",
  "required": false,
  "options": ["Nederlands", "Turks", "Arabisch", "Engels", "Anders"]
}
```

Dit wordt opgeslagen als FHIR Extension met URL `https://openzorg.nl/extensions/voorkeurstaal`.

**Onboarding acties:**
1. Inventariseren welke extra velden de organisatie nodig heeft
2. Velden aanmaken via admin-API of beheerpaneel
3. Validatieregels instellen voor de nieuwe velden
4. Testen in acceptatieomgeving

### Stap 8: Validatieregels configureren

**Doel:** Organisatie-specifieke validaties instellen bovenop de kern.

**Laag 1 (Kern) — altijd actief, niet aanpasbaar:**
- BSN elfproef (9 cijfers, gewogen som deelbaar door 11)
- AGB-code validatie
- Verplichte Zib-velden per resourcetype

**Laag 2 (Uitbreiding) — per tenant configureerbaar:**

| Operator | Beschrijving | Voorbeeld |
|----------|-------------|-----------|
| `required` | Veld is verplicht | `birthDate` moet ingevuld zijn |
| `min` / `max` | Numeriek bereik | Leeftijd minimaal 18 |
| `minLength` / `maxLength` | Tekstlengte | Toelichting minimaal 10 tekens |
| `pattern` | Regex-patroon | Postcode: `^\d{4}\s?[A-Z]{2}$` |
| `in` | Waardenlijst | Status moet een van `["actief", "inactief", "overdracht"]` zijn |

**Voorbeeld — geboortedatum verplicht maken:**

```json
{
  "resourceType": "Patient",
  "fieldPath": "birthDate",
  "operator": "required",
  "value": true,
  "errorMessage": "Geboortedatum is verplicht"
}
```

### Stap 9: Testen en livegang

**Doel:** Alles valideren voordat de organisatie live gaat.

**Testfase (1-2 weken):**
1. Functioneel testen door beheerder met testdata
2. Verificatie geimporteerde data (steekproef)
3. Workflowtest (intake-proces doorlopen)
4. Rollentest (iedere rol logt in en voert kerntaken uit)
5. Prestatie-/belastingtest bij grote datasets

**Go-live checklist:**
- [ ] Medplum Project aangemaakt en geconfigureerd
- [ ] Tenant-rij in PostgreSQL met juiste modules
- [ ] Beheerder-account actief en getest
- [ ] Organisatieprofiel compleet (AGB, locaties, teams)
- [ ] Alle Practitioners aangemaakt met BIG/AGB-nummers
- [ ] Clientdata geimporteerd en geverifieerd
- [ ] Standaardworkflows gedeployed en getest
- [ ] Extra velden en validatieregels ingericht
- [ ] NEN 7513 audit logging werkend
- [ ] Verwerkersovereenkomst getekend
- [ ] DNS/domein geconfigureerd (indien van toepassing)
- [ ] Gebruikerstraining afgerond

---

## 3. Datamodel per tenant

### 3.1 Organisatiehierarchie

```
Organization (Zorgaanbieder)
│   FHIR: Organization
│   Identificatie: AGB-code, KvK-nummer
│   Velden: naam, adres, telefoonnummer, email, website
│
├── Location (Locatie/Vestiging)
│     FHIR: Location
│     Velden: naam, adres, type, openingstijden
│     Relatie: managingOrganization → Organization
│
└── Organization (Team/Afdeling)
      FHIR: Organization (partOf → hoofdorganisatie)
      Velden: naam, type, contactpersoon
      Relatie: partOf → bovenliggende Organization
```

### 3.2 Medewerkers

```
Practitioner (Zorgverlener)
│   FHIR: Practitioner
│   Identificatie: AGB-code, BIG-nummer
│   Velden: naam, geboortedatum, geslacht, kwalificaties
│
└── PractitionerRole (Rol in organisatie)
      FHIR: PractitionerRole
      Relatie: practitioner → Practitioner
      Relatie: organization → Organization
      Relatie: location → Location[]
      Velden: specialisme, beschikbaarheid
```

### 3.3 Clienten

```
Patient (Client)
│   FHIR: Patient
│   Identificatie: BSN (elfproef-gevalideerd)
│   Velden: naam, roepnaam, geboortedatum, geslacht, adres,
│           telefoonnummer, email
│   Extensions: verzekering, indicatie (custom FHIR extensions)
│
├── RelatedPerson (Contactpersoon)
│     Relatie: patient → Patient
│     Velden: naam, relatie, telefoonnummer, email
│
├── EpisodeOfCare (Zorgepisode)
│     Relatie: patient → Patient
│     Relatie: managingOrganization → Organization
│     Velden: status, type, periode
│
└── Coverage (Verzekering)
      Relatie: beneficiary → Patient
      Velden: verzekeraar, polisnummer, type (Wlz/Wmo/Zvw/Jeugdwet)
```

### 3.4 Zorgplannen

```
CarePlan (Zorgplan)
│   FHIR: CarePlan
│   Relatie: subject → Patient
│   Relatie: author → Practitioner
│   Velden: status, titel, periode, categorie
│
├── Goal (Doel)
│     FHIR: Goal
│     Relatie: subject → Patient
│     Velden: beschrijving, status, doeldatum, voortgang
│
├── ServiceRequest (Geplande Zorgactiviteit)
│     FHIR: ServiceRequest
│     Relatie: subject → Patient
│     Relatie: requester → Practitioner
│     Velden: beschrijving, status, frequentie, periode
│
└── Condition (Probleem/Aandoening)
      FHIR: Condition
      Relatie: subject → Patient
      Velden: code, beschrijving, ernst, begindatum
```

### 3.5 Planning

```
Schedule (Rooster)
│   FHIR: Schedule
│   Relatie: actor → Practitioner | Location
│   Velden: planningsperiode, diensten
│
├── Slot (Tijdvak)
│     FHIR: Slot
│     Relatie: schedule → Schedule
│     Velden: start, eind, status (vrij/bezet/geblokkeerd)
│
└── Appointment (Afspraak)
      FHIR: Appointment
      Relatie: participant → Patient, Practitioner
      Velden: start, eind, type, status, locatie
```

### 3.6 Registraties

```
Observation (Rapportage)
│   FHIR: Observation
│   Relatie: subject → Patient
│   Relatie: performer → Practitioner
│   Type: SOEP (subjectief/objectief/evaluatie/plan) of Vrij
│   Extensions: soep-subjectief, soep-objectief, soep-evaluatie, soep-plan

DocumentReference + Binary (Document)
│   FHIR: DocumentReference + Binary
│   Relatie: subject → Patient
│   Velden: type, datum, auteur, bestand

AuditEvent (MIC-melding)
    FHIR: AuditEvent
    Extensions: mic-ernst
    Velden: beschrijving, ernst, datum, melder, betrokken client
```

### 3.7 Tenant-configuratie (PostgreSQL)

```
openzorg.tenants
│   Velden: id, name, slug, medplum_project_id, enabled_modules,
│           created_at, updated_at
│
├── openzorg.tenant_configurations
│     Velden: id, tenant_id, config_type, config_data (JSONB),
│             version, created_at, updated_at
│     config_type waarden:
│       - 'custom_field'      → extra veld-definitie
│       - 'validation_rule'   → validatieregel
│       - 'workflow'          → workflowconfiguratie
│     RLS: tenant_id == current_setting('openzorg.current_tenant_id')
│
└── openzorg.audit_log
      Velden: id, tenant_id, user_id, action, resource_type,
              resource_id, timestamp, details (JSONB)
      RLS: zelfde policy als tenant_configurations
      Indices: (tenant_id, timestamp DESC), (tenant_id, resource_type, resource_id)
```

### 3.8 Workflow-instanties (Flowable)

```
Processdefinitie (BPMN)
│   Gedeployed per tenant met tenantId variabele
│   Standaardprocessen: intake, zorgplanbeoordeling, MIC-afhandeling
│
├── Procesinstantie
│     Variabelen: tenantId, clientId, practitionerId, etc.
│     Status: actief, opgeschort, afgerond
│
└── Taak (UserTask)
      Toewijzing: op basis van rol (candidateGroups) + tenant
      Guard: verifyTaskTenant() controleert tenant bij elke actie
      Zichtbaar in werkbak (/api/taken)
```

---

## 4. Technische implementatie

### 4.1 Tenant Provisioning API

**Nieuw te bouwen:** `POST /api/admin/tenants`

Dit endpoint wordt alleen door super-admins aangeroepen (platform-operators, niet tenant-beheerders).

```
POST /api/admin/tenants
Authorization: Bearer <super-admin-token>

Request:
{
  "name": "Zorggroep Horizon",
  "slug": "zorggroep-horizon",
  "enabledModules": ["ecd", "planning"],
  "adminUser": {
    "email": "beheerder@zorggroephorizon.nl",
    "firstName": "Jan",
    "lastName": "de Vries"
  }
}

Response (201):
{
  "tenant": {
    "id": "a0000000-...",
    "name": "Zorggroep Horizon",
    "slug": "zorggroep-horizon",
    "medplumProjectId": "proj-abc123",
    "enabledModules": ["ecd", "planning"],
    "createdAt": "2026-04-10T12:00:00Z"
  },
  "adminUser": {
    "id": "user-xyz",
    "email": "beheerder@zorggroephorizon.nl",
    "temporaryPassword": "<generated>",
    "activationUrl": "https://zorggroep-horizon.openzorg.nl/activeren?token=..."
  }
}
```

**Interne flow van het provisioning-endpoint:**

```
1. Valideer request (naam, slug uniek, geldige modules)
2. Maak Medplum Project aan via Medplum Admin API
3. Configureer AccessPolicy-resources voor alle rollen
4. INSERT INTO openzorg.tenants (...)
5. INSERT INTO openzorg.tenant_configurations (...) — standaard Laag 2 regels
6. Maak admin-gebruiker aan in Medplum Project met beheerder-rol
7. Deploy standaard BPMN-processen naar Flowable met tenantId
8. Maak Organisation-resource aan in Medplum Project
9. Verstuur welkomstmail
10. Return tenant + admin credentials
```

**Foutafhandeling — rollback bij falen:**
- Als stap 3 faalt: verwijder Medplum Project
- Als stap 4 faalt: verwijder Medplum Project
- Als stap 7 faalt: markeer tenant als `provisioning_failed`, retry mogelijk
- Idempotent: herhaald aanroepen met zelfde slug is een no-op als tenant al bestaat

### 4.2 Configuratie-persistentie

**Huidige situatie:** In-memory `Map<string, TenantConfiguration>` in `services/ecd/src/routes/configuratie.ts`. Data verdwijnt bij herstart.

**Doelsituatie:** PostgreSQL-backed via `openzorg.tenant_configurations` tabel met JSONB.

**Migratieplan:**

```
Fase 1: Lees/schrijf naar PostgreSQL (huidige API-interface behouden)
  - Vervang Map<> door PostgreSQL queries
  - SET openzorg.current_tenant_id bij elke request (RLS)
  - Cache in-memory met TTL (5 min) voor performance

Fase 2: Versiebeheer
  - config_data bevat volledige configuratie-snapshot
  - version kolom wordt opgehoogd bij elke wijziging
  - Rollback mogelijk naar vorige versie

Fase 3: Audit
  - Elke configuratiewijziging wordt gelogd in audit_log
  - Wie heeft wat wanneer gewijzigd
```

**Benodigde PostgreSQL-wijzigingen:**

```sql
-- Extra kolommen op tenants-tabel
ALTER TABLE openzorg.tenants ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
-- Mogelijke waarden: provisioning, active, suspended, deactivated

ALTER TABLE openzorg.tenants ADD COLUMN settings JSONB NOT NULL DEFAULT '{}';
-- Organisatie-brede instellingen: taal, tijdzone, notificatievoorkeuren

-- Index op configuratie-queries
CREATE INDEX idx_tenant_config_type
    ON openzorg.tenant_configurations (tenant_id, config_type);
```

### 4.3 Role-Based Access Control (RBAC)

**Architectuur:**

```
Super-admin (platformbeheerder)
│   Toegang: alle tenants, provisioning, platform-instellingen
│   Authenticatie: apart Medplum Super Admin Project
│
└── Tenant (per zorgorganisatie)
    ├── Beheerder
    │     Mag: gebruikers beheren, configuratie wijzigen, modules aan/uit,
    │          workflows aanpassen, rapportages bekijken
    │     Medplum: AccessPolicy met volledige CRUD op alle resources
    │
    ├── Teamleider
    │     Mag: caseload monitoren, kwaliteitsindicatoren, escalaties,
    │          rapportages van eigen team
    │     Medplum: AccessPolicy met leestoegang + beperkte schrijftoegang
    │
    ├── Zorgmedewerker
    │     Mag: eigen clienten bekijken, rapporteren, planning inzien,
    │          taken uit werkbak oppakken
    │     Medplum: AccessPolicy gefilterd op eigen PractitionerRole
    │
    └── Planner
          Mag: roosters maken, beschikbaarheid beheren, afspraken plannen,
               wachtlijst beheren
          Medplum: AccessPolicy met CRUD op Schedule, Slot, Appointment
```

**Implementatie per laag:**

| Laag | Mechanisme | Granulariteit |
|------|-----------|---------------|
| FHIR-data | Medplum AccessPolicy | Per resourcetype + actie (CRUD) |
| Applicatie-API | Middleware role-check | Per API-endpoint |
| Workflow | Flowable candidateGroups | Per BPMN UserTask |
| Frontend | Route guards + UI-conditionals | Per pagina/component |

### 4.4 Beheerpanelen

**Tenant-beheerportaal (voor beheerders van de zorgorganisatie):**

```
/beheer
  ├── /gebruikers          — Gebruikers uitnodigen, rollen toewijzen, deactiveren
  ├── /organisatie         — Organisatieprofiel, locaties, teams beheren
  ├── /modules             — Geactiveerde modules bekijken
  ├── /configuratie
  │     ├── /extra-velden  — Custom fields toevoegen/wijzigen per resourcetype
  │     ├── /validatie     — Validatieregels beheren (Laag 2)
  │     └── /workflows     — Procesflows bekijken en aanpassen
  └── /audit               — Audit-logboek inzien (NEN 7513)
```

**Super-admin portaal (voor platformbeheerders):**

```
/admin
  ├── /tenants             — Alle tenants overzicht, status, provisioning
  │     └── /:id           — Tenant detail, configuratie, gebruikerstelling
  ├── /provisioning        — Nieuwe tenant aanmaken
  ├── /monitoring          — Platform health, resource-gebruik per tenant
  └── /migraties           — Import-jobs status en geschiedenis
```

### 4.5 Omgevingsisolatie

**Per tenant gegarandeerd gescheiden:**

| Gegeven | Isolatiemechanisme |
|---------|--------------------|
| FHIR-resources (clientdata) | Medplum Project (database-niveau) |
| Configuratie + audit | PostgreSQL RLS op `tenant_id` |
| Workflowinstanties | Flowable `tenantId` procesvariabele |
| API-toegang | `X-Tenant-ID` header + middleware validatie |
| Authenticatie | Medplum AccessPolicy per project |
| Bestanden/documenten | Medplum Binary storage per project |

**Niet gescheiden (gedeelde infrastructuur):**

| Component | Gedeeld | Toelichting |
|-----------|---------|-------------|
| PostgreSQL-instantie | Ja | Meerdere tenants in zelfde database, RLS isoleert |
| Medplum-server | Ja | Meerdere projects op zelfde Medplum-instantie |
| Flowable-engine | Ja | Tenant-filtering op procesvariabelen |
| Hono-services | Ja | Stateless, tenant-context per request |
| Redis/cache (toekomst) | Ja | Key-prefix per tenant |

**Wanneer dedicated infrastructuur nodig is:**
- Klant vereist fysiek gescheiden database (compliance-eis)
- Klant heeft zeer hoge volumes (> 10.000 clienten)
- Klant opereert in beveiligd netwerk (on-premise eis)

In die gevallen: aparte Docker Compose-stack met eigen PostgreSQL, Medplum en Flowable.

---

## 5. Roadmap

### Fase 1: Handmatige onboarding (huidige status + eerste uitbreiding)

**Doel:** Eerste 5-10 klanten handmatig onboarden met scripts en admin-acties.

| Item | Status | Beschrijving |
|------|--------|-------------|
| Tenant-tabel + RLS | Gebouwd | `openzorg.tenants` in init.sql |
| Configuratie-tabel + RLS | Gebouwd | `openzorg.tenant_configurations` in init.sql |
| Audit-log tabel | Gebouwd | `openzorg.audit_log` in init.sql |
| Tenant middleware | Gebouwd | `X-Tenant-ID` validatie in Hono |
| Roldefinities | Gebouwd | 4 rollen in `shared-domain/src/roles.ts` |
| Moduledefinities | Gebouwd | 4 modules in `shared-domain/src/tenant.ts` |
| Custom fields API | Gebouwd | CRUD in `configuratie.ts` (in-memory) |
| Validatieregels API | Gebouwd | CRUD in `configuratie.ts` (in-memory) |
| **Provisioning-script** | **Te bouwen** | CLI-tool dat alle stappen automatiseert |
| **Config naar PostgreSQL** | **Te bouwen** | In-memory Map vervangen door DB-queries |
| **Medplum Project creatie** | **Te bouwen** | Medplum Admin API integratie |
| **AccessPolicy per rol** | **Te bouwen** | Medplum AccessPolicy templates |
| **Tenant status-veld** | **Te bouwen** | `status` kolom op tenants-tabel |
| **Super-admin authenticatie** | **Te bouwen** | Gescheiden van tenant-auth |

**Geschatte doorlooptijd:** 2-3 sprints (4-6 weken)

### Fase 2: Self-service onboarding portaal

**Doel:** Klanten kunnen zelf een account aanmaken en basisinrichting doen.

| Item | Beschrijving |
|------|-------------|
| Provisioning API | `POST /api/admin/tenants` met volledige automatisering |
| Onboarding wizard (frontend) | Stapsgewijs: organisatie → modules → eerste gebruiker → basisconfig |
| Automatische Medplum Project setup | Inclusief AccessPolicy, standaard-resources |
| Automatische Flowable deploy | Standaardprocessen per gekozen module |
| Template-configuraties | Voorgedefinieerde sets van validatieregels en extra velden per zorgtype |
| Migratie-upload | CSV/FHIR Bundle upload met validatierapport |
| Tenant-dashboard | Status van onboarding, openstaande stappen, gezondheidscheck |
| Facturatie-integratie | Koppeling met betaalsysteem per tenant |

**Geschatte doorlooptijd:** 3-4 sprints (6-8 weken)

### Fase 3: White-label en custom domeinen

**Doel:** Zorgorganisaties draaien onder eigen merk en domein.

| Item | Beschrijving |
|------|-------------|
| Custom domein per tenant | `ecd.zorggroephorizon.nl` in plaats van `zorggroep-horizon.openzorg.nl` |
| White-label theming | Logo, kleuren, favicon per tenant (opgeslagen in tenant settings JSONB) |
| Aangepast emaildomein | Notificaties vanuit eigen domein |
| SSO-integratie | SAML/OIDC koppeling met bestaande identity provider van de klant |
| Dedicated infrastructuur optie | Aparte stack voor grote/veeleisende klanten |
| Marketplace voor plugins | Laag 3 extensies beschikbaar stellen via een plugin-store |
| Multi-regio deployment | Data-residency per klant (NL-only requirement voor zorgdata) |

**Geschatte doorlooptijd:** 4-6 sprints (8-12 weken)

---

## Bijlage A: Onboarding-tijdlijn (typisch)

```
Week 1     Contractfase + verwerkersovereenkomst
           Kick-off meeting met functioneel beheerder

Week 2     Tenant provisionering (Medplum Project, PostgreSQL, Flowable)
           Organisatieprofiel + locaties + teams inrichten
           Beheerder-account aanmaken

Week 3-4   Datamigratie voorbereiding
           Export uit bronsysteem
           Mapping en transformatie
           Dry-run import + validatierapport

Week 5     Extra velden en validatieregels configureren
           Workflowprocessen aanpassen en testen
           Gebruikers aanmaken en rollen toewijzen

Week 6     Acceptatietest door klant
           Training beheerders en key users
           Bugfixes en finetuning

Week 7     Go-live
           Monitoring eerste week
           Afsluitend evaluatiegesprek
```

## Bijlage B: Relatie met bestaande codebase

| Bestand | Relevantie voor onboarding |
|---------|---------------------------|
| `infra/postgres/init.sql` | Tenant-tabel, configuratie-tabel, audit-log, RLS-policies |
| `packages/shared-domain/src/tenant.ts` | `Tenant` interface, `OpenZorgModule` type, `isModuleEnabled()` |
| `packages/shared-domain/src/roles.ts` | `OpenZorgRole` type, `ROLE_DEFINITIONS`, 4 rollen |
| `packages/shared-domain/src/fhir-types.ts` | Zib-FHIR mapping, BSN-validatie, extension-URLs |
| `packages/shared-config/src/configuration.ts` | `TenantConfiguration`, `CustomFieldDefinition`, `ValidationRule` |
| `packages/shared-config/src/validation-engine.ts` | Drie-laags validatie-engine |
| `packages/shared-config/src/kern-validatie.ts` | Laag 1 (kern) validatieregels |
| `services/ecd/src/middleware/tenant.ts` | `tenantMiddleware` — X-Tenant-ID validatie |
| `services/ecd/src/routes/configuratie.ts` | Admin CRUD voor custom fields + validatieregels (in-memory) |
| `adapters/ons-import/src/index.ts` | Startpunt voor import-adapter |
