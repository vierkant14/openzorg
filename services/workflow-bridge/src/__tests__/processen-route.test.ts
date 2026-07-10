import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/flowable-client.js", () => ({
  cancelProcessInstance: vi.fn(),
  deployProcess: vi.fn(),
  getProcessDefinitions: vi.fn(),
  getProcessInstances: vi.fn(),
  startProcess: vi.fn(),
}));

vi.mock("../lib/audit.js", () => ({
  writeWorkflowAudit: vi.fn(),
}));

import { app } from "../app.js";
import { writeWorkflowAudit } from "../lib/audit.js";
import {
  cancelProcessInstance,
  deployProcess,
  getProcessDefinitions,
  startProcess,
} from "../lib/flowable-client.js";
import { _clearAuthCache } from "../middleware/auth.js";

import { stubFetchMetAuth, tenantHeaders } from "./helpers.js";

const startMock = vi.mocked(startProcess);
const deployMock = vi.mocked(deployProcess);
const cancelMock = vi.mocked(cancelProcessInstance);
const definitiesMock = vi.mocked(getProcessDefinitions);
const auditMock = vi.mocked(writeWorkflowAudit);

describe("processen-route", () => {
  beforeEach(() => {
    _clearAuthCache();
    vi.clearAllMocks();
    stubFetchMetAuth({ projectId: "proj-1", profileRef: "Practitioner/prac-9" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET / haalt definities van de tenant op", async () => {
    definitiesMock.mockResolvedValue({ data: [] });
    const res = await app.request("/api/processen", { headers: tenantHeaders() });
    expect(res.status).toBe(200);
    expect(definitiesMock).toHaveBeenCalledWith("proj-1");
  });

  it("start deployt de template en probeert opnieuw wanneer de definitie ontbreekt (ensure-deployed)", async () => {
    startMock
      .mockRejectedValueOnce(
        new Error("Flowable API fout: 400 Bad Request - no processes deployed with key 'intake-proces'"),
      )
      .mockResolvedValueOnce({ id: "pi-1" });
    deployMock.mockResolvedValue({ id: "d1" });

    const res = await app.request("/api/processen/intake-proces/start", {
      method: "POST",
      headers: tenantHeaders(),
      body: JSON.stringify({ variables: { clientRef: "Patient/1" } }),
    });

    expect(res.status).toBe(201);
    expect(deployMock).toHaveBeenCalledWith(expect.stringContaining("<"), "intake-proces", "proj-1");
    expect(startMock).toHaveBeenCalledTimes(2);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "workflow.task.deploy", details: { bron: "ensure-deployed" } }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "workflow.instance.start", processInstanceId: "pi-1" }),
    );
  });

  it("start met onbekende key én zonder template geeft de fout door", async () => {
    startMock.mockRejectedValue(
      new Error("Flowable API fout: 400 Bad Request - no processes deployed with key 'bestaat-niet'"),
    );

    const res = await app.request("/api/processen/bestaat-niet/start", {
      method: "POST",
      headers: tenantHeaders(),
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(500);
    expect(deployMock).not.toHaveBeenCalled();
  });

  it("annuleren vereist een reden", async () => {
    const res = await app.request("/api/processen/instances/pi-1", {
      method: "DELETE",
      headers: tenantHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("annuleren met reden verwijdert en audit", async () => {
    cancelMock.mockResolvedValue();

    const res = await app.request("/api/processen/instances/pi-1", {
      method: "DELETE",
      headers: tenantHeaders(),
      body: JSON.stringify({ reden: "dubbel gestart" }),
    });

    expect(res.status).toBe(200);
    expect(cancelMock).toHaveBeenCalledWith("pi-1", "proj-1", "dubbel gestart");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "workflow.instance.cancel", details: { reden: "dubbel gestart" } }),
    );
  });
});
