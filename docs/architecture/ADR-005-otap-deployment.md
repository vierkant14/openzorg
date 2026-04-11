# ADR-005: OTAP-strategie en veilige deployment voor multi-tenant SaaS

## Status
Accepted

## Datum
2026-04-11

## Context

OpenZorg is multi-tenant SaaS: alle tenants draaien op dezelfde codebase en dezelfde infrastructuur. Een update pushen naar productie raakt dus **alle** tenants tegelijk. De angst is terecht: een kapotte migratie of breaking change kan de zorgprocessen van meerdere organisaties platleggen.

De huidige situatie:
- **FHIR R4 data** (zorgplannen, rapportages, clienten) zit in Medplum — schema-vrije JSON-documenten
- **Operationele data** (tenants, audit_log, prestaties, declaraties) zit in PostgreSQL met RLS-isolatie per tenant
- We hebben momenteel **1 omgeving** op Unraid (effectief direct productie)
- We zijn een team van 2 personen — alles moet simpel en beheersbaar blijven

We hebben een strategie nodig die:
1. Voorkomt dat een deploy bestaande tenant-data breekt
2. Ons in staat stelt features geleidelijk uit te rollen
3. Past bij onze teamgrootte (geen Kubernetes-overhead voor 2 man)

## Besluit

### 1. FHIR-data is inherent veilig bij updates

FHIR R4 resources zijn **additief by design**:
- Nieuwe extensions breken oude data niet — clients die ze niet kennen negeren ze gewoon
- Verwijderde velden veroorzaken geen errors, FHIR-clients zijn tolerant voor ontbrekende optionele velden
- Medplum slaat alles op als JSON-documenten, er is geen rigide schema dat migreert

**Conclusie:** voor de klinische data in Medplum hoeven we niks speciaals te doen. Nieuwe FHIR-velden toevoegen is altijd veilig. Dit is een van de grote voordelen van een FHIR-native architectuur.

### 2. PostgreSQL-migraties: expand-contract patroon

Migraties staan als genummerde SQL-bestanden in `infra/postgres/migrations/` en zijn altijd **forward-only** (via bijv. `node-pg-migrate`).

```
infra/postgres/migrations/
  001_add_feature_flags.sql
  002_add_prestatie_status.sql
  003_add_declaratie_batch.sql
```

**Expand-contract patroon** — destructieve wijzigingen worden altijd in twee releases gesplitst:

- **Release N (expand):** Nieuwe kolom toevoegen, code schrijft naar oude én nieuwe kolom.
- **Release N+1 (contract):** Oude kolom verwijderen nadat alle code de nieuwe kolom gebruikt.

**Harde regels:**
- **Nooit `DROP COLUMN` of `DROP TABLE` in dezelfde release als deprecation.** Altijd minimaal 1 release wachten.
- **Altijd additief per release:** `ADD COLUMN ... DEFAULT ...`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX CONCURRENTLY`
- **Altijd idempotent:** gebruik `IF NOT EXISTS`, `IF NOT COLUMN EXISTS`-checks, zodat een migratie veilig twee keer kan draaien
- **Reverse migraties:** elk bestand `NNN_xxx.sql` heeft een `NNN_xxx_rollback.sql` als het niet idempotent is
- **Rollback-veilig:** omdat migraties additief zijn, kan de vorige codeversie altijd draaien op het nieuwe schema

### 3. Feature flags per tenant

De `tenants`-tabel krijgt een **`feature_flags JSONB`**-kolom naast de bestaande `enabled_modules`:

```sql
ALTER TABLE openzorg.tenants
  ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;

-- Voorbeeld:
UPDATE openzorg.tenants
SET feature_flags = '{"facturatie_v2": true, "nieuwe_rapportage_ui": false}'
WHERE slug = 'horizon';
```

- **`enabled_modules`** = welke grote modules een tenant heeft (ECD, Planning, Facturatie)
- **`feature_flags`** = granulaire aan/uit-switches voor nieuwe features binnen die modules

Backend-check:
```typescript
if (tenant.feature_flags?.facturatie_v2) {
  // nieuwe logica
} else {
  // bestaande logica
}
```

### 4. API versioning

Alle API routes behouden hun huidige pad als default (geen versie prefix = huidige versie). Bij breaking changes:

- Nieuwe versie onder `/api/v2/...`
- Oude versie blijft minimaal 2 releases beschikbaar
- Deprecation header (`Sunset`) op oude endpoints
- Non-breaking changes (nieuwe velden, nieuwe endpoints) gaan gewoon op het bestaande pad

### 5. Blue-green deployment via Docker tags

Docker images worden getagd met **git SHA** en semver:

```bash
# Bouwen met git SHA als tag
docker build -t openzorg/web:$(git rev-parse --short HEAD) .
docker build -t openzorg/service-ecd:$(git rev-parse --short HEAD) .

