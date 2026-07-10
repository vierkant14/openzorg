import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";
import { writeWorkflowAudit } from "../lib/audit.js";
import {
  claimTask,
  queryTasks,
  verifyTaskTenant,
  type FlowableTaak,
  type TakenQuery,
} from "../lib/flowable-client.js";
import { _clearAuthCache } from "../middleware/auth.js";

import { stubFetchMetAuth, tenantHeaders } from "./helpers.js";

vi.mock("../lib/flowable-client.js", () => ({
  queryTasks: vi.fn(),
  claimTask: vi.fn(),
  unclaimTask: vi.fn(),
  completeTask: vi.fn(),
  verifyTaskTenant: vi.fn(),
}));

vi.mock("../lib/audit.js", () => ({
  writeWorkflowAudit: vi.fn(),
}));

const queryTasksMock = vi.mocked(queryTasks);
const claimTaskMock = vi.mocked(claimTask);
const verifyMock = vi.mocked(verifyTaskTenant);
const auditMock = vi.mocked(writeWorkflowAudit);

function taak(overrides: Partial<FlowableTaak> = {}): FlowableTaak {
  return {
    id: "t1",
    name: "Beoordeel aanmelding",
    createTime: "2026-07-10T10:00:00Z",
    tenantId: "proj-1",
    processDefinitionId: "intake-proces:1:99",
    processInstanceId: "pi-1",
    ...overrides,
  };
}

describe("taken-route", () => {
  beforeEach(() => {
    _clearAuthCache();
    vi.clearAllMocks();
    stubFetchMetAuth({ projectId: "proj-1", profileRef: "Practitioner/prac-9" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scope=mijn gebruikt de token-identiteit als assignee", async () => {
    queryTasksMock.mockResolvedValue([taak({ assignee: "prac-9" })]);

    const res = await app.request("/api/taken?scope=mijn", { headers: tenantHeaders() });

    expect(res.status).toBe(200);
    const verwacht: TakenQuery = { tenantId: "proj-1", assignee: "prac-9" };
    expect(queryTasksMock).toHaveBeenCalledWith(verwacht);
  });

  it("scope=beschikbaar filtert onbeclaimde taken voor de rol", async () => {
    queryTasksMock.mockResolvedValue([
      taak({ id: "t1", assignee: null }),
      taak({ id: "t2", assignee: "iemand-anders" }),
    ]);

    const res = await app.request("/api/taken?scope=beschikbaar", {
      headers: tenantHeaders({ "X-User-Role": "zorgmedewerker" }),
    });

    expect(queryTasksMock).toHaveBeenCalledWith({ tenantId: "proj-1", candidateGroup: "zorgmedewerker" });
    const body = (await res.json()) as { data: FlowableTaak[]; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]?.id).toBe("t1");
  });

  it("scope=alle is verboden voor zorgmedewerker (403)", async () => {
    const res = await app.request("/api/taken?scope=alle", {
      headers: tenantHeaders({ "X-User-Role": "zorgmedewerker" }),
    });
    expect(res.status).toBe(403);
    expect(queryTasksMock).not.toHaveBeenCalled();
  });

  it("scope=alle werkt voor teamleider met één tenant-brede query", async () => {
    queryTasksMock.mockResolvedValue([taak()]);
    const res = await app.request("/api/taken?scope=alle", {
      headers: tenantHeaders({ "X-User-Role": "teamleider" }),
    });
    expect(res.status).toBe(200);
    expect(queryTasksMock).toHaveBeenCalledTimes(1);
    expect(queryTasksMock).toHaveBeenCalledWith({ tenantId: "proj-1" });
  });

  it("processInstanceId-filter levert de taken van één instantie", async () => {
    queryTasksMock.mockResolvedValue([taak()]);
    const res = await app.request("/api/taken?processInstanceId=pi-7", {
      headers: tenantHeaders(),
    });
    expect(res.status).toBe(200);
    expect(queryTasksMock).toHaveBeenCalledWith({ tenantId: "proj-1", processInstanceId: "pi-7" });
  });

  it("zonder scope of processInstanceId → 400", async () => {
    const res = await app.request("/api/taken", { headers: tenantHeaders() });
    expect(res.status).toBe(400);
  });

  it("deprecated ?userId-alias blijft werken tijdens de overgang (tenant-native)", async () => {
    queryTasksMock
      .mockResolvedValueOnce([taak({ id: "t1" })])
      .mockResolvedValueOnce([taak({ id: "t1" }), taak({ id: "t2" })]);

    const res = await app.request("/api/taken?userId=zorgmedewerker", {
      headers: tenantHeaders(),
    });

    expect(res.status).toBe(200);
    expect(queryTasksMock).toHaveBeenCalledWith({ tenantId: "proj-1", assignee: "zorgmedewerker" });
    expect(queryTasksMock).toHaveBeenCalledWith({ tenantId: "proj-1", candidateGroup: "zorgmedewerker" });
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(2); // gededuplicaat
  });

  it("claim zonder body claimt op de token-identiteit en audit de persoon", async () => {
    verifyMock.mockResolvedValue(taak({ assignee: null }));

    const res = await app.request("/api/taken/t1/claim", {
      method: "POST",
      headers: tenantHeaders({ "X-User-Role": "zorgmedewerker" }),
    });

    expect(res.status).toBe(200);
    expect(claimTaskMock).toHaveBeenCalledWith("t1", "prac-9");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workflow.task.claim",
        userId: "Practitioner/prac-9",
        details: { claimedBy: "prac-9" },
      }),
    );
  });

  it("claim weigert taken van een andere tenant", async () => {
    verifyMock.mockRejectedValue(new Error("Taak behoort niet tot deze tenant"));

    const res = await app.request("/api/taken/t1/claim", {
      method: "POST",
      headers: tenantHeaders(),
    });

    expect(res.status).toBe(500);
    expect(claimTaskMock).not.toHaveBeenCalled();
  });

  it("unclaim geeft de taak terug en audit de actie", async () => {
    verifyMock.mockResolvedValue(taak({ assignee: "prac-9" }));

    const res = await app.request("/api/taken/t1/unclaim", {
      method: "POST",
      headers: tenantHeaders(),
    });

    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "workflow.task.unclaim" }),
    );
  });
});
