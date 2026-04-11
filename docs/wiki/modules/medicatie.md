# Medicatie

## Wat doet deze module?

Beheert het medicatieoverzicht van clienten (FHIR: MedicationRequest). Zorgmedewerkers kunnen medicatie registreren, wijzigen en stopzetten. Het overzicht toont alle actieve en historische medicatie van een client.

## Functies

### Medicatie registreren
- **Medicatienaam**: vrije invoer of selectie uit een lijst
- **Dosering**: hoeveelheid, eenheid (mg, ml, stuks, etc.)
- **Frequentie**: aantal keer per dag, specifieke tijden, of vrij schema
- **Toedieningsweg**: oraal, injectie, inhalatie, cutaan, etc.
- **Voorschrijver**: referentie naar Practitioner (arts/huisarts)
- **Startdatum**: verplicht
- **Einddatum**: optioneel (bij onbepaalde duur leeg)
- **Reden**: indicatie of toelichting
- **Status**: actief, gestopt, onderbroken

### Medicatie wijzigen
- Dosering, frequentie of toedieningsweg aanpassen
- Statuswijziging (stoppen, onderbreken, hervatten)
- Einddatum toevoegen bij stoppen
- Reden van wijziging vastleggen

### Medicatieoverzicht
- Lijst van alle medicatie per client
- Gescheiden weergave: actieve medicatie bovenaan, gestopte medicatie onderaan
- Filteren op status (actief/gestopt/alle)
- Sorteren op startdatum of naam

### Medicatiehistorie
- Volledige wijzigingshistorie per medicatie via FHIR versioning
- Wie heeft wanneer wat gewijzigd

## Technisch

- **FHIR Resource**: MedicationRequest
- **API**: ECD service op port 4001
  - `GET /api/clients/:id/medicatie` — Medicatieoverzicht (filter op status)
  - `POST /api/clients/:id/medicatie` — Nieuwe medicatie registreren
  - `GET /api/clients/:id/medicatie/:medId` — Enkele medicatie ophalen
  - `PUT /api/clients/:id/medicatie/:medId` — Medicatie wijzigen
  - `DELETE /api/clients/:id/medicatie/:medId` — Medicatie verwijderen (soft delete)
- **FHIR mapping**:
  - `MedicationRequest.subject` verwijst naar Patient
  - `MedicationRequest.requester` verwijst naar Practitioner (voorschrijver)
  - `MedicationRequest.status`: active, stopped, on-hold, cancelled
  - `MedicationRequest.dosageInstruction` bevat dosering, frequentie, route
  - `MedicationRequest.reasonCode` bevat de indicatie
  - `MedicationRequest.authoredOn` is de startdatum
- **Permissies**: `medicatie:read`, `medicatie:write`
- **Rollen**: Beheerder en zorgmedewerker kunnen lezen en schrijven. Teamleider en planner kunnen alleen lezen.

## Configuratie per tenant

| Instelling | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `medicatieVoorschrijverVerplicht` | `false` | Is een voorschrijver verplicht bij registratie |
