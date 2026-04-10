#!/usr/bin/env node

/**
 * Seed script for Medplum: creates two test tenants (projects),
 * four roles (AccessPolicies), and test users for each tenant.
 *
 * Each tenant admin registers themselves and creates the project,
 * then invites other users as project admin.
 *
 * Usage:
 *   node scripts/seed-medplum.mjs
 *
 * Requires a running Medplum instance (docker compose up).
 */

import crypto from "node:crypto";

const MEDPLUM_BASE = process.env.MEDPLUM_BASE_URL || "http://localhost:8103";
const USER_PASSWORD = "V3ilig#Zorg2026!!";

const ROLE_POLICIES = {
  beheerder: {
    name: "Beheerder",
    resource: [
      { resourceType: "Patient" },
      { resourceType: "Practitioner" },
      { resourceType: "Organization" },
      { resourceType: "RelatedPerson" },
      { resourceType: "Condition" },
      { resourceType: "Goal" },
      { resourceType: "ServiceRequest" },
      { resourceType: "Procedure" },
      { resourceType: "AllergyIntolerance" },
      { resourceType: "Observation" },
      { resourceType: "Appointment" },
      { resourceType: "AuditEvent", readonly: true },
    ],
  },
  zorgmedewerker: {
    name: "Zorgmedewerker",
    resource: [
      { resourceType: "Patient" },
      { resourceType: "RelatedPerson", readonly: true },
      { resourceType: "Condition" },
      { resourceType: "Goal" },
      { resourceType: "ServiceRequest" },
      { resourceType: "Procedure" },
      { resourceType: "AllergyIntolerance" },
      { resourceType: "Observation" },
      { resourceType: "Appointment", readonly: true },
    ],
  },
  planner: {
    name: "Planner",
    resource: [
      { resourceType: "Patient", readonly: true },
      { resourceType: "Practitioner", readonly: true },
      { resourceType: "Appointment" },
      { resourceType: "ServiceRequest" },
    ],
  },
  teamleider: {
    name: "Teamleider",
    resource: [
      { resourceType: "Patient", readonly: true },
      { resourceType: "Practitioner", readonly: true },
      { resourceType: "Condition", readonly: true },
      { resourceType: "Goal", readonly: true },
      { resourceType: "Appointment", readonly: true },
      { resourceType: "AuditEvent", readonly: true },
    ],
  },
};

const TENANTS = [
  {
    slug: "zorggroep-de-linde",
    name: "Zorggroep De Linde",
    admin: { firstName: "Anna", lastName: "de Vries", email: "anna@delinde.openzorg.local" },
    users: [
      { firstName: "Bram", lastName: "Jansen", email: "bram@delinde.openzorg.local", role: "zorgmedewerker" },
      { firstName: "Carla", lastName: "Bakker", email: "carla@delinde.openzorg.local", role: "planner" },
      { firstName: "David", lastName: "Smit", email: "david@delinde.openzorg.local", role: "teamleider" },
    ],
  },
  {
    slug: "thuiszorg-het-gooi",
    name: "Thuiszorg Het Gooi",
    admin: { firstName: "Eva", lastName: "Mulder", email: "eva@hetgooi.openzorg.local" },
    users: [
      { firstName: "Frank", lastName: "Peters", email: "frank@hetgooi.openzorg.local", role: "zorgmedewerker" },
      { firstName: "Griet", lastName: "Visser", email: "griet@hetgooi.openzorg.local", role: "planner" },
      { firstName: "Hans", lastName: "de Boer", email: "hans@hetgooi.openzorg.local", role: "teamleider" },
    ],
  },
];

// ---------- PKCE ----------

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

// ---------- API ----------

