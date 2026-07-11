#!/bin/sh
# OpenZorg seed-pilotprofiel — Bouwt de tenant "Zorggroep Horizon" uit tot het
# pilotprofiel uit de verkoop-spec: een kleine VVT-instelling met thuiszorg,
# 4 locaties en ~80 clienten.
#
# Creeert (idempotent):
#   - 4 locaties (Organizations, partOf de tenant-root-Organization):
#       Horizon Centrum / Horizon Oost / Horizon West (intramuraal) en
#       Thuiszorg Regio Noord (extramuraal)
#   - 2 afdelingen (child-Organizations) per intramurale locatie
#   - 80 clienten via het ECD-import-endpoint (POST /api/clients/import):
#       60 intramuraal verdeeld over de 3 locaties, 20 in de thuiszorg
#
# Idempotent:
#   - Locaties/afdelingen: bestaat de naam al -> hergebruiken.
#   - Clienten: bestaan er al >= 60 Patients -> import overslaan (zodat een
#     tweede run niet dubbel importeert).
#
# NB: dit is een demo/staging-script; het hoort NIET in de CI-keten. Wel is de
# shell-syntaxis clean (bash -n).
#
# Usage (standalone, standaardpoorten):
#   MEDPLUM_BASE_URL=http://localhost:8103 \
#   ECD_BASE_URL=http://localhost:4001 \
#   sh seed-pilotprofiel.sh
#
# Usage (Docker one-shot):
#   docker run --rm --network=openzorg_default \
#     -e MEDPLUM_BASE_URL=http://medplum:8103 \
#     -e ECD_BASE_URL=http://ecd:4001 \
#     -v $(pwd)/infra/scripts:/scripts -w /scripts \
#     node:20-alpine sh seed-pilotprofiel.sh

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"
ECD="${ECD_BASE_URL:-http://localhost:4001}"

echo "=== OpenZorg Seed: Pilotprofiel (Zorggroep Horizon) ==="
echo "Medplum: $MEDPLUM"
echo "ECD:     $ECD"

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

const ORG_TYPE_SYSTEM = 'https://openzorg.nl/CodeSystem/org-type';

// ── Auth: login op het bestaande tenant-account (PKCE) ──

async function login(email, password) {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const loginRes = await fetch(MEDPLUM + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, scope: 'openid', codeChallenge, codeChallengeMethod: 'S256' }),
  });
  if (!loginRes.ok) { console.log('  Login mislukt voor ' + email + ': HTTP ' + loginRes.status); return null; }
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
  if (!code) { console.log('  Geen autorisatiecode voor ' + email); return null; }

  const tokenRes = await fetch(MEDPLUM + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&code=' + code + '&code_verifier=' + codeVerifier,
  });
  if (!tokenRes.ok) { console.log('  Token mislukt voor ' + email); return null; }
  const tokenData = await tokenRes.json();
  const projectId = tokenData.project && tokenData.project.reference ? tokenData.project.reference.split('/')[1] : null;
  console.log('  Ingelogd als ' + email);
  return { token: tokenData.access_token, projectId: projectId };
}

// ── FHIR-helpers ──

async function fhirCreate(token, resource) {
  const r = await fetch(MEDPLUM + '/fhir/R4/' + resource.resourceType, {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json', 'Authorization': 'Bearer ' + token },
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
  const r = await fetch(MEDPLUM + '/fhir/R4/' + query, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!r.ok) return [];
  const bundle = await r.json();
  return (bundle.entry || []).map(function (e) { return e.resource; });
}

async function telPatienten(token) {
  const r = await fetch(MEDPLUM + '/fhir/R4/Patient?_summary=count', { headers: { 'Authorization': 'Bearer ' + token } });
  if (!r.ok) return 0;
  const bundle = await r.json();
  return bundle.total || 0;
}

// ── Organisatie-helper: idempotent op naam ──

async function vindOfMaakOrg(token, naam, typeCode, parentRef, stats) {
  const bestaand = await fhirSearch(token, 'Organization?name=' + encodeURIComponent(naam) + '&_count=5');
  const exact = bestaand.find(function (o) { return o.name === naam; });
  if (exact) {
    console.log('  Hergebruikt: ' + naam + ' (id=' + exact.id + ')');
    if (stats) stats.hergebruikt++;
    return exact.id;
  }
  const resource = {
    resourceType: 'Organization',
    name: naam,
    active: true,
    type: [{ coding: [{ system: ORG_TYPE_SYSTEM, code: typeCode, display: typeCode.charAt(0).toUpperCase() + typeCode.slice(1) }] }],
  };
  if (parentRef) resource.partOf = { reference: parentRef };
  const id = await fhirCreate(token, resource);
  if (id) {
    console.log('  Aangemaakt: ' + naam + ' (' + typeCode + ', id=' + id + ')');
    if (stats) stats.aangemaakt++;
  }
  return id;
}

// ── ECD-import ──

async function importeerClienten(token, tenantId, csv) {
  const r = await fetch(ECD + '/api/clients/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      'Authorization': 'Bearer ' + token,
      'X-Tenant-ID': tenantId,
      'X-User-Role': 'beheerder',
    },
    body: csv,
  });
  if (!r.ok) {
    const txt = await r.text().catch(function () { return ''; });
    console.log('  Import mislukt: HTTP ' + r.status + ' ' + txt.substring(0, 300));
    return null;
  }
  return await r.json();
}

