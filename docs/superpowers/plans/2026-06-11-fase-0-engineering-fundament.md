# Fase 0 — Engineering-fundament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Main bijgewerkt en beschermd met verplichte CI, een portable productie-deploy zonder hardcoded credentials, geteste backup/restore, en een release-proces met versie-tags en GHCR-images.

**Architecture:** Bestaande GitHub Actions CI (`.github/workflows/ci.yml` — lint/typecheck/forbidden-words/test/build/e2e) wordt geactiveerd door de 175-commit branch `plan-2a-execute` via PR naar `main` te brengen en branch-protectie aan te zetten. Daarnaast komt er een aparte productie-compose (`infra/compose/docker-compose.prod.yml`) die GHCR-images draait i.p.v. lokaal te bouwen, met verplichte secrets via env. Een release-workflow bouwt en pusht images bij elke `v*`-tag.

**Tech Stack:** pnpm 9.15.0 monorepo (turbo), GitHub Actions, Docker Compose v2, GitHub Container Registry (GHCR), PostgreSQL 16, Medplum.

**Repo-feiten (verifieer bij twijfel):**
- Repo: `github.com/vierkant14/openzorg`, default branch `main`, werk-branch `plan-2a-execute` (175 commits voor)
- `pnpm check-all` = lint + typecheck + forbidden-words + test + build
- CI-jobnamen in ci.yml: `Lint & Typecheck`, `Forbidden Words Check`, `Test`, `Build`, `E2E (Playwright)`
- `gh` CLI is NIET geïnstalleerd op deze machine
- Geen `LICENSE`-bestand; `package.json` zegt `Apache-2.0`, docs/ADR-006 zeggen EUPL 1.2
- Dev-compose (`infra/compose/docker-compose.yml`) heeft hardcoded dev-wachtwoorden — dat is OK voor dev, prod-compose mag GEEN defaults hebben
- Browser praat nooit rechtstreeks met Medplum; web leest `MEDPLUM_BASE_URL` runtime (`apps/web/src/app/api/auth/login/route.ts:24`) → images zijn omgeving-onafhankelijk
- Shell: Windows/PowerShell voor git/gh; Bash tool voor .sh-scripts en docker-tests

---

### Task 1: `pnpm check-all` groen op `plan-2a-execute`

**Files:**
- Modify: alleen wat nodig is om checks groen te krijgen (onbekend tot run)

- [ ] **Step 1: Dependencies installeren**

Run: `pnpm install`
Expected: exit 0, lockfile ongewijzigd (`git status` toont geen `pnpm-lock.yaml`-wijziging).

- [ ] **Step 2: check-all draaien**

Run: `pnpm check-all` (timeout ruim zetten, 10 min)
Expected: alle vijf stappen groen. Zo ja → Step 4.

- [ ] **Step 3 (alleen bij failures): per categorie fixen en hercontroleren**

Werkwijze per failure-categorie, in deze volgorde (snelste feedback eerst):
1. `pnpm lint` — fix met `pnpm lint:fix` waar mogelijk; rest handmatig. Geen `eslint-disable` toevoegen zonder reden-comment.
2. `pnpm typecheck` — types fixen, nooit `any` (verboden door lint), nooit `@ts-ignore`.
3. `pnpm forbidden-words` — gevonden term vervangen door neutrale term ("extern ECD" i.p.v. concurrent-naam).
4. `pnpm test` — falende test eerst lezen: is de test fout of de code? Bij twijfel: `superpowers:systematic-debugging`. Tests niet skippen of verwijderen om groen te krijgen.
5. `pnpm build` — meestal gevolg van 1-4.

Na elke categorie-fix: betreffende check opnieuw draaien. Commit per categorie:
```powershell
git add -A :!.claude
git commit -m "fix(ci): <categorie> groen voor merge naar main"
```

- [ ] **Step 4: Volledige check-all nogmaals als bewijs**

Run: `pnpm check-all`
Expected: exit 0, alle stappen groen. Output bewaren voor PR-beschrijving.

---

### Task 2: EUPL-1.2 licentie rechtzetten

