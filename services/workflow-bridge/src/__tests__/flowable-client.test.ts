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

describe("flowable-client tenant-native API", () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  function stubFetch(antwoorden: Array<{ status: number; body: unknown }>): void {
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        const antwoord = antwoorden[Math.min(i, antwoorden.length - 1)];
        i += 1;
        const status = antwoord?.status ?? 200;
        // Een 204-Response mag geen body hebben (Response-constructor-regel)
        const body = status === 204 ? null : JSON.stringify(antwoord?.body ?? {});
        return new Response(body, {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  }

  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queryTasks filtert native op tenantId en geeft params door", async () => {
    stubFetch([{ status: 200, body: { data: [{ id: "t1", tenantId: "proj-1" }] } }]);
    const { queryTasks } = await import("../lib/flowable-client.js");

    const taken = await queryTasks({ tenantId: "proj-1", candidateGroup: "zorgmedewerker" });

    expect(calls[0]?.url).toContain("tenantId=proj-1");
    expect(calls[0]?.url).toContain("candidateGroup=zorgmedewerker");
    expect(taken).toHaveLength(1);
    expect(taken[0]?.id).toBe("t1");
  });

  it("queryTasks kan op processInstanceId filteren", async () => {
    stubFetch([{ status: 200, body: { data: [] } }]);
    const { queryTasks } = await import("../lib/flowable-client.js");

    await queryTasks({ tenantId: "proj-1", processInstanceId: "pi-9" });

    expect(calls[0]?.url).toContain("processInstanceId=pi-9");
    expect(calls[0]?.url).toContain("tenantId=proj-1");
  });

  it("verifyTaskTenant gooit bij tenant-mismatch", async () => {
    stubFetch([{ status: 200, body: { id: "t1", tenantId: "andere-tenant" } }]);
    const { verifyTaskTenant } = await import("../lib/flowable-client.js");

    await expect(verifyTaskTenant("t1", "proj-1")).rejects.toThrow(/tenant/i);
  });

  it("verifyTaskTenant gooit óók bij ontbrekende tenant (fail-closed, geen legacy-fallback)", async () => {
    stubFetch([{ status: 200, body: { id: "t1", tenantId: "" } }]);
    const { verifyTaskTenant } = await import("../lib/flowable-client.js");

    await expect(verifyTaskTenant("t1", "proj-1")).rejects.toThrow(/tenant/i);
  });

  it("verifyTaskTenant retourneert de taakdetails bij een match", async () => {
    stubFetch([{ status: 200, body: { id: "t1", name: "Beoordeel aanmelding", tenantId: "proj-1" } }]);
    const { verifyTaskTenant } = await import("../lib/flowable-client.js");

    const taak = await verifyTaskTenant("t1", "proj-1");
    expect(taak.name).toBe("Beoordeel aanmelding");
  });

  it("startProcess stuurt native tenantId én de tenant-variabele mee", async () => {
    stubFetch([{ status: 201, body: { id: "pi-1", tenantId: "proj-1" } }]);
    const { startProcess } = await import("../lib/flowable-client.js");

    await startProcess("intake-proces", { clientRef: "Patient/1" }, "proj-1");

    const body = JSON.parse(String(calls[0]?.init?.body ?? "{}")) as Record<string, unknown>;
    expect(body["processDefinitionKey"]).toBe("intake-proces");
    expect(body["tenantId"]).toBe("proj-1");
    expect(body["variables"]).toContainEqual({ name: "tenantId", value: "proj-1" });
    expect(body["variables"]).toContainEqual({ name: "clientRef", value: "Patient/1" });
  });

  it("deployProcess stuurt het tenantId-form-veld mee", async () => {
    stubFetch([{ status: 201, body: { id: "d1", tenantId: "proj-1" } }]);
    const { deployProcess } = await import("../lib/flowable-client.js");

    await deployProcess("<definitions/>", "intake-proces", "proj-1");

    const formData = calls[0]?.init?.body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("tenantId")).toBe("proj-1");
  });

  it("cancelProcessInstance verifieert de tenant vóór verwijderen", async () => {
    stubFetch([
      { status: 200, body: { id: "pi-1", tenantId: "andere-tenant" } },
      { status: 204, body: {} },
    ]);
    const { cancelProcessInstance } = await import("../lib/flowable-client.js");

    await expect(cancelProcessInstance("pi-1", "proj-1", "test")).rejects.toThrow(/tenant/i);
    // Alleen de GET is uitgevoerd; nooit een DELETE naar Flowable gestuurd
    expect(calls).toHaveLength(1);
  });

  it("cancelProcessInstance verwijdert mét reden wanneer de tenant klopt", async () => {
    stubFetch([
      { status: 200, body: { id: "pi-1", tenantId: "proj-1" } },
      { status: 204, body: {} },
    ]);
    const { cancelProcessInstance } = await import("../lib/flowable-client.js");

    await cancelProcessInstance("pi-1", "proj-1", "dubbel gestart");

    expect(calls[1]?.init?.method).toBe("DELETE");
    expect(calls[1]?.url).toContain("deleteReason=dubbel%20gestart");
  });

  it("getProcessDefinitions filtert op tenant", async () => {
    stubFetch([{ status: 200, body: { data: [] } }]);
    const { getProcessDefinitions } = await import("../lib/flowable-client.js");

    await getProcessDefinitions("proj-1");
    expect(calls[0]?.url).toContain("tenantId=proj-1");
  });

  it("claimTask en unclaimTask sturen de juiste Flowable-actie", async () => {
    stubFetch([{ status: 200, body: {} }]);
    const { claimTask, unclaimTask } = await import("../lib/flowable-client.js");

    await claimTask("t1", "prac-9");
    let body = JSON.parse(String(calls[0]?.init?.body ?? "{}")) as Record<string, unknown>;
    expect(body).toEqual({ action: "claim", assignee: "prac-9" });

    await unclaimTask("t1");
    body = JSON.parse(String(calls[1]?.init?.body ?? "{}")) as Record<string, unknown>;
    expect(body["action"]).toBe("claim");
    expect(body["assignee"]).toBeNull();
  });
});
