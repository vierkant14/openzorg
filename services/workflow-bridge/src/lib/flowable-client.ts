const FLOWABLE_BASE = process.env.FLOWABLE_BASE_URL || "http://localhost:8080/flowable-rest";
const FLOWABLE_AUTH = Buffer.from("admin:admin").toString("base64");

interface FlowableRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
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
 * Deploys a BPMN process definition to Flowable.
 */
export async function deployProcess(bpmnXml: string, name: string): Promise<unknown> {
  const url = `${FLOWABLE_BASE}/service/repository/deployments`;

  const formData = new FormData();
  const blob = new Blob([bpmnXml], { type: "application/xml" });
  formData.append("file", blob, `${name}.bpmn20.xml`);

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
 * Starts a new process instance for the given process definition key.
 * Uses Flowable's native tenantId field and injects tenantId as a process variable
 * so tasks can be filtered by tenant.
 */
export async function startProcess(
  processKey: string,
  variables?: Record<string, unknown>,
  tenantId?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = {
    processDefinitionKey: processKey,
  };

  if (tenantId) {
    body.tenantId = tenantId;
  }

  const allVariables: Array<{ name: string; value: unknown }> = [];

  if (tenantId) {
    allVariables.push({ name: "tenantId", value: tenantId });
  }

  if (variables) {
    for (const [name, value] of Object.entries(variables)) {
      allVariables.push({ name, value });
    }
  }

  if (allVariables.length > 0) {
    body.variables = allVariables;
  }

  const response = await flowableFetch("/service/runtime/process-instances", {
    method: "POST",
    body,
  });

  return response.json();
}

/**
 * Gets tasks assigned to or available for a specific user/role, optionally filtered by tenant.
 * Searches both directly assigned tasks AND unclaimed tasks for candidate groups.
 * Uses includeProcessVariables to retrieve the tenantId variable from the parent process,
 * then filters results to only include tasks belonging to the specified tenant.
 */
export async function getTasksForUser(userId: string, tenantId?: string): Promise<unknown> {
  // Fetch directly assigned tasks
  const assignedResponse = await flowableFetch(
    `/service/runtime/tasks?assignee=${encodeURIComponent(userId)}&includeProcessVariables=true`,
  );
  const assignedData = (await assignedResponse.json()) as {
    data: Array<{ variables?: Array<{ name: string; value: unknown; scope?: string }>; [key: string]: unknown }>;
    [key: string]: unknown;
  };

  // Also fetch unclaimed tasks for this user's role (candidateGroup)
  // The userId is treated as a potential candidate group name (e.g. "teamleider", "beheerder")
  let candidateData: typeof assignedData = { data: [] };
  try {
    const candidateResponse = await flowableFetch(
      `/service/runtime/tasks?candidateGroup=${encodeURIComponent(userId)}&includeProcessVariables=true`,
    );
    candidateData = (await candidateResponse.json()) as typeof assignedData;
  } catch {
    // candidateGroup query failed — continue with only assigned tasks
  }

  // Merge results, avoiding duplicates
  const seenIds = new Set<string>();
  const allTasks: Array<Record<string, unknown>> = [];

  for (const task of [...assignedData.data, ...candidateData.data]) {
    const taskId = task["id"] as string;
    if (taskId && !seenIds.has(taskId)) {
      seenIds.add(taskId);
      allTasks.push(task);
    }
  }

  if (!tenantId) {
    return { ...assignedData, data: allTasks, total: allTasks.length, size: allTasks.length };
  }

  // Filter by tenant — match on tenantId process variable.
  // The variable may contain the Medplum project ID or a tenant slug.
  // We accept tasks where tenantId matches OR where no tenantId variable exists
  // (backward compatibility with process instances started without tenantId).
  const filtered = allTasks.filter((task) => {
    const vars = task["variables"] as Array<{ name: string; value: unknown; scope?: string }> | undefined;
    const tenantVar = vars?.find(
      (v) => v.name === "tenantId",
    );
    // No tenantId variable → show task (legacy process instance)
    if (!tenantVar) return true;
    // Match on exact value (could be project ID or slug)
    return tenantVar.value === tenantId;
  });

  return { ...assignedData, data: filtered, total: filtered.length, size: filtered.length };
}

/**
 * Verifies that a task belongs to a process instance owned by the given tenant.
 * Returns the task data if the tenant matches, throws an error otherwise.
 */
export async function verifyTaskTenant(taskId: string, tenantId: string): Promise<void> {
  const taskResponse = await flowableFetch(
    `/service/runtime/tasks/${encodeURIComponent(taskId)}`,
  );
  const task = (await taskResponse.json()) as { processInstanceId?: string };

  if (!task.processInstanceId) {
    throw new Error("Taak heeft geen procesinstantie");
  }

  const processResponse = await flowableFetch(
    `/service/runtime/process-instances/${encodeURIComponent(task.processInstanceId)}`,
  );
  const process = (await processResponse.json()) as { tenantId?: string };

  if (process.tenantId !== tenantId) {
    throw new Error("Taak behoort niet tot deze tenant");
  }
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
 * Lists process instances, optionally filtered by process definition key and tenant.
 */
export async function getProcessInstances(processKey?: string, tenantId?: string): Promise<unknown> {
  const params = new URLSearchParams();

  if (processKey) {
    params.set("processDefinitionKey", processKey);
  }

  if (tenantId) {
    params.set("tenantId", tenantId);
  }

  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await flowableFetch(`/service/runtime/process-instances${query}`);

  return response.json();
}