**Files:**
- Create: `LICENSE`
- Modify: `package.json` (regel 6: `"license": "Apache-2.0"`)

- [ ] **Step 1: LICENSE-bestand ophalen (officiële EUPL-1.2 tekst)**

Run (Bash tool):
```bash
curl -fsSL https://raw.githubusercontent.com/spdx/license-list-data/main/text/EUPL-1.2.txt -o LICENSE
head -5 LICENSE
```
Expected: eerste regels bevatten "EUROPEAN UNION PUBLIC LICENCE v. 1.2". Faalt de URL: alternatief `https://joinup.ec.europa.eu/sites/default/files/custom-page/attachment/2020-03/EUPL-1.2%20EN.txt`.

- [ ] **Step 2: package.json licentieveld fixen**

In `package.json`:
```json
"license": "EUPL-1.2",
```
(vervangt `"license": "Apache-2.0",`)

- [ ] **Step 3: Controleren dat geen ander manifest Apache claimt**

Run: Grep op `"license"` in `**/package.json` (exclusief node_modules).
Expected: alle workspace-packages ofwel geen license-veld ofwel `EUPL-1.2`. Afwijkingen gelijk fixen.

- [ ] **Step 4: Commit**

```powershell
git add LICENSE package.json
git commit -m "chore: EUPL-1.2 licentie toegevoegd (was foutief Apache-2.0 in package.json)"
```

---

### Task 3: PR naar main, CI groen, merge

**Files:**
- Geen nieuwe bestanden; alleen fixes als CI faalt

- [ ] **Step 1: gh CLI installeren**

Run (PowerShell): `winget install --id GitHub.cli --accept-source-agreements --accept-package-agreements`
Expected: geïnstalleerd. Daarna nieuwe shell nodig; verifieer met `gh --version`. Werkt winget niet: vraag gebruiker het te installeren of gebruik de GitHub web-UI voor PR-stappen.

- [ ] **Step 2: gh authenticeren (gebruikersactie)**

Vraag de gebruiker in de chat: typ `! gh auth login --web` en doorloop de browser-flow.
Verifieer daarna: `gh auth status` → "Logged in to github.com".

- [ ] **Step 3: Branch pushen en PR aanmaken**

```powershell
git push origin plan-2a-execute
gh pr create --base main --head plan-2a-execute --title "Plan 2A: ECD-volwassenheid, planning, AI, admin (175 commits)" --body @'
Brengt 6 weken werk naar main: role-split (5 rollen), AI-chat/Ollama, rooster + CAO-engine, facturatie-basis, DMN, cross-client overzichten, MIC, audit-viewer, sneltoetsen.

Vanaf deze merge geldt trunk-based: korte feature-branches, geen lang-levende zijtakken meer.

check-all lokaal groen (zie Task 1).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
'@
```
Expected: PR-URL in output.

- [ ] **Step 4: CI volgen en groen krijgen**

Run: `gh pr checks --watch` (of poll `gh pr checks` elke paar minuten)
Expected: `Lint & Typecheck`, `Forbidden Words Check`, `Test`, `Build` groen. `E2E (Playwright)` mag falen zonder de merge te blokkeren (zware job, wordt in Step 5 beoordeeld) — maar probeer hem eerst écht te fixen als de fout in onze code zit (lees het Playwright-report-artifact). Fixes als extra commits op `plan-2a-execute` pushen; CI herstart automatisch.

- [ ] **Step 5: E2E-status beoordelen**

Als E2E groen: niets doen. Als E2E rood door infra-flakiness (timeout Medplum-start, Docker-resources op de runner) en niet door onze code: noteer de oorzaak in een issue (`gh issue create --title "E2E-job flaky op GitHub-runner" --body "<oorzaak + log-link>"`) en ga door — E2E wordt bewust géén verplichte check in Task 4.

- [ ] **Step 6: Mergen (merge-commit, geen squash — 175 commits historie behouden)**

```powershell
gh pr merge --merge
git checkout main
git pull origin main
```
Expected: main bevat de merge; `git log -1` toont de merge-commit.

---

### Task 4: Branch-protectie op main

