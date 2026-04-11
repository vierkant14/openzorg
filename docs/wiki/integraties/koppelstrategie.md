# Koppelstrategie

## Visie

OpenZorg is geen monoliet die alles zelf doet. Veel zorginstellingen hebben bestaande systemen voor specifieke processen (HR, roostering, facturatie, salarisadministratie). OpenZorg biedt twee integratiemodellen:

### Model 1: OpenZorg als bron (API Provider)

Externe systemen halen data op uit of sturen data naar OpenZorg.

```
Extern systeem → OpenZorg API → FHIR data
```

**Voorbeelden:**
- HR-systeem haalt medewerkergegevens op via `/api/medewerkers`
- Facturatiesysteem leest afspraken uit via `/api/afspraken`
- BI-tool leest rapportages uit voor kwaliteitsindicatoren
- Roostersoftware stuurt geplande diensten als Appointments naar OpenZorg

**Authenticatie:** Bearer token + tenant header. Per integratie wordt een service-account aangemaakt met specifieke RBAC-permissies.

### Model 2: OpenZorg als consument (API Consumer)

OpenZorg haalt data op uit externe systemen.

```
OpenZorg → Externe API → Data
```

**Voorbeelden:**
- VECOZO: declaratiestatus ophalen
- iWlz: indicatiegegevens ophalen
- AGB-register: behandelaarvalidatie
- Apotheeksysteem: medicatieverificatie

Dit wordt via de workflow-bridge geimplementeerd als BPMN service-taken.

## Ondersteunde koppelformaten

| Formaat | Richting | Status |
|---------|----------|--------|
| REST JSON API | Beide | Live |
| FHIR R4 | Beide | Live (via Medplum) |
| Webhooks (events) | Uitgaand | Gepland Sprint 5 |
| HL7 FHIR Subscriptions | Beide | Gepland Sprint 6 |
| CSV/Excel import | Inkomend | Gepland |
| iWlz MAZ-berichten | Inkomend | Gepland Sprint 4 |
| AW319/AW320 | Uitgaand | Gepland Sprint 4 |

## API Headers

Alle API-calls vereisen:

```http
Authorization: Bearer <token>
X-Tenant-ID: <medplum-project-id>
X-User-Role: <rol>  (optioneel, voor RBAC)
Content-Type: application/json
```

## Bestaande systemen die klanten mogelijk al gebruiken

| Domein | Veelgebruikte pakketten | Integratieaanpak |
|--------|------------------------|-------------------|
| Roostering | Plancare, ORTEC, Nedap ONS | API import van diensten → Appointment |
| Salarisadministratie | AFAS, Exact, Visma | Medewerkerdata sync |
| Facturatie | AFAS, Exact, VECOZO | Declaratie-export |
| HRM | AFAS, SAP HR | Medewerker + contract sync |
| Apotheek | Pharmacom, Medimo | Medicatie-verificatie |
| Huisarts | HIS systemen | Verwijzing + medicatieoverdracht |

## Documentatie voor integrators

Elke API-endpoint wordt beschreven in het [API Overzicht](api-overzicht.md). Per endpoint:
- URL, HTTP method, request/response body
- Vereiste permissies
- FHIR resource mapping
- Voorbeeld curl-commando

OpenAPI spec is beschikbaar op `/api/docs` (gepland).

## Advies aan klanten

Bij de onboarding vragen we welke systemen de organisatie al gebruikt. Op basis daarvan:

1. **Systeem wordt vervangen door OpenZorg** → Data migratie
2. **Systeem blijft naast OpenZorg** → API-koppeling configureren
3. **Systeem is leidend voor specifiek domein** → OpenZorg haalt data op

Deze keuze wordt per module gemaakt, niet per organisatie.
