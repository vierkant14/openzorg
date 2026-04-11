import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "../index.js";

/**
 * Extracts X-Tenant-ID header and sets it in context.
 * Returns 400 if header is missing.
 */
export const tenantMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const tenantId = c.req.header("X-Tenant-ID");
  if (!tenantId) {
    return c.json({ error: "X-Tenant-ID header is verplicht" }, 400);
  }
  c.set("tenantId", tenantId);
  await next();
};