**Files:**
- Create (tijdelijk): `protection.json` (niet committen)

- [ ] **Step 1: Protectie-payload schrijven**

`protection.json` in repo-root (staat in .gitignore-zin: na gebruik verwijderen):
```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint & Typecheck", "Forbidden Words Check", "Test", "Build"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```
Rationale: verplichte CI-checks, maar geen verplichte review (solo-ontwikkelaar) en `enforce_admins: false` zodat Kevin in noodgevallen kan ingrijpen. E2E bewust niet verplicht (zie Task 3 Step 5).

- [ ] **Step 2: Toepassen via gh api**

```powershell
gh api -X PUT repos/vierkant14/openzorg/branches/main/protection -H "Accept: application/vnd.github+json" --input protection.json
Remove-Item protection.json
```
Expected: JSON-response met `"strict": true` en de vier contexts.

- [ ] **Step 3: Verifiëren**

Run: `gh api repos/vierkant14/openzorg/branches/main/protection --jq ".required_status_checks.contexts"`
Expected: `["Lint & Typecheck","Forbidden Words Check","Test","Build"]`

---

### Task 5: Portable productie-deploy (compose.prod + env-template)

Vanaf hier trunk-based werken:
```powershell
git checkout -b feat/prod-deploy main
```

**Files:**
- Create: `infra/compose/docker-compose.prod.yml`
- Create: `infra/compose/.env.prod.example`

- [ ] **Step 1: docker-compose.prod.yml schrijven**

