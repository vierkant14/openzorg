#!/usr/bin/env node
/**
 * Augment-script voor test-data in een bestaande tenant.
 *
 * Voegt extra cliënten, medewerkers, signaleringen, rapportages en
 * actieve workflow-processen toe aan een bestaande tenant zonder de
 * huidige data aan te raken. Bedoeld om een middelgrote VVT-omgeving
 * te simuleren zonder volledige re-seed.
 *
 * Gebruik:
 *   MEDPLUM=http://medplum:8103 TENANT_EMAIL=jan@horizon.nl \
 *   TENANT_PASSWORD=Hz!J4n#2026pKw8 node augment-vvt-data.mjs
 *
 * Of via docker exec op Unraid:
 *   docker run --rm --network=openzorg_default \
 *     -e MEDPLUM=http://medplum:8103 \
 *     -e TENANT_EMAIL=jan@horizon.nl \
 *     -e TENANT_PASSWORD='Hz!J4n#2026pKw8' \
 *     -v $(pwd)/infra/scripts:/app -w /app node:20-alpine \
 *     node augment-vvt-data.mjs
 */

import crypto from 'node:crypto';

const MEDPLUM = process.env.MEDPLUM || 'http://medplum:8103';
const EMAIL = process.env.TENANT_EMAIL || 'jan@horizon.nl';
const PASSWORD = process.env.TENANT_PASSWORD;
const TARGET_CLIENTS = parseInt(process.env.TARGET_CLIENTS || '42', 10);
const TARGET_APPOINTMENTS = parseInt(process.env.TARGET_APPOINTMENTS || '25', 10);
const TARGET_INTAKES = parseInt(process.env.TARGET_INTAKES || '8', 10);
const WORKFLOW_BRIDGE = process.env.WORKFLOW_BRIDGE || 'http://workflow-bridge:4003';

if (!PASSWORD) {
  console.error('TENANT_PASSWORD env var is required');
  process.exit(1);
}

/* ────────────────────────────────────────────────────────────
   Auth
   ──────────────────────────────────────────────────────────── */

async function login() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const loginRes = await fetch(`${MEDPLUM}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      scope: 'openid',
      codeChallenge,
      codeChallengeMethod: 'S256',
    }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const loginData = await loginRes.json();

  let code;
  if (loginData.memberships?.length) {
    const profileRes = await fetch(`${MEDPLUM}/auth/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginData.login, profile: loginData.memberships[0].profile }),
    });
    const profileData = await profileRes.json();
    code = profileData.code;
  } else {
    code = loginData.code;
  }
  if (!code) throw new Error('No code in login response');

  const tokenRes = await fetch(`${MEDPLUM}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=authorization_code&code=${code}&code_verifier=${codeVerifier}`,
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function fhirCreate(token, resource) {
  const res = await fetch(`${MEDPLUM}/fhir/R4/${resource.resourceType}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/fhir+json',
    },
    body: JSON.stringify(resource),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create ${resource.resourceType} failed: ${res.status} - ${text.substring(0, 200)}`);
  }
  const data = await res.json();
  return data.id;
}

