import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const tenantSettingsRoutes = new Hono<AppEnv>();

/**
 * GET /api/tenant-settings — Get settings for the current tenant.
 * Uses the X-Tenant-ID header to find the matching tenant.
 */
tenantSettingsRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");

  // Try matching by medplum_project_id first, then by id
  const result = await pool.query(
    `SELECT settings, enabled_modules, sector, sectors, name, slug
     FROM openzorg.tenants
     WHERE medplum_project_id = $1 OR id::text = $1
     LIMIT 1`,
    [tenantId],
  );

  const row = result.rows[0] as {
    settings: Record<string, unknown>;
    enabled_modules: string[];
    sector: string;
    sectors: string[];
    name: string;
    slug: string;
  } | undefined;

  if (!row) {
    // Return defaults if tenant not found in DB
    return c.json({
      bsnRequired: false,
      clientnummerPrefix: "C",
      enabledModules: [],
      sector: "vvt",
      sectors: ["vvt"],
    });
  }

  return c.json({
    ...(row.settings ?? {}),
    enabledModules: row.enabled_modules,
    sector: row.sector,
    sectors: row.sectors ?? [row.sector],
    tenantName: row.name,
    tenantSlug: row.slug,
  });
});
