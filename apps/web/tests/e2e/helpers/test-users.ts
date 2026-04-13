export const TEST_USERS = {
  zorgmedewerker: {
    email: "jan@horizon.nl",
    password: "Hz!J4n#2026pKw8",
    expectedRole: "beheerder", // jan is tenant admin in seed
  },
  tweedeTenant: {
    email: "maria@delinde.nl",
    password: "Ld!M4r1a#2026nRt5",
    expectedRole: "beheerder",
  },
} as const;
