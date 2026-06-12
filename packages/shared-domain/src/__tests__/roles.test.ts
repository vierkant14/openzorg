import { describe, expect, it } from "vitest";

import { ALL_ROLES, getRoleDefinition, hasPermission } from "../roles";

describe("state-machine leesrechten", () => {
  // Regressie: het cliëntdossier haalt voor élke rol de Patient-state-machine
  // op om de traject-status te renderen. Zonder leesrecht volgt een 403 en
  // redirect ecdFetch de gebruiker hard naar /geen-toegang.
  it("elke rol mag state-machine-definities lezen", () => {
    for (const role of ALL_ROLES) {
      expect(hasPermission(role, "state-machines:read"), `rol ${role}`).toBe(true);
    }
  });

  it("alleen tenant-admin mag state-machines schrijven", () => {
    for (const role of ALL_ROLES) {
      expect(hasPermission(role, "state-machines:write"), `rol ${role}`).toBe(
        role === "tenant-admin",
      );
    }
  });
});

describe("getRoleDefinition", () => {
  it("returns the definition for each known role", () => {
    for (const role of ALL_ROLES) {
      const def = getRoleDefinition(role);
      expect(def.role).toBe(role);
      expect(def.displayName).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });

  it("throws for unknown role", () => {
    // @ts-expect-error testing invalid input
    expect(() => getRoleDefinition("onbekend")).toThrow("Unknown role");
  });
});
