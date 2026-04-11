import { describe, expect, it } from "vitest";

import { isValidAGBCode, getRequiredZibFields, validateKern } from "../kern-validatie";

describe("isValidAGBCode", () => {
  it("accepts a valid 8-digit AGB code", () => {
    expect(isValidAGBCode("12345678")).toBe(true);
  });

  it("rejects an AGB code with fewer than 8 digits", () => {
    expect(isValidAGBCode("1234567")).toBe(false);
  });

  it("rejects an AGB code with more than 8 digits", () => {
    expect(isValidAGBCode("123456789")).toBe(false);
  });

  it("rejects an AGB code with non-numeric characters", () => {
    expect(isValidAGBCode("1234567a")).toBe(false);
  });

  it("rejects an AGB code starting with 00 (invalid category)", () => {
    expect(isValidAGBCode("00123456")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidAGBCode("")).toBe(false);
  });
});

describe("getRequiredZibFields", () => {
  it("returns name and birthDate for Patient", () => {
    expect(getRequiredZibFields("Patient")).toEqual(["name", "birthDate"]);
  });

  it("returns name for Practitioner", () => {
    expect(getRequiredZibFields("Practitioner")).toEqual(["name"]);
  });

  it("returns empty array for unknown resource type", () => {
    expect(getRequiredZibFields("UnknownResource")).toEqual([]);
  });
});

describe("validateKern", () => {
  it("returns error when resourceType is missing", () => {
    const result = validateKern({});
    expect(result).toHaveLength(1);
    expect(result[0]?.field).toBe("resourceType");
    expect(result[0]?.layer).toBe("kern");
  });

  it("returns errors for Patient missing required Zib fields", () => {
    const result = validateKern({ resourceType: "Patient" });
    const fields = result.map((e) => e.field);
    expect(fields).toContain("name");
    expect(fields).toContain("birthDate");
  });

  it("passes for Patient with all required fields", () => {
    const result = validateKern({
      resourceType: "Patient",
      name: [{ family: "Jansen" }],
      birthDate: "1990-01-01",
    });
    expect(result).toHaveLength(0);
  });

  it("detects invalid BSN via elfproef", () => {
    const result = validateKern({
      resourceType: "Patient",
      name: [{ family: "Jansen" }],
      birthDate: "1990-01-01",
      identifier: [
        { system: "http://fhir.nl/fhir/NamingSystem/bsn", value: "123456789" },
      ],
    });
    const bsnErrors = result.filter((e) => e.rule === "bsn-elfproef");
    expect(bsnErrors).toHaveLength(1);
  });

  it("accepts valid BSN (123456782 passes elfproef)", () => {
    const result = validateKern({
      resourceType: "Patient",
      name: [{ family: "Jansen" }],
      birthDate: "1990-01-01",
      identifier: [
        { system: "http://fhir.nl/fhir/NamingSystem/bsn", value: "123456782" },
      ],
    });
    const bsnErrors = result.filter((e) => e.rule === "bsn-elfproef");
    expect(bsnErrors).toHaveLength(0);
  });

  it("detects invalid AGB code on Practitioner", () => {
    const result = validateKern({
      resourceType: "Practitioner",
      name: [{ family: "Arts" }],
      identifier: [
        { system: "http://fhir.nl/fhir/NamingSystem/agb-z", value: "00000000" },
      ],
    });
    const agbErrors = result.filter((e) => e.rule === "agb-validation");
    expect(agbErrors).toHaveLength(1);
  });

  it("accepts valid AGB code on Practitioner", () => {
    const result = validateKern({
      resourceType: "Practitioner",
      name: [{ family: "Arts" }],
      identifier: [
        { system: "http://fhir.nl/fhir/NamingSystem/agb-z", value: "12345678" },
      ],
    });
    const agbErrors = result.filter((e) => e.rule === "agb-validation");
    expect(agbErrors).toHaveLength(0);
  });

  it("all kern errors have layer set to 'kern'", () => {
    const result = validateKern({ resourceType: "Patient" });
    for (const error of result) {
      expect(error.layer).toBe("kern");
    }
  });
});
