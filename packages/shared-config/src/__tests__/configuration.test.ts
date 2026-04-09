import { describe, expect, it } from "vitest";

import { isLayerModifiable } from "../configuration";

describe("isLayerModifiable", () => {
  it("returns false for kern layer", () => {
    expect(isLayerModifiable("kern")).toBe(false);
  });

  it("returns true for uitbreiding layer", () => {
    expect(isLayerModifiable("uitbreiding")).toBe(true);
  });

  it("returns true for plugin layer", () => {
    expect(isLayerModifiable("plugin")).toBe(true);
  });
});
