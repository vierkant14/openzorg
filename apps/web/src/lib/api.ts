/**
 * API helper for communicating with the ECD backend service.
 * Reads the auth token from the httpOnly cookie via a server-side proxy.
 */

// Use relative URL so it always resolves to the same origin as the app.
// The Next.js proxy at /api/ecd/* forwards to the ECD service server-side.
const ECD_BASE = process.env.NEXT_PUBLIC_ECD_URL || "/api/ecd";

export interface ApiError {
  error?: string;
  issue?: Array<{ diagnostics: string }>;
}

export async function ecdFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const headers: Record<string, string> = {
    "X-Tenant-ID": getTenantId(),
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> | undefined),
  };

  // Only set Content-Type for JSON requests (not FormData)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${ECD_BASE}${path}`, {
      ...options,
      headers,
    });

    // Parse response body safely — handle non-JSON responses
    const text = await res.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Non-JSON response
    }

    if (!res.ok) {
      // Auto-redirect to login on 401 (expired token)
      if (res.status === 401 && typeof window !== "undefined") {
        clearSession();
        window.location.href = "/login?expired=1";
        return { data: null, error: "Sessie verlopen, opnieuw inloggen", status: 401 };
      }

      // Redirect to forbidden page on 403 (insufficient permissions)
      if (res.status === 403 && typeof window !== "undefined") {
        window.location.href = "/geen-toegang";
        return { data: null, error: "Onvoldoende rechten", status: 403 };
      }
      const message =
        body?.issue?.[0]?.diagnostics || body?.error || text || `Fout ${res.status}`;
      return { data: null, error: message as string, status: res.status };
    }

    return { data: (body ?? {}) as T, error: null, status: res.status };
  } catch {
    return { data: null, error: "Kan geen verbinding maken met de server", status: 0 };
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
    const headers: Record<string, string> = {};
    const token = localStorage.getItem("openzorg_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const role = localStorage.getItem("openzorg_role");
    if (role) {
      headers["X-User-Role"] = role;
    }
    return headers;
  }
  return {};
}

export function setSession(token: string, tenantId: string, role?: string): void {
  localStorage.setItem("openzorg_token", token);
  localStorage.setItem("openzorg_tenant_id", tenantId);
  if (role) {
    localStorage.setItem("openzorg_role", role);
  }
}

export function clearSession(): void {
  localStorage.removeItem("openzorg_token");
  localStorage.removeItem("openzorg_tenant_id");
  localStorage.removeItem("openzorg_role");
  localStorage.removeItem("openzorg_user_name");
  localStorage.removeItem("openzorg_project_name");
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("openzorg_token");
}

export function getUserRole(): string {
  if (typeof window === "undefined") return "zorgmedewerker";
  return localStorage.getItem("openzorg_role") || "zorgmedewerker";
}
