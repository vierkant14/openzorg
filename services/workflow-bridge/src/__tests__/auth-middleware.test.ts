import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";
import { _clearAuthCache } from "../middleware/auth.js";

import { stubFetchMetAuth, tenantHeaders } from "./helpers.js";

describe("auth-middleware", () => {
  beforeEach(() => {
    _clearAuthCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("weigert zonder Authorization-header (401)", async () => {
    stubFetchMetAuth();
    const res = await app.request("/api/status", {
      headers: { "X-Tenant-ID": "proj-1" },
    });
    expect(res.status).toBe(401);
  });

  it("weigert een ongeldig token (401)", async () => {
    stubFetchMetAuth({ status: 401 });
    const res = await app.request("/api/status", { headers: tenantHeaders() });
    expect(res.status).toBe(401);
  });

  it("weigert wanneer X-Tenant-ID niet bij het token-project hoort (403)", async () => {
    stubFetchMetAuth({ projectId: "proj-1" });
    const res = await app.request("/api/status", {
      headers: tenantHeaders({ "X-Tenant-ID": "ander-project" }),
    });
    expect(res.status).toBe(403);
  });

  it("geeft 503 wanneer Medplum onbereikbaar is", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const res = await app.request("/api/status", { headers: tenantHeaders() });
    expect(res.status).toBe(503);
  });

  it("laat een geldig token met bijpassende tenant door", async () => {
    stubFetchMetAuth({ projectId: "proj-1" });
    const res = await app.request("/api/status", { headers: tenantHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenantId: string };
    expect(body.tenantId).toBe("proj-1");
  });

  it("staat super-admin-tokens toe voor élke tenant", async () => {
    stubFetchMetAuth({ projectId: "super-project", superAdmin: true });
    const res = await app.request("/api/status", {
      headers: tenantHeaders({ "X-Tenant-ID": "willekeurige-tenant" }),
    });
    expect(res.status).toBe(200);
  });

  it("cachet de token-verificatie (één auth/me-call voor twee requests)", async () => {
    const fetchSpy = stubFetchMetAuth({ projectId: "proj-1" });
    await app.request("/api/status", { headers: tenantHeaders() });
    await app.request("/api/status", { headers: tenantHeaders() });

    const authCalls = fetchSpy.mock.calls.filter((call) => String(call[0]).includes("/auth/me"));
    expect(authCalls).toHaveLength(1);
  });
});
