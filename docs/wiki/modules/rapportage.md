# Rapportage

## Wat doet deze module?

Beheert dagrapportages en notities over clienten (FHIR: Observation). OpenZorg ondersteunt twee rapportagetypen: **SOEP-rapportages** (gestructureerd) en **vrije rapportages**. SOEP staat voor Subjectief, Objectief, Evaluatie, Plan — een gangbare methode in de Nederlandse zorg.

## Functies

### SOEP-rapportage aanmaken
- **Subjectief (S)**: Wat de client zelf aangeeft, beleving, klachten
- **Objectief (O)**: Waarneming van de zorgmedewerker, meetwaarden
- **Evaluatie (E)**: Beoordeling en interpretatie van S en O
- **Plan (P)**: Vervolgacties, aanpassingen in het zorgplan
- Elk SOEP-veld is een apart `component` binnen de Observation
- Datum en tijd worden automatisch vastgelegd
- Auteur: de ingelogde medewerker (Practitioner referentie)

### Vrije rapportage
- Ongestructureerde notitie als alternatief voor SOEP
- Titel en vrije tekst
- Zelfde FHIR Observation resource, maar met categorie `vrij` in plaats van `soep`

### Rapportages bekijken
- Tijdlijnweergave per client, nieuwste bovenaan
- Filteren op type (SOEP/vrij), auteur, datumbereik
- Zoeken in rapportagetekst

### Koppeling aan zorgplan
- Optioneel koppelen van een rapportage aan een specifiek doel uit het zorgplan
- Via `Observation.focus` referentie naar het Goal

## Technisch

- **FHIR Resource**: Observation
- **Observation.category**: `soep` of `vrij` (via CodeableConcept)
- **SOEP-componenten** (Observation.component):
  - `component[0].code` = `S` (subjectief), `component[0].valueString` = tekst
  - `component[1].code` = `O` (objectief), `component[1].valueString` = tekst
  - `component[2].code` = `E` (evaluatie), `component[2].valueString` = tekst
  - `component[3].code` = `P` (plan), `component[3].valueString` = tekst
- **API**: ECD service op port 4001
  - `GET /api/clients/:id/rapportages` — Lijst met rapportages (gepagineerd, filter op type/auteur/datum)
  - `POST /api/clients/:id/rapportages` — Nieuwe rapportage aanmaken
  - `GET /api/clients/:id/rapportages/:rapId` — Enkele rapportage ophalen
  - `PUT /api/clients/:id/rapportages/:rapId` — Rapportage bijwerken
  - `DELETE /api/clients/:id/rapportages/:rapId` — Rapportage verwijderen (soft delete)
- **FHIR relaties**:
  - `Observation.subject` verwijst naar Patient
  - `Observation.performer` verwijst naar Practitioner
  - `Observation.focus` verwijst optioneel naar Goal (zorgplandoel)
- **Permissies**: `rapportages:read`, `rapportages:write`
- **Rollen**: Beheerder en zorgmedewerker kunnen lezen en schrijven. Teamleider kan lezen en schrijven. Planner kan alleen lezen.

## Configuratie per tenant

| Instelling | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `rapportageSOEPVerplicht` | `true` | Zijn alle vier SOEP-velden verplicht bij een SOEP-rapportage |
| `rapportageDefaultType` | `"soep"` | Standaard rapportagetype bij aanmaken |
