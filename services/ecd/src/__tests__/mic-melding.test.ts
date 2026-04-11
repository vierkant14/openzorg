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

describe("MIC Melding routes", () => {
  it("POST rejects missing datum", async () => {
    const res = await app.request("/api/mic-meldingen", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        ernst: "ernstig",
        betrokkenClient: "p1",
        betrokkenMedewerker: "pr1",
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { issue: Array<{ diagnostics: string }> };
    expect(body.issue[0]?.diagnostics).toContain("Datum");
  });

  it("POST rejects missing ernst", async () => {
    const res = await app.request("/api/mic-meldingen", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        datum: "2026-04-09",
        betrokkenClient: "p1",
        betrokkenMedewerker: "pr1",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("POST rejects missing betrokkenClient", async () => {
    const res = await app.request("/api/mic-meldingen", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        datum: "2026-04-09",
        ernst: "ernstig",
        betrokkenMedewerker: "pr1",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("POST rejects missing betrokkenMedewerker", async () => {
    const res = await app.request("/api/mic-meldingen", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        datum: "2026-04-09",
        ernst: "ernstig",
        betrokkenClient: "p1",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("POST creates MIC melding as AuditEvent", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ resourceType: "AuditEvent", id: "mic-1" }, 201),
    );

    const res = await app.request("/api/mic-meldingen", {
      method: "POST",
      headers: { ...TENANT_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        datum: "2026-04-09T10:00:00Z",
        ernst: "ernstig",
        beschrijving: "Client gevallen in badkamer",
        betrokkenClient: "patient-123",
        betrokkenMedewerker: "practitioner-456",
      }),
    });

    expect(res.status).toBe(201);
    const sentBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string) as {
      resourceType: string;
      agent: Array<{ who: { reference: string } }>;
      entity: Array<{ what: { reference: string } }>;
    };
    expect(sentBody.resourceType).toBe("AuditEvent");
    expect(sentBody.agent[0]?.who.reference).toBe("Practitioner/practitioner-456");
    expect(sentBody.entity[0]?.what.reference).toBe("Patient/patient-123");
  });

  it("GET lists MIC meldingen", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ resourceType: "Bundle", type: "searchset", entry: [] }),
    );

    const res = await app.request("/api/mic-meldingen", {
      headers: TENANT_HEADER,
    });

    expect(res.status).toBe(200);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain("AuditEvent");
  });
});