// ── Cliëntgenerator (realistische NL-namen, geen BSN, geboorte 1935-1955) ──

const VOORNAMEN_V = ['Wilhelmina','Johanna','Maria','Elisabeth','Cornelia','Hendrika','Geertruida','Anna','Margaretha','Petronella','Catharina','Alida','Gerarda','Grietje','Neeltje','Adriana','Jacoba','Antonia','Christina','Willemijn'];
const VOORNAMEN_M = ['Hendrik','Cornelis','Johannes','Gerrit','Willem','Jacobus','Adrianus','Pieter','Dirk','Bernardus','Theodorus','Antonius','Nicolaas','Marinus','Albertus','Wouter','Frederik','Lambertus','Everardus','Hermanus'];
const ACHTERNAMEN = ['Jansen','de Vries','van den Berg','Bakker','Janssen','Visser','Smit','Meijer','de Boer','Mulder','de Groot','Bos','Vos','Peters','Hendriks','van Leeuwen','Dekker','Brouwer','de Wit','Dijkstra','Smits','de Graaf','van der Meer','van der Linden','Kok','Jacobs','de Jong','Vermeulen','van den Heuvel','van der Veen','van den Broek','de Bruijn','Timmermans','Schouten','van Dijk','Willemsen','Verhoeven','Hoekstra','Prins','Kuipers'];
const STRATEN = ['Dorpsstraat','Kerkstraat','Hoofdstraat','Molenweg','Lindenlaan','Beukenlaan','Schoolstraat','Stationsweg','Julianastraat','Wilhelminalaan','Oranjestraat','Nassaulaan','Emmastraat','Vondelstraat','Prins Hendrikkade'];
const PLAATSEN = ['Amsterdam','Haarlem','Zaandam','Purmerend','Hoorn','Alkmaar','Amstelveen','Hilversum','Almere','Lelystad'];
const LETTERS = ['AB','CD','EF','GH','JK','LM','NP','RS','TV','WX'];

function p2(n) { return (n < 10 ? '0' : '') + n; }

function bouwCsv(locatieNamen) {
  const header = 'achternaam;voornaam;geboortedatum;bsn;straat;huisnummer;postcode;plaats;locatie';
  const rijen = [];
  for (let i = 0; i < 80; i++) {
    const achternaam = ACHTERNAMEN[i % ACHTERNAMEN.length];
    const voornaam = (i % 2 === 0)
      ? VOORNAMEN_V[i % VOORNAMEN_V.length]
      : VOORNAMEN_M[i % VOORNAMEN_M.length];
    const jaar = 1935 + (i % 21);
    const maand = 1 + (i % 12);
    const dag = 1 + (i % 28);
    const geboortedatum = jaar + '-' + p2(maand) + '-' + p2(dag);
    const straat = STRATEN[i % STRATEN.length];
    const huisnummer = 1 + (i % 180);
    const postcode = (1011 + i) + ' ' + LETTERS[i % LETTERS.length];
    const plaats = PLAATSEN[i % PLAATSEN.length];
    const locatie = i < 20 ? locatieNamen[0]
      : i < 40 ? locatieNamen[1]
        : i < 60 ? locatieNamen[2]
          : locatieNamen[3];
    rijen.push([achternaam, voornaam, geboortedatum, '', straat, huisnummer, postcode, plaats, locatie].join(';'));
  }
  return header + '\n' + rijen.join('\n');
}

// ── Main ──