Volledige inhoud `infra/compose/docker-compose.prod.yml`:
```yaml
# Productie-deploy: draait gepubliceerde GHCR-images, bouwt niets lokaal.
# Gebruik: docker compose -f infra/compose/docker-compose.prod.yml --env-file .env.prod up -d
# Alle secrets zijn VERPLICHT via env — er zijn bewust geen defaults.
# Web en Medplum binden op 127.0.0.1: een reverse proxy (TLS) zit ervoor.

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: openzorg
      POSTGRES_USER: openzorg
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is verplicht}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../postgres/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openzorg"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  medplum:
    image: medplum/medplum-server:latest
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "127.0.0.1:8103:8103"
    environment:
      NODE_ENV: production
      MEDPLUM_PORT: 8103
      MEDPLUM_BASE_URL: ${MEDPLUM_PUBLIC_URL:?MEDPLUM_PUBLIC_URL is verplicht (bijv. https://fhir.voorbeeld.nl/)}
      MEDPLUM_DATABASE_HOST: postgres
      MEDPLUM_DATABASE_PORT: 5432
      MEDPLUM_DATABASE_DBNAME: medplum
      MEDPLUM_DATABASE_USERNAME: openzorg
      MEDPLUM_DATABASE_PASSWORD: ${POSTGRES_PASSWORD:?}
      MEDPLUM_REDIS_HOST: redis
      MEDPLUM_REDIS_PORT: 6379
      MEDPLUM_SUPER_ADMIN_EMAIL: ${MEDPLUM_ADMIN_EMAIL:?MEDPLUM_ADMIN_EMAIL is verplicht}
      MEDPLUM_SUPER_ADMIN_PASSWORD: ${MEDPLUM_ADMIN_PASSWORD:?MEDPLUM_ADMIN_PASSWORD is verplicht}
    volumes:
      - medplum_data:/var/lib/medplum
      - ../medplum/medplum.config.json:/usr/src/medplum/medplum.config.json
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8103/healthcheck').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 10s
      retries: 120
      start_period: 600s

  flowable:
    image: flowable/flowable-rest:7.1.0
    restart: always
    environment:
      - spring.datasource.driver-class-name=org.postgresql.Driver
      - spring.datasource.url=jdbc:postgresql://postgres:5432/openzorg
      - spring.datasource.username=openzorg
      - spring.datasource.password=${POSTGRES_PASSWORD:?}
      - flowable.rest.app.admin.user-id=${FLOWABLE_ADMIN_USER:?FLOWABLE_ADMIN_USER is verplicht}
      - flowable.rest.app.admin.password=${FLOWABLE_ADMIN_PASSWORD:?FLOWABLE_ADMIN_PASSWORD is verplicht}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8080/flowable-rest/actuator/health || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 15
      start_period: 60s

  ecd:
    image: ghcr.io/vierkant14/openzorg-ecd:${OPENZORG_VERSION:?OPENZORG_VERSION is verplicht (bijv. 0.2.0)}
    restart: always
    depends_on:
      medplum:
        condition: service_healthy
      postgres:
        condition: service_healthy
    environment:
      ECD_PORT: 4001
      MEDPLUM_BASE_URL: http://medplum:8103
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: openzorg
      POSTGRES_USER: openzorg
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}
      MASTER_ADMIN_KEY: ${MASTER_ADMIN_KEY:?MASTER_ADMIN_KEY is verplicht}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:4001/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  planning:
    image: ghcr.io/vierkant14/openzorg-planning:${OPENZORG_VERSION:?}
    restart: always
    depends_on:
      medplum:
        condition: service_healthy
    environment:
      PLANNING_PORT: 4002
      MEDPLUM_BASE_URL: http://medplum:8103
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:4002/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  workflow-bridge:
    image: ghcr.io/vierkant14/openzorg-workflow-bridge:${OPENZORG_VERSION:?}
    restart: always
    depends_on:
      medplum:
        condition: service_healthy
      flowable:
        condition: service_healthy
    environment:
      WORKFLOW_PORT: 4003
      MEDPLUM_BASE_URL: http://medplum:8103
      FLOWABLE_BASE_URL: http://flowable:8080/flowable-rest
      FLOWABLE_ADMIN_USER: ${FLOWABLE_ADMIN_USER:?}
      FLOWABLE_ADMIN_PASSWORD: ${FLOWABLE_ADMIN_PASSWORD:?}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: openzorg
      POSTGRES_USER: openzorg
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:4003/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  facturatie:
    image: ghcr.io/vierkant14/openzorg-facturatie:${OPENZORG_VERSION:?}
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      FACTURATIE_PORT: 4004
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: openzorg
      POSTGRES_USER: openzorg
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:4004/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    image: ghcr.io/vierkant14/openzorg-web:${OPENZORG_VERSION:?}
    restart: always
    depends_on:
      medplum:
        condition: service_healthy
      ecd:
        condition: service_healthy
      workflow-bridge:
        condition: service_healthy
      facturatie:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      MEDPLUM_BASE_URL: http://medplum:8103
      ECD_SERVICE_URL: http://ecd:4001
      PLANNING_SERVICE_URL: http://planning:4002
      WORKFLOW_SERVICE_URL: http://workflow-bridge:4003
      FACTURATIE_SERVICE_URL: http://facturatie:4004
      MASTER_ADMIN_KEY: ${MASTER_ADMIN_KEY:?}
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 10s
      retries: 5

volumes:
  postgres_data:
  medplum_data:
```

Let op de bewuste verschillen met dev-compose: geen `build:`, geen `seed`/`seed-codelijsten`-services, geen gepubliceerde poorten voor postgres/redis/flowable, `restart: always`, alle secrets `:?`-verplicht. Resource-limits (uit de spec) worden bewust uitgesteld tot de hosting-keuze: zinvolle limieten hangen af van de host-specificaties, en op een single-host-deploy zonder buren is het risico beperkt. Flowable-admin-credentials zijn nu ook in workflow-bridge als env doorgegeven — controleer in `services/workflow-bridge/src` hoe de Flowable-auth nu heet (zoek op `YWRtaW46YWRtaW4=` of `admin`); als de code hardcoded `admin:admin` gebruikt, voeg env-var-support toe (`FLOWABLE_ADMIN_USER`/`FLOWABLE_ADMIN_PASSWORD` met dev-default `admin`/`admin`) en dek dit met een unit-test op de auth-header-opbouw.

- [ ] **Step 2: .env.prod.example schrijven**

