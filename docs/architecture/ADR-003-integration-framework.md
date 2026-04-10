# ADR-003: Integration Framework — Interoperabiliteit als kernwaarde

## Status
Accepted

## Context
OpenZorg positioneert zich als open alternatief voor gesloten ECD-systemen.
Een cruciaal verkoopargument is dat zorginstellingen hun bestaande systemen
(financieel, HR, planning, apotheek) eenvoudig kunnen koppelen. Dit vereist
een expliciet integratie-framework dat verder gaat dan alleen een REST API.

Concrete systemen die klanten willen koppelen:
- **Financieel**: AFAS, Exact Online, Twinfield, Unit4
- **HR/Salarisadministratie**: AFAS HRM, Visma Raet, ADP
- **Planning extern**: PlanCare, Rostar
- **Apotheek**: Pharmacom, Prescriptor
- **Communicatie**: Microsoft 365, Google Workspace
- **Overheid/keten**: VECOZO, iWlz/iStandaarden, GGD-systemen, Vektis
- **BI**: Metabase (ingebouwd), Power BI, Tableau

## Decision

### Drie integratiemechanismen

**1. FHIR API (standaard, altijd beschikbaar)**
- Volledige FHIR R4 REST API via Medplum
- Zorg-NL profielen voor Nederlandse interoperabiliteit
- OAuth2 client credentials voor machine-to-machine auth
- Elke externe app kan direct FHIR resources lezen/schrijven
- Scoping via AccessPolicy per integratie-client

**2. Webhook / Event Subscriptions (Sprint 2)**
- Configureerbare webhooks per tenant via admin-UI
- Events: `patient.created`, `appointment.planned`, `carePlan.updated`, etc.
- FHIR Subscription resource als basis (standaard, niet custom)
- Retry-mechanisme met exponential backoff
- Webhook secret + HMAC signature voor verificatie
- Event log per tenant voor debugging

**3. Connector SDK + standaard connectors (Sprint 4+)**
- TypeScript SDK voor het bouwen van connectors
- Connector = plugin die de OpenZorg event bus koppelt aan een extern systeem
- Standaard connectors voor veelgevraagde systemen:

| Connector | Richting | Wat het synct | Prioriteit |
|---|---|---|---|
| AFAS | Bi-directioneel | Facturen, medewerkers, uren | Hoog |
| Exact Online | Export | Facturen, grootboek | Hoog |
| iWlz/iStandaarden | Bi-directioneel | MAZ, AW319, indicaties | MVP (beperkt) |
| VECOZO | Export | Declaraties | Hoog |
| Microsoft 365 | Import/Export | Agenda-sync voor medewerkers | Middel |
| Vektis | Export | Declaratieberichten | Middel |

### API-design principes voor interoperabiliteit

1. **Alles via FHIR waar mogelijk** — geen custom endpoints voor data die
   als FHIR-resource uitgedrukt kan worden
2. **Custom endpoints alleen voor niet-FHIR operaties** — bijv. bulk export,
   rapportage-aggregaties, configuratie
3. **Webhooks zijn FHIR Subscriptions** — geen eigen webhook-systeem
4. **Idempotente operaties** — alle writes zijn idempotent voor retry-safety
5. **Rate limiting per client** — voorkomt dat een buggy connector de API platlegt
6. **Versioned API** — `/api/v1/` prefix voor alle niet-FHIR endpoints
7. **OpenAPI spec** — automatisch gegenereerd, altijd up-to-date
8. **Sandbox per tenant** — testomgeving voor connector-ontwikkeling

### Technische implementatie

```
Externe app → OAuth2 client_credentials → AccessPolicy-scoped token
           → FHIR R4 API (Medplum) voor zorgdata
           → Hono API (/api/v1/) voor OpenZorg-specifieke operaties
           → Webhook subscriptions voor real-time events

OpenZorg → Event bus (PG LISTEN/NOTIFY) → Webhook dispatcher
         → Connector SDK → AFAS/Exact/etc.
```

### Developer portal (post-MVP)

- API-documentatie met interactieve sandbox
- Connector marketplace
- OAuth2 app registratie voor third-party ontwikkelaars
- Usage analytics per integratie

## Consequences

- FHIR API is automatisch interoperabel met elk FHIR-capable systeem
- Webhook-systeem voegt complexiteit toe maar is essentieel voor real-time integraties
- Connector SDK vereist onderhoud per externe API (AFAS API wijzigt, etc.)
- We committen aan backwards-compatible API versioning
- Elke connector is een apart npm package in de monorepo (`adapters/`)
- Security: elke integratie krijgt eigen client credentials met minimale rechten
