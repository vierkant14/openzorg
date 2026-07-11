/**
 * E2E-testaccounts. Sinds W3 heeft elk account een gekoppelde server-rol
 * (Practitioner rol-extensie, gezet door de seed) — de login-rolkeuze wordt
 * genegeerd. De accounts + wachtwoorden worden aangemaakt in
 * `infra/scripts/seed.sh` (tenant Horizon) en gedocumenteerd in CLAUDE.md.
 */
export const TEST_USERS = {
  tenantAdmin: { email: "jan@horizon.nl", password: "Hz!J4n#2026pKw8" },
  zorgmedewerker: { email: "zorg@horizon.nl", password: "Hz!Zorg#2026fZ4a" },
  planner: { email: "planner@horizon.nl", password: "Hz!Plan#2026pT7b" },
  teamleider: { email: "teamleider@horizon.nl", password: "Hz!Team#2026tL9c" },
  beheerder: { email: "beheer@horizon.nl", password: "Hz!Behr#2026bB3d" },
  tweedeTenant: { email: "maria@delinde.nl", password: "Ld!M4r1a#2026nRt5" },
} as const;
