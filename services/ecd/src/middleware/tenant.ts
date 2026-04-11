import type { Context, Next } from "hono";

import type { AppEnv } from "../app.js";

/**
 * Tenant middleware extracts and validates the tenant context from the request.
 * The tenant ID is passed via the X-Tenant-ID header, which is set by the
 * API gateway or the frontend based on the authenticated user's project.
 *
 * In production, this will be derived from the Medplum project context.
 */
export async function tenantMiddleware(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  // Master admin routes don't need tenant context
  if (c.req.path.startsWith("/api/master/")) {
    await next();
    return;
  }

  const tenantId = c.req.header("X-Tenant-ID");

  if (!tenantId) {
    return c.json({ error: "X-Tenant-ID header is vereist" }, 400);
  }

  c.set("tenantId", tenantId);
  await next();
}