Volledige inhoud `infra/compose/.env.prod.example`:
```bash
# Kopieer naar .env.prod en vul in. .env.prod NOOIT committen.
# Genereer secrets met: openssl rand -base64 24

# Versie van de uit te rollen images (GHCR-tag, zonder 'v')
OPENZORG_VERSION=0.2.0

# PostgreSQL (zelfde wachtwoord gebruikt door alle services)
POSTGRES_PASSWORD=

# Medplum super-admin (eerste login)
MEDPLUM_ADMIN_EMAIL=
MEDPLUM_ADMIN_PASSWORD=

# Publieke URL waarop Medplum bereikbaar is (achter reverse proxy, met trailing slash)
MEDPLUM_PUBLIC_URL=

# Master-admin API-key voor /api/master/* routes
MASTER_ADMIN_KEY=

# Flowable REST admin
FLOWABLE_ADMIN_USER=
FLOWABLE_ADMIN_PASSWORD=
```

- [ ] **Step 3: .gitignore aanvullen**

Controleer dat `.env.prod` genegeerd wordt; zo niet, voeg toe aan `.gitignore`:
```
.env.prod
backups/
```

- [ ] **Step 4: Compose-bestand valideren**

Run (Bash tool):
```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
cp infra/compose/.env.prod.example /tmp/envtest && \
sed -i 's/^OPENZORG_VERSION=.*/OPENZORG_VERSION=0.2.0/; s/^\([A-Z_]*\)=$/\1=validatietest/' /tmp/envtest && \
docker compose -f infra/compose/docker-compose.prod.yml --env-file /tmp/envtest config --quiet && echo "COMPOSE OK"
```
Expected: `COMPOSE OK`. Daarna negatieve test — zonder env-file moet hij weigeren:
```bash
docker compose -f infra/compose/docker-compose.prod.yml config --quiet 2>&1 | head -3
```
Expected: foutmelding `POSTGRES_PASSWORD is verplicht` (of eerste ontbrekende var).

- [ ] **Step 5: Commit**

```powershell
git add infra/compose/docker-compose.prod.yml infra/compose/.env.prod.example .gitignore
git commit -m "feat(infra): portable productie-compose met verplichte secrets (geen dev-defaults)"
```

---

### Task 6: Backup/restore-scripts met geteste restore

**Files:**
- Create: `infra/scripts/backup.sh`
- Create: `infra/scripts/restore.sh`

- [ ] **Step 1: backup.sh schrijven**

Volledige inhoud `infra/scripts/backup.sh`:
```bash
#!/usr/bin/env bash
# Backup van alle OpenZorg-data: PostgreSQL-databases + Medplum binary-storage.
# Gebruik: COMPOSE_FILE=infra/compose/docker-compose.prod.yml ./infra/scripts/backup.sh
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/compose/docker-compose.prod.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"
mkdir -p "$DEST"

# Alleen databases dumpen die echt bestaan (medplum ontbreekt op een kale dev-stack)
DBS="$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U openzorg -d openzorg -tAc \
  "SELECT datname FROM pg_database WHERE datname IN ('openzorg','medplum')")"

for DB in $DBS; do
  echo "Backup database: $DB"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U openzorg --format=custom "$DB" > "$DEST/$DB.dump"
done

MEDPLUM_ID="$(docker compose -f "$COMPOSE_FILE" ps -q medplum 2>/dev/null || true)"
if [ -n "$MEDPLUM_ID" ]; then
  echo "Backup Medplum binary-storage volume"
  docker run --rm --volumes-from "$MEDPLUM_ID" \
    -v "$(cd "$DEST" && pwd):/backup" alpine \
    tar czf /backup/medplum_data.tar.gz -C /var/lib/medplum .
else
  echo "Medplum-container draait niet — binary-storage overgeslagen"
fi

echo "Backup klaar: $DEST"
ls -lh "$DEST"
```

- [ ] **Step 2: restore.sh schrijven**

