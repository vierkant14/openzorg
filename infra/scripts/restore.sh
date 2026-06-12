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
