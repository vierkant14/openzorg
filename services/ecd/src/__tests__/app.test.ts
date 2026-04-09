import { describe, expect, it } from "vitest";

import { app } from "../app.js";

interface HealthResponse {
  status: string;
  service: string;
}

interface ErrorResponse {
  error: string;
}

interface StatusResponse {
  service: string;
  tenantId: string;
  status: string;
}

describe("ECD Service", () => {
  it("returns health check", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthResponse;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("openzorg-ecd");
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
    expect(body.service).toBe("ecd");
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
});
