import { describe, expect, it } from "vitest";

import { isValidBSN } from "../fhir-types";

describe("isValidBSN", () => {
  it("returns true for a valid BSN", () => {
    // Known valid BSNs (pass 11-proef)
    expect(isValidBSN("123456782")).toBe(true);
    expect(isValidBSN("111222333")).toBe(true);
  });

  it("returns false for an invalid BSN", () => {
    expect(isValidBSN("123456789")).toBe(false);
    expect(isValidBSN("000000000")).toBe(false);
  });

  it("returns false for non-9-digit strings", () => {
    expect(isValidBSN("12345678")).toBe(false);
    expect(isValidBSN("1234567890")).toBe(false);
    expect(isValidBSN("abcdefghi")).toBe(false);
    expect(isValidBSN("")).toBe(false);
  });
});
