#!/bin/sh
# OpenZorg seed-planning-config — Seeds production-worthy organization structure
# with planning configuration (diensten, bezetting, competenties, locatie-toewijzing).
#
# Creates:
#   - Organization hierarchy (holding → locatie → team/afdeling)
#   - Dienst-configuratie per locatie
#   - Bezettingsprofielen per afdeling
#   - Competenties op medewerkers (PractitionerRole)
#   - Client-locatie toewijzingen
#
# Idempotent: checks for existing resources before creating.
#
# Usage (standalone):
#   MEDPLUM_BASE_URL=http://localhost:18103 \
#   PLANNING_BASE_URL=http://localhost:14002 \
#   ECD_BASE_URL=http://localhost:14001 \
#   sh seed-planning-config.sh

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:18103}"
PLANNING="${PLANNING_BASE_URL:-http://localhost:14002}"
ECD="${ECD_BASE_URL:-http://localhost:14001}"

echo "=== OpenZorg Seed: Planning Configuratie ==="
echo "Medplum:  $MEDPLUM"
echo "Planning: $PLANNING"
echo "ECD:      $ECD"

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
const PLANNING = '$PLANNING';
const ECD = '$ECD';

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
  return { token: tokenData.access_token, projectId: tokenData.project && tokenData.project.reference ? tokenData.project.reference.split('/')[1] : null };
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
    console.log('    WARN: create ' + resource.resourceType + ' failed: ' + r.status + ' ' + JSON.stringify(result.issue || result));
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
  if (!r.ok) {
    const err = await r.json().catch(function() { return {}; });
    console.log('    WARN: update ' + resourceType + '/' + id + ' failed: ' + r.status);
  }
  return r.ok;
}