Volledige inhoud `infra/scripts/restore.sh`:
```bash
#!/usr/bin/env bash
# Restore van een backup gemaakt met backup.sh.
# Gebruik: COMPOSE_FILE=... ./infra/scripts/restore.sh ./backups/20260611-120000
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Gebruik: $0 <backup-map>  (bijv. ./backups/20260611-120000)" >&2
  exit 1
fi
SRC="$1"
COMPOSE_FILE="${COMPOSE_FILE:-infra/compose/docker-compose.prod.yml}"

[ -d "$SRC" ] || { echo "Backup-map niet gevonden: $SRC" >&2; exit 1; }

for DUMP in "$SRC"/*.dump; do
  [ -e "$DUMP" ] || { echo "Geen .dump-bestanden in $SRC" >&2; exit 1; }
  DB="$(basename "$DUMP" .dump)"
  echo "Restore database: $DB"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_restore -U openzorg --clean --if-exists -d "$DB" < "$DUMP"
done

if [ -f "$SRC/medplum_data.tar.gz" ]; then
  MEDPLUM_ID="$(docker compose -f "$COMPOSE_FILE" ps -q medplum 2>/dev/null || true)"
  if [ -n "$MEDPLUM_ID" ]; then
    echo "Restore Medplum binary-storage"
    docker run --rm --volumes-from "$MEDPLUM_ID" \
      -v "$(cd "$SRC" && pwd):/backup" alpine \
      sh -c "rm -rf /var/lib/medplum/* && tar xzf /backup/medplum_data.tar.gz -C /var/lib/medplum"
  else
    echo "Medplum-container draait niet — binary-storage niet hersteld" >&2
  fi
fi

echo "Restore klaar. Herstart services: docker compose -f $COMPOSE_FILE restart"
```

- [ ] **Step 3: Restore-test uitvoeren tegen de dev-stack (DE backup-test)**

Run (Bash tool, vanaf repo-root):
```bash
F=infra/compose/docker-compose.yml
docker compose -f $F up -d postgres
docker compose -f $F exec -T postgres psql -U openzorg -d openzorg -c \
  "CREATE TABLE IF NOT EXISTS backup_smoke (id int); DELETE FROM backup_smoke; INSERT INTO backup_smoke VALUES (42);"
COMPOSE_FILE=$F bash infra/scripts/backup.sh
docker compose -f $F exec -T postgres psql -U openzorg -d openzorg -c "DROP TABLE backup_smoke;"
LAST=$(ls -1d backups/* | tail -1)
COMPOSE_FILE=$F bash infra/scripts/restore.sh "$LAST"
docker compose -f $F exec -T postgres psql -U openzorg -d openzorg -tAc "SELECT id FROM backup_smoke;"
```
Expected: laatste commando print `42`. Dat is de geteste restore. Ruim daarna op:
```bash
docker compose -f $F exec -T postgres psql -U openzorg -d openzorg -c "DROP TABLE backup_smoke;"
rm -rf "$LAST"
```

- [ ] **Step 4: Commit + PR + merge**

```powershell
git add infra/scripts/backup.sh infra/scripts/restore.sh
git commit -m "feat(infra): backup/restore-scripts voor postgres + medplum-storage (restore getest)"
git push origin feat/prod-deploy
gh pr create --base main --title "feat(infra): productie-compose + backup/restore" --body "Portable prod-deploy (GHCR-images, verplichte secrets) en geteste backup/restore. Onderdeel Fase 0."
gh pr checks --watch
gh pr merge --merge
git checkout main; git pull origin main
```
Expected: CI groen, gemerged.

---

### Task 7: Release-proces (tags, CHANGELOG, GHCR)

```powershell
git checkout -b feat/release-proces main
```

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `CHANGELOG.md`

- [ ] **Step 1: release.yml schrijven**

Volledige inhoud `.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: read
  packages: write

jobs:
  build-services:
    name: Build ${{ matrix.service }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [ecd, planning, workflow-bridge, facturatie]
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}-${{ matrix.service }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - uses: docker/build-push-action@v6
        with:
          context: .
          file: infra/docker/Dockerfile.service
          build-args: |
            SERVICE_NAME=${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}

  build-web:
    name: Build web
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}-web
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - uses: docker/build-push-action@v6
        with:
          context: .
          file: infra/docker/Dockerfile.web
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=web
          cache-to: type=gha,mode=max,scope=web
```
Let op: `ghcr.io/${{ github.repository }}-ecd` resolved naar `ghcr.io/vierkant14/openzorg-ecd` — exact wat docker-compose.prod.yml verwacht.

