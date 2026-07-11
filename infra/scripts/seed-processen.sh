#!/bin/sh
# OpenZorg seed-processen — Demo-zorgpaden per tenant (W1-6):
#   - Activeert intake-proces + zorgplan-evaluatie voor de tenant (per-tenant
#     deployment via de workflow-bridge)
#   - Start 2 intake-instanties gekoppeld aan bestaande seed-cliënten
#   Resultaat: een gevulde werkbak en een gevulde "Lopend"-tab in de demo.
#
# Idempotent: activeren deployt hooguit een nieuwe versie; instanties worden
# alleen gestart als er nog geen lopende intake-instanties zijn.
#
# NB: CI heeft dit script niet nodig — de proces-keten-e2e seedt zichzelf via
# de UI. Dit script is voor staging/demo-omgevingen.
#
# Usage (standalone):
#   MEDPLUM_BASE_URL=http://localhost:8103 WORKFLOW_BRIDGE_URL=http://localhost:4003 sh seed-processen.sh
#
# Usage (Docker one-shot):
#   docker run --rm --network=openzorg_default \
#     -e MEDPLUM_BASE_URL=http://medplum:8103 \
#     -e WORKFLOW_BRIDGE_URL=http://workflow-bridge:4003 \
#     -v $(pwd)/infra/scripts:/scripts -w /scripts \
#     node:20-alpine sh seed-processen.sh

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"
BRIDGE="${WORKFLOW_BRIDGE_URL:-http://localhost:4003}"

echo "=== OpenZorg Seed: Processen (demo-zorgpaden) ==="
echo "Medplum: $MEDPLUM"
echo "Bridge:  $BRIDGE"

command -v curl > /dev/null 2>&1 || apk add --no-cache curl > /dev/null 2>&1

wait_for() {
  url="$1"; naam="$2"
  echo "Waiting for $naam..."
  for i in $(seq 1 60); do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo "$naam is ready."
      return 0
    fi
    sleep 3
  done
  echo "ERROR: $naam not reachable"
  exit 1
}

wait_for "$MEDPLUM/healthcheck" "Medplum"
wait_for "$BRIDGE/health" "Workflow-bridge"

node -e "
const crypto = require('crypto');

const MEDPLUM = '$MEDPLUM';
const BRIDGE = '$BRIDGE';

const TENANTS = [
  { email: 'jan@horizon.nl', password: 'Hz!J4n#2026pKw8', naam: 'Zorggroep Horizon' },
  { email: 'maria@delinde.nl', password: 'Ld!M4r1a#2026nRt5', naam: 'Thuiszorg De Linde' },
];

async function login(email, password) {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const loginRes = await fetch(MEDPLUM + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, scope: 'openid', codeChallenge, codeChallengeMethod: 'S256' }),
  });
  if (!loginRes.ok) { console.log('  Login mislukt voor ' + email + ': HTTP ' + loginRes.status); return null; }
  const { code } = await loginRes.json();

  const tokenRes = await fetch(MEDPLUM + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: codeVerifier }),
  });
  if (!tokenRes.ok) { console.log('  Token mislukt voor ' + email); return null; }
  const token = await tokenRes.json();
  return { accessToken: token.access_token, projectId: token.project?.reference?.split('/')[1] };
}

async function bridgeFetch(sessie, path, opts = {}) {
  const res = await fetch(BRIDGE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + sessie.accessToken,
      'X-Tenant-ID': sessie.projectId,
      'X-User-Role': 'beheerder',
      ...(opts.headers || {}),
    },
  });
  return res;
}

async function medplumZoek(sessie, query) {
  const res = await fetch(MEDPLUM + '/fhir/R4/' + query, {
    headers: { 'Authorization': 'Bearer ' + sessie.accessToken },
  });
  if (!res.ok) return [];
  const bundle = await res.json();
  return (bundle.entry || []).map((e) => e.resource);
}

async function seedTenant(t) {
  console.log('--- ' + t.naam + ' ---');
  const sessie = await login(t.email, t.password);
  if (!sessie || !sessie.projectId) { console.log('  Overslaan (geen sessie).'); return; }

  // 1. Zorgpaden activeren (per-tenant deployment; idempotent genoeg)
  for (const key of ['intake-proces', 'zorgplan-evaluatie']) {
    const res = await bridgeFetch(sessie, '/api/bpmn-templates/' + key + '/deploy', { method: 'POST' });
    console.log('  Activeren ' + key + ': ' + (res.ok ? 'OK' : 'HTTP ' + res.status));
  }

  // 2. Al lopende intakes? Dan geen nieuwe starten (idempotentie)
  const lopendRes = await bridgeFetch(sessie, '/api/processen/intake-proces/instances');
  if (lopendRes.ok) {
    const lopend = await lopendRes.json();
    if ((lopend.data || []).length >= 2) {
      console.log('  Al ' + lopend.data.length + ' lopende intakes — niets te starten.');
      return;
    }
  }

  // 3. Start 2 intakes gekoppeld aan bestaande seed-cliënten
  const clienten = await medplumZoek(sessie, 'Patient?_count=2&_sort=-_lastUpdated');
  if (clienten.length === 0) { console.log('  Geen cliënten gevonden — sla starten over.'); return; }

  for (const client of clienten) {
    const naam = ((client.name || [])[0] || {});
    const weergave = [(naam.given || []).join(' '), naam.family].filter(Boolean).join(' ') || 'Cliënt';
    const res = await bridgeFetch(sessie, '/api/processen/intake-proces/start', {
      method: 'POST',
      body: JSON.stringify({ variables: { clientRef: 'Patient/' + client.id, clientNaam: weergave, clientId: client.id } }),
    });
    console.log('  Intake gestart voor ' + weergave + ': ' + (res.ok ? 'OK' : 'HTTP ' + res.status));
  }
}

(async () => {
  for (const t of TENANTS) {
    await seedTenant(t);
  }
  console.log('=== Seed processen klaar ===');
})().catch((err) => { console.error(err); process.exit(1); });
"
