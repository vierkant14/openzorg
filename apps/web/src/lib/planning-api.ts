/**
 * API helper for communicating with the Planning backend service.
 * Reads the auth token and tenant ID from localStorage.
 */

const PLANNING_BASE =
  process.env.NEXT_PUBLIC_PLANNING_URL || "http://localhost:4002";

export async function planningFetch<T = unknown>(
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
    const res = await fetch(`${PLANNING_BASE}${path}`, {
      ...options,
      headers,
    });

    const body = await res.json();

    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("openzorg_token");
        localStorage.removeItem("openzorg_tenant_id");
        window.location.href = "/login?expired=1";
        return { data: null, error: "Sessie verlopen", status: 401 };
      }
      const message =
        body?.issue?.[0]?.diagnostics || body?.error || `Fout ${res.status}`;
      return { data: null, error: message, status: res.status };
    }

    return { data: body as T, error: null, status: res.status };
  } catch {
    return {
      data: null,
      error: "Kan geen verbinding maken met de planning-service",
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
