import { describe, expect, it } from "vitest";

import { isModuleEnabled, type Tenant } from "../tenant";

const makeTenant = (modules: Tenant["enabledModules"]): Tenant => ({
  id: "test-id",
  name: "Test Zorginstelling",
  slug: "test",
  medplumProjectId: "proj-123",
  enabledModules: modules,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("isModuleEnabled", () => {
  it("returns true when module is in the tenant's enabled list", () => {
    const tenant = makeTenant(["ecd", "planning"]);
    expect(isModuleEnabled(tenant, "ecd")).toBe(true);
    expect(isModuleEnabled(tenant, "planning")).toBe(true);
  });

  it("returns false when module is not in the tenant's enabled list", () => {
    const tenant = makeTenant(["ecd"]);
    expect(isModuleEnabled(tenant, "planning")).toBe(false);
    expect(isModuleEnabled(tenant, "rapportage")).toBe(false);
  });

  it("returns false for empty module list", () => {
    const tenant = makeTenant([]);
    expect(isModuleEnabled(tenant, "ecd")).toBe(false);
  });
});
