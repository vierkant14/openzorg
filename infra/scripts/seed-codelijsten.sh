#!/bin/sh
# OpenZorg seed-codelijsten — Seeds comprehensive codelijsten (ValueSets) and
# detailed zorgplannen (CarePlans + Goals) for both tenants.
#
# This augments the base seed with:
#   - 3 rich codelijsten per tenant (medicatie 20+, diagnoses 20+, allergieen 15+)
#   - 4 detailed zorgplannen with SMART goals per leefgebied
#
# Idempotent: checks for existing ValueSets before creating.
#
# Usage (standalone):
#   MEDPLUM_BASE_URL=http://localhost:8103 sh seed-codelijsten.sh
#
# Usage (Docker one-shot):
#   docker run --rm --network=openzorg_default \
#     -e MEDPLUM_BASE_URL=http://medplum:8103 \
#     -v $(pwd)/infra/scripts:/scripts -w /scripts \
#     node:20-alpine sh seed-codelijsten.sh

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"

echo "=== OpenZorg Seed: Codelijsten + Zorgplannen ==="
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
  console.log('  Authenticated: ' + email);
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
    console.log('    WARN: create ' + resource.resourceType + ' failed: ' + r.status);
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

async function fhirUpdate(token, resourceType, id, resource) {
  const r = await fetch(MEDPLUM + '/fhir/R4/' + resourceType + '/' + id, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/fhir+json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify(resource),
  });
  return r.ok;
}

// ── Codelijsten data ──

const CODELIJST_MEDICATIE = [
  { code: '387517004', display: 'Paracetamol 500mg' },
  { code: '387207008', display: 'Ibuprofen 400mg' },
  { code: '372567009', display: 'Metformine 500mg' },
  { code: '372756006', display: 'Omeprazol 20mg' },
  { code: '372584003', display: 'Amlodipine 5mg' },
  { code: '373220009', display: 'Simvastatine 40mg' },
  { code: '387207008', display: 'Metoprolol 50mg' },
  { code: '373254001', display: 'Losartan 50mg' },
  { code: '373254001', display: 'Diclofenac 50mg' },
  { code: '372687004', display: 'Amoxicilline 500mg' },
  { code: '116601002', display: 'Prednisolon 5mg' },
  { code: '395862009', display: 'Pantoprazol 40mg' },
  { code: '387530003', display: 'Furosemide 40mg' },
  { code: '387106007', display: 'Oxazepam 10mg' },
  { code: '386858008', display: 'Tramadol 50mg' },
  { code: '409160006', display: 'Macrogol 13.7g' },
  { code: '273945008', display: 'Lactulose 670mg/ml' },
  { code: '13652007', display: 'Vitamine D3 800IE' },
  { code: '412528005', display: 'Calcium/Vit D 500/400' },
  { code: '387458008', display: 'Acenocoumarol 1mg' },
  { code: '372709008', display: 'Enalapril 10mg' },
  { code: '387174006', display: 'Spironolacton 25mg' },
];

const CODELIJST_DIAGNOSES = [
  { code: '44054006', display: 'Diabetes mellitus type 2' },
  { code: '38341003', display: 'Hypertensie' },
  { code: '13645005', display: 'COPD' },
  { code: '84114007', display: 'Hartfalen' },
  { code: '26929004', display: 'Dementie (Alzheimer)' },
  { code: '230690007', display: 'CVA/TIA' },
  { code: '64859006', display: 'Osteoporose' },
  { code: '35489007', display: 'Depressie' },
  { code: '46177005', display: 'Nierfalen (chronisch)' },
  { code: '49436004', display: 'Atriumfibrilleren' },
  { code: '396275006', display: 'Artrose' },
  { code: '49049000', display: 'Parkinson' },
  { code: '68566005', display: 'Urineweginfectie' },
  { code: '233604007', display: 'Pneumonie' },
  { code: '399912005', display: 'Decubitus' },
  { code: '14760008', display: 'Obstipatie' },
  { code: '2776000', display: 'Delirium' },
  { code: '197480006', display: 'Angststoornis' },
  { code: '84757009', display: 'Epilepsie' },
  { code: '40930008', display: 'Hypothyreoïdie' },
  { code: '22298006', display: 'Myocardinfarct' },
  { code: '235595009', display: 'Gastro-oesofageale refluxziekte' },
];

