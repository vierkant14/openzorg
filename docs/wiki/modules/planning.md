# Planning

## Wat doet deze module?

Beheert afspraken, dagplanning, beschikbaarheid en wachtlijsten voor zorgverlening.

## Functies

### Afspraken
- Aanmaken met client- en medewerker-selectie (dropdown lookups, geen vrije invoer)
- Type afspraak: huisbezoek, telefonisch, kantoor, groepssessie
- Datum, start- en eindtijd
- Status: gepland, bevestigd, afgerond, geannuleerd

### Dagplanning
- Kalenderweergave per dag
- Overzicht van alle afspraken met client, type en tijdblok
- Datumnavigatie

### Wachtlijst
- Clienten op de wachtlijst met prioriteit (hoog/normaal/laag)
- Wachttijd berekening
- Omzetten van wachtlijstitem naar afspraak

### Beschikbaarheid
- Medewerker beschikbaarheid registreren per dag/tijdslot
- FHIR Schedule + Slot resources

## Technisch

- **FHIR Resources**: Appointment, Schedule, Slot, ServiceRequest (wachtlijst)
- **API**: Planning service op port 4002
  - `GET/POST /api/afspraken`
  - `GET/POST /api/beschikbaarheid`
  - `GET/POST/PUT /api/wachtlijst`
- **Permissies**: `planning:read`, `planning:write`
- **Rollen**: Planner heeft volledige toegang. Zorgmedewerker kan alleen lezen. Teamleider kan lezen en schrijven.

## Roadmap: Roostering & Capaciteitsplanning

### Sprint 5-6 (gepland)

**Contractbeheer**
- Contracturen per medewerker (FTE, uren per week)
- Contracttype (vast, flex, oproep, ZZP)
- Ingangsdatum en einddatum

**Roostering**
- Weekrooster per medewerker en locatie
- Diensttypen: vroege dienst, late dienst, nachtdienst, weekenddienst
- Ruilverzoeken en beschikbaarheidsvoorkeur
- Automatische roostervalidatie (minimale bezetting, maximale uren, rusttijd)

**Capaciteitsplanning**
- Bedden/plaatsen per locatie (capaciteit)
- Bezettingsgraad dashboard
- Match: beschikbare capaciteit (bedden) × benodigde medewerkers × contracturen
- Signalering bij onderbezetting of overbezetting

**Locatiegebonden planning**
- Per locatie/cluster eigen roosterregels
- Intramuraal: nachtdiensten, weekendschema's
- Extramuraal: wijkindeling, reistijdberekening

### Architectuur (voorbereiding)

Het rooster wordt opgebouwd uit drie FHIR resources:
1. **Schedule** — Wie is er wanneer beschikbaar
2. **Slot** — Concrete tijdblokken (vrij/bezet/geblokkeerd)
3. **Appointment** — Geplande afspraken

Contract en capaciteit worden opgeslagen als extensies of dedicated resources (FHIR PlanDefinition voor roostersjablonen).

Elk zorgproces (intramuraal, extramuraal, dagbesteding) heeft eigen roosterregels. Dit wordt per tenant configureerbaar via de onboarding wizard.
