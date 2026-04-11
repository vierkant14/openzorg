/**
 * API helper for master admin / super-admin endpoints.
 * Calls /api/master/* which is proxied server-side with the X-Master-Key injected.
 * The master key never leaves the server.
 */

export async function masterFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  // Strip the /api/master prefix from the path since the proxy adds it
  const cleanPath = path.replace(/^\/api\/master/, "");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const res = await fetch(`/api/master${cleanPath}`, {
      ...options,
      headers,
    });

    const body = await res.json();

    if (!res.ok) {
      const message = body?.error || `Fout ${res.status}`;
      return { data: null, error: message, status: res.status };
    }

    return { data: body as T, error: null, status: res.status };
  } catch {
    return { data: null, error: "Kan geen verbinding maken met de server", status: 0 };
  }
}
