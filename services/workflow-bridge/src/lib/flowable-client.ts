const FLOWABLE_BASE = process.env.FLOWABLE_BASE_URL || "http://localhost:8080/flowable-rest";
const FLOWABLE_USER = process.env.FLOWABLE_ADMIN_USER || "admin";
const FLOWABLE_PASSWORD = process.env.FLOWABLE_ADMIN_PASSWORD || "admin";
const FLOWABLE_AUTH = Buffer.from(`${FLOWABLE_USER}:${FLOWABLE_PASSWORD}`).toString("base64");

if (!process.env.FLOWABLE_ADMIN_USER || !process.env.FLOWABLE_ADMIN_PASSWORD) {
  console.warn(
    "[flowable-client] FLOWABLE_ADMIN_USER/PASSWORD niet gezet — val terug op de dev-default. " +
      "Zet deze env-vars in elke niet-lokale omgeving.",
  );
}

interface FlowableRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Tenant-model (W1-1, spec §4.3.1): élke deployment, proces-start en query
 * loopt via Flowable's native tenantId (= Medplum project-ID). "Een zorgpad
 * activeren" betekent: de template voor déze tenant deployen. Er is géén
 * legacy-fallback — een taak of instantie zonder tenant hoort bij geen enkele
 * tenant (fail-closed). De proces-variabele `tenantId` blijft daarnaast
 * bestaan voor FHIR-context in taak-formulieren en back-compat van views.
 */

export interface FlowableTaak {
  id: string;
  name: string;
  description?: string;
  assignee?: string | null;
  createTime: string;
  dueDate?: string | null;
  tenantId?: string;
  processInstanceId?: string;
  processDefinitionId?: string;
  taskDefinitionKey?: string;
  variables?: Array<{ name: string; value: unknown; scope?: string }>;
}

export interface TakenQuery {
  /** Verplicht — fail-closed tenant-isolatie. */
  tenantId: string;
  /** Practitioner-ID van de persoon (assignee). */
  assignee?: string;
  /** Rol (candidateGroup) voor beschikbare taken. */
  candidateGroup?: string;
  /** Beperk tot één procesinstantie (instantie-detailweergave). */
  processInstanceId?: string;
}

/**
 * Makes an authenticated request to the Flowable REST API.
 */
export async function flowableFetch(path: string, options: FlowableRequestOptions = {}): Promise<Response> {
  const url = `${FLOWABLE_BASE}${path}`;
  const { method = "GET", body, headers = {} } = options;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${FLOWABLE_AUTH}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Onbekende fout");
    throw new Error(`Flowable API fout: ${response.status} ${response.statusText} - ${text}`);
  }

  return response;
}

/**
 * Deploys a BPMN process definition to Flowable, binnen de gegeven tenant.
 */
