#!/bin/sh
# OpenZorg seed script — runs once after Medplum is healthy.
# Creates super admin + 2 tenant environments with users.
# Uses the FULL Medplum registration flow: newuser → newproject → token exchange.

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"

echo "=== OpenZorg Seed Script ==="
echo "Medplum: $MEDPLUM"

apk add --no-cache curl > /dev/null 2>&1

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

# Run the registration with Node.js for proper crypto + async support
node -e "
const crypto = require('crypto');

async function register(email, password, firstName, lastName, projectName) {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  // Step 1: Create user
  const r1 = await fetch('$MEDPLUM/auth/newuser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, password, recaptchaToken: '', codeChallenge, codeChallengeMethod: 'S256' })
  });
  const s1 = await r1.json();
  if (!s1.login) { console.log('  ' + email + ': SKIP (exists or error)'); return; }

  // Step 2: Create project
  const r2 = await fetch('$MEDPLUM/auth/newproject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: s1.login, projectName })
  });
  const s2 = await r2.json();
  if (!s2.code) { console.log('  ' + email + ': project creation failed'); return; }

  // Step 3: Complete registration (token exchange)
  await fetch('$MEDPLUM/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&code=' + s2.code + '&code_verifier=' + codeVerifier
  });
  console.log('  ' + email + ': OK');
}

(async () => {
  console.log('Registering users...');
  await register('admin@openzorg.nl', 'Oz!Adm1n#2026mXq7', 'Super', 'Admin', 'OpenZorg Master');
  await register('jan@horizon.nl', 'Hz!J4n#2026pKw8', 'Jan', 'de Vries', 'Zorggroep Horizon');
  await register('maria@delinde.nl', 'Ld!M4r1a#2026nRt5', 'Maria', 'Jansen', 'Thuiszorg De Linde');

  console.log('');
  console.log('=========================================');
  console.log('  OpenZorg Seed Complete');
  console.log('=========================================');
  console.log('');
  console.log('Logins:');
  console.log('');
  console.log('  Super Admin:');
  console.log('    Email:    admin@openzorg.nl');
  console.log('    Wachtw:   Oz!Adm1n#2026mXq7');
  console.log('');
  console.log('  Zorggroep Horizon:');
  console.log('    Email:    jan@horizon.nl');
  console.log('    Wachtw:   Hz!J4n#2026pKw8');
  console.log('');
  console.log('  Thuiszorg De Linde:');
  console.log('    Email:    maria@delinde.nl');
  console.log('    Wachtw:   Ld!M4r1a#2026nRt5');
  console.log('');
  console.log('Open http://localhost:3000/login');
  console.log('=========================================');
})();
"
