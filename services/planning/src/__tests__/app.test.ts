import { describe, expect, it } from "vitest";

import { app } from "../app.js";

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

interface ErrorResponse {
  error: string;
}

interface StatusResponse {
  service: string;
  tenantId: string;
  status: string;
}

interface OperationOutcomeResponse {
  resourceType: string;
  issue: Array<{
    severity: string;
    code: string;
    diagnostics: string;
  }>;
}

describe("Planning Service", () => {
  it("returns health check", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthResponse;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("openzorg-planning");
    expect(body.timestamp).toBeDefined();
  });

  it("requires tenant header for API routes", async () => {
    const res = await app.request("/api/status");
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error).toContain("X-Tenant-ID");
  });

  it("returns status with tenant context", async () => {
    const res = await app.request("/api/status", {
      headers: { "X-Tenant-ID": "tenant-a" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as StatusResponse;
    expect(body.service).toBe("planning");
    expect(body.tenantId).toBe("tenant-a");
  });

  it("isolates tenant context between requests", async () => {
    const resA = await app.request("/api/status", {
      headers: { "X-Tenant-ID": "tenant-a" },
    });
    const resB = await app.request("/api/status", {
      headers: { "X-Tenant-ID": "tenant-b" },
    });

    const bodyA = (await resA.json()) as StatusResponse;
    const bodyB = (await resB.json()) as StatusResponse;

    expect(bodyA.tenantId).toBe("tenant-a");
    expect(bodyB.tenantId).toBe("tenant-b");
    expect(bodyA.tenantId).not.toBe(bodyB.tenantId);
  });

  it("rejects appointment with start after end", async () => {
    const res = await app.request("/api/afspraken", {
      method: "POST",
      headers: {
        "X-Tenant-ID": "tenant-a",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "booked",
        start: "2026-04-15T14:00:00Z",
        end: "2026-04-15T13:00:00Z",
        participant: [
          { actor: { reference: "Patient/123" }, status: "accepted" },
          { actor: { reference: "Practitioner/456" }, status: "accepted" },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as OperationOutcomeResponse;
    expect(body.resourceType).toBe("OperationOutcome");
    expect(body.issue[0]?.diagnostics).toBe("Starttijd moet voor eindtijd liggen");
  });

  it("rejects appointment without patient reference", async () => {
    const res = await app.request("/api/afspraken", {
      method: "POST",
      headers: {
        "X-Tenant-ID": "tenant-a",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "booked",
        start: "2026-04-15T13:00:00Z",
        end: "2026-04-15T14:00:00Z",
        participant: [
          { actor: { reference: "Practitioner/456" }, status: "accepted" },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as OperationOutcomeResponse;
    expect(body.issue[0]?.diagnostics).toBe("Client referentie is vereist");
  });

  it("rejects appointment without practitioner reference", async () => {
    const res = await app.request("/api/afspraken", {
      method: "POST",
      headers: {
        "X-Tenant-ID": "tenant-a",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "booked",
        start: "2026-04-15T13:00:00Z",
        end: "2026-04-15T14:00:00Z",
        participant: [
          { actor: { reference: "Patient/123" }, status: "accepted" },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as OperationOutcomeResponse;
    expect(body.issue[0]?.diagnostics).toBe("Medewerker referentie is vereist");
  });
});