async function fhirSearch(token, type, query = '') {
  const res = await fetch(`${MEDPLUM}/fhir/R4/${type}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { entry: [] };
  return res.json();
}

/* ────────────────────────────────────────────────────────────
   Dutch name + address data
   ──────────────────────────────────────────────────────────── */

const FAM_NAMES = [
  'de Jong', 'Jansen', 'de Vries', 'van den Berg', 'van Dijk', 'Bakker', 'Janssen', 'Visser',
  'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks',
  'van Leeuwen', 'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Smits', 'de Graaf', 'van der Meer',
  'van der Linden', 'Kok', 'Jacobs', 'de Haan', 'Vermeulen', 'van den Broek', 'de Bruijn',
  'van der Heijden', 'Schouten', 'van Beek', 'Willems', 'van Vliet', 'van de Ven', 'Hoekstra',
  'Maas', 'Verhoeven', 'Koster', 'van Dam', 'Prins', 'Blom', 'Huisman', 'Peeters',
];

const GIVEN_MALE = [
  'Jan', 'Peter', 'Henk', 'Willem', 'Klaas', 'Kees', 'Piet', 'Arie', 'Gerrit', 'Cor',
  'Frans', 'Hendrik', 'Nico', 'Dirk', 'Rob', 'Bas', 'Tom', 'Daan', 'Sander', 'Thomas',
];

const GIVEN_FEMALE = [
  'Maria', 'Anna', 'Truus', 'Els', 'Joke', 'Willemien', 'Greet', 'Annie', 'Corrie', 'Riet',
  'Sophie', 'Emma', 'Lisa', 'Fleur', 'Anouk', 'Nadia', 'Ayse', 'Fatima', 'Esther', 'Charlotte',
];

const STREETS = [
  'Beukenlaan', 'Dorpsstraat', 'Kerkstraat', 'Schoolstraat', 'Kastanjelaan', 'Wilgenhof',
  'Prinsengracht', 'Molenweg', 'Parklaan', 'Julianastraat', 'Wilhelminalaan', 'Oranjeweg',
];

const CITIES = [
  { name: 'Amsterdam', postal: '10' }, { name: 'Amstelveen', postal: '11' },
  { name: 'Zaandam', postal: '15' }, { name: 'Haarlem', postal: '20' },
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randomBSN() {
  // 9 cijfers, valideer met elfproef
  for (let tries = 0; tries < 100; tries++) {
    const digits = Array.from({ length: 9 }, () => randInt(0, 9));
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += digits[i] * (9 - i);
    sum -= digits[8];
    if (sum % 11 === 0 && digits[0] !== 0) return digits.join('');
  }
  return '123456782';
}

function randomBirthDate(minAge = 60, maxAge = 95) {
  const now = new Date();
  const age = randInt(minAge, maxAge);
  const year = now.getFullYear() - age;
  const month = randInt(1, 12);
  const day = randInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function randomAddress() {
  const city = rand(CITIES);
  const postal = `${city.postal}${randInt(10, 99)} ${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}`;
  return {
    line: [`${rand(STREETS)} ${randInt(1, 300)}`],
    postalCode: postal,
    city: city.name,
  };
}

const ZORGPROFIELEN = ['ZZP 4 VV', 'ZZP 5 VV', 'ZZP 6 VV', 'ZZP 7 VV', 'ZZP 8 VV', 'VPT', 'MPT'];
const INDICATIE_TYPES = ['wlz', 'wmo', 'zvw'];
const TRAJECT_STATUSSEN = ['aangemeld', 'in-intake', 'in-zorg', 'in-zorg', 'in-zorg', 'in-zorg', 'overdracht', 'uitgeschreven'];

/* ────────────────────────────────────────────────────────────
   Seed logic
   ──────────────────────────────────────────────────────────── */

async function main() {
  console.log(`\n🔐 Login als ${EMAIL}...`);
  const token = await login();
  console.log('✅ Ingelogd');

  // Check hoeveel cliënten er al zijn
  const existing = await fhirSearch(token, 'Patient', '_count=0');
  const existingCount = existing.total ?? 0;
  console.log(`ℹ️  Tenant heeft momenteel ${existingCount} cliënten`);

  // Zoek bestaande locaties voor random koppeling
  const orgs = await fhirSearch(token, 'Organization', '_count=50');
  const orgIds = (orgs.entry ?? []).map((e) => e.resource.id).filter(Boolean);
  console.log(`ℹ️  ${orgIds.length} Organisaties gevonden voor random toewijzing`);

  console.log(`\n👥 ${TARGET_CLIENTS} cliënten aanmaken...`);

  let created = 0;
  const errors = [];
  for (let i = 0; i < TARGET_CLIENTS; i++) {
    try {
      const isMale = Math.random() < 0.3;
      const given = rand(isMale ? GIVEN_MALE : GIVEN_FEMALE);
      const family = rand(FAM_NAMES);
      const birthDate = randomBirthDate();
      const bsn = randomBSN();
      const address = randomAddress();
      const profile = rand(ZORGPROFIELEN);
      const indicatie = rand(INDICATIE_TYPES);
      const status = rand(TRAJECT_STATUSSEN);
      const managingOrg = orgIds.length > 0 ? rand(orgIds) : null;

      // Eindatum indicatie: random 0-18 maanden vanaf nu
      const einddatum = new Date();
      einddatum.setMonth(einddatum.getMonth() + randInt(-1, 18));

      const patient = {
        resourceType: 'Patient',
        active: status !== 'uitgeschreven',
        identifier: [
          { system: 'http://fhir.nl/fhir/NamingSystem/bsn', value: bsn },
          { system: 'https://openzorg.nl/NamingSystem/clientnummer', value: `C-${String(existingCount + i + 1).padStart(5, '0')}` },
        ],
        name: [{ family, given: [given] }],
        gender: isMale ? 'male' : 'female',
        birthDate,
        address: [address],
        telecom: [{ system: 'phone', value: `06-${randInt(10000000, 99999999)}` }],
        extension: [
          {
            url: 'https://openzorg.nl/extensions/trajectStatus',
            valueString: status,
          },
          {
            url: 'https://openzorg.nl/extensions/indicatie',
            extension: [
              { url: 'type', valueString: indicatie },
              { url: 'zorgprofiel', valueString: profile },
              { url: 'financiering', valueString: indicatie },
              { url: 'einddatum', valueString: einddatum.toISOString().slice(0, 10) },
            ],
          },
        ],
        ...(managingOrg ? { managingOrganization: { reference: `Organization/${managingOrg}` } } : {}),
      };

      const patientId = await fhirCreate(token, patient);
      created++;

      // ── Signalering voor ~20% ──
      if (patientId && Math.random() < 0.2) {
        const sigCategories = ['valrisico', 'allergie', 'mrsa', 'dieet'];
        const ernst = Math.random() < 0.3 ? 'hoog' : Math.random() < 0.5 ? 'midden' : 'laag';
        await fhirCreate(token, {
          resourceType: 'Flag',
          status: 'active',
          category: [{
            coding: [{
              system: 'https://openzorg.nl/CodeSystem/signalering-categorie',
              code: rand(sigCategories),
              display: 'Signalering',
            }],
          }],
          code: { text: rand(['Valrisico hoog (Morse)', 'Pinda-allergie', 'MRSA positief', 'Diabetes dieet', 'Allergie voor penicilline']) },
          subject: { reference: `Patient/${patientId}` },
          period: { start: new Date().toISOString().split('T')[0] },
          extension: [
            { url: 'https://openzorg.nl/extensions/signalering-ernst', valueString: ernst },
          ],
        }).catch((e) => errors.push(`Signalering voor ${family}: ${e.message}`));
      }

      // ── Allergie voor ~30% ──
      if (patientId && Math.random() < 0.3) {
        const allergies = [
          { text: 'Penicilline', cat: 'medication' },
          { text: 'Pinda', cat: 'food' },
          { text: 'Lactose', cat: 'food' },
          { text: 'Latex', cat: 'environment' },
        ];
        const a = rand(allergies);
        await fhirCreate(token, {
          resourceType: 'AllergyIntolerance',
          clinicalStatus: { coding: [{ code: 'active' }] },
          code: { text: a.text },
          category: [a.cat],
          criticality: Math.random() < 0.2 ? 'high' : 'low',
          patient: { reference: `Patient/${patientId}` },
        }).catch((e) => errors.push(`Allergie voor ${family}: ${e.message}`));
      }

      // ── Rapportage voor ~40% ──
      if (patientId && Math.random() < 0.4) {
        const soepTypes = ['S', 'O', 'E', 'P'];
        const type = rand(soepTypes);
        const texts = {
          S: 'Cliënt geeft aan zich goed te voelen. Geen pijnklachten.',
          O: 'Bloeddruk 130/80, pols 72, temp 36.8. Loopt goed.',
          E: 'Stabiel. Zorgplan doelen op schema.',
          P: 'Voortzetten huidige zorg. Evaluatie over 2 weken.',
        };
        await fhirCreate(token, {
          resourceType: 'Observation',
          status: 'final',
          code: { text: `SOEP-${type}` },
          subject: { reference: `Patient/${patientId}` },
          effectiveDateTime: new Date(Date.now() - randInt(0, 7) * 86400000).toISOString(),
          valueString: texts[type],
        }).catch((e) => errors.push(`Rapportage voor ${family}: ${e.message}`));
      }

      if ((i + 1) % 10 === 0) process.stdout.write(` ${i + 1}`);
    } catch (e) {
      errors.push(`Patient ${i}: ${e.message}`);
    }
  }

  console.log(`\n\n✅ Cliënten klaar: ${created}/${TARGET_CLIENTS} (errors: ${errors.length})`);

  // ── Afspraken (Appointment) ──
  console.log(`\n📅 ${TARGET_APPOINTMENTS} afspraken aanmaken...`);
  const patientsForAppt = await fhirSearch(token, 'Patient', '_count=50&active=true');
  const patientIds = (patientsForAppt.entry ?? []).map((e) => e.resource.id).filter(Boolean);
  const practRes = await fhirSearch(token, 'Practitioner', '_count=30');
  const practIds = (practRes.entry ?? []).map((e) => e.resource.id).filter(Boolean);

  let apptCreated = 0;
  const APPT_TYPES = [
    { code: 'persoonlijke-verzorging', label: 'Persoonlijke verzorging' },
    { code: 'wondverzorging', label: 'Wondverzorging' },
    { code: 'medicatie', label: 'Medicatie aanreiken' },
    { code: 'dagbesteding', label: 'Dagbesteding' },
    { code: 'intakegesprek', label: 'Intakegesprek' },
    { code: 'evaluatie', label: 'Evaluatie zorgplan' },
    { code: 'huisbezoek', label: 'Huisbezoek' },
  ];
  for (let i = 0; i < TARGET_APPOINTMENTS; i++) {
    if (patientIds.length === 0 || practIds.length === 0) break;
    try {
      const daysFromNow = randInt(-2, 14);
      const hour = randInt(8, 17);
      const start = new Date();
      start.setDate(start.getDate() + daysFromNow);
      start.setHours(hour, randInt(0, 3) * 15, 0, 0);
      const end = new Date(start.getTime() + randInt(30, 90) * 60000);
      const type = rand(APPT_TYPES);
      const clientId = rand(patientIds);
      const practId = rand(practIds);
      await fhirCreate(token, {
        resourceType: 'Appointment',
        status: daysFromNow < 0 ? 'fulfilled' : 'booked',
        serviceType: [{ text: type.label }],
        appointmentType: { text: type.label, coding: [{ code: type.code }] },
        start: start.toISOString(),
        end: end.toISOString(),
        participant: [
          { actor: { reference: `Patient/${clientId}` }, status: 'accepted' },
          { actor: { reference: `Practitioner/${practId}` }, status: 'accepted' },
        ],
        description: `${type.label} voor cliënt`,
      });
      apptCreated++;
    } catch (e) {
      errors.push(`Afspraak ${i}: ${e.message}`);
    }
  }
  console.log(`   ✅ ${apptCreated}/${TARGET_APPOINTMENTS} afspraken aangemaakt`);

  // ── Workflow instances (intake-proces) ──
  // Bepaal tenant-id uit token (Medplum geeft projectId via /auth/me)
  // In plaats daarvan: de workflow-bridge zet tenantId zelf via X-Tenant-ID header.
  // We hebben de tenantId in de context nodig. Die halen we via de Medplum profile.
  console.log(`\n⚙️  ${TARGET_INTAKES} workflow-intakes starten...`);
  try {
    const meRes = await fetch(`${MEDPLUM}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    const tenantId = meData.project?.reference?.replace('Project/', '') ?? meData.project?.id;

    if (!tenantId) {
      console.log('   ⚠️  Kon tenant-id niet vinden, skip workflow-intakes');
    } else {
      let intakesCreated = 0;
      for (let i = 0; i < TARGET_INTAKES && i < patientIds.length; i++) {
        try {
          const clientId = patientIds[i];
          const res = await fetch(`${WORKFLOW_BRIDGE}/api/processen/intake-proces/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': tenantId,
            },
            body: JSON.stringify({
              variables: {
                clientId,
                clientNaam: `Test cliënt ${i + 1}`,
              },
            }),
          });
          if (res.ok) intakesCreated++;
        } catch (e) {
          errors.push(`Intake ${i}: ${e.message}`);
        }
      }
      console.log(`   ✅ ${intakesCreated}/${TARGET_INTAKES} intake-processen gestart (taken in werkbak)`);
    }
  } catch (e) {
    console.log(`   ⚠️  Workflow-intakes overgeslagen: ${e.message}`);
  }

  console.log(`\n✅ Klaar!`);
  console.log(`   Totaal errors: ${errors.length}`);
  if (errors.length > 0 && errors.length < 10) {
    console.log('\n⚠️  Fouten:');
    errors.forEach((e) => console.log(`   - ${e}`));
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err);
  process.exit(1);
});