- [ ] **Step 2: CHANGELOG.md schrijven**

Volledige inhoud `CHANGELOG.md`:
```markdown
# Changelog

Alle noemenswaardige wijzigingen aan OpenZorg worden hier bijgehouden.
Formaat: [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/); versies volgen [SemVer](https://semver.org/lang/nl/).

## [Unreleased]

## [0.2.0] - 2026-06-11

Eerste getagde release. Bevat de volledige plan-2A-reeks:

### Toegevoegd
- ECD-module: cliëntdossier, zorgplannen (SMART-doelen, evaluaties, handtekeningen), rapportages (SOEP/vrij), medicatie, allergieën, vaccinaties, diagnoses, risicoscreenings, wilsverklaringen, VBM, MDO, MIC-meldingen, documenten
- Vijf-rollen RBAC (tenant-admin, beheerder, zorgmedewerker, planner, teamleider) met route-permissiematrix
- Planning: dienst-configuratie, bezettingsprofielen, planning-engine (valideer/optimaliseer/genereer), rooster drag-and-drop, CAO/ATW-regels, herhalingen, wachtlijst
- Facturatie-basis: prestaties, declaraties, NZa 2026-productcatalogus
- Workflow: Flowable BPMN-integratie, werkbak, DMN-editor, intake-template
- AI: lokale Ollama-integratie, contextbewuste chat-assistent, rapportage-samenvattingen, per-tenant AI-configuratie
- Beheer: codelijsten, validatieregels (drielagen), feature flags, vragenlijsten, state-machines, audit-viewer (NEN 7513)
- Multi-tenant: Medplum Projects + PostgreSQL RLS, master-admin-laag
- Productie-deploy: `docker-compose.prod.yml` (GHCR-images, verplichte secrets), backup/restore-scripts
- CI: lint, typecheck, tests, forbidden-words, build, E2E (Playwright)

### Gewijzigd
- Licentie gecorrigeerd naar EUPL-1.2 (package.json claimde foutief Apache-2.0)
```

- [ ] **Step 3: Commit, PR, merge**

```powershell
git add .github/workflows/release.yml CHANGELOG.md
git commit -m "feat(release): GHCR release-workflow op v*-tags + CHANGELOG"
git push origin feat/release-proces
gh pr create --base main --title "feat(release): release-workflow + CHANGELOG" --body "Images naar GHCR bij elke v*-tag. Onderdeel Fase 0."
gh pr checks --watch
gh pr merge --merge
git checkout main; git pull origin main
```

- [ ] **Step 4: Eerste release taggen**

```powershell
git tag v0.2.0
git push origin v0.2.0
gh run watch
```
Expected: Release-workflow groen; 5 images zichtbaar via `gh api "users/vierkant14/packages?package_type=container" --jq ".[].name"` → bevat `openzorg-ecd`, `openzorg-planning`, `openzorg-workflow-bridge`, `openzorg-facturatie`, `openzorg-web`.

- [ ] **Step 5: GHCR-images publiek of compose-login documenteren**

GHCR-packages zijn standaard privé. Voor open-source: maak ze publiek via `gh api -X PATCH "user/packages/container/openzorg-ecd" -f visibility=public` per package, óf documenteer `docker login ghcr.io` in het runbook (Task 8). Kies publiek (het is een open-source project) tenzij gebruiker anders aangeeft.

---

### Task 8: Runbook + CLAUDE.md bijwerken

```powershell
git checkout -b docs/deploy-runbook main
```

**Files:**
- Create: `docs/deployment-production.md`
- Modify: `CLAUDE.md` (sectie "Deployment")

- [ ] **Step 1: Runbook schrijven**

