# Workflows

## Wat doet deze module?

Beheert procesflows via Flowable Community (BPMN 2.0). Functioneel beheerders kunnen werkprocessen definiëren als BPMN-templates. Medewerkers voeren taken uit via de taakwerkbak. De workflow-bridge service fungeert als tussenlaag tussen OpenZorg en de Flowable engine.

## Functies

### BPMN Templates
- Voorgedefinieerde processjablonen voor veelvoorkomende zorgprocessen
- Sjablonen worden beheerd in de workflow-bridge service (`bpmn-templates.ts`)
- Voorbeelden:
  - **Intake proces**: aanmelding, screening, intakegesprek, besluit
  - **Zorgplanevaluatie**: signalering, evaluatieverzoek, MDO, bijstelling
  - **Incidentafhandeling**: melding, analyse, maatregelen, terugkoppeling
  - **Onboarding medewerker**: contract, systeem-toegang, inwerkplan, evaluatie

### Proces starten
- Selectie van een BPMN-template
- Optioneel koppelen aan een client (Patient referentie)
- Initiator wordt automatisch ingevuld met de ingelogde medewerker
- Variabelen meegeven bij start (bijv. clientId, prioriteit)

### Taakwerkbak
- Persoonlijke werkbak met openstaande taken voor de ingelogde medewerker
- Teamwerkbak met alle openstaande taken voor het team
- Per taak: naam, omschrijving, toegewezen aan, deadline, prioriteit
- Acties: claimen (uit teamwerkbak), voltooien, terugleggen in teamwerkbak

### Taak voltooien
- Formulier invullen (uitkomst, notitie)
- Beslissingsvariabelen instellen (bijv. goedgekeurd: ja/nee)
- Na voltooiing gaat het proces automatisch door naar de volgende stap

### Procesbewaking
- Overzicht van lopende processen met status
- Procesgeschiedenis: welke stappen zijn doorlopen, door wie, wanneer
- Actieve stap markering

## Technisch

- **BPMN Engine**: Flowable Community op port 8080
- **Bridge service**: Hono op port 4003 (`services/workflow-bridge/`)
- **API**: Workflow-bridge service op port 4003
  - `GET /api/templates` — Beschikbare BPMN-sjablonen
  - `POST /api/processen` — Start een nieuw proces op basis van een template
  - `GET /api/processen` — Lijst van lopende processen
  - `GET /api/processen/:id` — Procesdetails en geschiedenis
  - `GET /api/taken` — Taakwerkbak (persoonlijk en team)
  - `POST /api/taken/:id/claim` — Taak claimen
  - `POST /api/taken/:id/complete` — Taak voltooien
  - `POST /api/taken/:id/unclaim` — Taak terugleggen
- **Flowable REST API** (intern, niet publiek):
  - De bridge service communiceert met Flowable via `http://flowable:8080/flowable-rest/service/`
  - Authenticatie: Basic auth (admin/admin in development)
- **Permissies**: `workflows:read`, `workflows:write`
- **Rollen**: Beheerder kan alles inclusief templates beheren. Zorgmedewerker kan taken uitvoeren. Teamleider kan taken toewijzen en procesbewaking inzien. Planner heeft geen toegang.
