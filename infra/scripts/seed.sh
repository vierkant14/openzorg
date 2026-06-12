#!/bin/sh
# OpenZorg seed script — runs once after Medplum is healthy.
# Creates master admins + 2 VVT tenant environments with rich test data.
# Uses the FULL Medplum registration flow: newuser → newproject → token exchange.

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"

echo "=== OpenZorg Seed Script ==="
echo "Medplum: $MEDPLUM"

# Install tools if not present (Dockerfile.seed pre-installs these)
command -v curl > /dev/null 2>&1 || apk add --no-cache curl postgresql-client > /dev/null 2>&1

PGHOST="${POSTGRES_HOST:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"
PGDB="${POSTGRES_DB:-openzorg}"
PGUSER="${POSTGRES_USER:-openzorg}"
PGPASSWORD="${POSTGRES_PASSWORD:-openzorg_dev_password}"
export PGPASSWORD

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

# Run the registration + test data creation with Node.js
node -e "
const crypto = require('crypto');

const MEDPLUM = '$MEDPLUM';

// ── Registration helpers ──

async function register(email, password, firstName, lastName, projectName) {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const r1 = await fetch(MEDPLUM + '/auth/newuser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, password, recaptchaToken: '', codeChallenge, codeChallengeMethod: 'S256' })
  });
  const s1 = await r1.json();
  if (!s1.login) {
    console.log('  ' + email + ': newuser failed (HTTP ' + r1.status + ') → ' + JSON.stringify(s1));
    return { accessToken: null, projectId: '' };
  }

  const r2 = await fetch(MEDPLUM + '/auth/newproject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: s1.login, projectName })
  });
  const s2 = await r2.json();
  if (!s2.code) {
    console.log('  ' + email + ': newproject failed (HTTP ' + r2.status + ') → ' + JSON.stringify(s2));
    return { accessToken: null, projectId: '' };
  }

  const r3 = await fetch(MEDPLUM + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&code=' + s2.code + '&code_verifier=' + codeVerifier
  });
  const token = await r3.json();
  const projectId = token.project?.reference?.replace('Project/', '') || '';
  console.log('  ' + email + ': OK (project: ' + projectId + ')');
  return { accessToken: token.access_token || null, projectId };
}

// ── FHIR helper ──

async function fhirCreate(token, resource) {
  if (!token) return null;
  const r = await fetch(MEDPLUM + '/fhir/R4/' + resource.resourceType, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(resource)
  });
  const result = await r.json();
  return result.id || null;
}

// ── Test data creation ──

