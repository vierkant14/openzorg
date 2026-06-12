import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// De module bouwt de Basic-auth-header op bij import — daarom per test
// vi.resetModules + dynamische import, zodat de env-stubs effect hebben.
describe("flowable-client Basic-auth", () => {
  const fetchSpy = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
  );

  beforeEach(() => {
    vi.resetModules();
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function authHeaderNaFlowableFetch(): Promise<string | undefined> {
    const { flowableFetch } = await import("../lib/flowable-client.js");
    await flowableFetch("/service/runtime/tasks");
    const init = fetchSpy.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string> | undefined;
    return headers?.["Authorization"];
  }

  it("gebruikt FLOWABLE_ADMIN_USER en FLOWABLE_ADMIN_PASSWORD voor de auth-header", async () => {
    vi.stubEnv("FLOWABLE_ADMIN_USER", "prodbeheer");
    vi.stubEnv("FLOWABLE_ADMIN_PASSWORD", "geheim123");

    const verwacht = `Basic ${Buffer.from("prodbeheer:geheim123").toString("base64")}`;
    expect(await authHeaderNaFlowableFetch()).toBe(verwacht);
  });

  it("valt terug op admin:admin zonder env-vars", async () => {
    vi.stubEnv("FLOWABLE_ADMIN_USER", undefined);
    vi.stubEnv("FLOWABLE_ADMIN_PASSWORD", undefined);

    const verwacht = `Basic ${Buffer.from("admin:admin").toString("base64")}`;
    expect(await authHeaderNaFlowableFetch()).toBe(verwacht);
  });
});
