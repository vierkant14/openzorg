# Medewerkers

## Wat doet deze module?

Beheert de registratie van medewerkers (FHIR: Practitioner). Elke medewerker krijgt een profiel met persoonlijke gegevens, AGB-code en rol. AGB-codes worden gevalideerd volgens het standaard 8-cijferig formaat.

## Functies

### Medewerker aanmaken
- **Persoonsgegevens**: voornaam, tussenvoegsel, achternaam
- **AGB-code**: 8-cijferige code, gevalideerd op formaat (Kern-laag validatie vanuit `shared-domain`)
- **BIG-registratie**: optioneel, voor geregistreerde zorgprofessionals
- **Functie**: vrije tekst of selectie (bijv. verpleegkundige, verzorgende IG, arts)
- **Contactgegevens**: e-mail (verplicht, gebruikt voor login), telefoon
- **Locatie/Afdeling**: koppeling aan een of meerdere Organization resources
- **Rol**: beheerder, zorgmedewerker, planner, teamleider
- **Actief**: toggle om medewerker te activeren/deactiveren

### Medewerker bewerken
- Alle velden zijn wijzigbaar behalve de automatisch aangemaakte Medplum-gebruiker
- Rolwijziging alleen door beheerder

### Medewerker deactiveren
- Soft delete: zet `Practitioner.active` op `false`
- Medewerker kan niet meer inloggen maar blijft refereerbaar in historische gegevens
- Kan later worden geheractiveerd

### Overzicht en zoeken
- Lijst van alle medewerkers met naam, functie, AGB-code, rol, status
- Zoeken op naam, AGB-code of functie
- Filteren op rol, locatie, status (actief/inactief)

## Technisch

- **FHIR Resource**: Practitioner
- **API**: ECD service op port 4001
  - `GET /api/medewerkers` — Lijst medewerkers (zoek/filter)
  - `POST /api/medewerkers` — Nieuwe medewerker aanmaken
  - `GET /api/medewerkers/:id` — Medewerker ophalen
  - `PUT /api/medewerkers/:id` — Medewerker bijwerken
  - `DELETE /api/medewerkers/:id` — Medewerker deactiveren (soft delete)
- **AGB-validatie**: Kern-laag (Layer 1) validatie in `packages/shared-domain`. Controleert:
  - Exact 8 cijfers
  - Alleen numerieke tekens
  - Wordt uitgevoerd bij aanmaken en bewerken
- **Identifier systemen**:
  - `http://fhir.nl/fhir/NamingSystem/agb` — AGB-code
  - `http://fhir.nl/fhir/NamingSystem/big` — BIG-registratie (optioneel)
- **FHIR mapping**:
  - `Practitioner.name` bevat de naam
  - `Practitioner.identifier` bevat AGB- en BIG-codes
  - `Practitioner.telecom` bevat e-mail en telefoon
  - `Practitioner.active` geeft de actief/inactief status aan
  - Rol wordt opgeslagen via de extensie `https://openzorg.nl/extensions/role`
- **Permissies**: `medewerkers:read`, `medewerkers:write`
- **Rollen**: Beheerder kan alles. Teamleider kan lezen en beperkt schrijven (geen rolwijziging). Zorgmedewerker en planner kunnen alleen lezen.
