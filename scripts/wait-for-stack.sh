#!/usr/bin/env bash
set -euo pipefail

ENDPOINTS=(
  "http://localhost:3000/api/health"
  "http://localhost:4001/health"
  "http://localhost:4002/health"
  "http://localhost:4003/health"
  "http://localhost:4004/health"
)

MAX_WAIT=${MAX_WAIT:-300}
INTERVAL=${INTERVAL:-5}
ELAPSED=0

echo "Wachten tot alle services healthy zijn (max ${MAX_WAIT}s)..."

while [ $ELAPSED -lt $MAX_WAIT ]; do
  ALL_HEALTHY=true
  for endpoint in "${ENDPOINTS[@]}"; do
    if ! curl -sf "$endpoint" > /dev/null 2>&1; then
      ALL_HEALTHY=false
      break
    fi
  done

  if [ "$ALL_HEALTHY" = true ]; then
    echo "Alle services healthy na ${ELAPSED}s."
    exit 0
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  echo "  ${ELAPSED}s verstreken, nog niet alle services healthy..."
done

echo "TIMEOUT: niet alle services werden healthy binnen ${MAX_WAIT}s." >&2
echo "Laatste status:" >&2
for endpoint in "${ENDPOINTS[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" || echo "FAIL")
  echo "  $endpoint → $status" >&2
done
exit 1
