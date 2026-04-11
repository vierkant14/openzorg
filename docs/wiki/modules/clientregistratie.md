# Clientregistratie

## Wat doet deze module?

Beheert de basisregistratie van clienten (FHIR: Patient). Elke client krijgt automatisch een uniek **clientnummer** (bijv. C-00001). BSN is optioneel en configureerbaar per organisatie.

## Functies

### Client aanmaken
- **Persoonsgegevens**: voornaam, tussenvoegsel, achternaam, geboortedatum, geslacht, burgerlijke staat
- **BSN**: optioneel (configureerbaar per tenant via instellingen). Wordt gevalideerd met de elfproef.
- **Clientnummer**: automatisch gegenereerd, uniek per tenant, format C-XXXXX
- **Contactgegevens**: telefoon vast/mobiel, e-mail
- **Adres**: straat, huisnummer + toevoeging, postcode, woonplaats
- **Behandelaar**: dropdown-selectie uit geregistreerde medewerkers (FHIR Practitioner referentie)
- **Locatie/Cluster**: dropdown-selectie uit organisatielocaties (FHIR Organization referentie)
- **Verzekering**: verzekeraar, polisnummer
- **Indicatie**: type (WLZ/WMO/ZVW/Jeugdwet), CIZ besluitnummer, start/einddatum, zorgprofiel

### Client inactief maken
Soft delete via de "Inactief maken" knop in het clientdossier. Zet `Patient.active` op `false`. Client blijft in het systeem maar wordt gemarkeerd. Kan later worden heractiveerd.

### Zoeken en filteren
Zoek op naam, clientnummer, BSN of woonplaats. Clientenlijst toont: naam, clientnummer, BSN, leeftijd, woonplaats, status.

## Technisch

- **FHIR Resource**: Patient
- **API**: `GET/POST /api/clients`, `GET/PUT/DELETE /api/clients/:id`
- **Identifier systemen**:
  - `http://fhir.nl/fhir/NamingSystem/bsn` — BSN
  - `https://openzorg.nl/NamingSystem/clientnummer` — Clientnummer (auto-gegenereerd)
- **Permissies**: `clients:read`, `clients:write`, `clients:delete`
- **Rollen**: Alle rollen kunnen lezen. Beheerder en zorgmedewerker kunnen schrijven. Alleen beheerder kan verwijderen.

## Configuratie per tenant

| Instelling | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `bsnRequired` | `false` | BSN verplicht bij aanmaken client |
| `clientnummerPrefix` | `"C"` | Prefix voor het clientnummer |
