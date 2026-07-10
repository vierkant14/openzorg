import type { Context, Next } from "hono";

import type { AppEnv } from "../app.js";

const MEDPLUM_BASE_URL = process.env.MEDPLUM_BASE_URL ?? "http://localhost:8103";

/**
 * Token-verificatie voor de workflow-bridge (W1-1, spec §4.3.7).
 *
 * Vóór deze middleware vertrouwde de bridge de X-Tenant-ID-header blind.
 * Nu wordt elk Bearer-token geverifieerd bij Medplum (/auth/me) en wordt
 * de header ge-cross-checkt tegen het project van het token. Resultaat op
 * de context: userId (practitioner-ID zonder prefix), userRef (volledige
 * profile-reference) en projectId.
 *
 * Super-admin-tokens (project.superAdmin) mogen namens élke tenant werken —
 * dat is het pad voor systeemactoren zoals de timer-service.
 */

interface AuthInfo {
  profileRef: string;
  projectId: string;
  superAdmin: boolean;
  verlooptOp: number;
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 500;
const authCache = new Map<string, AuthInfo>();

/** Alleen voor tests: cache leegmaken zodat elke test een verse verificatie ziet. */
export function _clearAuthCache(): void {
  authCache.clear();
}

interface AuthMeResponse {
  profile?: { reference?: string; resourceType?: string; id?: string };
  project?: { reference?: string; resourceType?: string; id?: string; superAdmin?: boolean };
}

function profileReference(profile: AuthMeResponse["profile"]): string {
  if (!profile) return "";
  if (profile.reference) return profile.reference;
  if (profile.resourceType && profile.id) return `${profile.resourceType}/${profile.id}`;
  return "";
}

function projectIdVan(project: AuthMeResponse["project"]): string {
  if (!project) return "";
  if (project.id) return project.id;
  return project.reference?.split("/")[1] ?? "";
}

export async function authMiddleware(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authorization-header met Bearer-token is vereist" }, 401);
  }

  let info = authCache.get(authHeader);

  if (!info || info.verlooptOp < Date.now()) {
    let response: Response;
    try {
      response = await fetch(`${MEDPLUM_BASE_URL}/auth/me`, {
        headers: { Authorization: authHeader },
      });
    } catch {
      return c.json({ error: "Kan het token niet verifiëren: Medplum is onbereikbaar" }, 503);
    }

    if (!response.ok) {
      return c.json({ error: "Ongeldig of verlopen token" }, 401);
    }

    const me = (await response.json()) as AuthMeResponse;

    info = {
      profileRef: profileReference(me.profile),
      projectId: projectIdVan(me.project),
      superAdmin: me.project?.superAdmin === true,
      verlooptOp: Date.now() + CACHE_TTL_MS,
    };

    if (authCache.size >= CACHE_MAX) {
      const oudste = authCache.keys().next().value;
      if (oudste !== undefined) authCache.delete(oudste);
    }
    authCache.set(authHeader, info);
  }

  const tenantHeader = c.req.header("X-Tenant-ID");
  if (!info.superAdmin && tenantHeader && info.projectId && tenantHeader !== info.projectId) {
    return c.json({ error: "Tenant komt niet overeen met het token" }, 403);
  }

  c.set("userId", info.profileRef.split("/")[1] ?? info.profileRef);
  c.set("userRef", info.profileRef);
  c.set("projectId", info.projectId);

  await next();
}