async function fhirRead(token, resourceType, id) {
  const r = await fetch(MEDPLUM + '/fhir/R4/' + resourceType + '/' + id, {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!r.ok) return null;
  return await r.json();
}

// ── Planning/ECD service helpers ──

async function putPlanning(token, tenantId, path, body) {
  const r = await fetch(PLANNING + path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'X-Tenant-ID': tenantId,
      'X-User-Role': 'beheerder',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(function() { return ''; });
    console.log('    WARN: PUT ' + path + ' failed: ' + r.status + ' ' + txt.substring(0, 200));
    return false;
  }
  return true;
}

async function putEcd(token, tenantId, path, body) {
  const r = await fetch(ECD + path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'X-Tenant-ID': tenantId,
      'X-User-Role': 'beheerder',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(function() { return ''; });
    console.log('    WARN: PUT ' + path + ' failed: ' + r.status + ' ' + txt.substring(0, 200));
    return false;
  }
  return true;
}

// ── Organization hierarchy data ──

const ORG_TYPE_SYSTEM = 'https://openzorg.nl/CodeSystem/org-type';

const ORG_TREE = {
  name: 'Zorggroep Horizon',
  type: 'holding',
  children: [
    {
      name: 'Verpleeghuis De Zonneweide',
      type: 'locatie',
      children: [
        { name: 'Afdeling Tulp - Somatiek', type: 'team' },
        { name: 'Afdeling Roos - PG/Dementie', type: 'team' },
        { name: 'Afdeling Zonnebloem - Revalidatie', type: 'team' },
      ],
    },
    {
      name: 'Verpleeghuis Het Baken',
      type: 'locatie',
      children: [
        { name: 'Afdeling Meerval - Somatiek', type: 'team' },
        { name: 'Afdeling Waterlinie - PG/Dementie', type: 'team' },
      ],
    },
  ],
};

// ── Dienst-configuratie ──

const DIENST_CONFIG = {
  diensttypen: [
    { code: 'vroeg', naam: 'Vroege dienst', start: '07:00', eind: '15:00', kleur: '#0d9488' },
    { code: 'laat', naam: 'Late dienst', start: '15:00', eind: '23:00', kleur: '#7c3aed' },
    { code: 'nacht', naam: 'Nachtdienst', start: '23:00', eind: '07:00', kleur: '#1e3a5f' },
    { code: 'tusssen', naam: 'Tussendienst', start: '11:00', eind: '19:00', kleur: '#059669' },
  ],
};

// ── Bezettingsprofielen ──

const BEZETTING_TULP = {
  eisen: [
    { dienstCode: 'vroeg', rollen: [{ competentie: 'verpleegkundige', minimum: 2 }, { competentie: 'verzorgende', minimum: 3 }] },
    { dienstCode: 'laat', rollen: [{ competentie: 'verpleegkundige', minimum: 1 }, { competentie: 'verzorgende', minimum: 2 }] },
    { dienstCode: 'nacht', rollen: [{ competentie: 'verpleegkundige', minimum: 1 }, { competentie: 'verzorgende', minimum: 1 }] },
  ],
};

const BEZETTING_ROOS = {
  eisen: [
    { dienstCode: 'vroeg', rollen: [{ competentie: 'verpleegkundige', minimum: 2 }, { competentie: 'verzorgende', minimum: 4 }] },
    { dienstCode: 'laat', rollen: [{ competentie: 'verpleegkundige', minimum: 1 }, { competentie: 'verzorgende', minimum: 3 }] },
    { dienstCode: 'nacht', rollen: [{ competentie: 'verpleegkundige', minimum: 1 }, { competentie: 'verzorgende', minimum: 2 }] },
  ],
};

const BEZETTING_ZONNEBLOEM = {
  eisen: [
    { dienstCode: 'vroeg', rollen: [{ competentie: 'verpleegkundige', minimum: 1 }, { competentie: 'verzorgende', minimum: 2 }] },
    { dienstCode: 'laat', rollen: [{ competentie: 'verpleegkundige', minimum: 1 }, { competentie: 'verzorgende', minimum: 1 }] },
    { dienstCode: 'nacht', rollen: [{ competentie: 'verzorgende', minimum: 1 }] },
  ],
};

// ── Competenties per medewerker ──

const COMPETENTIES = [
  ['verpleegkundige', 'VH-INJECTIES', 'VH-INFUUS', 'UIT-DEMENTIE'],
  ['verpleegkundige', 'VH-INJECTIES', 'UIT-PALLIATIEF', 'UIT-WOND'],
  ['verzorgende', 'UIT-DEMENTIE', 'UIT-TILLIFT'],
  ['verzorgende', 'UIT-DIABETES', 'UIT-TILLIFT'],
  ['verzorgende', 'UIT-DEMENTIE', 'UIT-REVALIDATIE'],
  ['verpleegkundige', 'VH-INJECTIES', 'VH-KATHETERISATIE', 'UIT-GERIATRIE'],
];

// ── Main seed function ──

async function main() {
  console.log('');
  console.log('Authenticating as jan@horizon.nl...');

  const auth = await login('jan@horizon.nl', 'Hz!J4n#2026pKw8');
  if (!auth || !auth.token) {
    console.error('FATAL: Could not authenticate');
    process.exit(1);
  }
  const token = auth.token;
  const tenantId = 'zorggroep-horizon';

  // ── 1. Create Organization hierarchy ──
  console.log('');
  console.log('--- 1. Organisatie-hierarchie ---');

  const orgIds = {}; // name -> id

  async function createOrgTree(node, parentRef) {
    // Check if org already exists
    const existing = await fhirSearch(token, 'Organization?name=' + encodeURIComponent(node.name) + '&_count=1');
    let orgId;

    if (existing.length > 0) {
      orgId = existing[0].id;
      console.log('  Bestaat al: ' + node.name + ' (id=' + orgId + ')');
    } else {
      const resource = {
        resourceType: 'Organization',
        name: node.name,
        active: true,
        type: [{
          coding: [{
            system: ORG_TYPE_SYSTEM,
            code: node.type,
            display: node.type.charAt(0).toUpperCase() + node.type.slice(1),
          }],
        }],
      };
      if (parentRef) {
        resource.partOf = { reference: parentRef };
      }
      orgId = await fhirCreate(token, resource);
      if (orgId) {
        console.log('  Aangemaakt: ' + node.name + ' (' + node.type + ', id=' + orgId + ')');
      } else {
        console.log('  FOUT: Kon ' + node.name + ' niet aanmaken');
        return;
      }
    }

    orgIds[node.name] = orgId;

    if (node.children) {
      for (const child of node.children) {
        await createOrgTree(child, 'Organization/' + orgId);
      }
    }
  }

  await createOrgTree(ORG_TREE, null);
  console.log('  Organisaties totaal: ' + Object.keys(orgIds).length);

  // ── 2. Dienst-configuratie voor De Zonneweide ──
  console.log('');
  console.log('--- 2. Dienst-configuratie ---');

  const zonneweideId = orgIds['Verpleeghuis De Zonneweide'];
  if (zonneweideId) {
    const ok = await putPlanning(token, tenantId, '/api/dienst-config/' + zonneweideId, DIENST_CONFIG);
    if (ok) {
      console.log('  Dienst-config aangemaakt voor De Zonneweide (4 diensttypen)');
    }
  } else {
    console.log('  WARN: Geen orgId voor De Zonneweide, dienst-config overgeslagen');
  }

  // ── 3. Bezettingsprofielen per afdeling ──
  console.log('');
  console.log('--- 3. Bezettingsprofielen ---');

  const bezettingMap = [
    { name: 'Afdeling Tulp - Somatiek', config: BEZETTING_TULP },
    { name: 'Afdeling Roos - PG/Dementie', config: BEZETTING_ROOS },
    { name: 'Afdeling Zonnebloem - Revalidatie', config: BEZETTING_ZONNEBLOEM },
  ];

  for (const bz of bezettingMap) {
    const afdelingId = orgIds[bz.name];
    if (afdelingId) {
      const ok = await putPlanning(token, tenantId, '/api/bezetting/' + afdelingId, bz.config);
      if (ok) {
        console.log('  Bezetting: ' + bz.name + ' (' + bz.config.eisen.length + ' diensten)');
      }
    } else {
      console.log('  WARN: Geen orgId voor ' + bz.name);
    }
  }

  // ── 4. Competenties op medewerkers ──
  console.log('');
  console.log('--- 4. Competenties medewerkers ---');

  const practitioners = await fhirSearch(token, 'Practitioner?_count=20&_sort=name');
  console.log('  Gevonden: ' + practitioners.length + ' medewerkers');

  const practitionerCount = Math.min(6, practitioners.length);
  for (let i = 0; i < practitionerCount; i++) {
    const pract = practitioners[i];
    const comps = COMPETENTIES[i];

    // Check for existing PractitionerRole
    const existingRoles = await fhirSearch(token, 'PractitionerRole?practitioner=Practitioner/' + pract.id + '&_count=5');

    if (existingRoles.length > 0) {
      // Update existing PractitionerRole with competenties extension
      const role = existingRoles[0];
      role.extension = role.extension || [];
      // Remove existing competenties extension if present
      role.extension = role.extension.filter(function(ext) {
        return ext.url !== 'https://openzorg.nl/extensions/competenties';
      });
      role.extension.push({
        url: 'https://openzorg.nl/extensions/competenties',
        valueString: JSON.stringify(comps),
      });
      const ok = await fhirUpdate(token, 'PractitionerRole', role.id, role);
      if (ok) {
        console.log('  Updated: ' + (pract.name && pract.name[0] ? pract.name[0].given[0] + ' ' + pract.name[0].family : pract.id) + ' -> ' + comps.join(', '));
      }
    } else {
      // Create new PractitionerRole with competenties
      const roleId = await fhirCreate(token, {
        resourceType: 'PractitionerRole',
        active: true,
        practitioner: { reference: 'Practitioner/' + pract.id },
        extension: [{
          url: 'https://openzorg.nl/extensions/competenties',
          valueString: JSON.stringify(comps),
        }],
      });
      if (roleId) {
        console.log('  Created: ' + (pract.name && pract.name[0] ? pract.name[0].given[0] + ' ' + pract.name[0].family : pract.id) + ' -> ' + comps.join(', '));
      }
    }
  }

  // ── 5. Clienten toewijzen aan afdelingen ──
  console.log('');
  console.log('--- 5. Client-locatie toewijzingen ---');

  const patients = await fhirSearch(token, 'Patient?_count=20&_sort=name');
  console.log('  Gevonden: ' + patients.length + ' clienten');

  const locatieAssignments = [
    { afdelingName: 'Afdeling Tulp - Somatiek', startIdx: 0, count: 4, kamerStart: 101 },
    { afdelingName: 'Afdeling Roos - PG/Dementie', startIdx: 4, count: 4, kamerStart: 201 },
    { afdelingName: 'Afdeling Zonnebloem - Revalidatie', startIdx: 8, count: 2, kamerStart: 301 },
  ];

  for (const assign of locatieAssignments) {
    const afdelingId = orgIds[assign.afdelingName];
    if (!afdelingId) {
      console.log('  WARN: Geen orgId voor ' + assign.afdelingName);
      continue;
    }

    for (let i = 0; i < assign.count; i++) {
      const patIdx = assign.startIdx + i;
      if (patIdx >= patients.length) {
        console.log('  WARN: Niet genoeg clienten (verwacht index ' + patIdx + ')');
        break;
      }

      const patient = patients[patIdx];
      const kamer = assign.kamerStart + i;
      const patientName = patient.name && patient.name[0]
        ? (patient.name[0].given ? patient.name[0].given[0] : '') + ' ' + (patient.name[0].family || '')
        : patient.id;

      const ok = await putEcd(token, tenantId, '/api/clients/' + patient.id + '/locatie', {
        organisatieId: afdelingId,
        kamer: String(kamer),
      });
      if (ok) {
        console.log('  ' + patientName + ' -> ' + assign.afdelingName + ', kamer ' + kamer);
      }
    }
  }

  // ── Done ──
  console.log('');
  console.log('==========================================');
  console.log('  Seed Planning Configuratie Complete');
  console.log('==========================================');
  console.log('');
  console.log('Aangemaakt:');
  console.log('  ' + Object.keys(orgIds).length + ' organisatie-eenheden (holding + 2 locaties + 5 afdelingen)');
  console.log('  1 dienst-configuratie (4 diensttypen)');
  console.log('  3 bezettingsprofielen');
  console.log('  ' + practitionerCount + ' medewerkers met competenties');
  console.log('  ' + Math.min(10, patients.length) + ' client-locatie toewijzingen');
  console.log('');
}

main().catch(function(e) { console.error('FATAL:', e); process.exit(1); });
"

echo ""
echo "Seed planning-config script complete."
