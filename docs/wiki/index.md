# OpenZorg Documentatie

## Voor wie is deze documentatie?

- **Functioneel beheerders** — Wat kan het systeem en hoe configureer je het
- **Zorgmedewerkers** — Hoe gebruik je de dagelijkse functies
- **Ontwikkelaars** — Technische architectuur en API-documentatie
- **Integrators** — Hoe koppel je externe systemen aan OpenZorg

---

## Modules

| Module | Status | Beschrijving |
|--------|--------|-------------|
| [Clientregistratie](modules/clientregistratie.md) | Live | Clientdossier, BSN/clientnummer, contactpersonen |
| [Zorgplan](modules/zorgplan.md) | Live | CarePlan met doelen en interventies |
| [Rapportage](modules/rapportage.md) | Live | SOEP-rapportages en vrije notities |
| [Medicatie](modules/medicatie.md) | Live | Medicatieoverzicht en -beheer |
| [Planning](modules/planning.md) | Live | Afspraken, dagplanning, wachtlijst |
| [Berichten](modules/berichten.md) | Live | Intern berichtensysteem |
| [Medewerkers](modules/medewerkers.md) | Live | Medewerkerregistratie, AGB-codes |
| [Organisatie](modules/organisatie.md) | Live | Locaties, afdelingen, clusters |
| [Configuratie](modules/configuratie.md) | Live | Custom velden, validatieregels |
| [Workflows](modules/workflows.md) | Live | BPMN procesflows |
| [Rollenbeheer](modules/rollenbeheer.md) | Live | RBAC met 4 standaardrollen |
| [MIC-meldingen](modules/mic-meldingen.md) | Live | Incidentrapportage |
| [Documenten](modules/documenten.md) | Live | Documentupload en -beheer |
| Roostering | Gepland | Medewerkerrooster, contracturen, capaciteit |
| Facturatie | Gepland | WLZ/WMO/ZVW declaraties |

## Technisch

| Document | Beschrijving |
|----------|-------------|
| [Architectuur](technisch/architectuur.md) | FHIR-native, multi-tenant, microservices |
| [RBAC & Beveiliging](technisch/rbac.md) | Rollen, permissies, NEN 7513 audit |
| [Multi-tenant](technisch/multi-tenant.md) | Tenant isolatie, onboarding, master admin |
| [Datamodel](technisch/datamodel.md) | FHIR R4 resources, extensies, identifiers |

## Integraties

| Document | Beschrijving |
|----------|-------------|
| [API Overzicht](integraties/api-overzicht.md) | REST endpoints, authenticatie, headers |
| [Koppelstrategie](integraties/koppelstrategie.md) | Hoe externe systemen aansluiten |
| [Webhooks](integraties/webhooks.md) | Event-driven integraties (gepland) |
