import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";

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

describe("Rapportage routes", () => {
  it("POST rejects unknown type", async () => {
    const res = await app.request("/api/clients/p1/rapportages", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "unknown" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { issue: Array<{ diagnostics: string }> };
    expect(body.issue[0]?.diagnostics).toContain("soep");
  });

  it("POST rejects SOEP without any filled fields", async () => {
    const res = await app.request("/api/clients/p1/rapportages", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "soep",
        subjectief: "",
        objectief: "",
        evaluatie: "",
        plan: "",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("POST rejects vrij without tekst", async () => {
    const res = await app.request("/api/clients/p1/rapportages", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "vrij", tekst: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("POST creates SOEP rapportage with extensions", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ resourceType: "Observation", id: "obs-1" }, 201),
    );

    const res = await app.request("/api/clients/p1/rapportages", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "soep",
        subjectief: "Klaagt over hoofdpijn",
        objectief: "Temp 37.5",
        evaluatie: "Mogelijk griep",
        plan: "Rust en paracetamol",
      }),
    });

    expect(res.status).toBe(201);
    const sentBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string) as {
      extension: Array<{ url: string }>;
      valueString: string;
    };
    expect(sentBody.extension).toHaveLength(4);
    expect(sentBody.valueString).toContain("S: Klaagt over hoofdpijn");
  });

  it("POST creates vrij rapportage", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ resourceType: "Observation", id: "obs-2" }, 201),
    );

    const res = await app.request("/api/clients/p1/rapportages", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "vrij",
        tekst: "Client voelt zich beter vandaag",
      }),
    });

    expect(res.status).toBe(201);
  });

  it("GET lists rapportages for a client", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ resourceType: "Bundle", type: "searchset", entry: [] }),
    );

    const res = await app.request("/api/clients/p1/rapportages", {
      headers: TENANT_HEADER,
    });

    expect(res.status).toBe(200);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("subject=Patient/p1");
  });
});