# Rollback = vorige tag in docker-compose en herstarten
docker compose -f infra/compose/docker-compose.yml pull
docker compose -f infra/compose/docker-compose.yml up -d
```

- **Altijd de vorige image bewaren** als rollback-optie
- Rollback = tag terugzetten in docker-compose en `docker compose pull && up -d`
- Database migraties worden **niet** teruggedraaid — daarom is het expand-contract patroon essentieel
- Geen complexe orchestratie nodig, past bij Docker Compose op Unraid

### 6. OTAP-straat

| Omgeving | Trigger | Doel |
|----------|---------|------|
| **O** (Ontwikkeling) | Lokaal — `docker compose up` | Ontwikkelen en unit tests |
| **T** (Test) | Staging branch → test server | Integratietests, migratie-check (later) |
| **A** (Acceptatie) | Release candidate tag → pre-prod | Validatie met geanonimiseerde productie-data (later) |
| **P** (Productie) | `main` branch → Unraid server | Live tenants |

**Pragmatische start (nu):** alleen **Development + Productie**. Test en Acceptatie voegen we toe zodra we meer dan 2 tenants hebben. De Docker Compose setup maakt het makkelijk om een tweede stack op dezelfde Unraid te draaien met andere poorten.

### 7. Database-migratie workflow

Migraties draaien **automatisch bij container-startup**:

```bash
# In de entrypoint van de service-container:
for f in /app/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

- Elke migratie is **idempotent** (`IF NOT EXISTS` overal) — als de container herstart, is dat geen probleem
- Volgorde gegarandeerd door nummering (001, 002, 003...)
- **Workflow:**
  1. Schrijf migratie lokaal, test op dev
  2. (Straks) Draai op staging met testdata
  3. Deploy naar productie — migratie draait automatisch bij startup
  4. Bij problemen: rollback naar vorige image (die de nieuwe kolommen negeert omdat alles additief is)

### 8. Canary releases via feature flags

Nieuwe features uitrollen in stappen:

1. **Feature bouwen** achter een feature flag (standaard `false`)
2. **Deploy naar productie** — niemand ziet de feature nog
3. **Aanzetten voor 1 tenant** (bijv. onze eigen test-organisatie)
4. **Monitoren** — audit_log, errors, gebruikersfeedback
5. **Aanzetten voor alle tenants** of per tenant uitrollen
6. **Feature flag opruimen** in een volgende release als de feature stabiel is

Dit geeft ons canary-release functionaliteit zonder infrastructuurcomplexiteit.

## Consequenties

### Positief
- **Geen breaking changes mogelijk** — FHIR is additief, SQL-migraties zijn additief, features zitten achter flags
- **Snelle rollback** — vorige Docker-image is altijd beschikbaar, migraties zijn backwards-compatible
- **Geleidelijke uitrol** — feature flags geven controle per tenant zonder aparte deployments
- **Simpel genoeg voor 2 man** — geen Kubernetes, geen complexe CI/CD pipelines, gewoon Docker tags en SQL-bestanden
- **Schaalbaar** — dezelfde aanpak werkt als we later naar K8s migreren (ADR-002)

### Negatief
- **Dode kolommen** — door nooit te DROPpen groeien tabellen in breedte. Periodiek opruimen is nodig.
- **Feature flag discipline** — flags die nooit opgeruimd worden zorgen voor spaghetti-code. Regel: flag verwijderen binnen 2 sprints na volledige uitrol.
- **Geen echte blue-green** — met Docker Compose is er kort downtime bij herstart. Acceptabel voor nu, later oplossen met K8s rolling updates.
- **Acceptatie-omgeving met productiedata** vereist een anonimiseringsscript voor BSN en persoonsgegevens. Dit moet gebouwd worden voordat we die omgeving opzetten.

## Acties

- [ ] Migratie schrijven: `feature_flags JSONB` kolom toevoegen aan `tenants`-tabel
- [ ] Migratie-runner toevoegen aan Docker entrypoint
- [ ] Map `infra/postgres/migrations/` aanmaken met initieel migratiebestand
- [ ] Feature flag helper-functie toevoegen aan shared-domain