Volledige inhoud `docs/deployment-production.md`:
```markdown
# Productie-deployment runbook

## Vereisten
- Docker Engine + Compose v2 op de host
- Reverse proxy met TLS (Caddy/Traefik/nginx) → web op 127.0.0.1:3000, Medplum op 127.0.0.1:8103
- Een `.env.prod` op basis van `infra/compose/.env.prod.example` (secrets via `openssl rand -base64 24`)

## Eerste deploy
1. `git clone https://github.com/vierkant14/openzorg && cd openzorg && git checkout v<versie>`
2. `cp infra/compose/.env.prod.example .env.prod` en alle velden invullen
3. `docker compose -f infra/compose/docker-compose.prod.yml --env-file .env.prod up -d`
4. Wacht tot `docker compose -f infra/compose/docker-compose.prod.yml ps` alle services healthy toont (Medplum-migratie kan 10 min duren)
5. Maak tenants + gebruikers aan via de master-admin-flow (géén seed-scripts in productie — die bevatten testdata en publieke wachtwoorden)

## Upgrade naar nieuwe versie
1. `git fetch --tags && git checkout v<nieuw>`
2. Pas `OPENZORG_VERSION` aan in `.env.prod`
3. Maak eerst een backup (zie onder)
4. `docker compose -f infra/compose/docker-compose.prod.yml --env-file .env.prod up -d`

## Backup
- `COMPOSE_FILE=infra/compose/docker-compose.prod.yml ./infra/scripts/backup.sh`
- Output in `./backups/<timestamp>/`: pg-dumps (openzorg + medplum) + medplum_data.tar.gz
- Plan dit als cron (dagelijks) en kopieer off-host (rsync/restic naar tweede locatie)

## Restore
- `COMPOSE_FILE=infra/compose/docker-compose.prod.yml ./infra/scripts/restore.sh ./backups/<timestamp>`
- Herstart daarna: `docker compose -f infra/compose/docker-compose.prod.yml restart`
- **Test de restore elk kwartaal** op een schone omgeving — een ongeteste backup is geen backup

## Secrets-beheer
- `.env.prod` staat in .gitignore en verlaat de host nooit
- Wachtwoordrotatie: nieuw secret in `.env.prod`, daarna `up -d` (services herstarten met nieuwe waarde); voor POSTGRES_PASSWORD ook `ALTER USER openzorg WITH PASSWORD ...` in postgres

## Wat dit bewust nog niet is
- Geen Kubernetes/HA — één host volstaat tot de eerste pilot schaal vraagt
- Geen monitoring-stack — komt in een latere fase (gap-analyse R-06 operational readiness)
```

- [ ] **Step 2: CLAUDE.md Deployment-sectie aanvullen**

Voeg onder `## Deployment` (na de Unraid-subsectie) toe:
```markdown
### Productie (portable, GHCR-images)

```
docker compose -f infra/compose/docker-compose.prod.yml --env-file .env.prod up -d
```

Zie `docs/deployment-production.md` voor het volledige runbook (secrets, backup/restore, upgrades). Releases via git-tag `v*` → GitHub Actions bouwt images naar `ghcr.io/vierkant14/openzorg-*`. Test-accounts en seed-scripts zijn **dev-only** en horen nooit in productie.
```

- [ ] **Step 3: Commit, PR, merge**

```powershell
git add docs/deployment-production.md CLAUDE.md
git commit -m "docs: productie-runbook + deployment-sectie CLAUDE.md"
git push origin docs/deploy-runbook
gh pr create --base main --title "docs: productie-runbook" --body "Runbook voor portable prod-deploy. Sluit Fase 0 af."
gh pr checks --watch
gh pr merge --merge
git checkout main; git pull origin main
```

---

## Definition of done Fase 0

- [ ] `main` bevat alle plan-2a-execute-werk; `git log main..plan-2a-execute` is leeg
- [ ] Branch-protectie actief: PR + 4 groene checks verplicht voor main
- [ ] `docker compose -f infra/compose/docker-compose.prod.yml config` slaagt mét env-file en faalt zónder
- [ ] Restore-test heeft aantoonbaar `42` teruggegeven (Task 6 Step 3)
- [ ] Tag `v0.2.0` bestaat; 5 images staan in GHCR
- [ ] `docs/deployment-production.md` bestaat; CLAUDE.md verwijst ernaar
```
