import { describe, expect, it } from "vitest";

import { app } from "../app.js";

const TENANT_HEADER = { "X-Tenant-ID": "config-test-tenant" };

describe("Configuratie routes — Custom Fields", () => {
  it("GET /api/admin/custom-fields returns empty list initially", async () => {
    const res = await app.request("/api/admin/custom-fields", {
      headers: TENANT_HEADER,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { customFields: unknown[] };
    expect(body.customFields).toEqual([]);
  });

  it("POST /api/admin/custom-fields creates a custom field", async () => {
    const res = await app.request("/api/admin/custom-fields", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: "Patient",
        fieldName: "huisarts",
        fieldType: "string",
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      customField: { id: string; fieldName: string; layer: string };
      version: number;
    };
    expect(body.customField.fieldName).toBe("huisarts");
    expect(body.customField.layer).toBe("uitbreiding");
    expect(body.version).toBeGreaterThan(1);
  });

  it("POST /api/admin/custom-fields rejects missing required fields", async () => {
    const res = await app.request("/api/admin/custom-fields", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ resourceType: "Patient" }),
    });

    expect(res.status).toBe(400);
  });

  it("POST /api/admin/custom-fields rejects invalid fieldType", async () => {
    const res = await app.request("/api/admin/custom-fields", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: "Patient",
        fieldName: "test",
        fieldType: "invalid-type",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("DELETE /api/admin/custom-fields/:id returns 404 for unknown id", async () => {
    const res = await app.request("/api/admin/custom-fields/nonexistent", {
      method: "DELETE",
      headers: TENANT_HEADER,
    });

    expect(res.status).toBe(404);
  });
});

describe("Configuratie routes — Validation Rules", () => {
  const RULE_TENANT = { "X-Tenant-ID": "rule-test-tenant" };

  it("GET /api/admin/validation-rules returns empty list initially", async () => {
    const res = await app.request("/api/admin/validation-rules", {
      headers: RULE_TENANT,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { validationRules: unknown[] };
    expect(body.validationRules).toEqual([]);
  });

  it("POST /api/admin/validation-rules creates a rule", async () => {
    const res = await app.request("/api/admin/validation-rules", {
      method: "POST",
      headers: { ...RULE_TENANT, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: "Patient",
        fieldPath: "telecom",
        operator: "required",
        value: true,
        errorMessage: "Telefoonnummer is verplicht",
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      validationRule: { id: string; operator: string; layer: string };
      version: number;
    };
    expect(body.validationRule.operator).toBe("required");
    expect(body.validationRule.layer).toBe("uitbreiding");
  });

  it("POST /api/admin/validation-rules rejects missing fields", async () => {
    const res = await app.request("/api/admin/validation-rules", {
      method: "POST",
      headers: { ...RULE_TENANT, "Content-Type": "application/json" },
      body: JSON.stringify({ resourceType: "Patient" }),
    });

    expect(res.status).toBe(400);
  });

  it("POST /api/admin/validation-rules rejects invalid operator", async () => {
    const res = await app.request("/api/admin/validation-rules", {
      method: "POST",
      headers: { ...RULE_TENANT, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: "Patient",
        fieldPath: "name",
        operator: "INVALID",
        errorMessage: "test",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("DELETE /api/admin/validation-rules/:id returns 404 for unknown id", async () => {
    const res = await app.request("/api/admin/validation-rules/nonexistent", {
      method: "DELETE",
      headers: RULE_TENANT,
    });

    expect(res.status).toBe(404);
  });
});
