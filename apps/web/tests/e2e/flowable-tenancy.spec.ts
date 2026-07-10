import { expect, test } from "@playwright/test";

/**
 * Integratie-guard voor de Flowable-tenant-aannames waar de workflow-bridge
 * op bouwt (W1-1, spec §4.3.1):
 *
 *  1. Een deployment kan per tenant (form-veld `tenantId`).
 *  2. Een proces-start met `processDefinitionKey` + `tenantId` landt in die
 *     tenant; starten in een tenant zonder deployment faalt.
 *  3. Taak- en instantie-query's filteren native op `tenantId`.
 *
 * Draait direct tegen de Flowable REST API (in CI onderdeel van de
 * compose-stack via workflow-bridge depends_on). Lokaal zonder stack
 * wordt de test overgeslagen.
 */

const FLOWABLE = process.env.FLOWABLE_URL ?? "http://localhost:8080/flowable-rest";
const AUTH_HEADER = {
  Authorization: `Basic ${Buffer.from("admin:admin").toString("base64")}`,
};

const TENANT_A = "spike-tenant-a";
const TENANT_B = "spike-tenant-b";
const PROCESS_KEY = "tenancy-spike-proces";

const SPIKE_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:flowable="http://flowable.org/bpmn"
  targetNamespace="https://openzorg.nl/spike">
  <process id="${PROCESS_KEY}" name="Tenancy spike" isExecutable="true">
    <startEvent id="start" />
    <sequenceFlow id="f1" sourceRef="start" targetRef="stap1" />
    <userTask id="stap1" name="Spike taak" flowable:candidateGroups="zorgmedewerker" />
    <sequenceFlow id="f2" sourceRef="stap1" targetRef="einde" />
    <endEvent id="einde" />
  </process>
</definitions>`;

test.describe("Flowable multi-tenant gedrag", () => {
  let bereikbaar = false;
  let deploymentId: string | null = null;

  test.beforeAll(async ({ request }) => {
    try {
      const res = await request.get(`${FLOWABLE}/service/repository/deployments?size=1`, {
        headers: AUTH_HEADER,
        timeout: 5000,
      });
      bereikbaar = res.ok();
    } catch {
      bereikbaar = false;
    }
  });

  test.afterAll(async ({ request }) => {
    if (deploymentId) {
      await request
        .delete(`${FLOWABLE}/service/repository/deployments/${deploymentId}?cascade=true`, {
          headers: AUTH_HEADER,
        })
        .catch(() => undefined);
    }
  });

  test("deployment, start en query's zijn tenant-gebonden", async ({ request }) => {
    test.skip(!bereikbaar, "Flowable niet bereikbaar (lokaal zonder stack) — draait in CI");

    // 1. Deploy binnen tenant A
    const deployRes = await request.post(`${FLOWABLE}/service/repository/deployments`, {
      headers: AUTH_HEADER,
      multipart: {
        file: {
          name: `${PROCESS_KEY}.bpmn20.xml`,
          mimeType: "application/xml",
          buffer: Buffer.from(SPIKE_BPMN, "utf-8"),
        },
        tenantId: TENANT_A,
      },
    });
    expect(deployRes.status(), await deployRes.text()).toBe(201);
    const deployment = (await deployRes.json()) as { id: string; tenantId?: string };
    deploymentId = deployment.id;
    expect(deployment.tenantId).toBe(TENANT_A);

    // 2a. Start binnen tenant A slaagt en instance draagt de tenant
    const startRes = await request.post(`${FLOWABLE}/service/runtime/process-instances`, {
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      data: {
        processDefinitionKey: PROCESS_KEY,
        tenantId: TENANT_A,
        variables: [{ name: "tenantId", value: TENANT_A }],
      },
    });
    expect(startRes.status(), await startRes.text()).toBe(201);
    const instance = (await startRes.json()) as { id: string; tenantId?: string };
    expect(instance.tenantId).toBe(TENANT_A);

    // 2b. Start binnen tenant B (geen deployment daar) faalt
    const startB = await request.post(`${FLOWABLE}/service/runtime/process-instances`, {
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      data: { processDefinitionKey: PROCESS_KEY, tenantId: TENANT_B },
    });
    expect(startB.ok()).toBe(false);

    // 3a. Taken-query filtert native op tenant
    const takenA = await request.get(
      `${FLOWABLE}/service/runtime/tasks?tenantId=${TENANT_A}&candidateGroup=zorgmedewerker`,
      { headers: AUTH_HEADER },
    );
    expect(takenA.ok()).toBe(true);
    const takenABody = (await takenA.json()) as { data: Array<{ tenantId?: string }> };
    expect(takenABody.data.length).toBeGreaterThan(0);
    for (const taak of takenABody.data) {
      expect(taak.tenantId).toBe(TENANT_A);
    }

    const takenB = await request.get(
      `${FLOWABLE}/service/runtime/tasks?tenantId=${TENANT_B}&candidateGroup=zorgmedewerker`,
      { headers: AUTH_HEADER },
    );
    const takenBBody = (await takenB.json()) as { data: unknown[] };
    expect(takenBBody.data.length).toBe(0);

    // 3b. Instantie-query filtert native op tenant
    const instA = await request.get(
      `${FLOWABLE}/service/runtime/process-instances?tenantId=${TENANT_A}&processDefinitionKey=${PROCESS_KEY}`,
      { headers: AUTH_HEADER },
    );
    const instABody = (await instA.json()) as { data: Array<{ tenantId?: string }> };
    expect(instABody.data.length).toBeGreaterThan(0);
    for (const inst of instABody.data) {
      expect(inst.tenantId).toBe(TENANT_A);
    }
  });
});
