# W4 — Live platform: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) of superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax voor tracking.

**Goal:** De productie-stack publiek live (Unraid + Cloudflare Tunnel), met release v0.3.0 als deploy-eenheid, draaiende backup-cron en een geteste restore.

**Architecture:** Release-tag → GHCR-images → prod-compose op Unraid → tunnel-hostname → live smoke-test. Alles wat kan wordt vooraf voorbereid zodat de feitelijke uitrol één sessie is zodra de server bereikbaar is (die was 2026-07-10 onbereikbaar — SSH-timeout; herprobeer bij elke werkstroom-grens: `ssh -o ConnectTimeout=8 root@192.168.1.10 "echo ok"`).

**Tech Stack:** GitHub Actions release-workflow (bestaand, triggert op `v*`), `infra/compose/docker-compose.prod.yml`, `infra/scripts/backup.sh`/`restore.sh`, Cloudflare Tunnel (config staat op de Unraid-server), runbook `docs/deployment-production.md`.

## Global Constraints

Identiek aan W1-plan, plus: **géén seed-scripts in productie** (runbook-regel); secrets alleen op de server (`.env.prod`, nooit in repo); Unraid nooit met `--no-cache` bouwen (daemon-crash — memory-regel); prod draait GHCR-images, niet lokaal gebouwde.

---

### Task 1: Release v0.3.0 voorbereiden (kan vóór Unraid bereikbaar is)

**Files:** `CHANGELOG.md` (nieuw of bijwerken — check of Fase 0 er een maakte), versie-bump waar het release-proces dat verwacht (check `.github/workflows/release.yml` voor wat de tag triggert en of package.json-versies meegaan).

- [ ] **Step 1:** CHANGELOG-sectie 0.3.0: W0-W3-hoogtepunten (planning-normalisatie, procesmanagement-revamp met tenant-isolatie fail-closed + identiteitslaag, werkbak/Processen-hub, dashboard, CSV-import, pilotprofiel). Eerlijk: breaking = login-flow (serverrollen), Flowable-instanties van vóór v0.3.0 zijn niet zichtbaar (per-tenant-model).
- [ ] **Step 2:** `git tag v0.3.0 && git push origin v0.3.0` → release-workflow bouwt 5 images naar GHCR. Verifieer: `gh run watch` op de release-run; daarna `gh api /orgs/... ` niet nodig — images-check kan via `docker manifest inspect ghcr.io/vierkant14/openzorg-web:0.3.0` op een host mét docker (Unraid) of via de GitHub-UI (packages).
- [ ] **Step 3:** Let op: GHCR-packages moeten publiek staan óf de server moet ingelogd zijn op ghcr (Kevins restpunt uit Fase 0 — token mist packages-scope). Als pull op Unraid faalt met 401: `docker login ghcr.io` op de server met een PAT van Kevin (open punt voor Kevin) óf tijdelijk de compose op `build:`-varianten draaien (unraid-compose) tot dat geregeld is — documenteer welke van de twee het werd.

### Task 2: Deploy-workflow opschonen

**Files:** `.github/workflows/deploy.yml`

- [ ] **Step 1:** De deploy-job verwijst naar `/opt/openzorg` en een `DEPLOY_ENABLED`-vlag die uit staat — schijn-automation. Vervang de deploy-job door een `workflow_dispatch`-only job die niets doet behalve een echo met verwijzing naar het runbook, of verwijder de job en laat alleen de test-job op main staan (aanbevolen: verwijderen; CI.yml dekt main al — dan hernoemt de workflow naar "Main extra checks" of vervalt geheel). Kies: **verwijder `deploy.yml`** en documenteer in `docs/deployment-production.md` dat deploy tag-gedreven en handmatig-op-server is. (Open punt 4 in de spec — als Kevin auto-deploy naar staging wil, komt dat later terug.)
- [ ] **Step 2:** Commit: `chore(ci): verwijder schijn-deploy-workflow — deploy is release-tag-gedreven`

### Task 3: Uitrol op Unraid (vereist bereikbare server)

Volg `docs/deployment-production.md` exact; dit task-blok is de invulling met deze omgeving:

