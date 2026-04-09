import { describe, expect, it } from "vitest";

import { ALL_ROLES, getRoleDefinition } from "../roles";

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