async function main() {
  console.log('');
  const auth = await login('jan@horizon.nl', 'Hz!J4n#2026pKw8');
  if (!auth || !auth.token || !auth.projectId) {
    console.error('FATAL: kon niet inloggen als jan@horizon.nl');
    process.exit(1);
  }
  const token = auth.token;
  const tenantId = auth.projectId;

  // 1. Tenant-root-Organization opzoeken (de root heeft geen partOf)
  console.log('');
  console.log('--- 1. Tenant-root ---');
  const orgs = await fhirSearch(token, 'Organization?_count=200');
  const roots = orgs.filter(function (o) { return !o.partOf; });
  const root = roots.find(function (o) { return (o.name || '').indexOf('Horizon') >= 0; }) || roots[0];
  if (!root) {
    console.error('FATAL: geen tenant-root-Organization gevonden (draai eerst seed.sh)');
    process.exit(1);
  }
  console.log('  Root: ' + root.name + ' (id=' + root.id + ')');
  const rootRef = 'Organization/' + root.id;

  // 2. Vier locaties (partOf de root)
  console.log('');
  console.log('--- 2. Locaties ---');
  const stats = { aangemaakt: 0, hergebruikt: 0 };
  const intramuraal = ['Horizon Centrum', 'Horizon Oost', 'Horizon West'];
  const extramuraal = 'Thuiszorg Regio Noord';
  const locatieIds = {};
  for (const naam of intramuraal) {
    locatieIds[naam] = await vindOfMaakOrg(token, naam, 'locatie', rootRef, stats);
  }
  locatieIds[extramuraal] = await vindOfMaakOrg(token, extramuraal, 'locatie', rootRef, stats);

  // 3. Twee afdelingen per intramurale locatie
  console.log('');
  console.log('--- 3. Afdelingen (per intramurale locatie) ---');
  const afdStats = { aangemaakt: 0, hergebruikt: 0 };
  for (const naam of intramuraal) {
    const locId = locatieIds[naam];
    if (!locId) { console.log('  WARN: geen locatie-id voor ' + naam + ', afdelingen overgeslagen'); continue; }
    const locRef = 'Organization/' + locId;
    await vindOfMaakOrg(token, naam + ' - Afdeling A', 'team', locRef, afdStats);
    await vindOfMaakOrg(token, naam + ' - Afdeling B', 'team', locRef, afdStats);
  }

  // 4. Tachtig clienten via de CSV-import-route (idempotent: sla over bij >= 60)
  console.log('');
  console.log('--- 4. Clienten (CSV-import) ---');
  const bestaandeClienten = await telPatienten(token);
  console.log('  Bestaande clienten: ' + bestaandeClienten);
  let importResultaat = null;
  if (bestaandeClienten >= 60) {
    console.log('  Er zijn al >= 60 clienten — import overgeslagen (idempotent).');
  } else {
    const csv = bouwCsv([intramuraal[0], intramuraal[1], intramuraal[2], extramuraal]);
    console.log('  CSV opgebouwd: 80 rijen (60 intramuraal, 20 thuiszorg). Importeren...');
    importResultaat = await importeerClienten(token, tenantId, csv);
  }

  // 5. Samenvatting
  console.log('');
  console.log('==========================================');
  console.log('  Seed Pilotprofiel — samenvatting');
  console.log('==========================================');
  console.log('  Locaties:   ' + stats.aangemaakt + ' aangemaakt, ' + stats.hergebruikt + ' hergebruikt (4 totaal)');
  console.log('  Afdelingen: ' + afdStats.aangemaakt + ' aangemaakt, ' + afdStats.hergebruikt + ' hergebruikt (6 totaal)');
  if (importResultaat) {
    console.log('  Import:     ' + importResultaat.totaal + ' rijen, ' + importResultaat.aangemaakt + ' aangemaakt, ' + (importResultaat.fouten ? importResultaat.fouten.length : 0) + ' fouten');
    if (importResultaat.fouten && importResultaat.fouten.length) {
      const eerste = importResultaat.fouten[0];
      console.log('              eerste fout: rij ' + eerste.rij + (eerste.veld ? ' (' + eerste.veld + ')' : '') + ' — ' + eerste.melding);
    }
  } else if (bestaandeClienten >= 60) {
    console.log('  Import:     overgeslagen (al >= 60 clienten aanwezig)');
  } else {
    console.log('  Import:     mislukt — zie melding hierboven');
  }
  console.log('');
}

main().catch(function (e) { console.error('FATAL:', e); process.exit(1); });
"

echo ""
echo "Seed pilotprofiel-script klaar."
