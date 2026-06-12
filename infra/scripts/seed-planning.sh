#!/bin/sh
# OpenZorg seed-planning — Seeds planning test data for Zorggroep Horizon:
#   - PractitionerRole resources with contract hours for the first 6 practitioners
#   - 20-30 Appointment resources spread across the current week
#
# Includes CAO-violation scenarios for testing:
#   - One practitioner with >48h/week
#   - Two consecutive appointments with <11h rest gap
#   - One shift >10h
#
# Idempotent: checks for existing PractitionerRole + Appointments before creating.
#
# Usage (standalone):
#   MEDPLUM_BASE_URL=http://localhost:8103 sh seed-planning.sh
#
# Usage (Docker one-shot):
#   docker run --rm --network=openzorg_default \
#     -e MEDPLUM_BASE_URL=http://medplum:8103 \
#     -v $(pwd)/infra/scripts:/scripts -w /scripts \
#     node:20-alpine sh seed-planning.sh

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"

echo "=== OpenZorg Seed: Planning (Afspraken + Contracten) ==="
echo "Medplum: $MEDPLUM"

# Install tools if not present
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

// ── Auth: login to existing tenant account ──

async function login(email, password) {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const loginRes = await fetch(MEDPLUM + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      scope: 'openid',
      codeChallenge,
      codeChallengeMethod: 'S256',
    }),
  });
  if (!loginRes.ok) {
    console.log('  Login failed for ' + email + ': HTTP ' + loginRes.status);
    return null;
  }
  const loginData = await loginRes.json();

  let code;
  if (loginData.memberships && loginData.memberships.length) {
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
  if (!code) { console.log('  No code for ' + email); return null; }

  const tokenRes = await fetch(MEDPLUM + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&code=' + code + '&code_verifier=' + codeVerifier,
  });
  if (!tokenRes.ok) { console.log('  Token exchange failed for ' + email); return null; }
  const tokenData = await tokenRes.json();
  console.log('  Geverifieerd: ' + email);
  return tokenData.access_token;
}

// ── FHIR helpers ──

async function fhirCreate(token, resource) {
  const r = await fetch(MEDPLUM + '/fhir/R4/' + resource.resourceType, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify(resource),
  });
  const result = await r.json();
  if (!r.ok) {
    console.log('    WARN: aanmaken ' + resource.resourceType + ' mislukt: ' + r.status);
    return null;
  }
  return result.id || null;
}

async function fhirSearch(token, query) {
  const r = await fetch(MEDPLUM + '/fhir/R4/' + query, {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!r.ok) return [];
  const bundle = await r.json();
  return (bundle.entry || []).map(function(e) { return e.resource; });
}

// ── Get Monday of current week ──

function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day === 0) ? -6 : 1 - day; // adjust when Sunday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toISOWithOffset(date, offsetHours) {
  const pad = function(n) { return String(n).padStart(2, '0'); };
  const sign = offsetHours >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetHours);
  return date.getFullYear() + '-' +
    pad(date.getMonth() + 1) + '-' +
    pad(date.getDate()) + 'T' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes()) + ':00' +
    sign + pad(absOffset) + ':00';
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Main seed ──

