import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const tenantRoutes = new Hono<AppEnv>();

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  medplum_project_id: string;
  enabled_modules: string[];
  sector: string | null;
  sectors: string[];
  settings: { bsnRequired: boolean; clientnummerPrefix: string };
  contact_email: string | null;
  contact_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/master/tenants — List all tenants (super-admin only).
 */
tenantRoutes.get("/", async (c) => {
  const result = await pool.query<TenantRow>(
    "SELECT * FROM openzorg.tenants ORDER BY created_at DESC",
  );
  return c.json({ tenants: result.rows });
});

/**
 * GET /api/master/tenants/:id — Get a single tenant.
 */
tenantRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await pool.query<TenantRow>(
    "SELECT * FROM openzorg.tenants WHERE id = $1",
    [id],
  );
  const tenant = result.rows[0];
  if (!tenant) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }
  return c.json(tenant);
});

/**
 * POST /api/master/tenants — Create a new tenant (onboarding).
 */
tenantRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    slug: string;
    sector?: string;
    sectors?: string[];
    contactEmail?: string;
    contactName?: string;
    enabledModules?: string[];
  }>();

  if (!body.name || !body.slug) {
    return c.json({ error: "Naam en slug zijn verplicht" }, 400);
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return c.json({ error: "Slug mag alleen kleine letters, cijfers en streepjes bevatten" }, 400);
  }

  // Check uniqueness
  const existing = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE slug = $1",
    [body.slug],
  );
  if (existing.rows.length > 0) {
    return c.json({ error: "Er bestaat al een tenant met deze slug" }, 409);
  }

  // Generate a medplum project ID placeholder (in production this calls Medplum admin API)
  const medplumProjectId = `medplum-project-${body.slug}`;

  const defaultModules = body.enabledModules ?? [
    "clientregistratie", "medewerkers", "organisatie", "rapportage",
    "planning", "configuratie", "toegangsbeheer", "berichten",
  ];

  const primarySector = body.sector ?? body.sectors?.[0] ?? "vvt";
  const allSectors = body.sectors ?? [primarySector];

  const result = await pool.query<TenantRow>(
    `INSERT INTO openzorg.tenants (name, slug, medplum_project_id, enabled_modules, sector, sectors, contact_email, contact_name, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
     RETURNING *`,
    [
      body.name,
      body.slug,
      medplumProjectId,
      defaultModules,
      primarySector,
      allSectors,
      body.contactEmail ?? null,
      body.contactName ?? null,
    ],
  );

  return c.json(result.rows[0], 201);
});

/**
 * PUT /api/master/tenants/:id — Update a tenant.
 */
tenantRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    enabledModules?: string[];
    sector?: string;
    sectors?: string[];
    contactEmail?: string;
    contactName?: string;
    status?: string;
    settings?: Record<string, unknown>;
  }>();

  const result = await pool.query<TenantRow>(
    `UPDATE openzorg.tenants SET
       name = COALESCE($2, name),
       enabled_modules = COALESCE($3, enabled_modules),
       sector = COALESCE($4, sector),
       sectors = COALESCE($5, sectors),
       contact_email = COALESCE($6, contact_email),
       contact_name = COALESCE($7, contact_name),
       status = COALESCE($8, status),
       settings = COALESCE($9, settings),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      body.name ?? null,
      body.enabledModules ?? null,
      body.sector ?? null,
      body.sectors ?? null,
      body.contactEmail ?? null,
      body.contactName ?? null,
      body.status ?? null,
      body.settings ? JSON.stringify(body.settings) : null,
    ],
  );

  const tenant = result.rows[0];
  if (!tenant) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }
  return c.json(tenant);
});

/**
 * DELETE /api/master/tenants/:id — Deactivate a tenant (soft delete).
 */
tenantRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await pool.query<TenantRow>(
    `UPDATE openzorg.tenants SET status = 'inactive', updated_at = now() WHERE id = $1 RETURNING *`,
    [id],
  );

  const tenant = result.rows[0];
  if (!tenant) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }
  return c.json({ message: "Tenant gedeactiveerd", tenant });
});

/**
 * GET /api/master/tenants/:id/audit — Audit log for a tenant (NEN 7513).
 */
tenantRoutes.get("/:id/audit", async (c) => {
  const tenantId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const result = await pool.query(
    `SELECT * FROM openzorg.audit_log
     WHERE tenant_id = $1
     ORDER BY timestamp DESC
     LIMIT $2 OFFSET $3`,
    [tenantId, Math.min(limit, 200), offset],
  );

  const countResult = await pool.query(
    "SELECT COUNT(*) as total FROM openzorg.audit_log WHERE tenant_id = $1",
    [tenantId],
  );
  const total = parseInt((countResult.rows[0] as { total: string })?.total ?? "0", 10);

  return c.json({ entries: result.rows, total, limit, offset });
});

/**
 * GET /api/master/stats — Overview stats for super-admin dashboard.
 */
tenantRoutes.get("/stats/overview", async (c) => {
  const tenantsResult = await pool.query(
    "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM openzorg.tenants",
  );
  const stats = tenantsResult.rows[0] as { total: string; active: string } | undefined;

  return c.json({
    totalTenants: parseInt(stats?.total ?? "0", 10),
    activeTenants: parseInt(stats?.active ?? "0", 10),
  });
});
