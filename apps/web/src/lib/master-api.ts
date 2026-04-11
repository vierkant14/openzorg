/**
 * API helper for master admin / super-admin endpoints.
 * Uses X-Master-Key authentication instead of tenant context.
 */

const ECD_BASE = process.env.NEXT_PUBLIC_ECD_URL || "http://localhost:4001";

const MASTER_KEY = "dev-master-key"; // In production: from env or secure storage

export async function masterFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const headers: Record<string, string> = {
    "X-Master-Key": MASTER_KEY,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const res = await fetch(`${ECD_BASE}${path}`, {
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
