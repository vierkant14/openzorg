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
