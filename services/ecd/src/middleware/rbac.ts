import type { Context, Next } from "hono";
import { getRequiredPermission, hasPermission } from "@openzorg/shared-domain";
import type { OpenZorgRole } from "@openzorg/shared-domain";

import type { AppEnv } from "../app.js";

/**
 * RBAC middleware: extracts the user role from X-User-Role header
 * and checks it against the permission matrix.
 *
 * The role header is set by the frontend from localStorage.
 * In production, this should be validated against the auth token / Medplum PractitionerRole.
 */
export async function rbacMiddleware(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const role = c.req.header("X-User-Role") as OpenZorgRole | undefined;

  if (!role) {
    // No role header → allow through (backwards compatible during rollout).
    // Once all clients send the header, change this to a 403.
    await next();
    return;
  }

  const path = new URL(c.req.url).pathname;
  const method = c.req.method;

  const requiredPermission = getRequiredPermission(path, method);

  // No permission rule for this route → public within tenant
  if (!requiredPermission) {
    await next();
    return;
  }

  if (!hasPermission(role, requiredPermission)) {
    return c.json(
      { error: "Onvoldoende rechten", required: requiredPermission, role },
      403,
    );
  }

  await next();
}
