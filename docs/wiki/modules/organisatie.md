# Organisatie

## Wat doet deze module?

Beheert de organisatiestructuur met locaties, afdelingen en clusters (FHIR: Organization). De structuur is hierarchisch: een organisatie kan meerdere locaties bevatten, een locatie meerdere afdelingen, enzovoort. Dit wordt gerealiseerd via `Organization.partOf` referenties.

## Functies

### Organisatie inrichten
- **Hoofdorganisatie**: automatisch aangemaakt bij tenant onboarding (naam, KvK-nummer, AGB-code)
- **Locaties**: fysieke vestigingen met adres (straat, postcode, woonplaats)
- **Afdelingen**: organisatorische eenheden binnen een locatie
- **Clusters**: groepering van clienten binnen een afdeling (bijv. woongroep, wijkteam)

### Locatie aanmaken
- Naam (verplicht)
- Adres: straat, huisnummer, postcode, woonplaats
- Type: intramuraal, extramuraal, dagbesteding, kantoor
- Telefoonnummer en e-mail
- Bovenliggende organisatie (partOf): dropdown selectie

### Hierarchie beheren
- Boomstructuurweergave van de organisatie
- Drag-and-drop herschikking van afdelingen en clusters (partOf aanpassen)
- Elk niveau kan worden uitgevouwen of ingeklapt

### Zoeken en filteren
- Zoeken op naam
- Filteren op type (intramuraal/extramuraal/dagbesteding/kantoor)

## Technisch

- **FHIR Resource**: Organization
- **API**: ECD service op port 4001
  - `GET /api/organisatie` — Volledige organisatiestructuur (boom)
  - `POST /api/organisatie` — Nieuwe locatie/afdeling/cluster aanmaken
  - `GET /api/organisatie/:id` — Enkele organisatie-eenheid ophalen
  - `PUT /api/organisatie/:id` — Organisatie-eenheid bijwerken
  - `DELETE /api/organisatie/:id` — Organisatie-eenheid deactiveren
- **FHIR mapping**:
  - `Organization.name` is de naam
  - `Organization.partOf` verwijst naar de bovenliggende Organization
  - `Organization.type` bevat het type (intramuraal, extramuraal, etc.)
  - `Organization.address` bevat het adres
  - `Organization.telecom` bevat contactgegevens
  - `Organization.identifier` bevat het KvK-nummer en/of AGB-code
  - `Organization.active` geeft de actief/inactief status aan
- **Identifier systemen**:
  - `https://openzorg.nl/NamingSystem/kvk` — KvK-nummer
  - `http://fhir.nl/fhir/NamingSystem/agb` — AGB-code organisatie
- **Permissies**: `organisatie:read`, `organisatie:write`
- **Rollen**: Beheerder kan alles. Teamleider kan lezen. Zorgmedewerker en planner kunnen lezen.
