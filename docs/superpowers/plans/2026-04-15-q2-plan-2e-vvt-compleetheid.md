# Q2-Plan 2E: VVT-compleetheid — datamodel, state, test-data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OpenZorg moet een *middelgrote VVT-instelling* (bv. 4 locaties, 30 teams, 200 medewerkers, 1000 cliënten) vol-fictief kunnen draaien. De basisprocessen (intake → indicatie → zorgplan → rapportage → facturatie → ontslag) moeten compleet zijn, met **fijnmazige state-transities** voor cliënten en medewerkers, **dynamische rollen** die een master-admin zelf kan toevoegen, en **hiërarchische organisatiestructuur** (Organisatie > Regio/Cluster > Locatie > Team > Client/Medewerker). Dit sluit de laatste gaps voor een eerste echte pilot en maakt de test-omgeving geloofwaardig voor demo's.

**Architecture:** Zoveel mogelijk FHIR-native (Organization hiërarchie, PractitionerRole per locatie, Patient.managingOrganization + Patient.generalPractitioner). State-transitions via een nieuwe `openzorg.state_machines` config-tabel (Laag 2 uit H7.2) die per resource-type een configureerbare set states + transitions bevat, toegepast bij save. Rollen worden dynamisch uit `openzorg.roles` geladen ipv hardcoded in shared-domain.

**Tech Stack:** Postgres, Medplum FHIR, Hono (ecd service), Next.js, bestaand validation-engine en audit-log.

**Spec referenties:**
- `docs/openzorg-requirements-claude-code.docx` — H3 (doelgroep + use cases), H6 (datamodel-strategie), H7 (drielagen-model)
- `docs/vvt-procescatalogus.md` — bestaande procescatalogus
- `docs/enterprise-onboarding.md` — tenant-provisioning
- `docs/superpowers/plans/2026-04-14-q2-plan-2c-platform-admin.md` — zusterplan
- `docs/superpowers/plans/2026-04-15-q2-plan-2d-validation-rules.md` — zusterplan

**Branch:** `plan-2e-vvt-compleetheid`, afgeleid van `plan-2a-execute` nadat huidige werk gemerged is.

**Dependencies:**
- Plan 2C moet werken (platform admin) — we gebruiken de feature-flags om nieuwe modules (state-machine editor, roles editor, locatie-tree) per tenant aan/uit te zetten.
- Plan 2D backend (validation-rules) is nuttig want state-transitions en validatie delen veel infrastructure.

---

## Waarom dit plan nu

Huidige staat:
1. **Rollen zijn hardcoded** in `packages/shared-domain/src/roles.ts`: `beheerder`, `zorgmedewerker`, `planner`, `teamleider`. Alles anders (controller, kwaliteitsmedewerker, zorgadministratie, MIC-coördinator) vereist een code-wijziging + release.
2. **Client-status is binair**: `Patient.active = true/false`. Geen zichtbaarheid voor "aangemeld", "in intake", "in zorg", "in overdracht", "uitgeschreven", "overleden", "in wachtkamer". Een teamleider kan niet filteren op "alle cliënten in intake".
3. **Medewerker-status idem**: een Practitioner is ook alleen actief of niet. Geen ziek / verlof / uit dienst / nieuwe medewerker in onboarding.
4. **Organisatiestructuur is er FHIR-technisch wel** maar heeft geen UI voor een tree-view. Je kunt geen cliënt aan een Team toewijzen omdat Teams niet als eigen resource bestaan (FHIR `Group` of `CareTeam` kan, niet gebruikt).
5. **Test-data is te klein**: 8 cliënten + 6 medewerkers + 1 fictieve organisatie. Een VVT-manager die demo ziet voelt geen realisme.
6. **State-transities per organisatie verschillen**: sommige VVT's doen een triage-stap, anderen niet. Een beheerder moet zelf kunnen bepalen welke stappen er zijn zonder Claude te vragen.

Zonder dit plan blijft OpenZorg een "speelgoed-ECD". Mét dit plan is het een serieuze pilot-kandidaat.

---

## Scope

### In scope
- **Dynamische rollen**: tabel `openzorg.roles`, CRUD endpoints, admin UI onder `/admin/rollen` (placeholder bestaat al). Bestaande 4 rollen als defaults, extra rollen via UI toevoegen.
- **State-machines per resource-type**: nieuwe tabel `openzorg.state_machines` met config-type `state_machine`, data `{ resourceType, states: [...], transitions: [...], current field path }`. Ondersteunt client-status, medewerker-status, traject-status.
- **State-transition UI in cliëntdossier en medewerkerprofiel**: dropdown met mogelijke transities op basis van huidige state + rol-check.
- **Organisatie-tree UI**: nieuwe `/admin/organisatie/structuur` pagina met drag-and-drop tree-view. Cliënten en medewerkers koppelen via Organization-referenties.
- **Medewerker aan Organization koppelen** via nieuwe `Practitioner.extension[organizationRef]` (custom extension) of via FHIR `PractitionerRole.organization`.
- **Cliënt aan Organization koppelen** via bestaande `Patient.managingOrganization`.
- **Test-data seeder** voor middelgrote VVT: 4 locaties, 12 teams, 200 medewerkers, 1000 cliënten met gevarieerde stadia en zorgprofielen. Nieuwe CLI script `infra/scripts/seed-vvt.sh`.
- **Extra default-rollen**: controller, kwaliteitsmedewerker, zorgadministratie, MIC-coördinator — pre-gedefinieerd als seed-data maar wel via de dynamische tabel.
- **Business-rule builder** voor state-transition guards: "een cliënt mag alleen van 'in intake' naar 'in zorg' als zorgplan is goedgekeurd". Koppelt aan de validation-engine uit Plan 2D.

