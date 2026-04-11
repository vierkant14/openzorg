# Berichten

## Wat doet deze module?

Intern berichtensysteem voor communicatie tussen medewerkers (FHIR: Communication). Medewerkers kunnen berichten versturen naar collega's, met optionele koppeling aan een client. Het systeem houdt gelezen/ongelezen status bij.

## Functies

### Bericht versturen
- **Ontvanger**: selectie van een of meerdere medewerkers (Practitioner referentie)
- **Onderwerp**: vrije tekst
- **Inhoud**: vrije tekst (markdown niet ondersteund)
- **Client**: optionele koppeling aan een client (Patient referentie)
- **Prioriteit**: normaal of urgent
- Afzender wordt automatisch ingevuld met de ingelogde medewerker

### Inbox
- Overzicht van ontvangen berichten, nieuwste bovenaan
- **Ongelezen indicator**: visuele markering (bold + badge) voor ongelezen berichten
- **Ongelezen teller**: badge in de sidebar navigatie met aantal ongelezen berichten
- Markeren als gelezen (automatisch bij openen, of handmatig)
- Markeren als ongelezen
- Filteren: alle, ongelezen, per afzender

### Verzonden berichten
- Overzicht van verstuurde berichten
- Status: verzonden, gelezen (wanneer ontvanger het bericht heeft geopend)

### Bericht beantwoorden
- Direct reageren op een ontvangen bericht
- Conversatieweergave: berichten in een thread gekoppeld via `Communication.inResponseTo`

## Technisch

- **FHIR Resource**: Communication
- **API**: ECD service op port 4001
  - `GET /api/berichten` — Inbox van de ingelogde medewerker (gepagineerd)
  - `GET /api/berichten/verzonden` — Verzonden berichten
  - `POST /api/berichten` — Nieuw bericht versturen
  - `GET /api/berichten/:id` — Enkel bericht ophalen (markeert als gelezen)
  - `PUT /api/berichten/:id/gelezen` — Markeer als gelezen
  - `PUT /api/berichten/:id/ongelezen` — Markeer als ongelezen
  - `GET /api/berichten/ongelezen/count` — Aantal ongelezen berichten (voor badge)
- **FHIR mapping**:
  - `Communication.sender` verwijst naar Practitioner (afzender)
  - `Communication.recipient` verwijst naar Practitioner(s) (ontvanger(s))
  - `Communication.subject` verwijst optioneel naar Patient
  - `Communication.payload` bevat de berichtinhoud als string
  - `Communication.topic` bevat het onderwerp
  - `Communication.priority` = `routine` of `urgent`
  - `Communication.status` = `completed` (verzonden)
  - `Communication.received` = tijdstip van eerste keer openen (gelezen)
  - `Communication.inResponseTo` verwijst naar het oorspronkelijke bericht bij antwoorden
- **Gelezen/ongelezen**: Wordt bijgehouden via het `received` veld. Als `received` leeg is, is het bericht ongelezen.
- **Permissies**: `berichten:read`, `berichten:write`
- **Rollen**: Alle rollen kunnen berichten lezen en versturen.
