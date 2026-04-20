#!/bin/sh
# OpenZorg seed-facturatie — Seeds Coverage + prestaties + declaraties test data.
#
# Creates per tenant:
#   - 5 Coverage resources (2 WLZ, 2 ZVW, 1 WMO) linked to existing patients
#   - 12 prestaties with WLZ/WMO/ZVW products
#   - 2 concept-declaraties
#
# Usage:
#   MEDPLUM_BASE_URL=http://localhost:18103 ECD_BASE_URL=http://localhost:14001 \
#   FACTURATIE_BASE_URL=http://localhost:14004 sh seed-facturatie.sh

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"
ECD="${ECD_BASE_URL:-http://localhost:4001}"
FACTURATIE="${FACTURATIE_BASE_URL:-http://localhost:4004}"

echo "=== OpenZorg Seed: Facturatie Test Data ==="
echo "Medplum: $MEDPLUM | ECD: $ECD | Facturatie: $FACTURATIE"

command -v curl > /dev/null 2>&1 || apk add --no-cache curl > /dev/null 2>&1

wait_for_medplum() {
  echo "Waiting for Medplum..."
  for i in $(seq 1 60); do
    if curl -sf "$MEDPLUM/healthcheck" > /dev/null 2>&1; then
      echo "Medplum is ready."
      return 0
    fi
    sleep 3
  done
  echo "ERROR: Medplum not reachable after 180s"
  exit 1
}

wait_for_medplum

node -e "
const crypto = require('crypto');

const MEDPLUM = '$MEDPLUM';
const ECD = '$ECD';
const FACTURATIE = '$FACTURATIE';

async function login(email, password) {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const loginRes = await fetch(MEDPLUM + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, scope: 'openid', codeChallenge, codeChallengeMethod: 'S256' }),
  });
  const loginData = await loginRes.json();

  let code;
  if (loginData.memberships && loginData.memberships.length > 0) {
    const profileRes = await fetch(MEDPLUM + '/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginData.login, profile: loginData.memberships[0].profile }),
    });
    const profileData = await profileRes.json();
    code = profileData.code;
  } else {
    code = loginData.code;
  }

  const tokenRes = await fetch(MEDPLUM + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&code=' + code + '&code_verifier=' + codeVerifier,
  });
  const tokenData = await tokenRes.json();
  const projectId = tokenData.project?.reference?.replace('Project/', '') ||
    loginData.memberships?.[0]?.project?.reference?.replace('Project/', '') || '';
  return { token: tokenData.access_token, projectId };
}

async function fhirFetch(token, path) {
  const res = await fetch(MEDPLUM + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/fhir+json' },
  });
  return res.json();
}

