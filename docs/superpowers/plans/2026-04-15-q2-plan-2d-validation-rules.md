# Q2-Plan 2D: Validation rules editor (Laag 2, H7.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een functioneel beheerder kan zonder code eigen validatieregels per resource type + veld definiëren (bv. "gewicht moet tussen 1 en 300 kg zijn", "tijdstip bij MIC-melding is verplicht"). De regels worden bij elke save van het betreffende FHIR-resource door de bestaande `validation-engine.ts` toegepast. Dit is letterlijk laag 2 uit hoofdstuk 7.2 van de requirements en sluit aan bij de task-form-options uit Plan 2F-prework.

**Architecture:** De infrastructuur bestaat al: `packages/shared-config/src/validation-engine.ts` interpreteert regels runtime, `kern-validatie.ts` heeft laag 1 (BSN, AGB, verplichte Zib velden). Wat ontbreekt is een admin-UI die regels toevoegt aan `openzorg.tenant_configurations` met `config_type='validation_rule'` zodat de bestaande engine ze oppikt.

**Tech Stack:** Postgres JSONB, Hono (ecd service), Next.js admin page, bestaand `@openzorg/shared-config` package.

**Spec referenties:**
- `docs/openzorg-requirements-claude-code.docx` — hoofdstuk 7.2: "Validatieregel toevoegen — Gewicht moet tussen 1 en 300 kg zijn — Regel-editor met dropdown voor operator"
- `packages/shared-config/src/validation-engine.ts` — runtime engine, lijst van ondersteunde operators
- `packages/shared-config/src/kern-validatie.ts` — laag 1 (niet aanpasbaar)
- `docs/superpowers/plans/2026-04-14-q2-plan-2c-platform-admin.md` — zusterplan voor platform settings

**Branch:** `plan-2d-validation-rules`, afgeleid van main nadat 2A/2B/2C gemerged zijn.

**Dependencies:**
- Plan 2C moet af zijn — wil hergebruiken wat we bouwden voor Platform Settings: de JSONB-config pattern, audit-logging, master-admin UI style.
- `validation-engine.ts` moet runtime correct werken (staat vermeld als "aanwezig" in audit).

---

## Waarom dit plan

Vandaag kan een klant geen regel toevoegen als "gewicht tussen 1 en 300 kg" zonder een release te vragen. Dat is exact het anti-pattern dat H7.2 wil voorkomen. De engine is er al (de types, de interpreter, de kern/uitbreiding-scheiding). Het ontbreekt aan twee dingen:

1. Een UI voor de functioneel beheerder om regels te beheren
2. Een hook in de FHIR-save-paden die de engine aanroept

---

## Scope

### In scope
- Admin-UI `/admin/validatie` (bestaat als placeholder) wordt volledig functioneel
- CRUD-endpoints `GET /api/admin/validation-rules`, `POST`, `PUT`, `DELETE`
- Rule-editor met:
  - Resource-type dropdown (Patient, MedicationRequest, Observation, Condition, ...)
  - Veld-picker per resource-type (Patient.birthDate, Patient.weight, etc.) — lijst uit een kleine YAML/TS-map
  - Operator-dropdown: required, min, max, range, regex, oneOf, not-empty
  - Waarde-veld dat van type afhangt van operator (getal voor min/max, array voor oneOf)
  - Foutmelding-veld (NL-tekst die de gebruiker ziet)
- "Test deze regel"-knop die een voorbeeld-resource invoer laat zien en de engine runt
- Versioning via bestaande `tenant_configurations.version` kolom
- Audit-log entry bij elke wijziging via bestaande audit-log

### Buiten scope (aparte plans of later)
- **Cross-field validation** — "als X dan Y verplicht" — vereist een DSL en dat is Plan 2E's DMN-scope
- **Validation hooks op FHIR-save** — de engine moet nog gewired worden aan de save-paden van client.ts, medicatie.ts etc. Dit is een aparte implementatie-stap en raakt alle routes.
- **Validation op frontend forms** — nice-to-have zodat je de fout ziet vóór submit; eerst de server-kant werkend krijgen.

---

## Fase 1 — Backend CRUD

- [ ] Nieuwe route `services/ecd/src/routes/validation-rules.ts` met GET/POST/PUT/DELETE
- [ ] Rules worden opgeslagen in `openzorg.tenant_configurations` met `config_type='validation_rule'`, één rij per regel (ipv één grote JSONB blob — eenvoudiger voor CRUD)
- [ ] TypeScript-types synchroon met `validation-engine.ts` (importeren uit shared-config)
- [ ] Validation bij POST: operator moet geldige zijn, value-type moet matchen operator
- [ ] Audit-log bij elke wijziging met before/after diff
- [ ] Tests: unit tests voor de endpoint + integration test die een regel opslaat en teruglees't

## Fase 2 — Veld-registry