async function medplumFetch(path, options = {}) {
  const url = `${MEDPLUM_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": options.contentType || "application/json",
      ...options.headers,
    },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const msg = data?.issue?.[0]?.details?.text || JSON.stringify(data);
    throw new Error(`${options.method || "GET"} ${path} -> ${res.status}: ${msg}`);
  }
  return data;
}

// ---------- Register user + create project = tenant admin ----------

async function registerTenantAdmin(email, password, firstName, lastName, projectName) {
  const { codeVerifier, codeChallenge } = generatePKCE();

  const reg = await medplumFetch("/auth/newuser", {
    method: "POST",
    body: JSON.stringify({
      email, password, firstName, lastName,
      recaptchaToken: "skip",
      codeChallenge, codeChallengeMethod: "S256",
    }),
  });

  const proj = await medplumFetch("/auth/newproject", {
    method: "POST",
    body: JSON.stringify({ login: reg.login, projectName }),
  });

  const token = await medplumFetch("/oauth2/token", {
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    body: `grant_type=authorization_code&code=${proj.code}&code_verifier=${codeVerifier}`,
  });

  // Get project ID from /auth/me
  const me = await medplumFetch("/auth/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  return {
    token: token.access_token,
    projectId: me.project?.id,
    profileRef: me.profile?.reference,
  };
}

// ---------- Login existing user ----------

async function loginUser(email, password) {
  const { codeVerifier, codeChallenge } = generatePKCE();

  const loginRes = await medplumFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email, password, scope: "openid",
      codeChallenge, codeChallengeMethod: "S256",
    }),
  });

  let code;
  if (loginRes.memberships?.length > 0) {
    const profRes = await medplumFetch("/auth/profile", {
      method: "POST",
      body: JSON.stringify({ login: loginRes.login, profile: loginRes.memberships[0].profile }),
    });
    code = profRes.code;
  } else {
    code = loginRes.code;
  }

  const token = await medplumFetch("/oauth2/token", {
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    body: `grant_type=authorization_code&code=${code}&code_verifier=${codeVerifier}`,
  });
  return token.access_token;
}

// ---------- Main ----------

async function main() {
  console.log("OpenZorg Medplum Seed Script");
  console.log(`Server: ${MEDPLUM_BASE}\n`);

  // Wait for Medplum
  let retries = 30;
  while (retries > 0) {
    try { await medplumFetch("/healthcheck"); break; }
    catch { console.log(`Waiting for Medplum... (${retries})`); await new Promise(r => setTimeout(r, 5000)); retries--; }
  }
  if (retries === 0) { console.error("Medplum not available."); process.exit(1); }

  const results = [];

  for (const tenant of TENANTS) {
    console.log(`\n--- Tenant: ${tenant.name} ---`);

    // Step 1: Register admin user who creates the project
    console.log(`  Registering admin: ${tenant.admin.email}`);
    let adminInfo;
    try {
      adminInfo = await registerTenantAdmin(
        tenant.admin.email, USER_PASSWORD,
        tenant.admin.firstName, tenant.admin.lastName,
        tenant.name
      );
    } catch (err) {
      if (err.message.includes("already exists") || err.message.includes("Email already registered")) {
        console.log("  Already registered, logging in...");
        const tok = await loginUser(tenant.admin.email, USER_PASSWORD);
        const me = await medplumFetch("/auth/me", { headers: { Authorization: `Bearer ${tok}` } });
        adminInfo = { token: tok, projectId: me.project?.id };
      } else {
        throw err;
      }
    }
    console.log(`  Project ID: ${adminInfo.projectId}`);

    // Step 2: Create AccessPolicies
    const policyIds = {};
    for (const [roleKey, roleDef] of Object.entries(ROLE_POLICIES)) {
      console.log(`  Creating AccessPolicy: ${roleDef.name}`);
      const policy = await medplumFetch("/fhir/R4/AccessPolicy", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminInfo.token}` },
        body: JSON.stringify({
          resourceType: "AccessPolicy",
          name: `OpenZorg ${roleDef.name}`,
          resource: roleDef.resource,
        }),
      });
      policyIds[roleKey] = policy.id;
    }

    // Step 3: Invite other users via admin endpoint
    for (const user of tenant.users) {
      console.log(`  Inviting: ${user.email} (${user.role})`);
      try {
        await medplumFetch(`/admin/projects/${adminInfo.projectId}/invite`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminInfo.token}` },
          body: JSON.stringify({
            resourceType: "Practitioner",
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            sendEmail: false,
            membership: {
              accessPolicy: { reference: `AccessPolicy/${policyIds[user.role]}` },
            },
          }),
        });
      } catch (err) {
        console.warn(`  Warning: ${err.message.substring(0, 100)}`);
      }
    }

    results.push({
      name: tenant.name,
      slug: tenant.slug,
      projectId: adminInfo.projectId,
      admin: tenant.admin.email,
      users: tenant.users.map(u => u.email),
    });
  }

  // Summary
  console.log("\n\n=== Seed Complete ===\n");
  for (const t of results) {
    console.log(`${t.name} (project: ${t.projectId})`);
    console.log(`  Admin: ${t.admin} / ${USER_PASSWORD}`);
    for (const u of t.users) {
      console.log(`  ${u} / ${USER_PASSWORD}`);
    }
  }

  console.log(`\nEnvironment variables:`);
  console.log(`TENANT_A_PROJECT_ID=${results[0]?.projectId}`);
  console.log(`TENANT_B_PROJECT_ID=${results[1]?.projectId}`);
}

main().catch(err => { console.error("Seed failed:", err.message); process.exit(1); });
