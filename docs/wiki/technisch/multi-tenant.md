# Multi-tenant

## Overzicht

OpenZorg is vanaf dag 1 ontworpen als multi-tenant platform. Elke zorgorganisatie is een volledig geïsoleerde tenant met eigen data, gebruikers en configuratie. Isolatie wordt gegarandeerd op twee niveaus: PostgreSQL Row Level Security en Medplum Projects.

## Tenant isolatie

### Medplum Projects
- Elke tenant krijgt een eigen Medplum Project
- Auth tokens zijn project-scoped: een token voor tenant A kan geen data van tenant B benaderen
- FHIR resources worden automatisch geïsoleerd per project
- Gebruikers worden per project aangemaakt (een medewerker bestaat alleen binnen zijn tenant)

### PostgreSQL RLS
- Aanvullende isolatie voor tenant-specifieke data buiten FHIR (configuratie, audit)
- Tabellen met RLS: `tenant_configurations`, `audit_log`
- RLS policies filteren op `tenant_id` kolom
- Zelfs bij een bug in de applicatielaag kan data niet lekken naar andere tenants

```sql
-- Voorbeeld RLS policy
CREATE POLICY tenant_isolation ON tenant_configurations
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

## Tenantbeheer

### Tenants tabel
De `openzorg.tenants` tabel in PostgreSQL slaat de basisconfiguratie van elke tenant op:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| `id` | UUID | Primaire sleutel |
| `name` | TEXT | Organisatienaam |
| `slug` | TEXT | URL-vriendelijke naam (uniek) |
| `medplum_project_id` | TEXT | Gekoppeld Medplum Project ID |
| `sectors` | TEXT[] | Zorgsectoren (VVT, GGZ, GHZ, etc.) |
| `enabled_modules` | TEXT[] | Actieve modules voor deze tenant |
| `settings` | JSONB | Tenant-specifieke instellingen |
| `is_enabled` | BOOLEAN | Tenant actief/inactief |
| `created_at` | TIMESTAMP | Aanmaakdatum |

### Tenant-instellingen (JSONB)
Het `settings` veld bevat configureerbare opties per tenant:

```json
{
  "bsnRequired": false,
  "clientnummerPrefix": "C",
  "zorgplanEvaluatiePeriode": 90,
  "documentMaxSizeMB": 10,
  "rapportageDefaultType": "soep"
}
```

Instellingen zijn raadpleegbaar via `GET /api/tenant-settings`.

## Master Admin

De master admin is een super-admin dashboard voor het beheren van alle tenants. Toegankelijk via `/master-admin` in de web applicatie.

### Routes
Alle master admin API routes staan onder `/api/master/*` en zijn beveiligd met de `X-Master-Key` header (geen PKCE auth). De tenant middleware wordt overgeslagen voor deze routes.

- `GET /api/master/tenants` — Lijst van alle tenants
- `POST /api/master/tenants` — Nieuwe tenant aanmaken (onboarding)
- `GET /api/master/tenants/:id` — Tenant details ophalen
- `PUT /api/master/tenants/:id` — Tenant bijwerken
- `PUT /api/master/tenants/:id/toggle` — Tenant activeren/deactiveren

### Onboarding wizard
Het aanmaken van een nieuwe tenant doorloopt de volgende stappen:

1. **Organisatiegegevens**: naam, slug, KvK-nummer
2. **Sectoren**: welke zorgsectoren (VVT, GGZ, etc.)
3. **Modules**: welke modules activeren
4. **Beheerder**: eerste admin gebruiker (e-mail, wachtwoord)
5. **Instellingen**: initiële tenant settings (BSN verplicht, clientnummer prefix, etc.)

Na afronding:
- Er wordt een Medplum Project aangemaakt
- De eerste beheerder wordt geregistreerd via de PKCE flow
- De tenant wordt opgeslagen in de `tenants` tabel
- De standaard organisatiestructuur (Organization) wordt aangemaakt

## Multi-sector

Organisaties kunnen in meerdere zorgsectoren opereren (bijv. VVT + GGZ). Dit wordt opgeslagen als `sectors TEXT[]` in de tenants tabel. Sectorspecifieke modules en formulieren worden conditioneel getoond op basis van de actieve sectoren.

Ondersteunde sectoren:
- **VVT**: Verpleging, Verzorging en Thuiszorg
- **GGZ**: Geestelijke Gezondheidszorg
- **GHZ**: Gehandicaptenzorg
- **Ziekenhuis**: Ziekenhuiszorg
- **Jeugdzorg**: Jeugdhulpverlening