### Out of scope (later)
- SAML/SSO login via het AD van de VVT — Plan 3A
- E-formulieren (JSONForms) per state-transition — Plan 2F
- Bulk-import van bestaande cliëntgegevens uit ONSDB (of andere concurrent) — komt in een migratie-plan
- Mobile view / native app — later
- Zorgzwaartepakket auto-assign — later

---

## Fase 1 — Dynamische rollen

- [ ] Nieuwe tabel `openzorg.roles`:
  ```sql
  CREATE TABLE openzorg.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES openzorg.tenants(id),
    slug TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    is_system BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, slug)
  );
  ```
- [ ] Seed met 4 bestaande rollen + nieuwe: `controller`, `kwaliteitsmedewerker`, `zorgadministratie`, `mic-coordinator`. Alle met `is_system=true` (niet verwijderbaar) behalve de 4 nieuwe die `is_system=false` krijgen zodat ze bewerkbaar blijven.
- [ ] Backend route `GET /api/admin/rollen` leest uit tabel ipv shared-domain constanten
- [ ] `POST /api/admin/rollen` → maak nieuwe rol (niet-systeem)
- [ ] `PUT /api/admin/rollen/:slug` → update permissions van niet-systeem rollen
- [ ] `DELETE /api/admin/rollen/:slug` → soft-delete (active=false) voor niet-systeem rollen
- [ ] Admin-UI `/admin/rollen` uitwerken: tabel met rollen, klik om permissions te bewerken
- [ ] Permission-matrix blijft in shared-domain (dat is leveranciersvoorschrift Laag 1)
- [ ] `AppShell.tsx` filter respecteert nog steeds role+permissions — geen wijziging nodig want alleen de *bron* van rollen verandert

## Fase 2 — Organisatie-tree & locatie-koppeling

- [ ] Nieuwe pagina `/admin/organisatie/structuur` — tree-view van alle Organization resources
- [ ] UI: node toevoegen (child van geselecteerde), verwijderen (alleen leeg), hernoemen
- [ ] Nieuwe `Organization.extension[organizationType]` custom extension: `holding` | `regio` | `cluster` | `locatie` | `team`
- [ ] Hiërarchie-validatie: holding > regio > cluster > locatie > team
- [ ] Dashboard-widget: "Jouw locatie" laat zien welke Organization je toegewezen bent
- [ ] Cliënten-lijst filter op locatie/team (gebruikt Patient.managingOrganization)
- [ ] Client-dossier extra-veld "Team" ipv alleen locatie

## Fase 3 — Client & medewerker state-machines

- [ ] Nieuwe tabel `openzorg.state_machines` (in tenant_configurations als config_type='state_machine' past ook, keuze)
- [ ] Schema:
  ```json
  {
    "resourceType": "Patient",
    "fieldPath": "extension[trajectStatus]",
    "states": [
      { "slug": "aangemeld", "label": "Aangemeld", "color": "blue" },
      { "slug": "in-intake", "label": "In intake", "color": "amber" },
      { "slug": "in-zorg", "label": "In zorg", "color": "green" },
      { "slug": "overdracht", "label": "Overdracht", "color": "navy" },
      { "slug": "uitgeschreven", "label": "Uitgeschreven", "color": "gray" },
      { "slug": "overleden", "label": "Overleden", "color": "coral" }
    ],
    "transitions": [
      { "from": "aangemeld", "to": "in-intake", "requiredRole": "planner" },
      { "from": "in-intake", "to": "in-zorg", "requiredRole": "teamleider",
        "guard": "zorgplanAanwezig == true" },
      { "from": "in-zorg", "to": "overdracht", "requiredRole": "zorgmedewerker" },
      ...
    ],
    "initialState": "aangemeld"
  }
  ```
- [ ] Endpoint `POST /api/clients/:id/state-transition` → valideer transition, schrijf extension, audit-log
- [ ] UI in client dossier: status-badge bovenaan met dropdown voor toegestane volgende states
- [ ] Admin UI `/admin/state-machines` voor beheer per resource-type
- [ ] Zelfde pattern voor medewerker (Practitioner) — states: `onboarding`, `actief`, `ziek`, `verlof`, `uit-dienst`

## Fase 4 — Test-data seeder voor middelgrote VVT

