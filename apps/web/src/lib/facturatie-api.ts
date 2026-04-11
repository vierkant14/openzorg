/**
 * API helper for communicating with the Facturatie backend service.
 */

const FACTURATIE_BASE =
  process.env.NEXT_PUBLIC_FACTURATIE_URL || "/api/facturatie";

export async function facturatieFetch<T = unknown>(
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
    const res = await fetch(`${FACTURATIE_BASE}${path}`, {
      ...options,
      headers,
    });

    const text = await res.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Non-JSON response
    }

    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("openzorg_token");
        localStorage.removeItem("openzorg_tenant_id");
        window.location.href = "/login?expired=1";
        return { data: null, error: "Sessie verlopen", status: 401 };
      }
      const message =
        (body?.error as string | undefined) || text || `Fout ${res.status}`;
      return { data: null, error: message, status: res.status };
    }

    return { data: (body ?? {}) as T, error: null, status: res.status };
  } catch {
    return {
      data: null,
      error: "Kan geen verbinding maken met de facturatie-service",
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
