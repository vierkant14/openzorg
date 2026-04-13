#!/usr/bin/env bash
set -euo pipefail

HOST=${1:-192.168.1.10}

ENDPOINTS=(
  "http://${HOST}:13000/api/health|web"
  "http://${HOST}:14001/health|ecd"
  "http://${HOST}:14002/health|planning"
  "http://${HOST}:14003/health|workflow-bridge"
  "http://${HOST}:14004/health|facturatie"
  "http://${HOST}:18103/healthcheck|medplum"
)

echo "Unraid smoke-test tegen ${HOST}"
echo "================================"

FAILED=0
for entry in "${ENDPOINTS[@]}"; do
  url="${entry%%|*}"
  name="${entry##*|}"
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "TIMEOUT")
  if [ "$status" = "200" ]; then
    printf "  ✓ %-20s %s\n" "$name" "$status"
  else
    printf "  ✗ %-20s %s (%s)\n" "$name" "$status" "$url"
    FAILED=$((FAILED + 1))
  fi
done

echo "================================"
if [ $FAILED -eq 0 ]; then
  echo "Alle ${#ENDPOINTS[@]} services healthy."
  exit 0
else
  echo "${FAILED}/${#ENDPOINTS[@]} services niet healthy." >&2
  exit 1
fi