- [ ] Nieuw script `infra/scripts/seed-vvt-compleet.sh`:
  - 1 Holding "VVT De Waterlanden" (fictief)
  - 2 Regio's: Noord, Zuid
  - 4 Clusters: Noord-A, Noord-B, Zuid-A, Zuid-B
  - 8 Locaties: 4 × "Woonzorgcentrum X", 4 × "Wijkteam Y"
  - 12 Teams verdeeld over de locaties
  - 200 Medewerkers met gevarieerde rollen (mix van alle 8 rollen), gekoppeld aan teams
  - 1000 Cliënten met:
    - BSN (via elfproef), naam, geboortedatum, adres
    - Zorgprofiel (ZZP 1 t/m 10 / VPT / MPT)
    - Indicatie (Wlz / Wmo / Zvw) met geldigheidsduur
    - Traject-status verdeeld: 50 aangemeld, 150 in-intake, 600 in-zorg, 100 overdracht, 50 uitgeschreven, 50 overleden
    - Managing organization = team
    - Random aantal allergieën, diagnoses, vaccinaties
  - 300 Actieve rapportages
  - 100 Actieve zorgplannen
  - 50 Actieve MIC-meldingen
  - 40 Signaleringen (valrisico, allergie, MRSA, mix van laag/hoog)
  - 150 Geplande afspraken voor vandaag + volgende 7 dagen
- [ ] Seed-script idempotent: detecteert "VVT De Waterlanden" bestaat al en skipt
- [ ] Optioneel: data-generator module met faker-NL voor realistische Nederlandse namen, adressen, postcodes

## Fase 5 — Testen en documentatie

- [ ] E2E-test: log in als controller, bekijk cliëntenlijst, zie status-kleuren
- [ ] E2E-test: log in als beheerder, maak een nieuwe rol "MIC-reviewer", toegewezen aan Organisatie X
- [ ] E2E-test: verplaats cliënt van "in-intake" naar "in-zorg", verwacht error als guard `zorgplanAanwezig==true` faalt
- [ ] Handleiding voor functioneel beheerder in `docs/wiki/modules/state-machines.md`
- [ ] Handleiding voor functioneel beheerder in `docs/wiki/modules/rollen-beheer.md`
- [ ] Handleiding organisatiestructuur in `docs/wiki/modules/organisatie.md`
- [ ] Update `docs/vvt-procescatalogus.md` met de nieuwe state-flows

---

## Acceptatiecriteria

1. Een beheerder kan via `/admin/rollen` een nieuwe rol toevoegen inclusief permissions zonder code wijziging
2. Een beheerder kan via `/admin/state-machines` een state-machine voor Patient bewerken (state toevoegen, transitie definiëren met guard)
3. Een zorgmedewerker ziet in het cliëntdossier de huidige status als badge en kan alleen toegestane overgangen maken
4. Elke state-transition wordt gelogd in `openzorg.audit_log` met before/after en user-id
5. Test-seed genereert 1000 cliënten in een geloofwaardige verdeling over de states, locaties, en zorgprofielen
6. Locatie-tree UI laat 4 niveaus zien en ondersteunt drag-and-drop herordenen
7. Cliënten-lijst heeft een nieuwe filter "Team" die werkt op basis van Patient.managingOrganization

---

## Risico's

| Risico | Impact | Mitigatie |
|---|---|---|
| State-machine edits breken bestaande cliënten (state die niet meer bestaat) | Hoog | Immutable state-definitions + migrate-script bij verwijderen; initiele versie mag alleen states TOEVOEGEN |
| Test-seed is zwaar voor Medplum (1000 Patients + submodellen) | Middel | Batch-insert (bulk/upsert via Medplum transaction bundle), totaal <5 min |
| Rollen-matrix in shared-domain raakt out-of-sync met tenant-specifieke permissions | Hoog | shared-domain definieert alleen de permission-lijst (Laag 1), tenant-tabel assignee de permissions aan custom roles |
| Organisatie-tree wordt te diep (>5 niveaus) bij grote concerns | Laag | Max diepte = 5 in validatie |
| FHIR Organization.partOf is niet bedoeld voor team-hiërarchie | Middel | Alternatief: FHIR CareTeam voor het laagste niveau, of custom extension — te beslissen in fase 2 |

---

## Stappen hierna (na 2E)

- **Plan 2F — JSONForms per state-transitie**: als een cliënt van "in-intake" → "in-zorg" gaat, toon een formulier dat de zorgplan-velden afdwingt
- **Plan 2G — Bulk-import uit concurrenten**: CSV/JSON-importer die ONSDB / Caress data converteert naar FHIR
- **Plan 3A — SAML/SSO** koppeling aan Entra ID / Google Workspace van de VVT
- **Plan 3B — Mobile-web voor zorgmedewerkers**: compact responsive dashboard voor onderweg
- **Plan 3C — Kwaliteitsdashboard** per locatie: HKZ-indicatoren, aantal MIC's, val-incidenten, rapportage-compliance
