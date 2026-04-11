# Configuratie

## Wat doet deze module?

Beheert custom velden en validatieregels per tenant. Functioneel beheerders kunnen zonder ontwikkelaar extra velden toevoegen aan clientdossiers en formulieren. Dit is onderdeel van de drie-lagen configuratiefilosofie: Kern (onwijzigbaar), Uitbreiding (tenant-configureerbaar), Plugin (toekomstig).

## Functies

### Custom velden
Een functioneel beheerder kan aangepaste velden definiëren die verschijnen in het clientdossier of andere formulieren.

**Ondersteunde veldtypen:**
| Type | Beschrijving | Voorbeeld |
|------|-------------|---------|
| `string` | Vrije tekst, enkele regel | Klantkenmerk |
| `number` | Numeriek, optioneel met min/max | Aantal contactmomenten |
| `date` | Datumveld | Datum intakegesprek |
| `boolean` | Ja/nee checkbox | Heeft huisdier |
| `dropdown` | Keuzelijst met voorgedefinieerde opties | Woonsituatie (zelfstandig, beschermd, etc.) |
| `multi-select` | Meerdere opties selecteerbaar | Allergieën |
| `textarea` | Vrije tekst, meerdere regels | Bijzonderheden |

**Per custom veld:**
- Naam (label): verplicht, uniek binnen de tenant
- Technische sleutel: automatisch gegenereerd uit de naam
- Veldtype: een van de bovenstaande typen
- Verplicht: toggle (standaard uit)
- Actief: toggle om het veld te tonen/verbergen zonder data te verliezen
- Volgorde: bepaalt de positie in het formulier
- Opties: alleen voor dropdown en multi-select, lijst van toegestane waarden

### Validatieregels (Uitbreidingslaag)
Tenant-specifieke validatieregels bovenop de kern-validatie. Beheerders kunnen per veld extra regels instellen.

**Ondersteunde operatoren:**
| Operator | Toepassing | Voorbeeld |
|----------|-----------|---------|
| `required` | Veld is verplicht | BSN verplicht maken |
| `min` | Minimale waarde (number) | Leeftijd >= 0 |
| `max` | Maximale waarde (number) | Leeftijd <= 150 |
| `minLength` | Minimale tekstlengte | Naam >= 2 tekens |
| `maxLength` | Maximale tekstlengte | Notitie <= 5000 tekens |
| `pattern` | Regex patroon | Postcode: `^\d{4}\s?[A-Z]{2}$` |
| `in` | Waarde moet in lijst staan | Status in [actief, inactief] |

### Beheer
- Overzicht van alle custom velden met naam, type, verplicht, actief
- Velden aanmaken, bewerken en deactiveren
- Validatieregels toevoegen, bewerken en verwijderen
- Voorvertoning van het formulier met custom velden

## Technisch

- **Opslag**: Custom velden worden opgeslagen als FHIR StructureDefinition extensies
- **Waarden**: Opgeslagen als extensies op de betreffende resource (bijv. Patient extensie)
- **Extensie base URL**: `https://openzorg.nl/extensions/custom/`
- **Validatieregels**: Opgeslagen in PostgreSQL tabel `tenant_configurations` (RLS per tenant)
- **Validatie-engine**: `packages/shared-config/src/validation-engine.ts`
- **API**: ECD service op port 4001
  - `GET /api/admin/custom-fields` — Lijst van custom velden
  - `POST /api/admin/custom-fields` — Nieuw custom veld aanmaken
  - `PUT /api/admin/custom-fields/:id` — Custom veld bewerken
  - `DELETE /api/admin/custom-fields/:id` — Custom veld deactiveren
  - `GET /api/admin/validation-rules` — Lijst van validatieregels
  - `POST /api/admin/validation-rules` — Nieuwe validatieregel aanmaken
  - `PUT /api/admin/validation-rules/:id` — Validatieregel bewerken
  - `DELETE /api/admin/validation-rules/:id` — Validatieregel verwijderen
- **Permissies**: `configuratie:read`, `configuratie:write`
- **Rollen**: Alleen beheerder kan lezen en schrijven. Overige rollen hebben geen toegang tot configuratie.

## Drie-lagen validatie

```
Laag 1: Kern (immutable)          → BSN elfproef, AGB 8-cijferig, verplichte Zib-velden
Laag 2: Uitbreiding (configurabel) → Tenant-specifieke regels via /api/admin/validation-rules
Laag 3: Plugin (toekomstig)        → Custom validatie-plugins per organisatie
```

Kern-validatie kan niet worden uitgeschakeld door tenants. Uitbreidingsregels worden toegevoegd bovenop de kern.
