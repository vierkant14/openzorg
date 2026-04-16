import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database module before importing app
vi.mock("../lib/db.js", () => {
  const storage = new Map<string, { id: string; tenant_id: string; config_type: string; config_data: unknown; created_at: string }>();
  let counter = 0;

  return {
    pool: {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        const text = sql.trim();

        // getTenantUuid — always return a fake UUID for test tenants
        if (text.includes("FROM openzorg.tenants")) {
          return { rows: [{ id: "00000000-0000-0000-0000-000000000001" }] };
        }

        // SELECT tenant_configurations
        if (text.startsWith("SELECT") && text.includes("tenant_configurations")) {
          const tenantId = params?.[0] as string;
          const configType = text.includes("custom_field") ? "custom_field" : "validation_rule";

          // Single item lookup (PATCH/DELETE)
          if (text.includes("WHERE id =")) {
            const id = params?.[0] as string;
            const item = storage.get(id);
            if (item && item.tenant_id === (params?.[1] as string) && item.config_type === configType) {
              return { rows: [item] };
            }
            return { rows: [] };
          }

          // List
          const rows = [...storage.values()].filter(
            (r) => r.tenant_id === tenantId && r.config_type === configType,
          );
          return { rows };
        }

        // INSERT
        if (text.startsWith("INSERT")) {
          const id = `cfg-${++counter}`;
          const tenantId = params?.[0] as string;
          const configType = text.includes("custom_field") ? "custom_field" : "validation_rule";
          const configData = typeof params?.[1] === "string" ? JSON.parse(params[1]) : params?.[1];
          const row = { id, tenant_id: tenantId, config_type: configType, config_data: configData, created_at: new Date().toISOString() };
          storage.set(id, row);
          return { rows: [row] };
        }

        // UPDATE
        if (text.startsWith("UPDATE")) {
          const id = params?.[1] as string;
          const item = storage.get(id);
          if (item) {
            const configData = typeof params?.[0] === "string" ? JSON.parse(params[0]) : params?.[0];
            item.config_data = configData;
          }
          return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
        }

        // DELETE
        if (text.startsWith("DELETE")) {
          const id = params?.[0] as string;
          const deleted = storage.delete(id);
          return { rows: [], rowCount: deleted ? 1 : 0 };
        }

        return { rows: [], rowCount: 0 };
      }),
    },
  };
});

import { app } from "../app.js";

const TENANT_HEADER = { "X-Tenant-ID": "config-test-tenant" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Configuratie routes — Custom Fields", () => {
  it("GET /api/admin/custom-fields returns list", async () => {
    const res = await app.request("/api/admin/custom-fields", {
      headers: TENANT_HEADER,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { customFields: unknown[] };
    expect(Array.isArray(body.customFields)).toBe(true);
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
    };
    expect(body.customField.fieldName).toBe("huisarts");
    expect(body.customField.layer).toBe("uitbreiding");
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
});

describe("Configuratie routes — Validation Rules", () => {
  const RULE_TENANT = { "X-Tenant-ID": "rule-test-tenant" };

  it("GET /api/admin/validation-rules returns list", async () => {
    const res = await app.request("/api/admin/validation-rules", {
      headers: RULE_TENANT,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { rules: unknown[] };
    expect(Array.isArray(body.rules)).toBe(true);
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
    const body = (await res.json()) as { id: string; operator: string };
    expect(body.operator).toBe("required");
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
});