(async () => {
  console.log('');
  console.log('Authenticeren als jan@horizon.nl (Zorggroep Horizon)...');
  const token = await login('jan@horizon.nl', 'Hz!J4n#2026pKw8');
  if (!token) {
    console.log('FOUT: Kan niet inloggen. Afbreken.');
    process.exit(1);
  }

  // ── 1. Practitioners ophalen ──
  console.log('');
  console.log('--- Stap 1: Medewerkers ophalen ---');
  const allPractitioners = await fhirSearch(token, 'Practitioner?_count=10&_sort=name');
  if (allPractitioners.length === 0) {
    console.log('WARN: Geen medewerkers gevonden. Voer eerst seed.sh uit.');
    process.exit(1);
  }
  const practitioners = allPractitioners.slice(0, 6);
  console.log('  ' + practitioners.length + ' medewerkers geselecteerd voor contracten');

  // ── 2. PractitionerRole contracten aanmaken ──
  console.log('');
  console.log('--- Stap 2: Contracten (PractitionerRole) aanmaken ---');

  // Contract hours per practitioner: 36, 32, 24, 40, 28, 36
  const contractUren = [36, 32, 24, 40, 28, 36];
  const contractFte  = [1.0, 0.89, 0.67, 1.11, 0.78, 1.0];
  const contractType = ['vast', 'vast', 'vast', 'bepaalde-tijd', 'oproep', 'vast'];

  const practRoleIds = [];
  let contractAangemaakt = 0;
  let contractOvergeslagen = 0;

  for (let i = 0; i < practitioners.length; i++) {
    const pract = practitioners[i];
    const name = pract.name && pract.name[0];
    const displayName = name ? (name.given ? name.given[0] + ' ' : '') + (name.family || '') : 'Medewerker ' + (i + 1);

    // Check if a PractitionerRole already exists for this practitioner
    const existing = await fhirSearch(token, 'PractitionerRole?practitioner=Practitioner/' + pract.id + '&_count=1');
    if (existing.length > 0) {
      console.log('  PractitionerRole bestaat al voor ' + displayName + ' — overgeslagen');
      practRoleIds.push(existing[0].id);
      contractOvergeslagen++;
      continue;
    }

    const roleId = await fhirCreate(token, {
      resourceType: 'PractitionerRole',
      practitioner: { reference: 'Practitioner/' + pract.id, display: displayName },
      active: true,
      extension: [
        { url: 'https://openzorg.nl/extensions/contract-uren', valueDecimal: contractUren[i] },
        { url: 'https://openzorg.nl/extensions/contract-fte', valueDecimal: contractFte[i] },
        { url: 'https://openzorg.nl/extensions/contract-type', valueString: contractType[i] },
      ],
    });
    if (roleId) {
      console.log('  Contract aangemaakt voor ' + displayName + ' (' + contractUren[i] + 'u/week, ' + contractType[i] + ')');
      practRoleIds.push(roleId);
      contractAangemaakt++;
    }
  }
  console.log('  ' + contractAangemaakt + ' contracten aangemaakt, ' + contractOvergeslagen + ' overgeslagen');

  // ── 3. Patienten ophalen ──
  console.log('');
  console.log('--- Stap 3: Clienten ophalen ---');
  const patients = await fhirSearch(token, 'Patient?_count=10&_sort=name');
  if (patients.length === 0) {
    console.log('WARN: Geen clienten gevonden. Voer eerst seed.sh uit.');
    process.exit(1);
  }
  console.log('  ' + patients.length + ' clienten gevonden');

  // ── 4. Check existing appointments this week ──
  const monday = getMondayOfCurrentWeek();
  const friday = addDays(monday, 4);
  const mondayStr = monday.toISOString().split('T')[0];
  const sundayStr = addDays(monday, 6).toISOString().split('T')[0];

  const existingAppts = await fhirSearch(token,
    'Appointment?date=ge' + mondayStr + '&date=le' + sundayStr + '&_count=50');
  if (existingAppts.length > 0) {
    console.log('  WARN: Al ' + existingAppts.length + ' afspraken gevonden voor deze week — overgeslagen');
    console.log('');
    console.log('=========================================');
    console.log('  Seed Planning Complete (al aanwezig)');
    console.log('=========================================');
    return;
  }

  // ── 4. Appointments aanmaken ──
  console.log('');
  console.log('--- Stap 4: Afspraken aanmaken (week van ' + mondayStr + ') ---');

  // Helper: get patient display name
  function patientDisplay(p) {
    const name = p.name && p.name[0];
    return name ? (name.given ? name.given[0] + ' ' : '') + (name.family || '') : 'Client';
  }

  // Helper: get practitioner display name
  function practDisplay(p) {
    const name = p.name && p.name[0];
    return name ? (name.given ? name.given[0] + ' ' : '') + (name.family || '') : 'Medewerker';
  }

  // Helper: create an appointment
  async function maakAfspraak(pract, patient, dayOffset, startHour, durationHours, type, display) {
    const start = addDays(monday, dayOffset);
    start.setHours(startHour, 0, 0, 0);
    const end = addHours(start, durationHours);
    const apptType = type || 'regulier';
    const typeDisplay = display || 'Reguliere zorg';

    const id = await fhirCreate(token, {
      resourceType: 'Appointment',
      status: 'booked',
      start: toISOWithOffset(start, 2),
      end: toISOWithOffset(end, 2),
      appointmentType: {
        coding: [{ code: apptType, display: typeDisplay }],
      },
      participant: [
        {
          actor: { reference: 'Practitioner/' + pract.id, display: practDisplay(pract) },
          status: 'accepted',
        },
        {
          actor: { reference: 'Patient/' + patient.id, display: patientDisplay(patient) },
          status: 'accepted',
        },
      ],
    });
    return id;
  }

  let apptCount = 0;

  // Medewerker 0 (Jan de Vries / eerste) — normale week
  // Ma: 08:00-10:00 (2u), Di: 08:00-10:30 (2,5u), Wo: 09:00-11:00 (2u), Do: 08:00-10:00 (2u), Vr: 08:00-10:00 (2u)
  if (practitioners[0] && patients[0]) {
    if (await maakAfspraak(practitioners[0], patients[0], 0, 8, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[0], patients[1] || patients[0], 0, 11, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[0], patients[0], 1, 8, 2.5, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[0], patients[2] || patients[0], 2, 9, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[0], patients[3] || patients[0], 3, 8, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[0], patients[1] || patients[0], 4, 8, 2, 'regulier', 'Reguliere zorg')) apptCount++;
  }

  // Medewerker 1 (tweede) — CAO OVERTREDING: >48u/week
  // Maandag t/m vrijdag: lange diensten zodat totaal > 48u
  if (practitioners[1] && patients[1]) {
    // Ma: 07:00-17:00 (10u)
    if (await maakAfspraak(practitioners[1], patients[0] || patients[0], 0, 7, 10, 'regulier', 'Reguliere zorg')) apptCount++;
    // Di: 07:00-17:00 (10u)
    if (await maakAfspraak(practitioners[1], patients[1], 1, 7, 10, 'regulier', 'Reguliere zorg')) apptCount++;
    // Wo: 07:00-17:00 (10u)
    if (await maakAfspraak(practitioners[1], patients[2] || patients[1], 2, 7, 10, 'regulier', 'Reguliere zorg')) apptCount++;
    // Do: 07:00-17:00 (10u)
    if (await maakAfspraak(practitioners[1], patients[3] || patients[1], 3, 7, 10, 'regulier', 'Reguliere zorg')) apptCount++;
    // Vr: 07:00-16:00 (9u) — totaal 49u = CAO overtreding >48u
    if (await maakAfspraak(practitioners[1], patients[0], 4, 7, 9, 'regulier', 'Reguliere zorg')) apptCount++;
    console.log('  CAO SCENARIO: Medewerker 2 heeft 49u/week gepland (>48u limiet)');
  }

  // Medewerker 2 (derde) — CAO OVERTREDING: <11u rust tussen diensten
  if (practitioners[2] && patients[2]) {
    // Ma avonddienst: 14:00-23:00 (9u)
    if (await maakAfspraak(practitioners[2], patients[0], 0, 14, 9, 'regulier', 'Reguliere zorg')) apptCount++;
    // Di ochtenddienst: 07:00-13:00 (6u) — slechts 8u rust na avonddienst (< 11u CAO norm)
    if (await maakAfspraak(practitioners[2], patients[1] || patients[0], 1, 7, 6, 'regulier', 'Reguliere zorg')) apptCount++;
    // Wo: normale dienst
    if (await maakAfspraak(practitioners[2], patients[2], 2, 8, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    // Do: normale dienst
    if (await maakAfspraak(practitioners[2], patients[3] || patients[2], 3, 9, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    console.log('  CAO SCENARIO: Medewerker 3 heeft <11u rust tussen maandag-avond en dinsdag-ochtend');
  }

  // Medewerker 3 (vierde) — CAO OVERTREDING: dienst >10u
  if (practitioners[3] && patients[3]) {
    // Ma: 06:00-17:30 (11,5u dienst = >10u CAO overtreding)
    if (await maakAfspraak(practitioners[3], patients[0], 0, 6, 11.5, 'regulier', 'Reguliere zorg')) apptCount++;
    // Di: normale dienst
    if (await maakAfspraak(practitioners[3], patients[1] || patients[3], 1, 8, 3, 'regulier', 'Reguliere zorg')) apptCount++;
    // Do: normale dienst
    if (await maakAfspraak(practitioners[3], patients[2] || patients[3], 3, 9, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    // Vr: normale dienst
    if (await maakAfspraak(practitioners[3], patients[3], 4, 10, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    console.log('  CAO SCENARIO: Medewerker 4 heeft een dienst van 11,5u op maandag (>10u limiet)');
  }

  // Medewerker 4 (vijfde) — normale week met gevarieerde diensten
  if (practitioners[4] && patients.length > 0) {
    if (await maakAfspraak(practitioners[4], patients[0], 0, 8, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[4], patients[1] || patients[0], 1, 9, 1.5, 'controle', 'Controle bezoek')) apptCount++;
    if (await maakAfspraak(practitioners[4], patients[2] || patients[0], 2, 10, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[4], patients[3] || patients[0], 3, 8, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[4], patients[0], 4, 9, 2, 'regulier', 'Reguliere zorg')) apptCount++;
  }

  // Medewerker 5 (zesde) — weekenddienst + weekdagen
  if (practitioners[5] && patients.length > 0) {
    // Normaal door de week
    if (await maakAfspraak(practitioners[5], patients[1] || patients[0], 0, 7, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[5], patients[2] || patients[0], 1, 8, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[5], patients[0], 2, 7, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    // Weekend: zaterdag en zondag
    if (await maakAfspraak(practitioners[5], patients[3] || patients[0], 5, 8, 2, 'regulier', 'Reguliere zorg')) apptCount++;
    if (await maakAfspraak(practitioners[5], patients[1] || patients[0], 6, 9, 2, 'regulier', 'Reguliere zorg')) apptCount++;
  }

  console.log('  ' + apptCount + ' afspraken aangemaakt');

  console.log('');
  console.log('=========================================');
  console.log('  Seed Planning Complete');
  console.log('=========================================');
  console.log('');
  console.log('Aangemaakt:');
  console.log('  ' + contractAangemaakt + ' PractitionerRole contracten');
  console.log('  ' + apptCount + ' afspraken (week van ' + mondayStr + ')');
  console.log('');
  console.log('CAO-overtreding scenario\\'s voor testdoeleinden:');
  console.log('  - Medewerker 2: 49u/week (>48u CAO limiet)');
  console.log('  - Medewerker 3: <11u rust tussen maandag-avond en dinsdag-ochtend');
  console.log('  - Medewerker 4: dienst van 11,5u op maandag (>10u CAO limiet)');
  console.log('');
})().catch(function(e) { console.error('FOUT:', e); process.exit(1); });
"

echo ""
echo "Seed planning script complete."
