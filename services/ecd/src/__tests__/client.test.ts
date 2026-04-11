import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";

// Mock global fetch to avoid calling Medplum
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/fhir+json" },
  });
}

const TENANT_HEADER = { "X-Tenant-ID": "test-tenant" };

describe("Client routes — BSN validation", () => {
  it("POST /api/clients rejects invalid BSN", async () => {
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: "Patient",
        name: [{ family: "Test" }],
        identifier: [
          { system: "http://fhir.nl/fhir/NamingSystem/bsn", value: "000000000" },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { issue: Array<{ diagnostics: string }> };
    expect(body.issue[0]?.diagnostics).toContain("elfproef");
  });

  it("POST /api/clients accepts valid BSN (123456782)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ resourceType: "Patient", id: "new-id" }, 201),
    );

    const res = await app.request("/api/clients", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: "Patient",
        name: [{ family: "Jansen" }],
        birthDate: "1990-01-01",
        identifier: [
          { system: "http://fhir.nl/fhir/NamingSystem/bsn", value: "123456782" },
        ],
      }),
    });

    expect(res.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("POST /api/clients allows Patient without BSN", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ resourceType: "Patient", id: "no-bsn" }, 201),
    );

    const res = await app.request("/api/clients", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: "Patient",
        name: [{ family: "ZonderBSN" }],
      }),
    });

    expect(res.status).toBe(201);
  });

  it("PUT /api/clients/:id rejects invalid BSN", async () => {
    const res = await app.request("/api/clients/patient-1", {
      method: "PUT",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType: "Patient",
        name: [{ family: "Test" }],
        identifier: [
          { system: "http://fhir.nl/fhir/NamingSystem/bsn", value: "111111111" },
        ],
      }),
    });

    expect(res.status).toBe(400);
  });

  it("GET /api/clients proxies to Medplum", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        resourceType: "Bundle",
        type: "searchset",
        entry: [],
      }),
    );

    const res = await app.request("/api/clients", {
      headers: TENANT_HEADER,
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("/fhir/R4/Patient");
  });

  it("GET /api/clients/:id proxies to Medplum", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ resourceType: "Patient", id: "abc" }),
    );

    const res = await app.request("/api/clients/abc", {
      headers: TENANT_HEADER,
    });

    expect(res.status).toBe(200);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("/fhir/R4/Patient/abc");
  });

  it("DELETE /api/clients/:id performs soft delete", async () => {
    // First call: GET current patient
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        resourceType: "Patient",
        id: "del-1",
        active: true,
        name: [{ family: "ToDelete" }],
      }),
    );
    // Second call: PUT with active=false
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        resourceType: "Patient",
        id: "del-1",
        active: false,
      }),
    );

    const res = await app.request("/api/clients/del-1", {
      method: "DELETE",
      headers: TENANT_HEADER,
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Check that second call sets active=false
    const putCall = mockFetch.mock.calls[1];
    const putBody = JSON.parse(putCall?.[1]?.body as string) as { active: boolean };
    expect(putBody.active).toBe(false);
  });
});
