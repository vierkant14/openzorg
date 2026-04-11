# Datamodel Overzicht OpenZorg

> **Kernpunt:** OpenZorg heeft bewust weinig database-tabellen. Alle klinische data leeft als FHIR R4 resources in Medplum. Dit document legt uit waarom, en geeft een compleet overzicht van wat er wel is.

---

## 1. Waarom weinig tabellen? — FHIR-native architectuur

### Traditioneel ECD (zoals Nedap, PinkRoccade)

Een klassiek elektronisch clientdossier heeft doorgaans **200+ custom database-tabellen**: clienten, adressen, contactpersonen, zorgplannen, doelen, interventies, rapportages, medicatie, roosters, declaraties, autorisaties, enzovoort. Elke leverancier bedenkt zijn eigen schema. Dat leidt tot:

- Vendor lock-in (data zit vast in proprietary schema)
- Dure koppelingen met andere systemen
- Geen standaardisatie tussen instellingen

### OpenZorg: FHIR-native

OpenZorg slaat **geen klinische data op in eigen tabellen**. In plaats daarvan gebruiken we [Medplum](https://www.medplum.com/), een open source FHIR R4 server die intern PostgreSQL gebruikt met JSON-kolommen voor resource-opslag.

Dit betekent:

- **Interoperabiliteit** — Data volgt de internationale FHIR R4 standaard
- **Geen vendor lock-in** — Elke FHIR-compatible client kan de data lezen
- **Zib-compatibel** — Nederlandse Zorginformatiebouwstenen mappen direct op FHIR resources
- **Minder onderhoud** — Geen migratiescripts voor 200+ tabellen

### Wat staat er dan wel in onze eigen PostgreSQL?

Onze eigen database bevat uitsluitend **applicatieconfiguratie**, geen klinische data:

| Tabel | Doel |
|---|---|
| `tenants` | Multi-tenant configuratie (organisatie-instellingen, custom velden, validatieregels) |
| `audit_log` | Audit trail voor niet-FHIR operaties |
| RLS policies | Row Level Security voor tenant-isolatie |

Dat is alles. En dat is **by design**.

---

## 2. FHIR Resource Map — Compleet overzicht

Hieronder alle FHIR resources die OpenZorg gebruikt of gaat gebruiken, met hun functionele betekenis in de VVT-context.

### Actief in gebruik

| FHIR Resource | Functioneel | Toelichting |
|---|---|---|
| **Patient** | Client | Persoonsgegevens, BSN, adres, contactgegevens, verzekering (via extension) |
| **RelatedPerson** | Contactpersoon | Familielid, wettelijk vertegenwoordiger, mantelzorger |
| **Practitioner** | Zorgverlener | AGB-code, kwalificaties, BIG-registratie |
| **PractitionerRole** | Functie/rol | Rol binnen organisatie (bijv. wijkverpleegkundige, verzorgende IG) |
| **Organization** | Zorginstelling | Organisatie, locatie, afdeling, team |
| **CarePlan** | Zorgplan | Per leefgebied, met doelen en interventies, status-tracking |
| **Goal** | Doel | SMART-doelen per leefgebied |
| **ServiceRequest** | Interventie/verrichting | Zorgactiviteiten; als `draft` ook bruikbaar als wachtlijst |
| **Observation** | Rapportage | SOEP-rapportage, vrije rapportage, meetwaarden, scores |
| **DocumentReference** + **Binary** | Documenten | Foto's, PDF's, gescande documenten, rapportages |
| **AuditEvent** | MIC-meldingen / audit | Meldingen Incidenten Client, plus audit trail |
| **Appointment** | Afspraken | Geplande afspraken met client |
| **Schedule** | Rooster | Rooster van zorgverlener |
| **Slot** | Tijdslot | Beschikbaar tijdslot binnen rooster |
| **Task** | Taken/acties | Taken en acties, gekoppeld aan Flowable BPMN-workflows |

### Gepland (Sprint 4 en verder)

| FHIR Resource | Functioneel | Status |
|---|---|---|
| **Claim** | Declaratie | Sprint 4 |
| **Condition** | Diagnose/aandoening | Gepland |
| **MedicationRequest** | Medicatievoorschrift | Gepland |
| **MedicationAdministration** | Medicatietoediening | Gepland |
| **Encounter** | Contact/bezoek | Gepland |
| **CareTeam** | Behandelteam | Gepland |
| **Coverage** | Verzekeringspolis | Gepland (vervangt huidige extension) |
| **QuestionnaireResponse** | Vragenlijsten/scores | Gepland |

---

## 3. Custom FHIR Extensions

Waar de standaard FHIR resources niet toereikend zijn voor de Nederlandse VVT-context, gebruiken we extensions.

### SOEP-rapportage

Op `Observation` resources:

| Extension | Doel |
|---|---|
| `soep-subjectief` | Wat ervaart/vertelt de client? |
| `soep-objectief` | Wat observeert de zorgverlener? |
| `soep-evaluatie` | Beoordeling van de situatie |
| `soep-plan` | Vervolgacties |

### Verzekering (tijdelijk)

Op `Patient` resource (wordt vervangen door `Coverage` resource):

| Extension | Doel |
|---|---|
| `verzekeraar` | Naam/code zorgverzekeraar |
| `polisnummer` | Polisnummer van de client |

### Indicatie

Op `Patient` of `ServiceRequest`:

| Extension | Doel |
|---|---|
| `indicatie-type` | Type indicatie (WLZ, ZVW, WMO, JW) |
| `ciz-besluitnummer` | CIZ besluitnummer (bij WLZ) |
| `zorgprofiel` | Toegekend zorgprofiel |
| `indicatie-startdatum` | Ingangsdatum indicatie |
| `indicatie-einddatum` | Einddatum indicatie |

### MIC-meldingen

Op `AuditEvent`:

| Extension | Doel |
|---|---|
| `mic-ernst-level` | Ernst van het incident (laag/midden/hoog/kritiek) |

---

## 4. Vergelijking met traditioneel ECD

Om te laten zien dat "weinig tabellen" niet "weinig data" betekent:

### Traditioneel ECD: ~20+ kerntabellen

| Tabel | Equivalent |
|---|---|
| `client` | Patient |
| `client_adres` | Patient.address |
| `client_telefoon` | Patient.telecom |
| `contactpersonen` | RelatedPerson |
| `verzekeringen` | Coverage (of Patient extension) |
| `zorgverleners` | Practitioner |
| `zorgverlener_rollen` | PractitionerRole |
| `organisaties` | Organization |
| `zorgplannen` | CarePlan |
| `doelen` | Goal |
| `interventies` | ServiceRequest |
| `rapportages` | Observation |
| `documenten` | DocumentReference + Binary |
| `afspraken` | Appointment |
| `roosters` | Schedule + Slot |
| `diagnoses` | Condition |
| `medicatie` | MedicationRequest |
| `medicatie_toediening` | MedicationAdministration |
| `taken` | Task |
| `declaraties` | Claim |

In een traditioneel ECD is dit **20+ tabellen met eigen schema's, relaties, migraties en documentatie**. In OpenZorg zijn dit **gestandaardiseerde FHIR resources** met vastgestelde structuur, validatie en zoekparameters.

### Voordeel van FHIR-native

- **Geen eigen migratiescripts** — Medplum beheert de opslag
- **Gestandaardiseerde API** — Elke FHIR-client werkt direct
- **Ingebouwde validatie** — FHIR StructureDefinitions valideren data bij opslag
- **Zoeken is standaard** — Geen custom query-builders nodig
- **Tenant-specifieke configuratie** — Custom velden en validatieregels via onze tenant-tabel, niet via schema-wijzigingen

---

## 5. Wat ontbreekt nog — Roadmap resources

De volgende FHIR resources moeten nog worden toegevoegd om het datamodel compleet te maken voor de VVT-sector:

| FHIR Resource | Zib Mapping | Prioriteit | Toelichting |
|---|---|---|---|
| **Condition** | Zib Probleem | Hoog | Diagnoses en aandoeningen vastleggen |
| **MedicationRequest** | Zib MedicatieVoorschrift | Hoog | Medicatievoorschriften |
| **MedicationAdministration** | Zib MedicatieToediening | Hoog | Registratie van toedieningen |
| **Encounter** | Zib Contact | Hoog | Bezoeken en contactmomenten |
| **CareTeam** | Zib Zorgteam | Midden | Behandelteam per client |
| **Coverage** | Zib Betaler | Midden | Vervangt huidige verzekering-extension op Patient |
| **AllergyIntolerance** | Zib AllergieIntolerantie | Midden | Allergieen en intoleranties |
| **NutritionOrder** | Zib Voedingsadvies | Laag | Dieetvoorschriften |
| **DeviceUseStatement** | Zib MedischHulpmiddel | Laag | Hulpmiddelen (rollator, tillift, etc.) |

---

## Samenvatting

```
Traditioneel ECD          OpenZorg
──────────────────        ──────────────────
200+ custom tabellen  →   ~3 eigen tabellen (config)
Proprietary schema    →   FHIR R4 standaard
Vendor lock-in        →   Open, interoperabel
Dure koppelingen      →   Standaard FHIR API
Eigen migraties       →   Medplum beheert opslag
```

Het datamodel is niet "dun" — het is **standaard**. Alle klinische data zit in FHIR resources met een internationaal gedefinieerd schema. Onze eigen database bevat alleen wat FHIR niet biedt: multi-tenant configuratie en applicatie-specifieke audit logging.
