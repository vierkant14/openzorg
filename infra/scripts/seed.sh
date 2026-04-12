#!/bin/sh
# OpenZorg seed script — runs once after Medplum is healthy.
# Creates master admins + 2 VVT tenant environments with rich test data.
# Uses the FULL Medplum registration flow: newuser → newproject → token exchange.

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"

echo "=== OpenZorg Seed Script ==="
echo "Medplum: $MEDPLUM"

apk add --no-cache curl postgresql-client > /dev/null 2>&1

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
  if (!s1.login) { console.log('  ' + email + ': SKIP (exists or error)'); return { accessToken: null, projectId: '' }; }

  const r2 = await fetch(MEDPLUM + '/auth/newproject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: s1.login, projectName })
  });
  const s2 = await r2.json();
  if (!s2.code) { console.log('  ' + email + ': project creation failed'); return { accessToken: null, projectId: '' }; }

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

  // ── Organisatie (Organization) — created early so we can reference locations for PractitionerRoles ──
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

  const locaties = [
    { naam: 'Locatie Zuid - Verpleeghuis', type: 'verpleeghuis', adres: 'Kerkstraat 12, 1017 GP Amsterdam', tel: '020-5551234' },
    { naam: 'Wijkteam Noord', type: 'thuiszorg-team', adres: 'Buikslotermeerplein 3, 1025 XL Amsterdam', tel: '020-5555678' },
    { naam: 'Hoofdkantoor', type: 'kantoor', adres: 'Zorgboulevard 1, 1234 AB Amsterdam', tel: '020-5559012' },
  ];
  const locIds = [];
  for (const loc of locaties) {
    if (!rootOrgId) continue;
    const locId = await fhirCreate(token, {
      resourceType: 'Organization',
      active: true,
      name: loc.naam,
      partOf: { reference: 'Organization/' + rootOrgId },
      type: [{ coding: [{ system: 'https://openzorg.nl/fhir/CodeSystem/locatie-type', code: loc.type, display: loc.type }] }],
      telecom: [{ system: 'phone', value: loc.tel, use: 'work' }],
      address: [{ text: loc.adres }],
    });
    locIds.push(locId);
  }
  console.log('    1 organisatie + ' + locIds.filter(Boolean).length + ' locaties aangemaakt');

  // ── Contracten (PractitionerRole) — koppelt medewerker aan organisatie met contractgegevens ──
  const contractData = [
    { practIdx: 0, functie: 'Wijkverpleegkundige', uren: 36, type: 'vast', start: '2023-06-01' },
    { practIdx: 1, functie: 'Verzorgende IG', uren: 32, type: 'vast', start: '2024-01-15' },
    { practIdx: 2, functie: 'Teamleider zorg', uren: 36, type: 'vast', start: '2022-09-01' },
    { practIdx: 3, functie: 'Planner', uren: 24, type: 'vast', start: '2024-03-01' },
    { practIdx: 4, functie: 'Verpleegkundige', uren: 28, type: 'bepaalde-tijd', start: '2025-07-01' },
    { practIdx: 5, functie: 'Verzorgende IG', uren: 20, type: 'oproep', start: '2025-10-15' },
  ];

  let contractCount = 0;
  for (let ci = 0; ci < contractData.length; ci++) {
    const cd = contractData[ci];
    if (!practIds[cd.practIdx]) continue;
    const locRef = locIds[ci % locIds.length];
    await fhirCreate(token, {
      resourceType: 'PractitionerRole',
      active: true,
      practitioner: { reference: 'Practitioner/' + practIds[cd.practIdx], display: practitioners[cd.practIdx].given[0] + ' ' + practitioners[cd.practIdx].family },
      organization: rootOrgId ? { reference: 'Organization/' + rootOrgId, display: tenantName } : undefined,
      location: locRef ? [{ reference: 'Organization/' + locRef }] : [],
      code: [{ text: cd.functie }],
      extension: [
        { url: 'https://openzorg.nl/extensions/contract-uren', valueDecimal: cd.uren },
        { url: 'https://openzorg.nl/extensions/contract-type', valueString: cd.type },
        { url: 'https://openzorg.nl/extensions/dienstverband-start', valueDate: cd.start },
        { url: 'https://openzorg.nl/extensions/locatie-naam', valueString: locaties[ci % locaties.length].naam },
      ],
    });
    contractCount++;
  }
  console.log('    ' + contractCount + ' contracten (PractitionerRole) aangemaakt');

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
    { patient: 0, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-15', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-15', geldigTot: '2026-10-15' },
    { patient: 0, vaccine: 'COVID-19 (booster 2025)', code: 'J07BX03', datum: '2025-09-01', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-09-01', geldigTot: '2026-09-01' },
    { patient: 1, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-20', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-20', geldigTot: '2026-10-20' },
    { patient: 2, vaccine: 'Pneumokokken', code: 'J07AL', datum: '2025-03-10', herhalend: false, frequentie: 'eenmalig', volgendeDatum: '', geldigTot: '' },
    { patient: 4, vaccine: 'Influenza (seizoen 2025-2026)', code: 'J07BB', datum: '2025-10-18', herhalend: true, frequentie: 'jaarlijks', volgendeDatum: '2026-10-18', geldigTot: '2026-10-18' },
    { patient: 4, vaccine: 'Zona (gordelroos)', code: 'J07BK03', datum: '2025-05-22', herhalend: false, frequentie: 'eenmalig', volgendeDatum: '', geldigTot: '' },
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

  // ── Berichten (Communication) ──
  const berichtData = [
    { from: 0, to: 2, onderwerp: 'Overdracht avonddienst', bericht: 'Mevrouw Jansen was vanavond onrustig. Extra aandacht bij de ochtendzorg svp. Vitale functies zijn stabiel, geen bijzonderheden met medicatie.', daysAgo: 0 },
    { from: 2, to: 0, onderwerp: 'Re: Overdracht avonddienst', bericht: 'Bedankt voor de overdracht. Ik neem dit mee in de ochtendzorg. Wordt ze misschien onrustig door de medicatiewijziging van vorige week?', daysAgo: 0 },
    { from: 1, to: 3, onderwerp: 'Planning volgende week', bericht: 'Kun je de planning voor volgende week aanpassen? Ik kan woensdag niet. Ruilen met donderdag zou ideaal zijn.', daysAgo: 1 },
    { from: 3, to: 1, onderwerp: 'Re: Planning volgende week', bericht: 'Is geregeld. Je staat nu ingepland op donderdag. Woensdag neemt Sophie over.', daysAgo: 1 },
    { from: 0, to: 4, onderwerp: 'MDO volgende week dinsdag', bericht: 'Herinnering: MDO voor mevrouw De Boer staat gepland voor dinsdag 10:00. Graag voorbereid komen met evaluatie zorgdoelen.', daysAgo: 2 },
    { from: 5, to: 0, onderwerp: 'Nieuwe client intake', bericht: 'Er is een nieuwe aanmelding binnengekomen voor thuiszorg. Dhr. Van der Berg, 74 jaar, indicatie Wmo begeleiding individueel. Kun jij de intake plannen?', daysAgo: 3 },
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
      ...(berichtCount < 3 ? { received: sentDate.toISOString() } : {}),
    });
    berichtCount++;
  }
  console.log('    ' + berichtCount + ' berichten aangemaakt');

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
  console.log('Per tenant: 6 medewerkers, 6 contracten, 8 clienten, 4 zorgplannen,');
  console.log('  10 rapportages, 7 medicaties, 4 allergieen,');
  console.log('  6 vaccinaties, 5 contactpersonen, 6 afspraken,');
  console.log('  1 organisatie + 3 locaties, 6 berichten, 4 codelijsten');
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
    <userTask id="afwijzingCommuniceren" name="Afwijzing communiceren" flowable:candidateGroups="beheerder" />
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
    <userTask id="aanvraagIndienen" name="Herindicatie aanvragen bij CIZ" flowable:candidateGroups="beheerder">
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
    <userTask id="maatregelenBepalen" name="Verbetermaatregelen bepalen" flowable:candidateGroups="beheerder">
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

# Start 2 intake processes (creates "Aanmelding beoordelen" tasks for planner)
start_process "intake-proces"
start_process "intake-proces"

# Start 1 zorgplan evaluatie (creates "Evaluatie voorbereiden" task for zorgmedewerker)
start_process "zorgplan-evaluatie"

# Start 1 herindicatie (creates "Signalering controleren" task for planner)
start_process "herindicatie"

# Start 1 MIC afhandeling (creates "Melding analyseren" task for teamleider)
start_process "mic-afhandeling"

# Start 1 vaccinatie campagne (creates "Clienten inventariseren" task for zorgmedewerker)
start_process "vaccinatie-campagne" '[{"name":"vaccin","value":"Influenza 2026-2027"},{"name":"doelgroep","value":"65+ clienten"}]'

echo ""
echo "Workflow seeding complete: 5 processes deployed, 6 instances started"

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