- [ ] **Step 1:** `ssh root@192.168.1.10` → `cd /mnt/user/appdata && git clone https://github.com/vierkant14/openzorg openzorg-prod || (cd openzorg-prod && git fetch --tags)` → `cd openzorg-prod && git checkout v0.3.0`. (Bewust een **aparte map** naast de bestaande staging-checkout `/mnt/user/appdata/openzorg`, zodat staging blijft bestaan.)
- [ ] **Step 2:** `.env.prod` opstellen uit `.env.prod.example` (secrets via `openssl rand -base64 24`; `OPENZORG_VERSION=0.3.0`; `MEDPLUM_PUBLIC_URL` = de publieke tunnel-URL van stap 4). **Poort-botsing checken**: prod-compose bindt vermoedelijk 3000/8103 — de staging-stack gebruikt 1xxxx-range; controleer `docker ps` en pas zo nodig de prod-compose-poortmapping aan via env of override-file naar bv. 23000/28103 (documenteren in runbook).
- [ ] **Step 3:** `docker compose -f infra/compose/docker-compose.prod.yml --env-file .env.prod up -d` → wachten tot healthy (`… ps`; Medplum-migratie kan 10 min duren).
- [ ] **Step 4:** Cloudflare Tunnel: bestaande tunnel-config op de server bekijken (`docker ps | grep cloudflared` of Unraid-app); voeg een hostname toe die naar de prod-web-poort wijst. Domein-keuze is **open punt 1 voor Kevin** — tot zijn antwoord: gebruik een subdomein onder het bestaande domein (bv. `demo.windahelden.nl` → prod-web) en noteer dat het één config-regel is om te wijzigen.
- [ ] **Step 5:** Bootstrap productie-inhoud (géén seed): master-admin-flow → tenant "Demo VVT" aanmaken → pilot-inrichtingsdraaiboek (W3) volgen via de UI, inclusief CSV-import met het voorbeeldbestand (mag: dit is demo-inhoud, geen echte persoonsgegevens — test-BSN's).
- [ ] **Step 6:** Live smoke: vanaf de dev-machine `E2E_BASE_URL=https://<publieke-url> pnpm --filter @openzorg/web test:e2e -- --grep "smoke"` (de smoke-spec; login-afhankelijke specs alleen als demo-accounts daar bestaan). Healthchecks: `curl -s https://<url>/api/ecd/health`-equivalent per service (check de health-routes in de proxy-config; anders op de server `docker compose ps` + interne curls).

### Task 4: Backups draaiend + restore getest

- [ ] **Step 1:** Op de server: cron-entry (Unraid User Scripts of crontab) dagelijks 03:00 → `cd /mnt/user/appdata/openzorg-prod && COMPOSE_FILE=infra/compose/docker-compose.prod.yml ./infra/scripts/backup.sh`; bewaarbeleid: 14 dagen (vind/rm ouder dan 14d in hetzelfde script of cron).
- [ ] **Step 2:** Restore-test conform runbook: op een wegwerp-locatie (`/tmp/openzorg-restore-test` of tweede compose-project) een restore draaien van de eerste echte backup en verifiëren dat de web-UI met de demo-tenant opkomt. **Een ongeteste backup is geen backup** — resultaat (datum, backup-id, uitkomst) in het overdrachtsrapport én als notitie in `docs/deployment-production.md`.
- [ ] **Step 3:** Off-host-kopie: noteer als open punt voor Kevin (tweede locatie/rsync-doel is een infra-keuze), tenzij er al een rsync-doel bestaat op de server — dan meteen inrichten.

### Task 5: Afronding

- [ ] W4-resultaat in overdrachtsrapport: publieke URL, versie, backup-status, restore-testdatum, wat open bleef (GHCR-publiek? domein-keuze?).
- [ ] Memory `project_state` bijwerken. Runbook-afwijkingen terugschrijven naar `docs/deployment-production.md`.
- [ ] **Fallback als Unraid onbereikbaar blijft** (spec W4.6): Tasks 1-2 zijn dan af; leg in het overdrachtsrapport een letterlijk copy-paste-commandoblok klaar voor de volledige uitrol (stap 1-6 hierboven ingevuld), gemarkeerd "wacht op server".
