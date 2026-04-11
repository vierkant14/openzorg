/**
 * API helper for communicating with the Workflow-bridge backend service.
 * Reads the auth token and tenant ID from localStorage.
 */

const WORKFLOW_BASE =
  process.env.NEXT_PUBLIC_WORKFLOW_URL || "/api/workflow";

export async function workflowFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const headers: Record<string, string> = {
    "X-Tenant-ID": getTenantId(),
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${WORKFLOW_BASE}${path}`, {
      ...options,
      headers,
    });

    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!res.ok) {
        return { data: null, error: text || `Fout ${res.status}`, status: res.status };
      }
      // OK response but not valid JSON — return null data instead of empty object
      return { data: null, error: null, status: res.status };
    }

    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("openzorg_token");
        localStorage.removeItem("openzorg_tenant_id");
        window.location.href = "/login?expired=1";
        return { data: null, error: "Sessie verlopen", status: 401 };
      }
      const issues = body?.issue as Array<{ diagnostics?: string }> | undefined;
      const message =
        issues?.[0]?.diagnostics || (body?.error as string | undefined) || `Fout ${res.status}`;
      return { data: null, error: message, status: res.status };
    }

    return { data: body as T, error: null, status: res.status };
  } catch {
    return {
      data: null,
      error: "Kan geen verbinding maken met de workflow-service",
      status: 0,
    };
  }
}

function getTenantId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("openzorg_tenant_id") || "";
  }
  return "";
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("openzorg_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}
