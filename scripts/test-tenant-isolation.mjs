#!/usr/bin/env node

/**
 * Tenant Isolation Test
 *
 * Proves that tenant A cannot see tenant B's data, even when
 * both tenants are on the same Medplum instance.
 *
 * This test:
 * 1. Seeds two tenants (if not already seeded)
 * 2. Creates a Patient in tenant A
 * 3. Creates a Patient in tenant B
 * 4. Verifies tenant A can only see its own Patient
 * 5. Verifies tenant B can only see its own Patient
 * 6. Verifies cross-tenant access is blocked
 *
 * Usage:
 *   node scripts/test-tenant-isolation.mjs
 *
 * Requires TENANT_A_PROJECT_ID and TENANT_B_PROJECT_ID in env,
 * or run seed-medplum.mjs first.
 */

import crypto from "node:crypto";

const MEDPLUM_BASE = process.env.MEDPLUM_BASE_URL || "http://localhost:8103";
const USER_PASSWORD = "V3ilig#Zorg2026!!";

// Test users from seed data
const TENANT_A_USER = "anna@delinde.openzorg.local";
const TENANT_B_USER = "eva@hetgooi.openzorg.local";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

async function loginAsUser(email, password) {
  const { codeVerifier, codeChallenge } = generatePKCE();

  const loginRes = await fetch(`${MEDPLUM_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      scope: "openid",
      codeChallenge,
      codeChallengeMethod: "S256",
    }),
  });

  const loginData = await loginRes.json();

  let code;
  if (loginData.memberships?.length > 0) {
    const profileRes = await fetch(`${MEDPLUM_BASE}/auth/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login: loginData.login,
        profile: loginData.memberships[0].profile,
      }),
    });
    const profileData = await profileRes.json();
    code = profileData.code;
  } else {
    code = loginData.code;
  }

  const tokenRes = await fetch(`${MEDPLUM_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=authorization_code&code=${code}&code_verifier=${codeVerifier}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function createPatient(token, name) {
  const res = await fetch(`${MEDPLUM_BASE}/fhir/R4/Patient`, {
    method: "POST",
    headers: {
      "Content-Type": "application/fhir+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      resourceType: "Patient",
      name: [{ family: name, given: ["Test"] }],
      birthDate: "1990-01-01",
    }),
  });

  return res.json();
}

async function searchPatients(token) {
  const res = await fetch(`${MEDPLUM_BASE}/fhir/R4/Patient`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function getPatientById(token, patientId) {
  const res = await fetch(`${MEDPLUM_BASE}/fhir/R4/Patient/${patientId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: await res.json() };
}

async function main() {
  console.log("=== OpenZorg Tenant Isolation Test ===\n");

  // Step 1: Login as both users
  console.log("1. Authenticating test users...");
  let tokenA, tokenB;
  try {
    tokenA = await loginAsUser(TENANT_A_USER, USER_PASSWORD);
    assert(!!tokenA, `Logged in as ${TENANT_A_USER}`);
  } catch (err) {
    console.error(`   Cannot login as ${TENANT_A_USER}: ${err.message}`);
    console.error("   Did you run: node scripts/seed-medplum.mjs ?");
    process.exit(1);
  }

  try {
    tokenB = await loginAsUser(TENANT_B_USER, USER_PASSWORD);
    assert(!!tokenB, `Logged in as ${TENANT_B_USER}`);
  } catch (err) {
    console.error(`   Cannot login as ${TENANT_B_USER}: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Create patients in each tenant
  console.log("\n2. Creating test patients...");
  const patientA = await createPatient(tokenA, "TenantA-Isolatietest");
  assert(patientA.id, `Created patient in tenant A: ${patientA.id}`);

  const patientB = await createPatient(tokenB, "TenantB-Isolatietest");
  assert(patientB.id, `Created patient in tenant B: ${patientB.id}`);

  // Step 3: Verify each tenant can see its own patient
  console.log("\n3. Verifying own-tenant access...");
  const searchA = await searchPatients(tokenA);
  const foundOwnA = searchA.entry?.some((e) => e.resource?.id === patientA.id);
  assert(foundOwnA, "Tenant A can see its own patient");

  const searchB = await searchPatients(tokenB);
  const foundOwnB = searchB.entry?.some((e) => e.resource?.id === patientB.id);
  assert(foundOwnB, "Tenant B can see its own patient");

  // Step 4: Verify cross-tenant isolation
  console.log("\n4. Verifying cross-tenant isolation...");

  // Tenant A should NOT see tenant B's patient in search results
  const crossSearchA = searchA.entry?.some((e) => e.resource?.id === patientB.id);
  assert(!crossSearchA, "Tenant A search does NOT include tenant B's patient");

  // Tenant B should NOT see tenant A's patient in search results
  const crossSearchB = searchB.entry?.some((e) => e.resource?.id === patientA.id);
  assert(!crossSearchB, "Tenant B search does NOT include tenant A's patient");

  // Direct access by ID should also fail
  const directAccessAtoB = await getPatientById(tokenA, patientB.id);
  assert(
    directAccessAtoB.status === 404 || directAccessAtoB.status === 403,
    `Tenant A cannot access tenant B's patient by ID (got ${directAccessAtoB.status})`,
  );

  const directAccessBtoA = await getPatientById(tokenB, patientA.id);
  assert(
    directAccessBtoA.status === 404 || directAccessBtoA.status === 403,
    `Tenant B cannot access tenant A's patient by ID (got ${directAccessBtoA.status})`,
  );

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    console.error("\nTENANT ISOLATION TEST FAILED");
    process.exit(1);
  } else {
    console.log("\nTENANT ISOLATION VERIFIED");
  }
}

main().catch((err) => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