async function ecdPost(token, projectId, path, body) {
  const res = await fetch(ECD + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      'X-Tenant-ID': projectId,
      'X-User-Role': 'tenant-admin',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Map Medplum projectId to tenant UUID (from openzorg.tenants init.sql)
const TENANT_UUID_MAP = {
  'medplum-project-horizon': 'a0000000-0000-0000-0000-000000000001',
  'medplum-project-linde': 'b0000000-0000-0000-0000-000000000002',
};

async function factPost(projectId, path, body) {
  // Facturatie service needs the tenant UUID, not the Medplum project ID
  const tenantId = TENANT_UUID_MAP[projectId] || projectId;
  const res = await fetch(FACTURATIE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) console.log('    factPost error:', JSON.stringify(data).substring(0, 150));
  return data;
}

const COVERAGES = [
  { verzekeraar: 'Zilveren Kruis', polisnummer: 'ZK-2026-001234', financieringstype: 'zvw', ingangsdatum: '2026-01-01' },
  { verzekeraar: 'CZ Zorgkantoor', polisnummer: 'CZ-WLZ-5678', financieringstype: 'wlz', ingangsdatum: '2025-07-01', zzpKlasse: 'VV5', toewijzingsnummer: 'TW-2025-0042', indicatiebesluit: 'CIZ-2025-98765' },
  { verzekeraar: 'VGZ', polisnummer: 'VGZ-2026-009876', financieringstype: 'zvw', ingangsdatum: '2026-01-01' },
  { verzekeraar: 'Menzis Zorgkantoor', polisnummer: 'MZ-WLZ-3456', financieringstype: 'wlz', ingangsdatum: '2025-10-01', zzpKlasse: 'VV3', toewijzingsnummer: 'TW-2025-0088', indicatiebesluit: 'CIZ-2025-54321' },
  { verzekeraar: 'Gemeente Utrecht', polisnummer: 'WMO-UTR-2026-111', financieringstype: 'wmo', ingangsdatum: '2026-02-01' },
];

const PRESTATIES = [
  { product_code: 'ZZP-VV05', product_naam: 'ZZP-VV5 Beschermd wonen met intensieve dementiezorg', financieringstype: 'wlz', eenheid: 'dag', aantal: 31, tarief: 18234 },
  { product_code: 'ZZP-VV03', product_naam: 'ZZP-VV3 Beschut wonen met intensieve verzorging', financieringstype: 'wlz', eenheid: 'dag', aantal: 28, tarief: 12156 },
  { product_code: 'VPT-BASIS', product_naam: 'VPT Basis (volledig pakket thuis)', financieringstype: 'wlz', eenheid: 'dag', aantal: 31, tarief: 4280 },
  { product_code: 'MPT', product_naam: 'MPT (modulair pakket thuis)', financieringstype: 'wlz', eenheid: 'uur', aantal: 40, tarief: 5250 },
  { product_code: 'DAGBEST', product_naam: 'Dagbesteding', financieringstype: 'wlz', eenheid: 'dagdeel', aantal: 20, tarief: 3580 },
  { product_code: 'PV-01', product_naam: 'Persoonlijke verzorging', financieringstype: 'wmo', eenheid: 'uur', aantal: 16, tarief: 4250 },
  { product_code: 'HH-01', product_naam: 'Huishoudelijke hulp', financieringstype: 'wmo', eenheid: 'uur', aantal: 12, tarief: 3180 },
  { product_code: 'BG-01', product_naam: 'Individuele begeleiding', financieringstype: 'wmo', eenheid: 'uur', aantal: 8, tarief: 5680 },
  { product_code: 'WV-01', product_naam: 'Wijkverpleging', financieringstype: 'zvw', eenheid: 'uur', aantal: 20, tarief: 7950 },
  { product_code: 'WV-02', product_naam: 'Gespecialiseerde verpleging', financieringstype: 'zvw', eenheid: 'uur', aantal: 10, tarief: 9850 },
  { product_code: 'ZZP-VV08', product_naam: 'ZZP-VV8 Beschermd wonen met zeer intensieve zorg', financieringstype: 'wlz', eenheid: 'dag', aantal: 14, tarief: 27891 },
  { product_code: 'ZZP-VV10', product_naam: 'ZZP-VV10 Beschermd verblijf met intensieve palliatieve zorg', financieringstype: 'wlz', eenheid: 'dag', aantal: 7, tarief: 34212 },
];

async function seedTenant(email, password, label) {
  console.log('');
  console.log('  Authenticated: ' + email);
  const { token, projectId } = await login(email, password);

  console.log('--- ' + label + ' ---');

  // Get patients
  const patients = await fhirFetch(token, '/fhir/R4/Patient?_count=10&_sort=family');
  const patientIds = (patients.entry || []).map(e => e.resource.id).slice(0, 5);
  console.log('  Gevonden: ' + patientIds.length + ' clienten');

  // Create coverages
  let coverageCount = 0;
  for (let i = 0; i < Math.min(patientIds.length, COVERAGES.length); i++) {
    const cov = COVERAGES[i];
    const result = await ecdPost(token, projectId, '/api/clients/' + patientIds[i] + '/verzekering', cov);
    if (result.id || result.resourceType) {
      coverageCount++;
      console.log('  Coverage: ' + cov.verzekeraar + ' (' + cov.financieringstype + ') -> client ' + (i + 1));
    } else {
      console.log('  Coverage SKIP: ' + JSON.stringify(result).substring(0, 100));
    }
  }
  console.log('  ' + coverageCount + ' coverages aangemaakt');

  // Create prestaties
  let prestatieCount = 0;
  const today = new Date();
  for (let i = 0; i < PRESTATIES.length; i++) {
    const p = PRESTATIES[i];
    const clientIdx = i % Math.max(patientIds.length, 1);
    const datum = new Date(today);
    datum.setDate(datum.getDate() - (i * 3)); // spread over last ~36 days

    const result = await factPost(projectId, '/api/prestaties', {
      clientId: patientIds[clientIdx],
      datum: datum.toISOString().split('T')[0],
      productCode: p.product_code,
      financieringstype: p.financieringstype,
      aantal: p.aantal,
      opmerking: 'Testdata seed',
    });
    if (result.id) {
      prestatieCount++;
    }
  }
  console.log('  ' + prestatieCount + ' prestaties aangemaakt');

  // Create 2 concept-declaraties
  let declCount = 0;
  for (const ft of ['wlz', 'zvw']) {
    const periodeVan = new Date(today);
    periodeVan.setMonth(periodeVan.getMonth() - 1);
    periodeVan.setDate(1);
    const periodeTot = new Date(periodeVan);
    periodeTot.setMonth(periodeTot.getMonth() + 1);
    periodeTot.setDate(0);

    const result = await factPost(projectId, '/api/declaraties', {
      financieringstype: ft,
      periode_van: periodeVan.toISOString().split('T')[0],
      periode_tot: periodeTot.toISOString().split('T')[0],
    });
    if (result.id || result.nummer) {
      declCount++;
      console.log('  Declaratie: ' + (result.nummer || result.id) + ' (' + ft + ')');
    }
  }
  console.log('  ' + declCount + ' declaraties aangemaakt');
  console.log('  Totaal: ' + coverageCount + ' coverages, ' + prestatieCount + ' prestaties, ' + declCount + ' declaraties');
}

async function main() {
  console.log('');
  console.log('Authenticating tenant accounts...');

  await seedTenant('jan@horizon.nl', 'Hz!J4n#2026pKw8', 'Zorggroep Horizon');
  await seedTenant('maria@delinde.nl', 'Ld!M4r1a#2026nRt5', 'Thuiszorg De Linde');

  console.log('');
  console.log('=========================================');
  console.log('  Seed Facturatie Complete');
  console.log('=========================================');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
"

echo ""
echo "Seed facturatie script complete."