- [ ] Nieuwe file `packages/shared-config/src/fhir-fields.ts` met een whitelist van bewerkbare velden per resource-type:
  ```ts
  export const VALIDATABLE_FIELDS = {
    Patient: [
      { path: "birthDate", label: "Geboortedatum", type: "date" },
      { path: "gender", label: "Geslacht", type: "string" },
      { path: "identifier[?system='bsn'].value", label: "BSN", type: "string" },
      ...
    ],
    Observation: [
      { path: "valueQuantity.value", label: "Meetwaarde", type: "number" },
      ...
    ],
    ...
  }
  ```
- [ ] Deze registry is de bron voor de UI-field-picker
- [ ] Kern-velden (zoals Patient.identifier.system=bsn) krijgen een "locked"-flag zodat ze niet dubbel geconfigureerd worden naast `kern-validatie.ts`

## Fase 3 — Admin UI

- [ ] Pagina `apps/web/src/app/admin/validatie/page.tsx` helemaal nieuw uitwerken
- [ ] Linker kolom: lijst van bestaande regels, gegroepeerd per resource-type, met enable-toggle
- [ ] Rechter kolom: editor voor geselecteerde regel
- [ ] Formulier-velden:
  - Resource-type (select)
  - Veld (select, filtered op resource-type uit registry)
  - Operator (select, labels in NL)
  - Waarde/waarden (input gekleurd op operator-type)
  - Foutbericht (text, tone in NL)
  - Actief (toggle)
- [ ] "+ Nieuwe regel"-knop
- [ ] "Test regel"-knop: mini-form waarin je een waarde typt, knop runt `applyRule()` uit de engine en toont pass/fail + error-text
- [ ] Feature-gate achter `validation-rules-ui` flag (nieuwe feature-flag in Plan 2C)

## Fase 4 — Wire-up validation hooks

- [ ] `services/ecd/src/lib/fhir-validation.ts` nieuwe helper die de engine aanroept en een validation-result teruggeeft
- [ ] `client.ts` POST + PUT: call validate-helper voordat `medplumProxy`; bij error → 400 met OperationOutcome
- [ ] Zelfde voor: `medicatie.ts`, `rapportage.ts`, `zorgplan.ts` (de meest-gebruikte save-paden)
- [ ] Feature-flag: `validation-enforcement` (nieuwe flag) bepaalt of fouten blokkeren (hard fail) of alleen een audit-log warning (soft fail) — zodat een tenant een regel kan configureren en eerst in soft-mode draaien voordat het hard wordt afgedwongen

## Fase 5 — Tests + docs

- [ ] Unit-tests voor rule-CRUD endpoints
- [ ] Integration-test: maak een Patient met geboortedatum in de toekomst, verwacht 400 als regel actief
- [ ] E2E-test: admin maakt regel via UI, logt uit, logt in als zorgmedewerker, probeert client met geldige gegevens → pass, met ongeldige → error
- [ ] Update `docs/wiki/technisch/architectuur.md` met hoe Laag 1/2/3 in elkaar grijpen
- [ ] Korte video (30 sec) voor sales: "zie hoe snel een FB een regel toevoegt"

---

## Acceptatiecriteria

1. Een master-admin of beheerder kan via `/admin/validatie` een regel maken, activeren, deactiveren, verwijderen
2. Minimaal 5 operators werken end-to-end: required, min, max, range, regex
3. Een POST naar `/api/clients` die een regel schendt geeft een 400 met duidelijke NL-foutmelding
4. `validation-enforcement=soft` zet dezelfde regels om in warnings die alleen in de audit-log landen
5. Alle rule-wijzigingen staan in `openzorg.audit_log` met diff
6. Kern-validatie (`kern-validatie.ts`) blijft altijd actief en kan niet vervangen worden door een laag 2 regel

---

## Risico's

| Risico | Impact | Mitigatie |
|---|---|---|
| Regels worden te complex voor de UI (nested condities) | Middel | Blijf simpel in scope — "als X dan Y" is DMN-territory, niet 2D |
| Performance: elke FHIR-save roept de engine op | Laag | Regels zijn in-memory, engine is O(regels), paar μs per save |
| Mis-configuratie breekt alle schrijfacties | Hoog | `validation-enforcement=soft` default, pas op hard wanneer tenant comfortable is |
| Conflicten tussen laag 1 kern en laag 2 uitbreiding | Middel | Registry markeert kern-velden als locked, UI laat ze niet kiezen |
| Taalafhankelijke foutmeldingen bij tweetalige gebruikers | Laag | Eerst alleen NL, i18n later |

---

## Stappen hierna (na 2D)

- **Plan 2E — DMN decision tables**: voor beslisregels die OUTPUT zijn (bv. "indicatie hoog → traject A"), niet INPUT-validatie
- **Plan 2F — JSONForms + formKey per userTask**: koppelen van canvas formKey aan een concreet form schema
- **Plan 2G — Form-opties editor** (task-form-options): UI is vannacht al gebouwd, alleen nog polish + testen
- **Plan 3A — Form-validation op frontend**: validatie-engine ook in browser runnen voor instant feedback
