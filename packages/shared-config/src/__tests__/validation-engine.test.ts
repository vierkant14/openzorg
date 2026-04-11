import { describe, expect, it } from "vitest";

import type { CustomFieldDefinition, TenantConfiguration } from "../configuration";
import { applyCustomFields, extractCustomFields } from "../custom-fields";
import { validateResource } from "../validation-engine";

const baseTenantConfig: TenantConfiguration = {
  tenantId: "test-tenant",
  sector: "vvt",
  financieringstypen: ["wlz"],
  enabledModules: ["clientregistratie"],
  customFields: [],
  validationRules: [],
  version: 1,
  updatedAt: "2026-04-09T00:00:00Z",
};

describe("validateResource — Layer 1 (Kern)", () => {
  it("fails when resourceType is missing", () => {
    const result = validateResource({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "resourceType")).toBe(true);
  });

  it("fails for Patient missing required Zib fields", () => {
    const result = validateResource({ resourceType: "Patient" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
    expect(result.errors.some((e) => e.field === "birthDate")).toBe(true);
  });

  it("passes for valid Patient", () => {
    const result = validateResource({
      resourceType: "Patient",
      name: [{ family: "De Vries" }],
      birthDate: "1985-06-15",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects invalid BSN via elfproef", () => {
    const result = validateResource({
      resourceType: "Patient",
      name: [{ family: "Bakker" }],
      birthDate: "1990-01-01",
      identifier: [
        { system: "http://fhir.nl/fhir/NamingSystem/bsn", value: "000000000" },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "bsn-elfproef")).toBe(true);
  });

  it("kern errors cannot be suppressed by tenant config", () => {
    // Even with a tenant config, kern rules still run
    const result = validateResource(
      { resourceType: "Patient" },
      baseTenantConfig,
    );
    expect(result.valid).toBe(false);
    const kernErrors = result.errors.filter((e) => e.layer === "kern");
    expect(kernErrors.length).toBeGreaterThan(0);
  });
});

describe("validateResource — Layer 2 (Uitbreiding)", () => {
  it("applies a required rule from tenant config", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "req-telecom",
          resourceType: "Patient",
          fieldPath: "telecom",
          operator: "required",
          value: true,
          layer: "uitbreiding",
          errorMessage: "Telecom is verplicht voor deze organisatie",
        },
      ],
    };

    const result = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Smit" }],
        birthDate: "2000-01-01",
      },
      config,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "req-telecom")).toBe(true);
  });

  it("applies a min rule", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "min-age",
          resourceType: "Observation",
          fieldPath: "valueQuantity.value",
          operator: "min",
          value: 0,
          layer: "uitbreiding",
          errorMessage: "Waarde mag niet negatief zijn",
        },
      ],
    };

    const result = validateResource(
      {
        resourceType: "Observation",
        status: "final",
        code: { text: "Gewicht" },
        subject: { reference: "Patient/1" },
        valueQuantity: { value: -5, unit: "kg" },
      },
      config,
    );

    expect(result.errors.some((e) => e.rule === "min-age")).toBe(true);
  });

  it("applies a max rule", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "max-weight",
          resourceType: "Observation",
          fieldPath: "valueQuantity.value",
          operator: "max",
          value: 500,
          layer: "uitbreiding",
          errorMessage: "Gewicht kan niet meer dan 500 kg zijn",
        },
      ],
    };

    const result = validateResource(
      {
        resourceType: "Observation",
        status: "final",
        code: { text: "Gewicht" },
        subject: { reference: "Patient/1" },
        valueQuantity: { value: 600, unit: "kg" },
      },
      config,
    );

    expect(result.errors.some((e) => e.rule === "max-weight")).toBe(true);
  });

  it("applies a pattern rule", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "phone-pattern",
          resourceType: "Patient",
          fieldPath: "telecom.value",
          operator: "pattern",
          value: "^\\+31",
          layer: "uitbreiding",
          errorMessage: "Telefoonnummer moet beginnen met +31",
        },
      ],
    };

    const result = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Kool" }],
        birthDate: "1990-01-01",
        telecom: { value: "0612345678" },
      },
      config,
    );

    expect(result.errors.some((e) => e.rule === "phone-pattern")).toBe(true);
  });

  it("applies an 'in' rule", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "status-in",
          resourceType: "Observation",
          fieldPath: "status",
          operator: "in",
          value: ["final", "amended"],
          layer: "uitbreiding",
          errorMessage: "Status moet 'final' of 'amended' zijn",
        },
      ],
    };

    const result = validateResource(
      {
        resourceType: "Observation",
        status: "preliminary",
        code: { text: "Test" },
        subject: { reference: "Patient/1" },
      },
      config,
    );

    expect(result.errors.some((e) => e.rule === "status-in")).toBe(true);
  });

  it("applies a minLength rule", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "name-minlen",
          resourceType: "Organization",
          fieldPath: "name",
          operator: "minLength",
          value: 3,
          layer: "uitbreiding",
          errorMessage: "Naam moet minimaal 3 tekens zijn",
        },
      ],
    };

    const result = validateResource(
      { resourceType: "Organization", name: "AB" },
      config,
    );

    expect(result.errors.some((e) => e.rule === "name-minlen")).toBe(true);
  });

  it("applies a maxLength rule", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "name-maxlen",
          resourceType: "Organization",
          fieldPath: "name",
          operator: "maxLength",
          value: 5,
          layer: "uitbreiding",
          errorMessage: "Naam mag maximaal 5 tekens zijn",
        },
      ],
    };

    const result = validateResource(
      { resourceType: "Organization", name: "Zeer Lange Naam" },
      config,
    );

    expect(result.errors.some((e) => e.rule === "name-maxlen")).toBe(true);
  });

  it("only applies rules matching the resource type", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "practitioner-rule",
          resourceType: "Practitioner",
          fieldPath: "telecom",
          operator: "required",
          value: true,
          layer: "uitbreiding",
          errorMessage: "Telecom is verplicht",
        },
      ],
    };

    const result = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Test" }],
        birthDate: "1990-01-01",
      },
      config,
    );

    // No practitioner rules applied to patient
    expect(result.errors.some((e) => e.rule === "practitioner-rule")).toBe(false);
  });

  it("passes when all Layer 2 rules are satisfied", () => {
    const config: TenantConfiguration = {
      ...baseTenantConfig,
      validationRules: [
        {
          id: "req-telecom",
          resourceType: "Patient",
          fieldPath: "telecom",
          operator: "required",
          value: true,
          layer: "uitbreiding",
          errorMessage: "Telecom is verplicht",
        },
      ],
    };

    const result = validateResource(
      {
        resourceType: "Patient",
        name: [{ family: "Jansen" }],
        birthDate: "1990-01-01",
        telecom: [{ value: "+31612345678" }],
      },
      config,
    );

    expect(result.valid).toBe(true);
  });
});