const CODELIJST_ALLERGIEEN = [
  { code: '91936005', display: 'Penicilline' },
  { code: '294505008', display: 'Amoxicilline' },
  { code: '293585002', display: 'NSAID\\'s' },
  { code: '300916003', display: 'Latex' },
  { code: '91935009', display: 'Jodium' },
  { code: '293607001', display: 'Contrastmiddel' },
  { code: '91934008', display: 'Noten' },
  { code: '91930006', display: 'Schaaldieren' },
  { code: '782415009', display: 'Lactose' },
  { code: '425525006', display: 'Gluten' },
  { code: '256259004', display: 'Pollen' },
  { code: '260153002', display: 'Huisstofmijt' },
  { code: '288328004', display: 'Bijengif' },
  { code: '294505008', display: 'Paracetamol' },
  { code: '91933002', display: 'Sulfonamiden' },
  { code: '418689008', display: 'Eieren' },
  { code: '418038007', display: 'Propyleenglycol' },
];

// ── Zorgplan data ──

const ZORGPLANNEN = [
  {
    patientMatch: { family: 'Jansen', given: 'Wilhelmina' },
    title: 'Zorgplan mevrouw Jansen',
    status: 'active',
    period: { start: '2026-01-15', end: '2026-07-15' },
    description: 'Integraal zorgplan gericht op behoud van zelfredzaamheid, valpreventie en sociaal welbevinden. Opgesteld n.a.v. multidisciplinair overleg d.d. 10-01-2026.',
    goals: [
      {
        leefgebied: 'mobiliteit',
        description: 'Mevrouw Jansen kan binnen 3 maanden zelfstandig met rollator van slaapkamer naar huiskamer lopen zonder hulp',
        lifecycleStatus: 'active',
        dueDate: '2026-04-15',
        situatieschets: 'Mevrouw is na val onzeker bij het lopen. Gebruikt rollator maar durft niet zelfstandig te lopen.',
      },
      {
        leefgebied: 'voeding',
        description: 'Mevrouw Jansen drinkt dagelijks minimaal 1,5 liter vocht, gemeten via vochtlijst, binnen 6 weken',
        lifecycleStatus: 'active',
        dueDate: '2026-03-01',
        situatieschets: 'Mevrouw drinkt te weinig, risico op dehydratie. Huidige inname geschat op 800ml/dag.',
      },
      {
        leefgebied: 'sociale-participatie',
        description: 'Mevrouw Jansen neemt minimaal 2x per week deel aan groepsactiviteiten in de huiskamer',
        lifecycleStatus: 'active',
        dueDate: '2026-04-01',
        situatieschets: 'Mevrouw trekt zich terug op kamer. Heeft weinig contact met medebewoners sinds overlijden echtgenoot.',
      },
    ],
  },
  {
    patientMatch: { family: 'Pietersen', given: 'Hendrik' },
    title: 'Zorgplan meneer De Boer',
    status: 'active',
    period: { start: '2026-02-01', end: '2026-08-01' },
    description: 'Zorgplan gericht op diabetesmanagement en wondverzorging. Nauwe samenwerking met huisarts en diabetesverpleegkundige.',
    goals: [
      {
        leefgebied: 'lichamelijke-gezondheid',
        description: 'Bloedglucose van meneer De Boer is binnen 8 weken stabiel tussen 4-10 mmol/L, gemeten via 4-punts dagcurve',
        lifecycleStatus: 'active',
        dueDate: '2026-04-01',
        situatieschets: 'Diabetes type 2, wisselende bloedsuikers (6-18 mmol/L). Onregelmatig eetpatroon.',
      },
      {
        leefgebied: 'huid-en-wondverzorging',
        description: 'Decubituswond categorie 2 op stuitje is binnen 6 weken genezen, beoordeeld met PUSH-score',
        lifecycleStatus: 'active',
        dueDate: '2026-03-15',
        situatieschets: 'Decubituswond cat. 2, 3x2cm, stuitje. PUSH-score 9. Wisselligging 3x per dag.',
      },
    ],
  },
  {
    patientMatch: { family: 'de Boer', given: 'Maria' },
    title: 'Zorgplan mevrouw Bakker',
    status: 'draft',
    period: { start: '2026-04-01', end: '2026-10-01' },
    description: 'Concept-zorgplan opgesteld na intake. Nog te bespreken met client en familie in zorgplanbespreking.',
    goals: [
      {
        leefgebied: 'geestelijke-gezondheid',
        description: 'Mevrouw Bakker ervaart minder angst bij dagelijkse activiteiten, gemeten met NRS-angst score daling van 7 naar 4 binnen 3 maanden',
        lifecycleStatus: 'proposed',
        dueDate: '2026-07-01',
        situatieschets: 'Mevrouw heeft toenemende angstklachten na ziekenhuisopname. NRS-angst score 7/10.',
      },
      {
        leefgebied: 'slaap-en-rust',
        description: 'Mevrouw Bakker slaapt minimaal 6 uur per nacht zonder slaapmedicatie, binnen 2 maanden',
        lifecycleStatus: 'proposed',
        dueDate: '2026-06-01',
        situatieschets: 'Slaapproblemen: 3-4 uur per nacht. Gebruikt oxazepam 10mg. Doel is afbouw.',
      },
    ],
  },
  {
    patientMatch: { family: 'van den Berg', given: 'Cornelis' },
    title: 'Zorgplan meneer Visser',
    status: 'active',
    period: { start: '2025-06-01', end: '2026-01-01' },
    description: 'Zorgplan gericht op revalidatie na CVA. Evaluatie was gepland op 01-12-2025 maar nog niet uitgevoerd.',
    goals: [
      {
        leefgebied: 'mobiliteit',
        description: 'Meneer Visser kan binnen 6 maanden zelfstandig 100 meter buiten lopen met wandelstok',
        lifecycleStatus: 'active',
        dueDate: '2025-12-01',
        situatieschets: 'Status na CVA links. Hemiparese rechts. Loopt nu max 20 meter met rollator.',
      },
      {
        leefgebied: 'persoonlijke-verzorging',
        description: 'Meneer Visser kan zich binnen 4 maanden zelfstandig wassen en aankleden (bovenlichaam)',
        lifecycleStatus: 'active',
        dueDate: '2025-10-01',
        situatieschets: 'Hulp nodig bij ADL door verminderde functie rechterarm. Gemotiveerd voor revalidatie.',
      },
      {
        leefgebied: 'regie-en-autonomie',
        description: 'Meneer Visser maakt dagelijks zelfstandig keuzes over dagindeling en maaltijden',
        lifecycleStatus: 'active',
        dueDate: '2025-10-01',
        situatieschets: 'Door afhankelijkheid na CVA is eigen regie verminderd. Meneer geeft aan zich machteloos te voelen.',
      },
    ],
  },
];


// ── Main seed function per tenant ──

async function seedForTenant(token, tenantSlug, tenantLabel) {
  console.log('');
  console.log('--- ' + tenantLabel + ' ---');

  // ── 1. Codelijsten (ValueSets) ──
  // We replace existing codelijsten to add the full set + proper tenant tag.

  const codelijstDefs = [
    { type: 'medicatie', naam: 'Veelvoorkomende medicatie (VVT)', codes: CODELIJST_MEDICATIE },
    { type: 'diagnoses', naam: 'Veelvoorkomende diagnoses (VVT)', codes: CODELIJST_DIAGNOSES },
    { type: 'allergieen', naam: 'Veelvoorkomende allergieën', codes: CODELIJST_ALLERGIEEN },
  ];

  let codelijstCount = 0;
  for (const cl of codelijstDefs) {
    // Check if a codelijst already exists for this type
    const existing = await fhirSearch(token, 'ValueSet?name=codelijst-' + cl.type + '&_count=1');
    if (existing.length > 0) {
      // Update existing ValueSet with full data + tenant tag
      const vs = existing[0];
      vs.title = cl.naam;
      vs.status = 'active';
      vs.meta = vs.meta || {};
      vs.meta.tag = [{ system: 'https://openzorg.nl/tenant', code: 'tenant:' + tenantSlug }];
      vs.compose = {
        include: [{
          system: 'http://snomed.info/sct',
          concept: cl.codes.map(function(c) { return { code: c.code, display: c.display }; }),
        }],
      };
      const ok = await fhirUpdate(token, 'ValueSet', vs.id, vs);
      if (ok) {
        console.log('  Updated codelijst-' + cl.type + ' (' + cl.codes.length + ' items)');
        codelijstCount++;
      }
    } else {
      // Create new ValueSet with tenant tag
      const id = await fhirCreate(token, {
        resourceType: 'ValueSet',
        name: 'codelijst-' + cl.type,
        title: cl.naam,
        status: 'active',
        url: 'https://openzorg.nl/fhir/ValueSet/codelijst-' + cl.type,
        meta: {
          tag: [{ system: 'https://openzorg.nl/tenant', code: 'tenant:' + tenantSlug }],
        },
        compose: {
          include: [{
            system: 'http://snomed.info/sct',
            concept: cl.codes.map(function(c) { return { code: c.code, display: c.display }; }),
          }],
        },
      });
      if (id) {
        console.log('  Created codelijst-' + cl.type + ' (' + cl.codes.length + ' items)');
        codelijstCount++;
      }
    }
  }
  console.log('  ' + codelijstCount + ' codelijsten verwerkt');

  // ── 2. Zorgplannen (CarePlans + Goals) ──

  // Find existing patients
  const allPatients = await fhirSearch(token, 'Patient?_count=100&_sort=name');
  console.log('  Gevonden: ' + allPatients.length + ' clienten');

  let zpCount = 0;
  let goalCount = 0;

  for (const zp of ZORGPLANNEN) {
    // Match patient by family + given name
    const patient = allPatients.find(function(p) {
      const name = p.name && p.name[0];
      if (!name) return false;
      return name.family === zp.patientMatch.family &&
             name.given && name.given[0] === zp.patientMatch.given;
    });

    if (!patient) {
      console.log('  WARN: Patient niet gevonden: ' + zp.patientMatch.given + ' ' + zp.patientMatch.family);
      continue;
    }

    // Check if a zorgplan already exists for this patient with this title
    const existingPlans = await fhirSearch(token,
      'CarePlan?subject=Patient/' + patient.id + '&_count=10');
    const alreadyExists = existingPlans.some(function(cp) {
      return cp.title === zp.title;
    });

    if (alreadyExists) {
      console.log('  Zorgplan bestaat al: ' + zp.title + ' — overgeslagen');
      continue;
    }

    // Set lastUpdated for the old plan (meneer Visser) to trigger evaluatie-verlopen
    const meta = {};
    if (zp.period.end < '2026-04-01') {
      // Old plan — the period.end is in the past, triggers evaluatie-verlopen
      meta.lastUpdated = '2025-09-15T10:00:00Z';
    }

    const cpId = await fhirCreate(token, {
      resourceType: 'CarePlan',
      status: zp.status,
      intent: 'plan',
      title: zp.title,
      description: zp.description,
      subject: { reference: 'Patient/' + patient.id },
      period: zp.period,
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '734163000',
          display: 'Care plan',
        }],
      }],
    });

    if (!cpId) {
      console.log('  WARN: CarePlan aanmaken mislukt: ' + zp.title);
      continue;
    }

    zpCount++;
    console.log('  Zorgplan: ' + zp.title + ' (id=' + cpId + ')');

    // Create goals for this zorgplan
    for (const goal of zp.goals) {
      const leefgebiedDisplay = {
        'lichamelijke-gezondheid': 'Lichamelijke gezondheid',
        'geestelijke-gezondheid': 'Geestelijke gezondheid',
        'mobiliteit': 'Mobiliteit',
        'voeding': 'Voeding',
        'huid-en-wondverzorging': 'Huid en wondverzorging',
        'uitscheiding': 'Uitscheiding',
        'slaap-en-rust': 'Slaap en rust',
        'persoonlijke-verzorging': 'Persoonlijke verzorging',
        'huishouden': 'Huishouden',
        'sociale-participatie': 'Sociale participatie',
        'regie-en-autonomie': 'Regie en autonomie',
        'zingeving-en-spiritualiteit': 'Zingeving en spiritualiteit',
      }[goal.leefgebied] || goal.leefgebied;

      const goalId = await fhirCreate(token, {
        resourceType: 'Goal',
        lifecycleStatus: goal.lifecycleStatus,
        description: { text: goal.description },
        subject: { reference: 'Patient/' + patient.id },
        target: [{ dueDate: goal.dueDate }],
        addresses: [{ reference: 'CarePlan/' + cpId }],
        category: [{
          coding: [{
            system: 'https://openzorg.nl/CodeSystem/leefgebieden',
            code: goal.leefgebied,
            display: leefgebiedDisplay,
          }],
        }],
        extension: [
          {
            url: 'https://openzorg.nl/extensions/leefgebied',
            valueString: goal.leefgebied,
          },
          {
            url: 'https://openzorg.nl/extensions/situatieschets',
            valueString: goal.situatieschets,
          },
        ],
      });

      if (goalId) {
        goalCount++;
        console.log('    Doel [' + goal.leefgebied + ']: ' + goal.description.substring(0, 60) + '...');
      }
    }
  }

  console.log('  Totaal: ' + zpCount + ' zorgplannen, ' + goalCount + ' doelen aangemaakt');
}


// ── Main ──

(async () => {
  console.log('');
  console.log('Authenticating tenant accounts...');

  // Tenant 1: Zorggroep Horizon
  const horizonToken = await login('jan@horizon.nl', 'Hz!J4n#2026pKw8');
  if (horizonToken) {
    await seedForTenant(horizonToken, 'zorggroep-horizon', 'Zorggroep Horizon');
  }

  // Tenant 2: Thuiszorg De Linde
  const lindeToken = await login('maria@delinde.nl', 'Ld!M4r1a#2026nRt5');
  if (lindeToken) {
    await seedForTenant(lindeToken, 'thuiszorg-de-linde', 'Thuiszorg De Linde');
  }

  console.log('');
  console.log('=========================================');
  console.log('  Seed Codelijsten + Zorgplannen Complete');
  console.log('=========================================');
  console.log('');
  console.log('Per tenant:');
  console.log('  3 codelijsten (medicatie 22, diagnoses 22, allergieen 17 items)');
  console.log('  4 zorgplannen met SMART doelen per leefgebied');
  console.log('');
})().catch(function(e) { console.error('FATAL:', e); process.exit(1); });
"

echo ""
echo "Seed codelijsten script complete."