export async function deployProcess(bpmnXml: string, name: string, tenantId: string): Promise<unknown> {
  const url = `${FLOWABLE_BASE}/service/repository/deployments`;

  const formData = new FormData();
  const blob = new Blob([bpmnXml], { type: "application/xml" });
  formData.append("file", blob, `${name}.bpmn20.xml`);
  formData.append("tenantId", tenantId);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${FLOWABLE_AUTH}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Onbekende fout");
    throw new Error(`Procesdefinitie deployment mislukt: ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * Start een nieuwe procesinstantie binnen de tenant. De native tenantId
 * bepaalt wélke definitie start (de tenant-deployment); de variabele
 * `tenantId` gaat daarnaast mee voor formulier-/FHIR-context.
 */
export async function startProcess(
  processKey: string,
  variables: Record<string, unknown> | undefined,
  tenantId: string,
): Promise<{ id: string }> {
  const allVariables: Array<{ name: string; value: unknown }> = [
    { name: "tenantId", value: tenantId },
  ];

  if (variables) {
    for (const [name, value] of Object.entries(variables)) {
      if (name === "tenantId") continue;
      allVariables.push({ name, value });
    }
  }

  const response = await flowableFetch("/service/runtime/process-instances", {
    method: "POST",
    body: {
      processDefinitionKey: processKey,
      tenantId,
      variables: allVariables,
    },
  });

  return (await response.json()) as { id: string };
}

/**
 * Query op taken, altijd binnen één tenant (native filter).
 */
export async function queryTasks(q: TakenQuery): Promise<FlowableTaak[]> {
  if (!q.tenantId) {
    throw new Error("tenantId is verplicht voor taak-query's");
  }

  const params = new URLSearchParams();
  params.set("tenantId", q.tenantId);
  params.set("includeProcessVariables", "true");
  if (q.assignee) params.set("assignee", q.assignee);
  if (q.candidateGroup) params.set("candidateGroup", q.candidateGroup);
  if (q.processInstanceId) params.set("processInstanceId", q.processInstanceId);

  const response = await flowableFetch(`/service/runtime/tasks?${params.toString()}`);
  const data = (await response.json()) as { data?: FlowableTaak[] };
  return data.data ?? [];
}

/**
 * Verifieert dat een taak bij de gegeven tenant hoort (native tenantId,
 * fail-closed: taken zonder tenant worden geweigerd) en retourneert de
 * taakdetails zodat aanroepers geen tweede fetch nodig hebben.
 */
export async function verifyTaskTenant(taskId: string, tenantId: string): Promise<FlowableTaak> {
  const response = await flowableFetch(
    `/service/runtime/tasks/${encodeURIComponent(taskId)}?includeProcessVariables=true`,
  );
  const taak = (await response.json()) as FlowableTaak;

  if (!taak.tenantId || taak.tenantId !== tenantId) {
    throw new Error("Taak behoort niet tot deze tenant");
  }

  return taak;
}

/**
 * Claimt een taak voor een persoon (practitioner-ID).
 */
export async function claimTask(taskId: string, assignee: string): Promise<void> {
  await flowableFetch(`/service/runtime/tasks/${encodeURIComponent(taskId)}`, {
    method: "POST",
    body: { action: "claim", assignee },
  });
}

/**
 * Geeft een geclaimde taak terug aan de groep.
 */
export async function unclaimTask(taskId: string): Promise<void> {
  await flowableFetch(`/service/runtime/tasks/${encodeURIComponent(taskId)}`, {
    method: "POST",
    body: { action: "claim", assignee: null },
  });
}

/**
 * Completes a task, optionally setting output variables.
 */
export async function completeTask(
  taskId: string,
  variables?: Record<string, unknown>,
): Promise<void> {
  const body: Record<string, unknown> = {
    action: "complete",
  };

  if (variables) {
    body.variables = Object.entries(variables).map(([name, value]) => ({
      name,
      value,
    }));
  }

  await flowableFetch(`/service/runtime/tasks/${encodeURIComponent(taskId)}`, {
    method: "POST",
    body,
  });
}

/**
 * Procesdefinities van één tenant.
 */
export async function getProcessDefinitions(tenantId: string): Promise<unknown> {
  const params = new URLSearchParams({ tenantId });
  const response = await flowableFetch(`/service/repository/process-definitions?${params.toString()}`);
  return response.json();
}

/**
 * Lopende procesinstanties van één tenant, optioneel per proces-key.
 */
export async function getProcessInstances(tenantId: string, processKey?: string): Promise<unknown> {
  const params = new URLSearchParams({ tenantId });
  if (processKey) {
    params.set("processDefinitionKey", processKey);
  }
  params.set("includeProcessVariables", "true");

  const response = await flowableFetch(`/service/runtime/process-instances?${params.toString()}`);
  return response.json();
}

/**
 * Annuleert een lopende procesinstantie (met reden), na tenant-verificatie.
 */
export async function cancelProcessInstance(
  processInstanceId: string,
  tenantId: string,
  reden: string,
): Promise<void> {
  const detailRes = await flowableFetch(
    `/service/runtime/process-instances/${encodeURIComponent(processInstanceId)}`,
  );
  const instance = (await detailRes.json()) as { tenantId?: string };

  if (!instance.tenantId || instance.tenantId !== tenantId) {
    throw new Error("Procesinstantie behoort niet tot deze tenant");
  }

  await flowableFetch(
    `/service/runtime/process-instances/${encodeURIComponent(processInstanceId)}?deleteReason=${encodeURIComponent(reden)}`,
    { method: "DELETE" },
  );
}
