# MIC-meldingen

## Wat doet deze module?

Beheert MIC-meldingen (Melding Incidenten Client) voor het registreren en afhandelen van incidenten in de zorgverlening (FHIR: AuditEvent). MIC is een wettelijk vereist systeem in de Nederlandse zorg voor het melden van ongewenste gebeurtenissen rond clienten.

## Functies

### Incident melden
- **Type incident**: val, medicatiefout, agressie, dwaling, decubitus, overig
- **Datum en tijd**: wanneer het incident plaatsvond
- **Locatie**: waar het incident plaatsvond (Organization referentie)
- **Client**: betrokken client (Patient referentie)
- **Melder**: automatisch ingevuld met de ingelogde medewerker
- **Omschrijving**: vrije tekst beschrijving van het incident
- **Ernst**: laag, middel, hoog, kritiek
- **Directe actie**: welke actie is direct ondernomen
- **Getuigen**: optioneel, namen van aanwezigen

### Afhandeling
- **Status**: gemeld, in behandeling, afgehandeld
- **Analyse**: oorzaakanalyse door teamleider of beheerder
- **Maatregelen**: genomen maatregelen om herhaling te voorkomen
- **Afhandelaar**: de medewerker die de melding afhandelt
- **Afhandeldatum**: wanneer de melding is afgehandeld

### Overzicht en rapportage
- Lijst van alle MIC-meldingen met filters op status, type, ernst, periode
- Zoeken op client, melder of omschrijving
- Teller per status (gemeld/in behandeling/afgehandeld)
- Export mogelijkheid voor kwartaalrapportages (toekomstig)

### Notificatie
- Bij een nieuwe melding met ernst "hoog" of "kritiek" wordt de teamleider genotificeerd via het berichtensysteem

## Technisch

- **FHIR Resource**: AuditEvent
- **API**: ECD service op port 4001
  - `GET /api/mic-meldingen` — Lijst MIC-meldingen (gefilterd, gepagineerd)
  - `POST /api/mic-meldingen` — Nieuwe MIC-melding aanmaken
  - `GET /api/mic-meldingen/:id` — Enkele melding ophalen
  - `PUT /api/mic-meldingen/:id` — Melding bijwerken (afhandeling)
- **FHIR mapping**:
  - `AuditEvent.type` bevat het incidenttype
  - `AuditEvent.recorded` is het meldmoment
  - `AuditEvent.outcome` is de ernst
  - `AuditEvent.outcomeDesc` bevat de omschrijving
  - `AuditEvent.agent[0]` verwijst naar de melder (Practitioner)
  - `AuditEvent.agent[1]` verwijst optioneel naar de afhandelaar (Practitioner)
  - `AuditEvent.entity[0]` verwijst naar de client (Patient)
  - `AuditEvent.source` verwijst naar de locatie (Organization)
  - Status en analyse worden opgeslagen via extensies (`https://openzorg.nl/extensions/mic-status`, `https://openzorg.nl/extensions/mic-analyse`)
- **Permissies**: `mic:read`, `mic:write`
- **Rollen**: Alle rollen kunnen meldingen lezen en aanmaken. Alleen beheerder en teamleider kunnen meldingen afhandelen (status wijzigen naar afgehandeld).
