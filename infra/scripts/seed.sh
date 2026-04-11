#!/bin/sh
# OpenZorg seed script — runs once after Medplum is healthy.
# Creates master admins + 2 VVT tenant environments with rich test data.
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
  if (!s1.login) { console.log('  ' + email + ': SKIP (exists or error)'); return null; }

  const r2 = await fetch(MEDPLUM + '/auth/newproject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: s1.login, projectName })
  });
  const s2 = await r2.json();
  if (!s2.code) { console.log('  ' + email + ': project creation failed'); return null; }

  const r3 = await fetch(MEDPLUM + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&code=' + s2.code + '&code_verifier=' + codeVerifier
  });
  const token = await r3.json();
  console.log('  ' + email + ': OK');
  return token.access_token || null;
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

  // ── Practitioners (medewerkers) ──
  const practitioners = [
    { family: 'de Vries', given: ['Jan'], role: 'beheerder', qualification: 'Wijkverpleegkundige' },
    { family: 'Bakker', given: ['Annemarie'], role: 'zorgmedewerker', qualification: 'Verzorgende IG' },
    { family: 'van Dijk', given: ['Peter'], role: 'teamleider', qualification: 'Teamleider zorg' },
    { family: 'Smit', given: ['Lisa'], role: 'planner', qualification: 'Planner' },
    { family: 'Hendriks', given: ['Mohammed'], role: 'zorgmedewerker', qualification: 'Verpleegkundige' },
    { family: 'Visser', given: ['Sophie'], role: 'zorgmedewerker', qualification: 'Verzorgende IG' },
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

  // ── Patients (clienten) ──
  const patients = [
    { family: 'Jansen', given: ['Wilhelmina'], gender: 'female', birthDate: '1938-03-14', bsn: '123456782', indicatie: 'wlz', profiel: 'VV Pakket 5', marital: 'W' },
    { family: 'Pietersen', given: ['Hendrik'], gender: 'male', birthDate: '1942-07-22', bsn: '987654321', indicatie: 'wlz', profiel: 'VV Pakket 4', marital: 'M' },
    { family: 'de Boer', given: ['Maria', 'Elisabeth'], gender: 'female', birthDate: '1945-11-08', bsn: '111222333', indicatie: 'zvw', profiel: 'S2', marital: 'D' },
    { family: 'van den Berg', given: ['Cornelis'], gender: 'male', birthDate: '1950-01-30', bsn: '444555666', indicatie: 'wmo', profiel: 'Begeleiding individueel', marital: 'M' },
    { family: 'Mulder', given: ['Johanna'], gender: 'female', birthDate: '1935-06-17', bsn: '777888999', indicatie: 'wlz', profiel: 'VV Pakket 6', marital: 'W' },
    { family: 'de Groot', given: ['Pieter'], gender: 'male', birthDate: '1948-09-03', bsn: '222333444', indicatie: 'zvw', profiel: 'S2', marital: 'M' },
    { family: 'Bos', given: ['Geertruida'], gender: 'female', birthDate: '1940-12-25', bsn: '555666777', indicatie: 'wlz', profiel: 'VV Pakket 5', marital: 'W' },
    { family: 'Vos', given: ['Johannes'], gender: 'male', birthDate: '1955-04-11', bsn: '888999000', indicatie: 'wmo', profiel: 'Huishoudelijke hulp', marital: 'M' },
  ];

  const patientIds = [];
  for (const p of patients) {
    const id = await fhirCreate(token, {
      resourceType: 'Patient',
      active: true,
      name: [{ family: p.family, given: p.given, text: p.given.join(' ') + ' ' + p.family }],
      gender: p.gender,
      birthDate: p.birthDate,
      identifier: [
        { system: 'http://fhir.nl/fhir/NamingSystem/bsn', value: p.bsn },
        { system: 'https://openzorg.nl/NamingSystem/clientnummer', value: 'C-' + String(patientIds.length + 1).padStart(5, '0') },
      ],
      telecom: [
        { system: 'phone', value: '0' + Math.floor(100000000 + Math.random() * 900000000), use: 'home' },
        { system: 'phone', value: '06-' + Math.floor(10000000 + Math.random() * 90000000), use: 'mobile' },
      ],
      address: [{
        line: [['Dorpstraat', 'Kerkweg', 'Hoofdstraat', 'Lindelaan', 'Molenweg', 'Beukenlaan', 'Eikenlaan', 'Kastanjelaan'][patientIds.length] + ' ' + (patientIds.length + 10)],
        postalCode: ['1234 AB', '2345 CD', '3456 EF', '4567 GH', '5678 IJ', '6789 KL', '7890 MN', '8901 OP'][patientIds.length],
        city: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Den Haag', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere'][patientIds.length],
      }],
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

  // ── CarePlans (zorgplannen) voor eerste 4 clienten ──
  const leefgebieden = ['Lichamelijk welbevinden', 'Psychisch welbevinden', 'Mobiliteit', 'Persoonlijke verzorging', 'Voeding', 'Veiligheid'];
  const carePlanIds = [];
  for (let i = 0; i < 4; i++) {
    if (!patientIds[i]) continue;
    const cpId = await fhirCreate(token, {
      resourceType: 'CarePlan',
      status: 'active',
      intent: 'plan',
      title: 'Individueel zorgplan 2026 - ' + patients[i].given[0] + ' ' + patients[i].family,
      description: 'Zorgplan opgesteld n.a.v. intake en indicatiestelling. Focus op ' + leefgebieden[i] + '.',
      subject: { reference: 'Patient/' + patientIds[i] },
      period: { start: '2026-01-15', end: '2026-07-15' },
      author: practIds[0] ? [{ reference: 'Practitioner/' + practIds[0], display: 'Jan de Vries' }] : [],
      category: [{ coding: [{ system: 'http://snomed.info/sct', code: '734163000', display: 'Care plan' }] }],
    });
    carePlanIds.push(cpId);

    // 2 doelen per zorgplan
    for (let g = 0; g < 2; g++) {
      const goalTexts = [
        ['Client kan zelfstandig naar het toilet lopen', 'Client eet minimaal 3 maaltijden per dag'],
        ['Client voelt zich veilig in thuissituatie', 'Client heeft regelmatig sociaal contact'],
        ['Client kan ADL zelfstandig uitvoeren', 'Valrisico is verminderd'],
        ['Client ervaart minder pijn', 'Slaapkwaliteit is verbeterd'],
      ];
      await fhirCreate(token, {
        resourceType: 'Goal',
        lifecycleStatus: 'active',
        description: { text: '[' + leefgebieden[g] + '] ' + (goalTexts[i]?.[g] || 'Doel verbeteren') },
        subject: { reference: 'Patient/' + patientIds[i] },
        target: [{ dueDate: '2026-07-01' }],
        addresses: [{ reference: 'CarePlan/' + cpId }],
      });
    }
  }
  console.log('    ' + carePlanIds.filter(Boolean).length + ' zorgplannen met doelen aangemaakt');

  // ── Rapportages (Observations) ──
  const rapportageCount = { count: 0 };
  for (let i = 0; i < 5; i++) {
    if (!patientIds[i]) continue;
    // SOEP rapportage
    await fhirCreate(token, {
      resourceType: 'Observation',
      status: 'final',
      code: { text: 'soep' },
      subject: { reference: 'Patient/' + patientIds[i] },
      effectiveDateTime: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      extension: [
        { url: 'https://openzorg.nl/extensions/soep/subjectief', valueString: 'Client geeft aan zich ' + ['goed', 'matig', 'moe', 'onrustig', 'tevreden'][i] + ' te voelen.' },
        { url: 'https://openzorg.nl/extensions/soep/objectief', valueString: ['Vitale functies stabiel.', 'Lichte koorts (37.8°C).', 'Bloeddruk verhoogd (155/95).', 'Huid intact, geen decubitus.', 'Gewicht stabiel.'][i] },
        { url: 'https://openzorg.nl/extensions/soep/evaluatie', valueString: ['Zorgplan kan ongewijzigd.', 'Extra controle nodig.', 'Huisarts inlichten.', 'Preventieve maatregelen genomen.', 'Geen bijzonderheden.'][i] },
        { url: 'https://openzorg.nl/extensions/soep/plan', valueString: ['Continueren huidige zorg.', 'Temperatuur monitoren.', 'Overleg met huisarts plannen.', 'Wisselligging schema handhaven.', 'Volgende evaluatie over 2 weken.'][i] },
      ],
    });
    // Vrije rapportage
    await fhirCreate(token, {
      resourceType: 'Observation',
      status: 'final',
      code: { text: 'vrij' },
      subject: { reference: 'Patient/' + patientIds[i] },
      effectiveDateTime: new Date(Date.now() - i * 86400000 * 2).toISOString(),
      valueString: ['Bezoek van familie, client was vrolijk.', 'Client heeft goed gegeten vandaag.', 'Wisselligging uitgevoerd, geen bijzonderheden.', 'Medicatie uitgereikt, geen bijwerkingen.', 'Client heeft deelgenomen aan groepsactiviteit.'][i],
    });
    rapportageCount.count += 2;
  }
  console.log('    ' + rapportageCount.count + ' rapportages aangemaakt');

  // ── Medicatie (MedicationRequest) ──
  const medicaties = [
    { patient: 0, naam: 'Metoprolol 50mg', dosering: '1x daags 1 tablet', reden: 'Hypertensie' },
    { patient: 0, naam: 'Omeprazol 20mg', dosering: '1x daags voor ontbijt', reden: 'Maagbescherming' },
    { patient: 1, naam: 'Acenocoumarol', dosering: 'Volgens trombosedienst', reden: 'Tromboseprofylaxe' },
    { patient: 2, naam: 'Paracetamol 500mg', dosering: 'Max 4x daags 1-2 tabletten', reden: 'Pijnbestrijding' },
    { patient: 2, naam: 'Furosemide 40mg', dosering: '1x daags ochtend', reden: 'Hartfalen' },
    { patient: 3, naam: 'Metformine 850mg', dosering: '2x daags bij de maaltijd', reden: 'Diabetes mellitus type 2' },
    { patient: 4, naam: 'Oxazepam 10mg', dosering: 'Zo nodig 1 tablet voor de nacht', reden: 'Slaapproblemen' },
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

  // ── Allergieën ──
  const allergieen = [
    { patient: 0, substance: 'Penicilline', reaction: 'Huiduitslag' },
    { patient: 1, substance: 'Jodium', reaction: 'Anafylactische reactie' },
    { patient: 2, substance: 'Noten', reaction: 'Benauwdheid' },
    { patient: 4, substance: 'Latex', reaction: 'Contactdermatitis' },
  ];

  let allergieCount = 0;
  for (const a of allergieen) {
    if (!patientIds[a.patient]) continue;
    await fhirCreate(token, {
      resourceType: 'AllergyIntolerance',
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] },
      type: 'allergy',
      category: ['medication'],
      patient: { reference: 'Patient/' + patientIds[a.patient] },
      code: { text: a.substance },
      reaction: [{ manifestation: [{ text: a.reaction }] }],
    });
    allergieCount++;
  }
  console.log('    ' + allergieCount + ' allergieen aangemaakt');

  // ── Vaccinaties ──
  const vaccinaties = [
    { patient: 0, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-15' },
    { patient: 0, vaccine: 'COVID-19 (booster 2025)', code: 'J07BX03', datum: '2025-09-01' },
    { patient: 1, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-20' },
    { patient: 2, vaccine: 'Pneumokokken', code: 'J07AL', datum: '2025-03-10' },
    { patient: 4, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-18' },
    { patient: 4, vaccine: 'Zona (gordelroos)', code: 'J07BK03', datum: '2025-05-22' },
  ];

  let vacCount = 0;
  for (const v of vaccinaties) {
    if (!patientIds[v.patient]) continue;
    await fhirCreate(token, {
      resourceType: 'Immunization',
      status: 'completed',
      vaccineCode: { coding: [{ system: 'http://www.whocc.no/atc', code: v.code, display: v.vaccine }], text: v.vaccine },
      patient: { reference: 'Patient/' + patientIds[v.patient] },
      occurrenceDateTime: v.datum,
      recorded: v.datum,
      primarySource: true,
    });
    vacCount++;
  }
  console.log('    ' + vacCount + ' vaccinaties aangemaakt');

  // ── Contactpersonen ──
  const contactpersonen = [
    { patient: 0, family: 'Jansen', given: ['Karel'], relation: 'Zoon', phone: '06-12345678' },
    { patient: 0, family: 'Jansen-Smit', given: ['Anja'], relation: 'Schoondochter', phone: '06-87654321' },
    { patient: 1, family: 'Pietersen', given: ['Marieke'], relation: 'Dochter', phone: '06-11223344' },
    { patient: 2, family: 'de Boer', given: ['Thomas'], relation: 'Zoon', phone: '06-55667788' },
    { patient: 4, family: 'Mulder', given: ['Ingrid'], relation: 'Dochter', phone: '06-99887766' },
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

  // ── Afspraken (Appointments) ──
  const now = new Date();
  let afspraakCount = 0;
  for (let i = 0; i < 6; i++) {
    if (!patientIds[i]) continue;
    const startDate = new Date(now.getTime() + (i - 2) * 86400000);
    startDate.setHours(8 + i, 0, 0);
    const endDate = new Date(startDate.getTime() + 3600000);
    await fhirCreate(token, {
      resourceType: 'Appointment',
      status: i < 2 ? 'fulfilled' : 'booked',
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      description: ['Ochtendzorg', 'Wondverzorging', 'Medicatie-uitgifte', 'ADL begeleiding', 'Evaluatiegesprek', 'Fysiotherapie'][i],
      participant: [
        { actor: { reference: 'Patient/' + patientIds[i], display: patients[i].given[0] + ' ' + patients[i].family }, status: 'accepted' },
        ...(practIds[i % practIds.length] ? [{ actor: { reference: 'Practitioner/' + practIds[i % practIds.length] }, status: 'accepted' }] : []),
      ],
    });
    afspraakCount++;
  }
  console.log('    ' + afspraakCount + ' afspraken aangemaakt');

  console.log('  Test data voor ' + tenantName + ' compleet!');
}

// ── Main ──

(async () => {
  console.log('');
  console.log('Registering users...');

  // Master admins (elk een eigen project/environment)
  const adminToken = await register('admin@openzorg.nl', 'Oz!Adm1n#2026mXq7', 'Super', 'Admin', 'OpenZorg Master');
  await register('kevin@openzorg.nl', 'Oz!K3v1n#2026xYp4', 'Kevin', 'Admin', 'Kevin Workspace');
  await register('meneka@openzorg.nl', 'Oz!M3n3k4#2026wZr7', 'Meneka', 'Admin', 'Meneka Workspace');

  // Tenant 1: Zorggroep Horizon (grotere VVT-instelling)
  console.log('');
  console.log('--- Tenant 1: Zorggroep Horizon ---');
  const horizonToken = await register('jan@horizon.nl', 'Hz!J4n#2026pKw8', 'Jan', 'de Vries', 'Zorggroep Horizon');
  await seedTenantData(horizonToken, 'Zorggroep Horizon');

  // Tenant 2: Thuiszorg De Linde (kleinere thuiszorg)
  console.log('');
  console.log('--- Tenant 2: Thuiszorg De Linde ---');
  const lindeToken = await register('maria@delinde.nl', 'Ld!M4r1a#2026nRt5', 'Maria', 'Jansen', 'Thuiszorg De Linde');
  await seedTenantData(lindeToken, 'Thuiszorg De Linde');

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
  console.log('Per tenant: 6 medewerkers, 8 clienten, 4 zorgplannen,');
  console.log('  10 rapportages, 7 medicaties, 4 allergieen,');
  console.log('  6 vaccinaties, 5 contactpersonen, 6 afspraken');
  console.log('');
  console.log('Open http://localhost:3000/login');
  console.log('=========================================');
})();
"
