import { vi } from "vitest";

/**
 * Gedeelde test-helpers voor route-tests: stubt global.fetch zó dat
 * /auth/me (token-verificatie) een instelbaar antwoord geeft en alle
 * overige calls (Flowable) door een aanroeper-specifieke handler lopen.
 */

export interface AuthMeStub {
  status?: number;
  profileRef?: string;
  projectId?: string;
  superAdmin?: boolean;
}

export type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Stubt global.fetch. auth/me-calls beantwoorden met de gegeven stub;
 * alle andere URL's gaan naar `handler` (default: lege 200-JSON).
 */
export function stubFetchMetAuth(auth: AuthMeStub = {}, handler?: FetchHandler): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/auth/me")) {
      if ((auth.status ?? 200) >= 400) {
        return jsonResponse({ error: "unauthorized" }, auth.status ?? 401);
      }
      return jsonResponse({
        profile: { reference: auth.profileRef ?? "Practitioner/prac-1" },
        project: {
          reference: `Project/${auth.projectId ?? "proj-1"}`,
          superAdmin: auth.superAdmin ?? false,
        },
      });
    }
    if (handler) return handler(u, init);
    return jsonResponse({});
  });

  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

/** Standaard-headers voor een geldige tenant-call in tests. */
export function tenantHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: "Bearer test-token",
    "X-Tenant-ID": "proj-1",
    "Content-Type": "application/json",
    ...extra,
  };
}