describe("Custom fields — apply and extract", () => {
  const customFieldDefs: CustomFieldDefinition[] = [
    {
      id: "cf-1",
      resourceType: "Patient",
      fieldName: "huisarts-naam",
      fieldType: "string",
      required: false,
      extensionUrl: "https://openzorg.nl/extensions/huisarts-naam",
      layer: "uitbreiding",
    },
    {
      id: "cf-2",
      resourceType: "Patient",
      fieldName: "diabetes-type",
      fieldType: "number",
      required: false,
      extensionUrl: "https://openzorg.nl/extensions/diabetes-type",
      layer: "uitbreiding",
    },
    {
      id: "cf-3",
      resourceType: "Patient",
      fieldName: "is-roker",
      fieldType: "boolean",
      required: false,
      extensionUrl: "https://openzorg.nl/extensions/is-roker",
      layer: "uitbreiding",
    },
  ];

  it("applies string custom field as FHIR extension", () => {
    const resource = { resourceType: "Patient" };
    const result = applyCustomFields(resource, customFieldDefs, {
      "huisarts-naam": "Dr. Visser",
    });

    const extensions = result["extension"] as Array<{ url: string; valueString?: string }>;
    expect(extensions).toHaveLength(1);
    expect(extensions[0]?.url).toBe("https://openzorg.nl/extensions/huisarts-naam");
    expect(extensions[0]?.valueString).toBe("Dr. Visser");
  });

  it("extracts custom fields from FHIR extensions", () => {
    const resource = {
      resourceType: "Patient",
      extension: [
        { url: "https://openzorg.nl/extensions/huisarts-naam", valueString: "Dr. Bakker" },
        { url: "https://openzorg.nl/extensions/diabetes-type", valueInteger: 2 },
        { url: "https://openzorg.nl/extensions/is-roker", valueBoolean: false },
      ],
    };

    const values = extractCustomFields(resource, customFieldDefs);
    expect(values["huisarts-naam"]).toBe("Dr. Bakker");
    expect(values["diabetes-type"]).toBe(2);
    expect(values["is-roker"]).toBe(false);
  });

  it("round-trips: apply then extract returns original values", () => {
    const resource = { resourceType: "Patient" };
    const input = { "huisarts-naam": "Dr. Mol", "diabetes-type": 1, "is-roker": true };

    const withFields = applyCustomFields(resource, customFieldDefs, input);
    const extracted = extractCustomFields(withFields, customFieldDefs);

    expect(extracted["huisarts-naam"]).toBe("Dr. Mol");
    expect(extracted["diabetes-type"]).toBe(1);
    expect(extracted["is-roker"]).toBe(true);
  });

  it("preserves existing non-custom extensions", () => {
    const resource = {
      resourceType: "Patient",
      extension: [
        { url: "http://other-system.nl/ext/something", valueString: "keep me" },
      ],
    };

    const result = applyCustomFields(resource, customFieldDefs, {
      "huisarts-naam": "Dr. Test",
    });

    const extensions = result["extension"] as Array<{ url: string }>;
    expect(extensions).toHaveLength(2);
    expect(extensions.some((e) => e.url === "http://other-system.nl/ext/something")).toBe(true);
  });
});
