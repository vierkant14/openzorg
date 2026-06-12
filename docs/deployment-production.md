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
