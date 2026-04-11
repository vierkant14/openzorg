# Zorgplan

## Wat doet deze module?

Beheert het individuele zorgplan van een client (FHIR: CarePlan). Een zorgplan bevat **doelen** (Goals) en **interventies** (ServiceRequests) die samen de zorgverlening beschrijven. Elk doel kan meerdere interventies bevatten. Het zorgplan is altijd gekoppeld aan een client en heeft een status die de levenscyclus van het plan weergeeft.

## Functies

### Zorgplan aanmaken
- Automatisch aangemaakt bij het openen van een nieuw zorgplan voor een client
- Status: concept, actief, opgeschort, afgerond, geannuleerd
- Periode: startdatum (verplicht), einddatum (optioneel)
- Auteur: automatisch ingevuld met de ingelogde medewerker (Practitioner referentie)

### Doelen beheren
- Doel toevoegen aan het zorgplan met beschrijving en categorie
- Levenscyclus: voorgesteld, geaccepteerd, actief, opgeschort, bereikt, geannuleerd
- Prioriteit: hoog, normaal, laag
- Streefdatum: wanneer het doel behaald moet zijn
- Voortgang: vrije tekst of gestructureerde notitie per evaluatiemoment
- Elk doel wordt opgeslagen als FHIR Goal met referentie naar het CarePlan

### Interventies beheren
- Interventie toevoegen aan een specifiek doel
- Beschrijving van de uit te voeren handeling
- Frequentie: dagelijks, wekelijks, maandelijks, of vrij in te vullen
- Verantwoordelijke medewerker (Practitioner referentie)
- Status: concept, actief, afgerond, geannuleerd
- Elke interventie wordt opgeslagen als FHIR ServiceRequest met referentie naar het Goal

### Evaluatie
- Periodieke evaluatie van doelen en interventies
- Evaluatiedatum en bevindingen vastleggen
- Doelstatus bijwerken op basis van evaluatie

## Technisch

- **FHIR Resources**: CarePlan, Goal, ServiceRequest
- **API**: ECD service op port 4001
  - `GET /api/clients/:id/zorgplan` — Haal het actieve zorgplan op inclusief doelen en interventies
  - `POST /api/clients/:id/zorgplan` — Maak een nieuw zorgplan aan
  - `PUT /api/clients/:id/zorgplan/:planId` — Werk het zorgplan bij
  - `POST /api/clients/:id/zorgplan/:planId/doelen` — Voeg een doel toe
  - `PUT /api/clients/:id/zorgplan/:planId/doelen/:goalId` — Werk een doel bij
  - `POST /api/clients/:id/zorgplan/:planId/doelen/:goalId/interventies` — Voeg een interventie toe
  - `PUT /api/clients/:id/zorgplan/:planId/interventies/:srId` — Werk een interventie bij
- **FHIR relaties**:
  - `CarePlan.subject` verwijst naar Patient
  - `CarePlan.goal` verwijst naar Goal resources
  - `Goal.addresses` verwijst naar de CarePlan
  - `ServiceRequest.basedOn` verwijst naar het CarePlan
  - `ServiceRequest.reasonReference` verwijst naar het Goal
- **Permissies**: `zorgplan:read`, `zorgplan:write`
- **Rollen**: Beheerder en zorgmedewerker kunnen lezen en schrijven. Teamleider kan lezen en schrijven. Planner kan alleen lezen.

## Configuratie per tenant

| Instelling | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `zorgplanEvaluatiePeriode` | `90` | Aantal dagen tussen evaluatiemomenten |
| `zorgplanMaxDoelen` | `20` | Maximum aantal doelen per zorgplan |