async function seedTenantData(token, tenantName) {
  if (!token) { console.log('  Skipping test data for ' + tenantName + ' (no token)'); return; }
  console.log('  Creating test data for ' + tenantName + '...');

  // ── Practitioners (20 medewerkers) ──
  const practitioners = [
    // Original 6
    { family: 'de Vries', given: ['Jan'], role: 'tenant-admin', qualification: 'Applicatiebeheerder' },
    { family: 'Bakker', given: ['Annemarie'], role: 'zorgmedewerker', qualification: 'Verzorgende IG' },
    { family: 'van Dijk', given: ['Peter'], role: 'teamleider', qualification: 'Teamleider zorg' },
    { family: 'Smit', given: ['Lisa'], role: 'planner', qualification: 'Planner' },
    { family: 'Hendriks', given: ['Mohammed'], role: 'zorgmedewerker', qualification: 'Verpleegkundige' },
    { family: 'Visser', given: ['Sophie'], role: 'zorgmedewerker', qualification: 'Verzorgende IG' },
    // 14 new
    { family: 'van Leeuwen', given: ['Fatima'], role: 'zorgmedewerker', qualification: 'Wijkverpleegkundige' },
    { family: 'de Jong', given: ['Willem'], role: 'zorgmedewerker', qualification: 'Verpleegkundige' },
    { family: 'Meijer', given: ['Charlotte'], role: 'zorgmedewerker', qualification: 'Verzorgende IG' },
    { family: 'Kuijpers', given: ['Bram'], role: 'teamleider', qualification: 'Teamleider zorg' },
    { family: 'Dijkstra', given: ['Anouk'], role: 'zorgmedewerker', qualification: 'Helpende' },
    { family: 'van der Linden', given: ['Sander'], role: 'zorgmedewerker', qualification: 'Verzorgende IG' },
    { family: 'Groen', given: ['Nadia'], role: 'planner', qualification: 'Planner' },
    { family: 'Vermeer', given: ['Daan'], role: 'zorgmedewerker', qualification: 'Verpleegkundige' },
    { family: 'Koster', given: ['Esther'], role: 'zorgmedewerker', qualification: 'Activiteitenbegeleider' },
    { family: 'Özdemir', given: ['Ayse'], role: 'zorgmedewerker', qualification: 'Verzorgende IG' },
    { family: 'van Beek', given: ['Jeroen'], role: 'zorgmedewerker', qualification: 'Wijkverpleegkundige' },
    { family: 'Willems', given: ['Marjolein'], role: 'zorgmedewerker', qualification: 'Helpende' },
    { family: 'Scholten', given: ['Thijs'], role: 'zorgmedewerker', qualification: 'Verpleegkundige' },
    { family: 'de Wit', given: ['Fleur'], role: 'zorgmedewerker', qualification: 'Activiteitenbegeleider' },
  ];

  const practIds = [];
  for (const p of practitioners) {
    const id = await fhirCreate(token, {
      resourceType: 'Practitioner',
      active: true,
      name: [{ family: p.family, given: p.given }],
      qualification: [{ code: { text: p.qualification } }],
      telecom: [{ system: 'phone', value: '06-' + Math.floor(10000000 + Math.random() * 90000000) }],
    });
    practIds.push(id);
  }
  console.log('    ' + practIds.filter(Boolean).length + ' medewerkers aangemaakt');

  // ── Organisatie (Organization) — root + 2 regios + 6 locaties ──
  const rootOrgId = await fhirCreate(token, {
    resourceType: 'Organization',
    active: true,
    name: tenantName,
    type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'prov', display: 'Healthcare Provider' }] }],
    telecom: [
      { system: 'phone', value: '020-' + Math.floor(1000000 + Math.random() * 9000000), use: 'work' },
      { system: 'email', value: 'info@' + tenantName.toLowerCase().replace(/\\s+/g, '') + '.nl', use: 'work' },
    ],
    address: [{ text: 'Zorgboulevard 1, 1234 AB Amsterdam', city: 'Amsterdam', postalCode: '1234 AB' }],
  });

  // Create 2 regions
  const regioNoordId = rootOrgId ? await fhirCreate(token, {
    resourceType: 'Organization',
    active: true,
    name: 'Regio Noord',
    partOf: { reference: 'Organization/' + rootOrgId },
    type: [{ coding: [{ system: 'https://openzorg.nl/fhir/CodeSystem/locatie-type', code: 'regio', display: 'Regio' }] }],
  }) : null;

  const regioZuidId = rootOrgId ? await fhirCreate(token, {
    resourceType: 'Organization',
    active: true,
    name: 'Regio Zuid',
    partOf: { reference: 'Organization/' + rootOrgId },
    type: [{ coding: [{ system: 'https://openzorg.nl/fhir/CodeSystem/locatie-type', code: 'regio', display: 'Regio' }] }],
  }) : null;

  const locaties = [
    { naam: 'Verpleeghuis Beukenhorst', type: 'verpleeghuis', adres: 'Beukenlaan 42, 1098 AB Amsterdam', tel: '020-5551001', regio: regioNoordId },
    { naam: 'Wijkteam Noord-West', type: 'thuiszorg-team', adres: 'Buikslotermeerplein 3, 1025 XL Amsterdam', tel: '020-5551002', regio: regioNoordId },
    { naam: 'Dagbesteding De Linde', type: 'dagbesteding', adres: 'Lindengracht 88, 1015 KK Amsterdam', tel: '020-5551003', regio: regioNoordId },
    { naam: 'Verpleeghuis Zonneweide', type: 'verpleeghuis', adres: 'Zonnebloemstraat 15, 1076 DE Amsterdam', tel: '020-5552001', regio: regioZuidId },
    { naam: 'Wijkteam Zuid-Oost', type: 'thuiszorg-team', adres: 'Bijlmerdreef 101, 1102 BG Amsterdam', tel: '020-5552002', regio: regioZuidId },
    { naam: 'Revalidatiecentrum Het Park', type: 'revalidatie', adres: 'Vondelpark 7, 1071 AA Amsterdam', tel: '020-5552003', regio: regioZuidId },
  ];
  const locIds = [];
  for (const loc of locaties) {
    if (!loc.regio) continue;
    const locId = await fhirCreate(token, {
      resourceType: 'Organization',
      active: true,
      name: loc.naam,
      partOf: { reference: 'Organization/' + loc.regio },
      type: [{ coding: [{ system: 'https://openzorg.nl/fhir/CodeSystem/locatie-type', code: loc.type, display: loc.type }] }],
      telecom: [{ system: 'phone', value: loc.tel, use: 'work' }],
      address: [{ text: loc.adres }],
    });
    locIds.push(locId);
  }
  console.log('    1 organisatie + 2 regios + ' + locIds.filter(Boolean).length + ' locaties aangemaakt');

  // ── Contracten (PractitionerRole) — 20 medewerkers met contracten, 3-4 per locatie ──
  const contractData = [
    { practIdx: 0, functie: 'Wijkverpleegkundige', uren: 36, fte: 1.0, type: 'vast', start: '2023-06-01', locIdx: 0 },
    { practIdx: 1, functie: 'Verzorgende IG', uren: 32, fte: 0.89, type: 'vast', start: '2024-01-15', locIdx: 0 },
    { practIdx: 2, functie: 'Teamleider zorg', uren: 36, fte: 1.0, type: 'vast', start: '2022-09-01', locIdx: 0 },
    { practIdx: 3, functie: 'Planner', uren: 24, fte: 0.67, type: 'vast', start: '2024-03-01', locIdx: 1 },
    { practIdx: 4, functie: 'Verpleegkundige', uren: 28, fte: 0.78, type: 'bepaalde-tijd', start: '2025-07-01', locIdx: 1 },
    { practIdx: 5, functie: 'Verzorgende IG', uren: 20, fte: 0.56, type: 'oproep', start: '2025-10-15', locIdx: 1 },
    { practIdx: 6, functie: 'Wijkverpleegkundige', uren: 32, fte: 0.89, type: 'vast', start: '2024-06-01', locIdx: 1 },
    { practIdx: 7, functie: 'Verpleegkundige', uren: 36, fte: 1.0, type: 'vast', start: '2023-03-15', locIdx: 2 },
    { practIdx: 8, functie: 'Verzorgende IG', uren: 24, fte: 0.67, type: 'vast', start: '2024-09-01', locIdx: 2 },
    { practIdx: 9, functie: 'Teamleider zorg', uren: 36, fte: 1.0, type: 'vast', start: '2022-01-01', locIdx: 2 },
    { practIdx: 10, functie: 'Helpende', uren: 16, fte: 0.44, type: 'oproep', start: '2025-04-01', locIdx: 3 },
    { practIdx: 11, functie: 'Verzorgende IG', uren: 32, fte: 0.89, type: 'vast', start: '2024-02-01', locIdx: 3 },
    { practIdx: 12, functie: 'Planner', uren: 28, fte: 0.78, type: 'vast', start: '2023-11-01', locIdx: 3 },
    { practIdx: 13, functie: 'Verpleegkundige', uren: 36, fte: 1.0, type: 'vast', start: '2024-05-01', locIdx: 4 },
    { practIdx: 14, functie: 'Activiteitenbegeleider', uren: 24, fte: 0.67, type: 'bepaalde-tijd', start: '2025-08-01', locIdx: 4 },
    { practIdx: 15, functie: 'Verzorgende IG', uren: 28, fte: 0.78, type: 'vast', start: '2024-07-15', locIdx: 4 },
    { practIdx: 16, functie: 'Wijkverpleegkundige', uren: 32, fte: 0.89, type: 'vast', start: '2023-09-01', locIdx: 5 },
    { practIdx: 17, functie: 'Helpende', uren: 20, fte: 0.56, type: 'oproep', start: '2025-12-01', locIdx: 5 },
    { practIdx: 18, functie: 'Verpleegkundige', uren: 36, fte: 1.0, type: 'vast', start: '2024-01-01', locIdx: 5 },
    { practIdx: 19, functie: 'Activiteitenbegeleider', uren: 24, fte: 0.67, type: 'bepaalde-tijd', start: '2025-06-01', locIdx: 2 },
  ];

  let contractCount = 0;
  for (const cd of contractData) {
    if (!practIds[cd.practIdx]) continue;
    const locRef = locIds[cd.locIdx];
    await fhirCreate(token, {
      resourceType: 'PractitionerRole',
      active: true,
      practitioner: { reference: 'Practitioner/' + practIds[cd.practIdx], display: practitioners[cd.practIdx].given[0] + ' ' + practitioners[cd.practIdx].family },
      organization: rootOrgId ? { reference: 'Organization/' + rootOrgId, display: tenantName } : undefined,
      location: locRef ? [{ reference: 'Organization/' + locRef }] : [],
      code: [{ text: cd.functie }],
      extension: [
        { url: 'https://openzorg.nl/extensions/contract-uren', valueDecimal: cd.uren },
        { url: 'https://openzorg.nl/extensions/contract-fte', valueDecimal: cd.fte },
        { url: 'https://openzorg.nl/extensions/contract-type', valueString: cd.type },
        { url: 'https://openzorg.nl/extensions/dienstverband-start', valueDate: cd.start },
        { url: 'https://openzorg.nl/extensions/locatie-naam', valueString: locaties[cd.locIdx].naam },
      ],
    });
    contractCount++;
  }
  console.log('    ' + contractCount + ' contracten (PractitionerRole) aangemaakt');

  // ── Patients (50 clienten) ──
  const straatnamen = [
    'Dorpstraat', 'Kerkweg', 'Hoofdstraat', 'Lindelaan', 'Molenweg', 'Beukenlaan', 'Eikenlaan', 'Kastanjelaan',
    'Rozengracht', 'Tulpstraat', 'Wilgenlaan', 'Esdoornlaan', 'Berkenlaan', 'Populierenlaan', 'Meidoornweg',
    'Hazelaarstraat', 'Elzenpad', 'Iepenlaan', 'Olmstraat', 'Cederlaan', 'Platanenlaan', 'Sparrenlaan',
    'Dennenlaan', 'Larixstraat', 'Notenlaan', 'Kerselaan', 'Pruimenweg', 'Appelstraat', 'Perenlaan',
    'Abrikozenlaan', 'Vijgenboomstraat', 'Olijflaan', 'Cipreslaan', 'Magnolialaan', 'Jasmijnstraat',
    'Seringenweg', 'Hortensiaplein', 'Azalealaan', 'Rhododendronweg', 'Camellialaan', 'Wisterialaan',
    'Lavendellaan', 'Rozemarijnstraat', 'Tijmpad', 'Basilicumlaan', 'Muntstraat', 'Salieplein',
    'Oreganoweg', 'Korianderlaan', 'Peterseliestraat',
  ];
  const steden = [
    'Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere',
    'Breda', 'Nijmegen', 'Apeldoorn', 'Haarlem', 'Arnhem', 'Zaanstad', 'Amersfoort', 'Haarlemmermeer',
    'Den Bosch', 'Zoetermeer', 'Zwolle', 'Leiden', 'Maastricht', 'Dordrecht', 'Ede', 'Leeuwarden',
    'Alphen aan den Rijn', 'Deventer', 'Hilversum', 'Delft', 'Heerlen', 'Venlo', 'Oss', 'Roermond',
    'Gouda', 'Vlaardingen', 'Enschede', 'Helmond', 'Purmerend', 'Schiedam', 'Spijkenisse', 'Kampen',
    'Middelburg', 'Vlissingen', 'Goes', 'Veenendaal', 'Doetinchem', 'Harderwijk', 'Zeist', 'Baarn',
    'Bussum', 'Weesp',
  ];
  const patients = [
    // Original 8 (indices 0-7)
    { family: 'Jansen', given: ['Wilhelmina'], gender: 'female', birthDate: '1938-03-14', bsn: '999901001', indicatie: 'wlz', profiel: 'VV5', marital: 'W', locIdx: 0 },
    { family: 'Pietersen', given: ['Hendrik'], gender: 'male', birthDate: '1942-07-22', bsn: '999901002', indicatie: 'wlz', profiel: 'VV4', marital: 'M', locIdx: 0 },
    { family: 'de Boer', given: ['Maria', 'Elisabeth'], gender: 'female', birthDate: '1945-11-08', bsn: '999901003', indicatie: 'wlz', profiel: 'VV5', marital: 'D', locIdx: 0 },
    { family: 'van den Berg', given: ['Cornelis'], gender: 'male', birthDate: '1950-01-30', bsn: '999901004', indicatie: 'wmo', profiel: 'Begeleiding individueel', marital: 'M', locIdx: 1 },
    { family: 'Mulder', given: ['Johanna'], gender: 'female', birthDate: '1935-06-17', bsn: '999901005', indicatie: 'wlz', profiel: 'VV6', marital: 'W', locIdx: 0 },
    { family: 'de Groot', given: ['Pieter'], gender: 'male', birthDate: '1948-09-03', bsn: '999901006', indicatie: 'wmo', profiel: 'Huishoudelijke hulp', marital: 'M', locIdx: 1 },
    { family: 'Bos', given: ['Geertruida'], gender: 'female', birthDate: '1940-12-25', bsn: '999901007', indicatie: 'wlz', profiel: 'VV5', marital: 'W', locIdx: 3 },
    { family: 'Vos', given: ['Johannes'], gender: 'male', birthDate: '1955-04-11', bsn: '999901008', indicatie: 'wmo', profiel: 'Huishoudelijke hulp', marital: 'M', locIdx: 4 },
    // 42 new clients (indices 8-49)
    { family: 'Dekker', given: ['Adriana'], gender: 'female', birthDate: '1941-02-18', bsn: '999901009', indicatie: 'wlz', profiel: 'VV5', marital: 'W', locIdx: 0 },
    { family: 'van Vliet', given: ['Gerard'], gender: 'male', birthDate: '1947-08-05', bsn: '999901010', indicatie: 'wlz', profiel: 'VV4', marital: 'M', locIdx: 0 },
    { family: 'Scholten', given: ['Hendrika'], gender: 'female', birthDate: '1939-12-30', bsn: '999901011', indicatie: 'wlz', profiel: 'VV7', marital: 'W', locIdx: 0 },
    { family: 'van Houten', given: ['Jacobus'], gender: 'male', birthDate: '1943-05-14', bsn: '999901012', indicatie: 'wlz', profiel: 'VV6', marital: 'M', locIdx: 3 },
    { family: 'Timmermans', given: ['Cornelia'], gender: 'female', birthDate: '1936-09-22', bsn: '999901013', indicatie: 'wlz', profiel: 'VV8', marital: 'W', locIdx: 3 },
    { family: 'Brouwer', given: ['Martinus'], gender: 'male', birthDate: '1944-03-08', bsn: '999901014', indicatie: 'wlz', profiel: 'VV5', marital: 'M', locIdx: 3 },
    { family: 'van der Heijden', given: ['Elisabeth'], gender: 'female', birthDate: '1949-07-19', bsn: '999901015', indicatie: 'wmo', profiel: 'Begeleiding individueel', marital: 'D', locIdx: 1 },
    { family: 'Wolters', given: ['Franciscus'], gender: 'male', birthDate: '1951-11-03', bsn: '999901016', indicatie: 'wmo', profiel: 'Begeleiding groep', marital: 'M', locIdx: 2 },
    { family: 'van Essen', given: ['Wilhelmus'], gender: 'male', birthDate: '1946-01-27', bsn: '999901017', indicatie: 'wlz', profiel: 'VV4', marital: 'M', locIdx: 3 },
    { family: 'Martens', given: ['Johanna', 'Maria'], gender: 'female', birthDate: '1940-06-15', bsn: '999901018', indicatie: 'wlz', profiel: 'VV6', marital: 'W', locIdx: 0 },
    { family: 'van der Wal', given: ['Antonius'], gender: 'male', birthDate: '1953-04-09', bsn: '999901019', indicatie: 'wmo', profiel: 'Huishoudelijke hulp', marital: 'M', locIdx: 4 },
    { family: 'Hermans', given: ['Grietje'], gender: 'female', birthDate: '1937-10-28', bsn: '999901020', indicatie: 'wlz', profiel: 'VV7', marital: 'W', locIdx: 3 },
    { family: 'Klaassen', given: ['Bernardus'], gender: 'male', birthDate: '1948-02-13', bsn: '999901021', indicatie: 'wlz', profiel: 'VV5', marital: 'M', locIdx: 0 },
    { family: 'Hoekstra', given: ['Aaltje'], gender: 'female', birthDate: '1945-08-20', bsn: '999901022', indicatie: 'wlz', profiel: 'VV4', marital: 'D', locIdx: 3 },
    { family: 'Bosman', given: ['Petrus'], gender: 'male', birthDate: '1950-12-06', bsn: '999901023', indicatie: 'wmo', profiel: 'Begeleiding individueel', marital: 'M', locIdx: 1 },
    { family: 'van Kampen', given: ['Geertje'], gender: 'female', birthDate: '1942-04-17', bsn: '999901024', indicatie: 'wlz', profiel: 'VV5', marital: 'W', locIdx: 0 },
    { family: 'Veldman', given: ['Dirk'], gender: 'male', birthDate: '1954-09-25', bsn: '999901025', indicatie: 'wmo', profiel: 'Huishoudelijke hulp', marital: 'M', locIdx: 4 },
    { family: 'Postma', given: ['Jantje'], gender: 'female', birthDate: '1938-01-11', bsn: '999901026', indicatie: 'wlz', profiel: 'VV6', marital: 'W', locIdx: 3 },
    { family: 'de Graaf', given: ['Hendrikus'], gender: 'male', birthDate: '1947-06-03', bsn: '999901027', indicatie: 'wlz', profiel: 'VV4', marital: 'M', locIdx: 0 },
    { family: 'Bouwman', given: ['Antonia'], gender: 'female', birthDate: '1943-11-29', bsn: '999901028', indicatie: 'wlz', profiel: 'VV5', marital: 'D', locIdx: 3 },
    { family: 'van Rijn', given: ['Lambertus'], gender: 'male', birthDate: '1952-03-16', bsn: '999901029', indicatie: 'wmo', profiel: 'Begeleiding groep', marital: 'M', locIdx: 2 },
    { family: 'Evers', given: ['Neeltje'], gender: 'female', birthDate: '1939-07-08', bsn: '999901030', indicatie: 'wlz', profiel: 'VV7', marital: 'W', locIdx: 0 },
    { family: 'Sanders', given: ['Theodorus'], gender: 'male', birthDate: '1946-10-21', bsn: '999901031', indicatie: 'wlz', profiel: 'VV5', marital: 'M', locIdx: 3 },
    { family: 'van Dam', given: ['Clasina'], gender: 'female', birthDate: '1944-05-30', bsn: '999901032', indicatie: 'wlz', profiel: 'VV4', marital: 'W', locIdx: 0 },
    { family: 'Kuiper', given: ['Arie'], gender: 'male', birthDate: '1955-02-07', bsn: '999901033', indicatie: 'wmo', profiel: 'Huishoudelijke hulp', marital: 'M', locIdx: 4 },
    { family: 'van der Meer', given: ['Jacoba'], gender: 'female', birthDate: '1941-09-14', bsn: '999901034', indicatie: 'wlz', profiel: 'VV6', marital: 'D', locIdx: 3 },
    { family: 'Leemans', given: ['Frederik'], gender: 'male', birthDate: '1949-01-23', bsn: '999901035', indicatie: 'wlz', profiel: 'VV4', marital: 'M', locIdx: 0 },
    { family: 'Akkerman', given: ['Dirkje'], gender: 'female', birthDate: '1936-04-05', bsn: '999901036', indicatie: 'wlz', profiel: 'VV8', marital: 'W', locIdx: 3 },
    { family: 'van Dalen', given: ['Gerardus'], gender: 'male', birthDate: '1953-08-18', bsn: '999901037', indicatie: 'wmo', profiel: 'Begeleiding individueel', marital: 'M', locIdx: 1 },
    { family: 'ter Haar', given: ['Arendina'], gender: 'female', birthDate: '1940-12-09', bsn: '999901038', indicatie: 'wlz', profiel: 'VV5', marital: 'W', locIdx: 0 },
    { family: 'Veenstra', given: ['Lubbert'], gender: 'male', birthDate: '1947-03-26', bsn: '999901039', indicatie: 'wlz', profiel: 'VV5', marital: 'M', locIdx: 3 },
    { family: 'Blom', given: ['Stientje'], gender: 'female', birthDate: '1945-07-12', bsn: '999901040', indicatie: 'wlz', profiel: 'VV4', marital: 'D', locIdx: 0 },
    { family: 'van Dongen', given: ['Marinus'], gender: 'male', birthDate: '1951-10-01', bsn: '999901041', indicatie: 'wmo', profiel: 'Huishoudelijke hulp', marital: 'M', locIdx: 4 },
    { family: 'Driessen', given: ['Catharina'], gender: 'female', birthDate: '1938-06-24', bsn: '999901042', indicatie: 'wlz', profiel: 'VV6', marital: 'W', locIdx: 3 },
    { family: 'Gerritsen', given: ['Hendrik', 'Jan'], gender: 'male', birthDate: '1944-11-15', bsn: '999901043', indicatie: 'wlz', profiel: 'VV5', marital: 'M', locIdx: 0 },
    { family: 'van Hees', given: ['Margrieta'], gender: 'female', birthDate: '1942-02-28', bsn: '999901044', indicatie: 'wlz', profiel: 'VV4', marital: 'W', locIdx: 3 },
    { family: 'Nieuwenhuis', given: ['Albertus'], gender: 'male', birthDate: '1956-05-19', bsn: '999901045', indicatie: 'wmo', profiel: 'Begeleiding individueel', marital: 'M', locIdx: 5 },
    { family: 'Kok', given: ['Trijntje'], gender: 'female', birthDate: '1937-08-07', bsn: '999901046', indicatie: 'wlz', profiel: 'VV7', marital: 'W', locIdx: 0 },
    { family: 'van der Veen', given: ['Pieter', 'Jan'], gender: 'male', birthDate: '1948-12-31', bsn: '999901047', indicatie: 'wlz', profiel: 'VV5', marital: 'M', locIdx: 3 },
    { family: 'Prins', given: ['Jannetje'], gender: 'female', birthDate: '1943-04-22', bsn: '999901048', indicatie: 'wlz', profiel: 'VV4', marital: 'D', locIdx: 0 },
    { family: 'Huisman', given: ['Cornelis', 'Johannes'], gender: 'male', birthDate: '1950-09-10', bsn: '999901049', indicatie: 'wmo', profiel: 'Begeleiding groep', marital: 'M', locIdx: 2 },
    { family: 'van Wijk', given: ['Pieternella'], gender: 'female', birthDate: '1941-01-16', bsn: '999901050', indicatie: 'wlz', profiel: 'VV6', marital: 'W', locIdx: 3 },
  ];

  const patientIds = [];
  for (let pi = 0; pi < patients.length; pi++) {
    const p = patients[pi];
    const id = await fhirCreate(token, {
      resourceType: 'Patient',
      active: true,
      name: [{ family: p.family, given: p.given, text: p.given.join(' ') + ' ' + p.family }],
      gender: p.gender,
      birthDate: p.birthDate,
      identifier: [
        { system: 'http://fhir.nl/fhir/NamingSystem/bsn', value: p.bsn },
        { system: 'https://openzorg.nl/NamingSystem/clientnummer', value: 'C-' + String(pi + 1).padStart(5, '0') },
      ],
      telecom: [
        { system: 'phone', value: '0' + Math.floor(100000000 + Math.random() * 900000000), use: 'home' },
        { system: 'phone', value: '06-' + Math.floor(10000000 + Math.random() * 90000000), use: 'mobile' },
      ],
      address: [{
        line: [straatnamen[pi] + ' ' + (pi + 10)],
        postalCode: String(1000 + pi * 37 % 9000) + ' ' + String.fromCharCode(65 + pi % 26) + String.fromCharCode(65 + (pi + 5) % 26),
        city: steden[pi],
      }],
      managingOrganization: locIds[p.locIdx] ? { reference: 'Organization/' + locIds[p.locIdx], display: locaties[p.locIdx].naam } : undefined,
      maritalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus', code: p.marital }] },
      generalPractitioner: practIds[0] ? [{ reference: 'Practitioner/' + practIds[0], display: 'Jan de Vries' }] : [],
      extension: [{
        url: 'https://openzorg.nl/extensions/indicatie',
        extension: [
          { url: 'type', valueString: p.indicatie },
          { url: 'zorgprofiel', valueString: p.profiel },
          { url: 'startdatum', valueString: '2025-01-01' },
        ]
      }],
    });
    patientIds.push(id);
  }
  console.log('    ' + patientIds.filter(Boolean).length + ' clienten aangemaakt');

  // ── CarePlans (zorgplannen) voor 15 clienten ──
  const leefgebieden = ['Lichamelijk welbevinden', 'Psychisch welbevinden', 'Mobiliteit', 'Persoonlijke verzorging', 'Voeding', 'Veiligheid'];
  const carePlanClientIndices = [0, 1, 2, 4, 6, 8, 10, 11, 13, 17, 20, 23, 26, 30, 35];
  const carePlanIds = [];
  for (let ci = 0; ci < carePlanClientIndices.length; ci++) {
    const i = carePlanClientIndices[ci];
    if (!patientIds[i]) continue;
    const cpId = await fhirCreate(token, {
      resourceType: 'CarePlan',
      status: ci < 12 ? 'active' : 'draft',
      intent: 'plan',
      title: 'Individueel zorgplan 2026 - ' + patients[i].given[0] + ' ' + patients[i].family,
      description: 'Zorgplan opgesteld n.a.v. intake en indicatiestelling. Focus op ' + leefgebieden[ci % leefgebieden.length] + '.',
      subject: { reference: 'Patient/' + patientIds[i] },
      period: { start: '2026-01-15', end: '2026-07-15' },
      author: practIds[ci % practIds.length] ? [{ reference: 'Practitioner/' + practIds[ci % practIds.length], display: practitioners[ci % practitioners.length].given[0] + ' ' + practitioners[ci % practitioners.length].family }] : [],
      category: [{ coding: [{ system: 'http://snomed.info/sct', code: '734163000', display: 'Care plan' }] }],
    });
    carePlanIds.push(cpId);

    // 2 doelen per zorgplan
    const allGoalTexts = [
      'Client kan zelfstandig naar het toilet lopen',
      'Client eet minimaal 3 maaltijden per dag',
      'Client voelt zich veilig in thuissituatie',
      'Client heeft regelmatig sociaal contact',
      'Client kan ADL zelfstandig uitvoeren',
      'Valrisico is verminderd',
      'Client ervaart minder pijn',
      'Slaapkwaliteit is verbeterd',
      'Client beweegt minimaal 30 minuten per dag',
      'Decubitus is voorkomen',
      'Continentie is verbeterd',
      'Gewicht is gestabiliseerd',
      'Client kan medicatie zelfstandig innemen',
      'Mantelzorger voelt zich ondersteund',
      'Angstklachten zijn verminderd',
    ];
    for (let g = 0; g < 2; g++) {
      const goalIdx = (ci * 2 + g) % allGoalTexts.length;
      await fhirCreate(token, {
        resourceType: 'Goal',
        lifecycleStatus: ci < 12 ? 'active' : 'proposed',
        description: { text: '[' + leefgebieden[(ci + g) % leefgebieden.length] + '] ' + allGoalTexts[goalIdx] },
        subject: { reference: 'Patient/' + patientIds[i] },
        target: [{ dueDate: '2026-07-01' }],
        addresses: cpId ? [{ reference: 'CarePlan/' + cpId }] : [],
      });
    }
  }
  console.log('    ' + carePlanIds.filter(Boolean).length + ' zorgplannen met doelen aangemaakt');

  // ── Rapportages (Observations) — 20 clienten ──
  const rapportageClientIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 13, 14, 17, 20, 23, 26, 30, 35, 40];
  const soepSubjectief = [
    'Client geeft aan zich goed te voelen.',
    'Client geeft aan zich matig te voelen.',
    'Client geeft aan zich moe te voelen.',
    'Client is onrustig vandaag.',
    'Client voelt zich tevreden.',
    'Client klaagt over pijn in de rug.',
    'Client is somber gestemd.',
    'Client voelt zich duizelig.',
    'Client geeft aan slecht geslapen te hebben.',
    'Client is opgewekt vandaag.',
  ];
  const soepObjectief = [
    'Vitale functies stabiel.',
    'Lichte koorts (37.8 graden).',
    'Bloeddruk verhoogd (155/95).',
    'Huid intact, geen decubitus.',
    'Gewicht stabiel.',
    'Oedeem aan enkels.',
    'Pupillen gelijk en reagerend op licht.',
    'Saturatie 95%.',
    'Pols regelmatig 72/min.',
    'Bloedglucose 8.2 mmol/L.',
  ];
  const soepEvaluatie = [
    'Zorgplan kan ongewijzigd.',
    'Extra controle nodig.',
    'Huisarts inlichten.',
    'Preventieve maatregelen genomen.',
    'Geen bijzonderheden.',
    'Medicatie-evaluatie nodig.',
    'Overleg met fysiotherapeut plannen.',
    'Wondverzorging adequate respons.',
    'Vochtbalans bewaken.',
    'Valpreventie maatregelen handhaven.',
  ];
  const soepPlan = [
    'Continueren huidige zorg.',
    'Temperatuur monitoren.',
    'Overleg met huisarts plannen.',
    'Wisselligging schema handhaven.',
    'Volgende evaluatie over 2 weken.',
    'Extra vochtinname stimuleren.',
    'Medicatie op tijd uitreiken.',
    'Mobilisatieoefeningen continueren.',
    'Mantelzorger informeren.',
    'Nachtcontrole instellen.',
  ];
  const vrijeRapportages = [
    'Bezoek van familie, client was vrolijk.',
    'Client heeft goed gegeten vandaag.',
    'Wisselligging uitgevoerd, geen bijzonderheden.',
    'Medicatie uitgereikt, geen bijwerkingen.',
    'Client heeft deelgenomen aan groepsactiviteit.',
    'Huisarts op bezoek geweest, beleid ongewijzigd.',
    'Client heeft een wandeling gemaakt in de tuin.',
    'Nachtrust was goed, doorgeslagen tot 07:00.',
    'Fysiotherapie sessie uitgevoerd.',
    'Gesprek gehad over wensen rondom levenseinde.',
  ];

  let rapportageCount = 0;
  for (let ri = 0; ri < rapportageClientIndices.length; ri++) {
    const pidx = rapportageClientIndices[ri];
    if (!patientIds[pidx]) continue;
    // SOEP rapportage
    await fhirCreate(token, {
      resourceType: 'Observation',
      status: 'final',
      code: { text: 'soep' },
      subject: { reference: 'Patient/' + patientIds[pidx] },
      effectiveDateTime: new Date(Date.now() - ri * 86400000 * 2).toISOString(),
      extension: [
        { url: 'https://openzorg.nl/extensions/soep/subjectief', valueString: soepSubjectief[ri % soepSubjectief.length] },
        { url: 'https://openzorg.nl/extensions/soep/objectief', valueString: soepObjectief[ri % soepObjectief.length] },
        { url: 'https://openzorg.nl/extensions/soep/evaluatie', valueString: soepEvaluatie[ri % soepEvaluatie.length] },
        { url: 'https://openzorg.nl/extensions/soep/plan', valueString: soepPlan[ri % soepPlan.length] },
      ],
    });
    // Vrije rapportage
    await fhirCreate(token, {
      resourceType: 'Observation',
      status: 'final',
      code: { text: 'vrij' },
      subject: { reference: 'Patient/' + patientIds[pidx] },
      effectiveDateTime: new Date(Date.now() - ri * 86400000).toISOString(),
      valueString: vrijeRapportages[ri % vrijeRapportages.length],
    });
    rapportageCount += 2;
  }
  console.log('    ' + rapportageCount + ' rapportages aangemaakt');

  // ── Medicatie (MedicationRequest) — 25 clienten ──
  const medicaties = [
    { patient: 0, naam: 'Metoprolol 50mg', dosering: '1x daags 1 tablet', reden: 'Hypertensie' },
    { patient: 0, naam: 'Omeprazol 20mg', dosering: '1x daags voor ontbijt', reden: 'Maagbescherming' },
    { patient: 1, naam: 'Acenocoumarol', dosering: 'Volgens trombosedienst', reden: 'Tromboseprofylaxe' },
    { patient: 2, naam: 'Paracetamol 500mg', dosering: 'Max 4x daags 1-2 tabletten', reden: 'Pijnbestrijding' },
    { patient: 2, naam: 'Furosemide 40mg', dosering: '1x daags ochtend', reden: 'Hartfalen' },
    { patient: 3, naam: 'Metformine 850mg', dosering: '2x daags bij de maaltijd', reden: 'Diabetes mellitus type 2' },
    { patient: 4, naam: 'Oxazepam 10mg', dosering: 'Zo nodig 1 tablet voor de nacht', reden: 'Slaapproblemen' },
    { patient: 5, naam: 'Amlodipine 5mg', dosering: '1x daags 1 tablet', reden: 'Hypertensie' },
    { patient: 6, naam: 'Diclofenac 50mg', dosering: '3x daags 1 tablet bij de maaltijd', reden: 'Artrose' },
    { patient: 6, naam: 'Omeprazol 20mg', dosering: '1x daags voor ontbijt', reden: 'Maagbescherming bij NSAID' },
    { patient: 8, naam: 'Simvastatine 40mg', dosering: '1x daags avond', reden: 'Hypercholesterolemie' },
    { patient: 9, naam: 'Metoprolol 100mg', dosering: '1x daags 1 tablet', reden: 'Hartfalen' },
    { patient: 9, naam: 'Furosemide 40mg', dosering: '1x daags ochtend', reden: 'Oedeem' },
    { patient: 10, naam: 'Haloperidol 1mg', dosering: '2x daags 1 tablet', reden: 'Dementie met onrust' },
    { patient: 11, naam: 'Insuline Lantus', dosering: '1x daags 16E subcutaan avond', reden: 'Diabetes mellitus type 2' },
    { patient: 13, naam: 'Rivaroxaban 20mg', dosering: '1x daags bij de maaltijd', reden: 'Boezemfibrilleren' },
    { patient: 14, naam: 'Paracetamol 1000mg', dosering: '3x daags 1 tablet', reden: 'Chronische pijn' },
    { patient: 17, naam: 'Metformine 500mg', dosering: '2x daags bij de maaltijd', reden: 'Diabetes mellitus type 2' },
    { patient: 17, naam: 'Enalapril 10mg', dosering: '1x daags 1 tablet', reden: 'Hypertensie' },
    { patient: 20, naam: 'Digoxine 0.125mg', dosering: '1x daags 1 tablet', reden: 'Hartfalen' },
    { patient: 23, naam: 'Temazepam 10mg', dosering: '1 tablet voor de nacht', reden: 'Insomnie' },
    { patient: 26, naam: 'Acetylsalicylzuur 80mg', dosering: '1x daags 1 tablet', reden: 'Secundaire preventie CVA' },
    { patient: 30, naam: 'Prednison 5mg', dosering: '1x daags ochtend', reden: 'Reumatoide artritis' },
    { patient: 35, naam: 'Memantine 10mg', dosering: '1x daags 1 tablet', reden: 'Dementie' },
    { patient: 40, naam: 'Pantoprazol 40mg', dosering: '1x daags voor ontbijt', reden: 'Reflux' },
    { patient: 40, naam: 'Metoprolol 50mg', dosering: '1x daags 1 tablet', reden: 'Hypertensie' },
    { patient: 45, naam: 'Morphine slow release 10mg', dosering: '2x daags 1 tablet', reden: 'Chronische pijn' },
    { patient: 45, naam: 'Macrogol', dosering: '1x daags 1 sachet opgelost in water', reden: 'Obstipatie bij opioiden' },
  ];

  let medCount = 0;
  for (const m of medicaties) {
    if (!patientIds[m.patient]) continue;
    await fhirCreate(token, {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: { text: m.naam },
      subject: { reference: 'Patient/' + patientIds[m.patient] },
      dosageInstruction: [{ text: m.dosering }],
      reasonCode: [{ text: m.reden }],
      authoredOn: '2026-01-15',
    });
    medCount++;
  }
  console.log('    ' + medCount + ' medicatievoorschriften aangemaakt');

  // ── Allergieën — 10 clienten ──
  const allergieen = [
    { patient: 0, substance: 'Penicilline', reaction: 'Huiduitslag', category: 'medication' },
    { patient: 1, substance: 'Jodium', reaction: 'Anafylactische reactie', category: 'medication' },
    { patient: 2, substance: 'Noten', reaction: 'Benauwdheid', category: 'food' },
    { patient: 4, substance: 'Latex', reaction: 'Contactdermatitis', category: 'environment' },
    { patient: 8, substance: 'Cotrimoxazol', reaction: 'Exantheem', category: 'medication' },
    { patient: 10, substance: 'Eieren', reaction: 'Maag-darmklachten', category: 'food' },
    { patient: 13, substance: 'Diclofenac', reaction: 'Astma-aanval', category: 'medication' },
    { patient: 20, substance: 'Amoxicilline', reaction: 'Urticaria', category: 'medication' },
    { patient: 30, substance: 'Gluten', reaction: 'Buikpijn en diarree', category: 'food' },
    { patient: 35, substance: 'Paracetamol', reaction: 'Leverfunctiestoornissen', category: 'medication' },
  ];

  let allergieCount = 0;
  for (const a of allergieen) {
    if (!patientIds[a.patient]) continue;
    await fhirCreate(token, {
      resourceType: 'AllergyIntolerance',
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] },
      type: 'allergy',
      category: [a.category],
      patient: { reference: 'Patient/' + patientIds[a.patient] },
      code: { text: a.substance },
      reaction: [{ manifestation: [{ text: a.reaction }] }],
    });
    allergieCount++;
  }
  console.log('    ' + allergieCount + ' allergieen aangemaakt');

  // ── Vaccinaties — 15 clienten ──
  const vaccinaties = [
    { patient: 0, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-15', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-15', geldigTot: '2026-10-15' },
    { patient: 0, vaccine: 'COVID-19 (booster 2025)', code: 'J07BX03', datum: '2025-09-01', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-09-01', geldigTot: '2026-09-01' },
    { patient: 1, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-20', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-20', geldigTot: '2026-10-20' },
    { patient: 2, vaccine: 'Pneumokokken', code: 'J07AL', datum: '2025-03-10', herhalend: false, frequentie: 'eenmalig', volgendeDatum: '', geldigTot: '' },
    { patient: 4, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-18', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-18', geldigTot: '2026-10-18' },
    { patient: 4, vaccine: 'Zona (gordelroos)', code: 'J07BK03', datum: '2025-05-22', herhalend: false, frequentie: 'eenmalig', volgendeDatum: '', geldigTot: '' },
    { patient: 6, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-22', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-22', geldigTot: '2026-10-22' },
    { patient: 8, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-25', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-25', geldigTot: '2026-10-25' },
    { patient: 10, vaccine: 'COVID-19 (booster 2025)', code: 'J07BX03', datum: '2025-09-05', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-09-05', geldigTot: '2026-09-05' },
    { patient: 11, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-28', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-28', geldigTot: '2026-10-28' },
    { patient: 13, vaccine: 'Pneumokokken', code: 'J07AL', datum: '2025-04-15', herhalend: false, frequentie: 'eenmalig', volgendeDatum: '', geldigTot: '' },
    { patient: 17, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-30', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-30', geldigTot: '2026-10-30' },
    { patient: 20, vaccine: 'COVID-19 (booster 2025)', code: 'J07BX03', datum: '2025-09-10', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-09-10', geldigTot: '2026-09-10' },
    { patient: 26, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-11-01', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-11-01', geldigTot: '2026-11-01' },
    { patient: 35, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-11-05', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-11-05', geldigTot: '2026-11-05' },
    { patient: 35, vaccine: 'Zona (gordelroos)', code: 'J07BK03', datum: '2025-06-10', herhalend: false, frequentie: 'eenmalig', volgendeDatum: '', geldigTot: '' },
    { patient: 40, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-11-08', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-11-08', geldigTot: '2026-11-08' },
    { patient: 45, vaccine: 'COVID-19 (booster 2025)', code: 'J07BX03', datum: '2025-09-15', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-09-15', geldigTot: '2026-09-15' },
  ];

  let vacCount = 0;
  for (const v of vaccinaties) {
    if (!patientIds[v.patient]) continue;
    const extensions = [
      { url: 'https://openzorg.nl/extensions/herhalend', valueBoolean: v.herhalend },
      { url: 'https://openzorg.nl/extensions/frequentie', valueString: v.frequentie },
    ];
    if (v.volgendeDatum) {
      extensions.push({ url: 'https://openzorg.nl/extensions/volgende-datum', valueDate: v.volgendeDatum });
    }
    if (v.geldigTot) {
      extensions.push({ url: 'https://openzorg.nl/extensions/geldig-tot', valueDate: v.geldigTot });
    }
    await fhirCreate(token, {
      resourceType: 'Immunization',
      status: 'completed',
      vaccineCode: { coding: [{ system: 'http://www.whocc.no/atc', code: v.code, display: v.vaccine }], text: v.vaccine },
      patient: { reference: 'Patient/' + patientIds[v.patient] },
      occurrenceDateTime: v.datum,
      recorded: v.datum,
      primarySource: true,
      extension: extensions,
    });
    vacCount++;
  }
  console.log('    ' + vacCount + ' vaccinaties aangemaakt');

  // ── Contactpersonen — 30 clienten ──
  const contactpersonen = [
    { patient: 0, family: 'Jansen', given: ['Karel'], relation: 'Zoon', phone: '06-12345678' },
    { patient: 0, family: 'Jansen-Smit', given: ['Anja'], relation: 'Schoondochter', phone: '06-87654321' },
    { patient: 1, family: 'Pietersen', given: ['Marieke'], relation: 'Dochter', phone: '06-11223344' },
    { patient: 2, family: 'de Boer', given: ['Thomas'], relation: 'Zoon', phone: '06-55667788' },
    { patient: 3, family: 'van den Berg', given: ['Sandra'], relation: 'Dochter', phone: '06-22334455' },
    { patient: 4, family: 'Mulder', given: ['Ingrid'], relation: 'Dochter', phone: '06-99887766' },
    { patient: 5, family: 'de Groot', given: ['Anna'], relation: 'Echtgenote', phone: '06-33445566' },
    { patient: 6, family: 'Bos', given: ['Henk'], relation: 'Zoon', phone: '06-44556677' },
    { patient: 7, family: 'Vos', given: ['Wilma'], relation: 'Echtgenote', phone: '06-55667789' },
    { patient: 8, family: 'Dekker', given: ['Ruud'], relation: 'Zoon', phone: '06-66778890' },
    { patient: 9, family: 'van Vliet', given: ['Monique'], relation: 'Dochter', phone: '06-77889901' },
    { patient: 10, family: 'Scholten', given: ['Bert'], relation: 'Zoon', phone: '06-88990012' },
    { patient: 11, family: 'van Houten', given: ['Ria'], relation: 'Echtgenote', phone: '06-99001123' },
    { patient: 12, family: 'Timmermans', given: ['Jan'], relation: 'Neef', phone: '06-10112234' },
    { patient: 13, family: 'Brouwer', given: ['Karin'], relation: 'Echtgenote', phone: '06-11223345' },
    { patient: 14, family: 'van der Heijden', given: ['Mark'], relation: 'Zoon', phone: '06-12334456' },
    { patient: 17, family: 'Martens', given: ['Lies'], relation: 'Dochter', phone: '06-13445567' },
    { patient: 18, family: 'van der Wal', given: ['Petra'], relation: 'Echtgenote', phone: '06-14556678' },
    { patient: 20, family: 'Hermans', given: ['Jos'], relation: 'Zoon', phone: '06-15667789' },
    { patient: 23, family: 'Hoekstra', given: ['Diana'], relation: 'Dochter', phone: '06-16778890' },
    { patient: 25, family: 'Veldman', given: ['Corrie'], relation: 'Echtgenote', phone: '06-17889901' },
    { patient: 26, family: 'Postma', given: ['Gert'], relation: 'Zoon', phone: '06-18990012' },
    { patient: 28, family: 'Bouwman', given: ['Tineke'], relation: 'Dochter', phone: '06-19001123' },
    { patient: 30, family: 'Evers', given: ['Wim'], relation: 'Zoon', phone: '06-20112234' },
    { patient: 33, family: 'van Dam', given: ['Loes'], relation: 'Dochter', phone: '06-21223345' },
    { patient: 35, family: 'van der Meer', given: ['Frank'], relation: 'Zoon', phone: '06-22334456' },
    { patient: 37, family: 'Akkerman', given: ['Margot'], relation: 'Dochter', phone: '06-23445567' },
    { patient: 40, family: 'Veenstra', given: ['Pieter'], relation: 'Echtgenoot', phone: '06-24556678' },
    { patient: 43, family: 'Gerritsen', given: ['Ans'], relation: 'Echtgenote', phone: '06-25667789' },
    { patient: 45, family: 'Kok', given: ['Edwin'], relation: 'Zoon', phone: '06-26778890' },
    { patient: 47, family: 'van der Veen', given: ['Joke'], relation: 'Dochter', phone: '06-27889901' },
    { patient: 49, family: 'van Wijk', given: ['Rob'], relation: 'Zoon', phone: '06-28990012' },
  ];

  let contactCount = 0;
  for (const cp of contactpersonen) {
    if (!patientIds[cp.patient]) continue;
    await fhirCreate(token, {
      resourceType: 'RelatedPerson',
      active: true,
      patient: { reference: 'Patient/' + patientIds[cp.patient] },
      name: [{ family: cp.family, given: cp.given }],
      relationship: [{ coding: [{ display: cp.relation }] }],
      telecom: [{ system: 'phone', value: cp.phone }],
    });
    contactCount++;
  }
  console.log('    ' + contactCount + ' contactpersonen aangemaakt');

  // ── Diagnoses (Condition) — 20 clienten ──
  const diagnoses = [
    { patient: 0, code: '38341003', display: 'Hypertensie', onset: '2018-05-10' },
    { patient: 1, code: '84114007', display: 'Hartfalen', onset: '2020-11-03' },
    { patient: 2, code: '52448006', display: 'Dementie', onset: '2023-02-15' },
    { patient: 3, code: '73211009', display: 'Diabetes mellitus', onset: '2019-08-22' },
    { patient: 4, code: '396275006', display: 'Osteoporose', onset: '2021-04-18' },
    { patient: 5, code: '38341003', display: 'Hypertensie', onset: '2017-09-30' },
    { patient: 6, code: '69896004', display: 'Reumatoide artritis', onset: '2022-01-12' },
    { patient: 8, code: '13645005', display: 'COPD', onset: '2020-06-25' },
    { patient: 9, code: '84114007', display: 'Hartfalen', onset: '2021-03-08' },
    { patient: 10, code: '52448006', display: 'Dementie', onset: '2024-01-20' },
    { patient: 11, code: '73211009', display: 'Diabetes mellitus', onset: '2018-12-05' },
    { patient: 13, code: '40425004', display: 'CVA (beroerte)', onset: '2023-07-14' },
    { patient: 17, code: '73211009', display: 'Diabetes mellitus', onset: '2020-03-10' },
    { patient: 17, code: '38341003', display: 'Hypertensie', onset: '2019-11-22' },
    { patient: 20, code: '84114007', display: 'Hartfalen', onset: '2022-08-05' },
    { patient: 23, code: '35489007', display: 'Depressieve stoornis', onset: '2023-05-18' },
    { patient: 26, code: '40425004', display: 'CVA (beroerte)', onset: '2024-02-28' },
    { patient: 30, code: '69896004', display: 'Reumatoide artritis', onset: '2019-07-15' },
    { patient: 35, code: '52448006', display: 'Dementie', onset: '2024-06-10' },
    { patient: 40, code: '38341003', display: 'Hypertensie', onset: '2016-10-20' },
    { patient: 40, code: '197480006', display: 'Angststoornis', onset: '2021-01-05' },
    { patient: 45, code: '396275006', display: 'Osteoporose', onset: '2020-09-12' },
  ];

  let diagnoseCount = 0;
  for (const d of diagnoses) {
    if (!patientIds[d.patient]) continue;
    await fhirCreate(token, {
      resourceType: 'Condition',
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
      code: { coding: [{ system: 'http://snomed.info/sct', code: d.code, display: d.display }], text: d.display },
      subject: { reference: 'Patient/' + patientIds[d.patient] },
      onsetDateTime: d.onset,
    });
    diagnoseCount++;
  }
  console.log('    ' + diagnoseCount + ' diagnoses aangemaakt');

  // ── Afspraken (Appointments) ──
  const now = new Date();
  let afspraakCount = 0;
  const afspraakBeschrijvingen = ['Ochtendzorg', 'Wondverzorging', 'Medicatie-uitgifte', 'ADL begeleiding', 'Evaluatiegesprek', 'Fysiotherapie', 'Avondzorg', 'Insuline toediening', 'Bloeddrukmeting', 'Stoma verzorging'];
  for (let i = 0; i < 10; i++) {
    if (!patientIds[i]) continue;
    const startDate = new Date(now.getTime() + (i - 3) * 86400000);
    startDate.setHours(7 + i, 0, 0);
    const endDate = new Date(startDate.getTime() + 3600000);
    await fhirCreate(token, {
      resourceType: 'Appointment',
      status: i < 3 ? 'fulfilled' : 'booked',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      description: afspraakBeschrijvingen[i],
      participant: [
        { actor: { reference: 'Patient/' + patientIds[i], display: patients[i].given[0] + ' ' + patients[i].family }, status: 'accepted' },
        ...(practIds[i % practIds.length] ? [{ actor: { reference: 'Practitioner/' + practIds[i % practIds.length] }, status: 'accepted' }] : []),
      ],
    });
    afspraakCount++;
  }
  console.log('    ' + afspraakCount + ' afspraken aangemaakt');

  // ── Berichten (Communication) ──
  const berichtData = [
    { from: 0, to: 2, onderwerp: 'Overdracht avonddienst', bericht: 'Mevrouw Jansen was vanavond onrustig. Extra aandacht bij de ochtendzorg svp. Vitale functies zijn stabiel, geen bijzonderheden met medicatie.', daysAgo: 0 },
    { from: 2, to: 0, onderwerp: 'Re: Overdracht avonddienst', bericht: 'Bedankt voor de overdracht. Ik neem dit mee in de ochtendzorg. Wordt ze misschien onrustig door de medicatiewijziging van vorige week?', daysAgo: 0 },
    { from: 1, to: 3, onderwerp: 'Planning volgende week', bericht: 'Kun je de planning voor volgende week aanpassen? Ik kan woensdag niet. Ruilen met donderdag zou ideaal zijn.', daysAgo: 1 },
    { from: 3, to: 1, onderwerp: 'Re: Planning volgende week', bericht: 'Is geregeld. Je staat nu ingepland op donderdag. Woensdag neemt Sophie over.', daysAgo: 1 },
    { from: 0, to: 4, onderwerp: 'MDO volgende week dinsdag', bericht: 'Herinnering: MDO voor mevrouw De Boer staat gepland voor dinsdag 10:00. Graag voorbereid komen met evaluatie zorgdoelen.', daysAgo: 2 },
    { from: 5, to: 0, onderwerp: 'Nieuwe client intake', bericht: 'Er is een nieuwe aanmelding binnengekomen voor thuiszorg. Dhr. Van der Berg, 74 jaar, indicatie Wmo begeleiding individueel. Kun jij de intake plannen?', daysAgo: 3 },
    { from: 6, to: 9, onderwerp: 'Valincident mevrouw Scholten', bericht: 'Mevrouw Scholten is gevallen in de gang. Geen zichtbaar letsel, wel geschrokken. MIC-melding is gemaakt. Graag extra valpreventie maatregelen bespreken.', daysAgo: 1 },
    { from: 7, to: 12, onderwerp: 'Vraag over medicatie dhr. Klaassen', bericht: 'Dhr. Klaassen klaagt over maagklachten na de nieuwe medicatie. Moeten we de huisarts bellen of is dit een bekende bijwerking?', daysAgo: 0 },
  ];

  let berichtCount = 0;
  for (const b of berichtData) {
    if (!practIds[b.from] || !practIds[b.to]) continue;
    const sentDate = new Date(Date.now() - b.daysAgo * 86400000);
    sentDate.setHours(8 + berichtCount, 30, 0);
    await fhirCreate(token, {
      resourceType: 'Communication',
      status: 'completed',
      sent: sentDate.toISOString(),
      sender: { reference: 'Practitioner/' + practIds[b.from], display: practitioners[b.from].given[0] + ' ' + practitioners[b.from].family },
      recipient: [{ reference: 'Practitioner/' + practIds[b.to], display: practitioners[b.to].given[0] + ' ' + practitioners[b.to].family }],
      payload: [{ contentString: b.bericht }],
      topic: { text: b.onderwerp },
      ...(berichtCount < 4 ? { received: sentDate.toISOString() } : {}),
    });
    berichtCount++;
  }
  console.log('    ' + berichtCount + ' berichten aangemaakt');

  // ── Wachtlijst (ServiceRequest draft) ──
  const wachtlijstItems = [
    { patientIdx: 45, priority: 'urgent', reden: 'Toenemende zorgbehoefte, thuissituatie niet meer veilig', toelichting: 'Mantelzorger overbelast, client heeft WLZ indicatie VV7 maar verblijft nog thuis. Spoedplaatsing nodig.', datum: '2026-03-15' },
    { patientIdx: 47, priority: 'routine', reden: 'Wens tot opname verpleeghuis', toelichting: 'Client en familie wensen opname. Huidige thuiszorg situatie stabiel maar niet meer gewenst.', datum: '2026-03-20' },
    { patientIdx: 49, priority: 'asap', reden: 'Herindicatie met hogere zorgzwaarte', toelichting: 'Indicatie bijgesteld van VV5 naar VV6. Huidige locatie kan niet voldoende zorg leveren.', datum: '2026-03-22' },
    { patientIdx: 41, priority: 'routine', reden: 'Aanmelding dagbesteding', toelichting: 'Client komt in aanmerking voor dagbesteding 3 dagen per week. Wacht op plek bij De Linde.', datum: '2026-03-25' },
    { patientIdx: 43, priority: 'urgent', reden: 'Overplaatsing na ziekenhuisopname', toelichting: 'Client wordt ontslagen uit ziekenhuis na heupfractuur. Revalidatieplek nodig, bij voorkeur Het Park.', datum: '2026-04-01' },
    { patientIdx: 39, priority: 'asap', reden: 'Uitbreiding thuiszorg uren', toelichting: 'Partner overleden, client heeft meer ondersteuning nodig. Wacht op beschikbaarheid wijkteam.', datum: '2026-04-05' },
  ];

  let wachtlijstCount = 0;
  for (const w of wachtlijstItems) {
    if (!patientIds[w.patientIdx]) continue;
    await fhirCreate(token, {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'proposal',
      subject: { reference: 'Patient/' + patientIds[w.patientIdx], display: patients[w.patientIdx].given[0] + ' ' + patients[w.patientIdx].family },
      priority: w.priority,
      reasonCode: [{ text: w.reden }],
      authoredOn: w.datum,
      note: [{ text: w.toelichting }],
    });
    wachtlijstCount++;
  }
  console.log('    ' + wachtlijstCount + ' wachtlijst entries aangemaakt');

  // ── Schedule + Slot (roosters) — 20 medewerkers ──
  const scheduleIds = [];
  for (let si = 0; si < practitioners.length; si++) {
    if (!practIds[si]) continue;
    const schedId = await fhirCreate(token, {
      resourceType: 'Schedule',
      active: true,
      actor: [{ reference: 'Practitioner/' + practIds[si], display: practitioners[si].given[0] + ' ' + practitioners[si].family }],
      planningHorizon: { start: new Date(now.getTime() - 86400000).toISOString(), end: new Date(now.getTime() + 5 * 86400000).toISOString() },
    });
    scheduleIds.push(schedId);

    // 5 slots per medewerker (mon-fri, 2-hour blocks)
    for (let day = 0; day < 5; day++) {
      const slotStart = new Date(now.getTime() + (day - 2) * 86400000);
      const startHour = 7 + (si % 5) * 2;
      slotStart.setHours(startHour, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + 2 * 3600000);
      const isBusy = (si + day) % 3 === 0;
      await fhirCreate(token, {
        resourceType: 'Slot',
        schedule: { reference: 'Schedule/' + schedId },
        status: isBusy ? 'busy' : 'free',
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      });
    }
  }
  console.log('    ' + scheduleIds.filter(Boolean).length + ' roosters met slots aangemaakt');

  // ── Codelijsten (ValueSet) — starter lijsten met veelvoorkomende codes ──
  const codelijsten = [
    {
      type: 'diagnoses',
      naam: 'Veelvoorkomende diagnoses',
      codes: [
        { code: '73211009', display: 'Diabetes mellitus' },
        { code: '38341003', display: 'Hypertensie' },
        { code: '84114007', display: 'Hartfalen' },
        { code: '13645005', display: 'COPD' },
        { code: '52448006', display: 'Dementie' },
        { code: '40425004', display: 'CVA (beroerte)' },
        { code: '396275006', display: 'Osteoporose' },
        { code: '69896004', display: 'Reumatoide artritis' },
        { code: '35489007', display: 'Depressieve stoornis' },
        { code: '197480006', display: 'Angststoornis' },
      ]
    },
    {
      type: 'allergieen',
      naam: 'Veelvoorkomende allergieen',
      codes: [
        { code: '91936005', display: 'Penicilline-allergie' },
        { code: '294505008', display: 'Allergie voor paracetamol' },
        { code: '300916003', display: 'Latex-allergie' },
        { code: '91935009', display: 'Allergie voor jodium' },
        { code: '91934008', display: 'Allergie voor noten' },
        { code: '418689008', display: 'Allergie voor eieren' },
        { code: '425525006', display: 'Allergie voor tarwe (gluten)' },
      ]
    },
    {
      type: 'verrichtingen',
      naam: 'Veelvoorkomende verrichtingen',
      codes: [
        { code: '225358003', display: 'Wondverzorging' },
        { code: '18629005', display: 'Bloeddrukmeting' },
        { code: '33747003', display: 'Bloedglucosemeting' },
        { code: '225444004', display: 'Katheterisatie' },
        { code: '385949008', display: 'Stoma verzorging' },
        { code: '225386006', display: 'Sondevoeding toedienen' },
        { code: '182813001', display: 'Compressietherapie' },
        { code: '225365006', display: 'Decubituspreventie' },
      ]
    },
    {
      type: 'medicatie',
      naam: 'Veelvoorkomende medicatie',
      codes: [
        { code: '387207008', display: 'Metoprolol' },
        { code: '372756006', display: 'Omeprazol' },
        { code: '387517004', display: 'Paracetamol' },
        { code: '372567009', display: 'Metformine' },
        { code: '387530003', display: 'Furosemide' },
        { code: '387458008', display: 'Acenocoumarol' },
        { code: '387106007', display: 'Oxazepam' },
        { code: '373254001', display: 'Diclofenac' },
        { code: '372584003', display: 'Amlodipine' },
      ]
    },
  ];

  let codeCount = 0;
  for (const cl of codelijsten) {
    await fhirCreate(token, {
      resourceType: 'ValueSet',
      name: 'codelijst-' + cl.type,
      title: cl.naam,
      status: 'active',
      url: 'https://openzorg.nl/fhir/ValueSet/codelijst-' + cl.type,
      compose: {
        include: [{
          system: 'http://snomed.info/sct',
          concept: cl.codes.map(function(code) { return { code: code.code, display: code.display }; }),
        }],
      },
    });
    codeCount++;
  }
  console.log('    ' + codeCount + ' codelijsten aangemaakt');

  console.log('  Test data voor ' + tenantName + ' compleet!');
}

// ── Main ──

(async () => {
  console.log('');
  console.log('Registering users...');

  // Master admins (elk een eigen project/environment)
  const admin = await register('admin@openzorg.nl', 'Oz!Adm1n#2026mXq7', 'Super', 'Admin', 'OpenZorg Master');
  await register('kevin@openzorg.nl', 'Oz!K3v1n#2026xYp4', 'Kevin', 'Admin', 'Kevin Workspace');
  await register('meneka@openzorg.nl', 'Oz!M3n3k4#2026wZr7', 'Meneka', 'Admin', 'Meneka Workspace');

  // Tenant 1: Zorggroep Horizon (grotere VVT-instelling)
  console.log('');
  console.log('--- Tenant 1: Zorggroep Horizon ---');
  const horizon = await register('jan@horizon.nl', 'Hz!J4n#2026pKw8', 'Jan', 'de Vries', 'Zorggroep Horizon');
  await seedTenantData(horizon.accessToken, 'Zorggroep Horizon');

  // Tenant 2: Thuiszorg De Linde (kleinere thuiszorg)
  console.log('');
  console.log('--- Tenant 2: Thuiszorg De Linde ---');
  const linde = await register('maria@delinde.nl', 'Ld!M4r1a#2026nRt5', 'Maria', 'Jansen', 'Thuiszorg De Linde');
  await seedTenantData(linde.accessToken, 'Thuiszorg De Linde');

  // Write Medplum project IDs to temp file for psql update
  const fs = require('fs');
  const lines = [];
  if (horizon.projectId) lines.push('zorggroep-horizon=' + horizon.projectId);
  if (linde.projectId) lines.push('thuiszorg-de-linde=' + linde.projectId);
  fs.writeFileSync('/tmp/tenant-project-ids.txt', lines.join('\\n') + '\\n');

  console.log('');
  console.log('=========================================');
  console.log('  OpenZorg Seed Complete');
  console.log('=========================================');
  console.log('');
  console.log('Master Admin accounts:');
  console.log('  admin@openzorg.nl   / Oz!Adm1n#2026mXq7');
  console.log('  kevin@openzorg.nl   / Oz!K3v1n#2026xYp4');
  console.log('  meneka@openzorg.nl  / Oz!M3n3k4#2026wZr7');
  console.log('');
  console.log('Tenant accounts:');
  console.log('  Zorggroep Horizon:  jan@horizon.nl    / Hz!J4n#2026pKw8');
  console.log('  Thuiszorg De Linde: maria@delinde.nl  / Ld!M4r1a#2026nRt5');
  console.log('');
  console.log('Per tenant: 20 medewerkers, 20 contracten, 50 clienten, 15 zorgplannen,');
  console.log('  40 rapportages, 28 medicaties, 10 allergieen, 18 vaccinaties,');
  console.log('  32 contactpersonen, 22 diagnoses, 10 afspraken,');
  console.log('  1 organisatie + 2 regios + 6 locaties, 8 berichten,');
  console.log('  6 wachtlijst entries, 20 roosters met slots, 4 codelijsten');
  console.log('');
  console.log('Open http://localhost:3000/login');
  console.log('=========================================');
})();
"

# ── Deploy workflow processes to Flowable ──
echo ""
echo "=== Deploying workflow processes to Flowable ==="

FLOWABLE_BASE="${FLOWABLE_BASE_URL:-http://flowable:8080/flowable-rest}"
FLOWABLE_AUTH="admin:admin"

wait_for_flowable() {
  echo "Waiting for Flowable..."
  for i in $(seq 1 60); do
    if curl -sf -u "$FLOWABLE_AUTH" "$FLOWABLE_BASE/service/management/engine" > /dev/null 2>&1; then
      echo "Flowable is ready."
      return 0
    fi
    sleep 3
  done
  echo "WARNING: Flowable not reachable after 180s — skipping workflow seeding"
  return 1
}

deploy_bpmn() {
  local name="$1"
  local xml="$2"
  local tmpfile="/tmp/${name}.bpmn20.xml"
  printf '%s' "$xml" > "$tmpfile"
  local result
  result=$(curl -sf -u "$FLOWABLE_AUTH" \
    -F "file=@${tmpfile};type=application/xml" \
    "$FLOWABLE_BASE/service/repository/deployments" 2>&1)
  if [ $? -eq 0 ]; then
    echo "  Deployed: $name"
  else
    echo "  WARN: Failed to deploy $name"
  fi
  rm -f "$tmpfile"
}

start_process() {
  local key="$1"
  local vars_json="$2"
  local body
  if [ -n "$vars_json" ]; then
    body="{\"processDefinitionKey\":\"${key}\",\"variables\":${vars_json}}"
  else
    body="{\"processDefinitionKey\":\"${key}\"}"
  fi
  local result
  result=$(curl -sf -u "$FLOWABLE_AUTH" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "$FLOWABLE_BASE/service/runtime/process-instances" 2>&1)
  if [ $? -eq 0 ]; then
    echo "  Started instance: $key"
  else
    echo "  WARN: Failed to start $key"
  fi
}

if wait_for_flowable; then

deploy_bpmn "intake-proces" '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             targetNamespace="http://openzorg.nl/bpmn"
             id="intakeDefinitions">
  <process id="intake-proces" name="Intake Proces" isExecutable="true">
    <startEvent id="start" name="Aanmelding ontvangen" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="aanmeldingBeoordelen" />
    <userTask id="aanmeldingBeoordelen" name="Aanmelding beoordelen" flowable:candidateGroups="planner" />
    <sequenceFlow id="f2" sourceRef="aanmeldingBeoordelen" targetRef="goedgekeurdGateway" />
    <exclusiveGateway id="goedgekeurdGateway" name="Goedgekeurd?" />
    <sequenceFlow id="f3" sourceRef="goedgekeurdGateway" targetRef="intakeGesprekPlannen">
      <conditionExpression xsi:type="tFormalExpression">${goedgekeurd == true}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="f4" sourceRef="goedgekeurdGateway" targetRef="afwijzingCommuniceren">
      <conditionExpression xsi:type="tFormalExpression">${goedgekeurd == false}</conditionExpression>
    </sequenceFlow>
    <userTask id="intakeGesprekPlannen" name="Intake gesprek plannen" flowable:candidateGroups="zorgmedewerker" />
    <sequenceFlow id="f5" sourceRef="intakeGesprekPlannen" targetRef="endGoedgekeurd" />
    <endEvent id="endGoedgekeurd" name="Intake afgerond" />
    <userTask id="afwijzingCommuniceren" name="Afwijzing communiceren" flowable:candidateGroups="beheerder,tenant-admin" />
    <sequenceFlow id="f6" sourceRef="afwijzingCommuniceren" targetRef="endAfgewezen" />
    <endEvent id="endAfgewezen" name="Aanmelding afgewezen" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_intake">
    <bpmndi:BPMNPlane bpmnElement="intake-proces" id="BPMNPlane_intake">
      <bpmndi:BPMNShape bpmnElement="start" id="BPMNShape_start"><omgdc:Bounds x="100" y="200" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>'

deploy_bpmn "zorgplan-evaluatie" '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             targetNamespace="http://openzorg.nl/bpmn"
             id="zorgplanEvaluatieDefinitions">
  <process id="zorgplan-evaluatie" name="Zorgplan Evaluatie" isExecutable="true">
    <startEvent id="start" name="Evaluatie gestart" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="voorbereiding" />
    <userTask id="voorbereiding" name="Evaluatie voorbereiden" flowable:candidateGroups="zorgmedewerker">
      <documentation>Verzamel rapportages en observaties ter voorbereiding op het MDO.</documentation>
    </userTask>
    <sequenceFlow id="f2" sourceRef="voorbereiding" targetRef="mdoPlannen" />
    <userTask id="mdoPlannen" name="MDO inplannen" flowable:candidateGroups="planner">
      <documentation>Plan het multidisciplinair overleg.</documentation>
    </userTask>
    <sequenceFlow id="f3" sourceRef="mdoPlannen" targetRef="mdoUitvoeren" />
    <userTask id="mdoUitvoeren" name="MDO uitvoeren" flowable:candidateGroups="teamleider">
      <documentation>Voer het MDO uit. Bespreek voortgang op alle leefgebieden.</documentation>
    </userTask>
    <sequenceFlow id="f4" sourceRef="mdoUitvoeren" targetRef="evaluatieVastleggen" />
    <userTask id="evaluatieVastleggen" name="Evaluatie vastleggen" flowable:candidateGroups="zorgmedewerker">
      <documentation>Leg de evaluatieresultaten vast in het zorgplan.</documentation>
    </userTask>
    <sequenceFlow id="f5" sourceRef="evaluatieVastleggen" targetRef="bijstellingGateway" />
    <exclusiveGateway id="bijstellingGateway" name="Bijstelling nodig?" />
    <sequenceFlow id="f6" sourceRef="bijstellingGateway" targetRef="zorgplanBijstellen">
      <conditionExpression xsi:type="tFormalExpression">${bijstellingNodig == true}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="f7" sourceRef="bijstellingGateway" targetRef="endEvaluatie">
      <conditionExpression xsi:type="tFormalExpression">${bijstellingNodig == false}</conditionExpression>
    </sequenceFlow>
    <userTask id="zorgplanBijstellen" name="Zorgplan bijstellen" flowable:candidateGroups="zorgmedewerker">
      <documentation>Pas doelen en interventies aan op basis van de evaluatie.</documentation>
    </userTask>
    <sequenceFlow id="f8" sourceRef="zorgplanBijstellen" targetRef="endBijgesteld" />
    <endEvent id="endBijgesteld" name="Zorgplan bijgesteld" />
    <endEvent id="endEvaluatie" name="Evaluatie afgerond" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_zorgplanEvaluatie">
    <bpmndi:BPMNPlane bpmnElement="zorgplan-evaluatie" id="BPMNPlane_zorgplanEvaluatie">
      <bpmndi:BPMNShape bpmnElement="start" id="BPMNShape_start"><omgdc:Bounds x="100" y="200" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>'

deploy_bpmn "herindicatie" '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             targetNamespace="http://openzorg.nl/bpmn"
             id="herindicatieDefinitions">
  <process id="herindicatie" name="Herindicatie Proces" isExecutable="true">
    <startEvent id="start" name="Herindicatie signalering" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="signaleringControleren" />
    <userTask id="signaleringControleren" name="Signalering controleren" flowable:candidateGroups="planner">
      <documentation>Controleer of de huidige indicatie afloopt en of herindicatie nodig is.</documentation>
    </userTask>
    <sequenceFlow id="f2" sourceRef="signaleringControleren" targetRef="nodigGateway" />
    <exclusiveGateway id="nodigGateway" name="Herindicatie nodig?" />
    <sequenceFlow id="f3" sourceRef="nodigGateway" targetRef="gegevensActualiseren">
      <conditionExpression xsi:type="tFormalExpression">${herindicatieNodig == true}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="f4" sourceRef="nodigGateway" targetRef="endNietNodig">
      <conditionExpression xsi:type="tFormalExpression">${herindicatieNodig == false}</conditionExpression>
    </sequenceFlow>
    <userTask id="gegevensActualiseren" name="Clientgegevens actualiseren" flowable:candidateGroups="zorgmedewerker">
      <documentation>Werk het zorgplan bij, actualiseer diagnoses en zorgzwaarte.</documentation>
    </userTask>
    <sequenceFlow id="f5" sourceRef="gegevensActualiseren" targetRef="aanvraagIndienen" />
    <userTask id="aanvraagIndienen" name="Herindicatie aanvragen bij CIZ" flowable:candidateGroups="beheerder,tenant-admin">
      <documentation>Dien de herindicatie-aanvraag in bij het CIZ of de gemeente.</documentation>
    </userTask>
    <sequenceFlow id="f6" sourceRef="aanvraagIndienen" targetRef="besluitVerwerken" />
    <userTask id="besluitVerwerken" name="Indicatiebesluit verwerken" flowable:candidateGroups="planner">
      <documentation>Verwerk het indicatiebesluit en werk de indicatiegegevens bij.</documentation>
    </userTask>
    <sequenceFlow id="f7" sourceRef="besluitVerwerken" targetRef="endVerwerkt" />
    <endEvent id="endVerwerkt" name="Herindicatie verwerkt" />
    <endEvent id="endNietNodig" name="Geen herindicatie nodig" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_herindicatie">
    <bpmndi:BPMNPlane bpmnElement="herindicatie" id="BPMNPlane_herindicatie">
      <bpmndi:BPMNShape bpmnElement="start" id="BPMNShape_start"><omgdc:Bounds x="100" y="200" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>'

deploy_bpmn "mic-afhandeling" '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             targetNamespace="http://openzorg.nl/bpmn"
             id="micAfhandelingDefinitions">
  <process id="mic-afhandeling" name="MIC Afhandeling" isExecutable="true">
    <startEvent id="start" name="MIC-melding ontvangen" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="meldingAnalyseren" />
    <userTask id="meldingAnalyseren" name="Melding analyseren" flowable:candidateGroups="teamleider">
      <documentation>Analyseer de MIC-melding. Bepaal de ernst en de oorzaak.</documentation>
    </userTask>
    <sequenceFlow id="f2" sourceRef="meldingAnalyseren" targetRef="ernstGateway" />
    <exclusiveGateway id="ernstGateway" name="Ernst niveau?" />
    <sequenceFlow id="f3" sourceRef="ernstGateway" targetRef="maatregelenRegistreren">
      <conditionExpression xsi:type="tFormalExpression">${ernstNiveau == '"'"'laag'"'"'}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="f4" sourceRef="ernstGateway" targetRef="maatregelenBepalen">
      <conditionExpression xsi:type="tFormalExpression">${ernstNiveau == '"'"'hoog'"'"'}</conditionExpression>
    </sequenceFlow>
    <userTask id="maatregelenRegistreren" name="Maatregelen registreren" flowable:candidateGroups="teamleider">
      <documentation>Registreer de genomen maatregelen voor dit laag-risico incident.</documentation>
    </userTask>
    <sequenceFlow id="f5" sourceRef="maatregelenRegistreren" targetRef="endLaag" />
    <endEvent id="endLaag" name="MIC afgehandeld (laag)" />
    <userTask id="maatregelenBepalen" name="Verbetermaatregelen bepalen" flowable:candidateGroups="beheerder,tenant-admin">
      <documentation>Bepaal structurele verbetermaatregelen voor dit hoog-risico incident.</documentation>
    </userTask>
    <sequenceFlow id="f6" sourceRef="maatregelenBepalen" targetRef="maatregelenUitvoeren" />
    <userTask id="maatregelenUitvoeren" name="Maatregelen uitvoeren" flowable:candidateGroups="zorgmedewerker">
      <documentation>Voer de bepaalde verbetermaatregelen uit.</documentation>
    </userTask>
    <sequenceFlow id="f7" sourceRef="maatregelenUitvoeren" targetRef="evalueren" />
    <userTask id="evalueren" name="Effectiviteit evalueren" flowable:candidateGroups="teamleider">
      <documentation>Evalueer of de maatregelen effectief zijn geweest.</documentation>
    </userTask>
    <sequenceFlow id="f8" sourceRef="evalueren" targetRef="endHoog" />
    <endEvent id="endHoog" name="MIC afgehandeld (hoog)" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_micAfhandeling">
    <bpmndi:BPMNPlane bpmnElement="mic-afhandeling" id="BPMNPlane_micAfhandeling">
      <bpmndi:BPMNShape bpmnElement="start" id="BPMNShape_start"><omgdc:Bounds x="100" y="200" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>'

deploy_bpmn "vaccinatie-campagne" '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             targetNamespace="http://openzorg.nl/bpmn"
             id="vaccinatieCampagneDefinitions">
  <process id="vaccinatie-campagne" name="Vaccinatie Campagne" isExecutable="true">
    <startEvent id="start" name="Campagne gestart">
      <documentation>Admin selecteert de doelgroep en het vaccin voor de campagne.</documentation>
    </startEvent>
    <sequenceFlow id="f1" sourceRef="start" targetRef="clientenInventariseren" />
    <userTask id="clientenInventariseren" name="Clienten inventariseren" flowable:candidateGroups="zorgmedewerker">
      <documentation>Controleer welke clienten vaccinatie nodig hebben. Verifieer contra-indicaties en allergieen.</documentation>
    </userTask>
    <sequenceFlow id="f2" sourceRef="clientenInventariseren" targetRef="afsprakenInplannen" />
    <userTask id="afsprakenInplannen" name="Afspraken inplannen" flowable:candidateGroups="planner">
      <documentation>Plan vaccinatieafspraken in voor alle clienten op de lijst.</documentation>
    </userTask>
    <sequenceFlow id="f3" sourceRef="afsprakenInplannen" targetRef="vaccinatieToedienen" />
    <userTask id="vaccinatieToedienen" name="Vaccinatie toedienen" flowable:candidateGroups="zorgmedewerker">
      <documentation>Dien het vaccin toe volgens protocol. Controleer identiteit en contra-indicaties.</documentation>
    </userTask>
    <sequenceFlow id="f4" sourceRef="vaccinatieToedienen" targetRef="registratieInDossier" />
    <userTask id="registratieInDossier" name="Registratie in dossier" flowable:candidateGroups="zorgmedewerker">
      <documentation>Registreer de vaccinatie in het clientdossier met batchnummer en datum.</documentation>
    </userTask>
    <sequenceFlow id="f5" sourceRef="registratieInDossier" targetRef="end" />
    <endEvent id="end" name="Campagne compleet" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_vaccinatieCampagne">
    <bpmndi:BPMNPlane bpmnElement="vaccinatie-campagne" id="BPMNPlane_vaccinatieCampagne">
      <bpmndi:BPMNShape bpmnElement="start" id="BPMNShape_start"><omgdc:Bounds x="100" y="200" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>'

echo ""
echo "Starting demo process instances..."

# Start 5 intake processes
start_process "intake-proces" '[{"name":"tenantId","value":"horizon"},{"name":"clientNaam","value":"Dhr. Nieuwenhuis"}]'
start_process "intake-proces" '[{"name":"tenantId","value":"horizon"},{"name":"clientNaam","value":"Mevr. Kok"}]'
start_process "intake-proces" '[{"name":"tenantId","value":"horizon"},{"name":"clientNaam","value":"Dhr. Huisman"}]'
start_process "intake-proces" '[{"name":"tenantId","value":"linde"},{"name":"clientNaam","value":"Mevr. Prins"}]'
start_process "intake-proces" '[{"name":"tenantId","value":"linde"},{"name":"clientNaam","value":"Dhr. van Wijk"}]'

# Start 3 zorgplan evaluaties
start_process "zorgplan-evaluatie" '[{"name":"tenantId","value":"horizon"},{"name":"clientNaam","value":"Mevr. Jansen"}]'
start_process "zorgplan-evaluatie" '[{"name":"tenantId","value":"horizon"},{"name":"clientNaam","value":"Dhr. Pietersen"}]'
start_process "zorgplan-evaluatie" '[{"name":"tenantId","value":"linde"},{"name":"clientNaam","value":"Mevr. de Boer"}]'

# Start 2 herindicaties
start_process "herindicatie" '[{"name":"tenantId","value":"horizon"},{"name":"clientNaam","value":"Mevr. Mulder"}]'
start_process "herindicatie" '[{"name":"tenantId","value":"linde"},{"name":"clientNaam","value":"Dhr. de Groot"}]'

# Start 2 MIC afhandelingen
start_process "mic-afhandeling" '[{"name":"tenantId","value":"horizon"},{"name":"locatie","value":"Verpleeghuis Beukenhorst"},{"name":"type","value":"valincident"}]'
start_process "mic-afhandeling" '[{"name":"tenantId","value":"linde"},{"name":"locatie","value":"Wijkteam Zuid-Oost"},{"name":"type","value":"medicatiefout"}]'

# Start 1 vaccinatie campagne
start_process "vaccinatie-campagne" '[{"name":"tenantId","value":"horizon"},{"name":"vaccin","value":"Influenza 2026-2027"},{"name":"doelgroep","value":"65+ clienten"}]'

echo ""
echo "Workflow seeding complete: 5 processes deployed, 13 instances started"

fi

# ── Update PostgreSQL tenant rows with real Medplum project IDs ──
echo ""
echo "Updating tenant project IDs in PostgreSQL..."
if [ -f /tmp/tenant-project-ids.txt ]; then
  while IFS='=' read -r slug project_id; do
    if [ -n "$slug" ] && [ -n "$project_id" ]; then
      echo "  $slug -> $project_id"
      psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" -c \
        "UPDATE openzorg.tenants SET medplum_project_id = '$project_id', updated_at = now() WHERE slug = '$slug';"
    fi
  done < /tmp/tenant-project-ids.txt
  echo "  Done."
else
  echo "  No project IDs to update (users may already exist)."
fi
