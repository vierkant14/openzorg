import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

/**
 * Plan 2E fase 1 — Dynamische rollen per tenant.
 *
 * De 4 kern-rollen blijven in shared-domain ROLE_PERMISSIONS voor
 * de permission-matrix, maar de *lijst van beschikbare rollen* komt
 * vanaf nu uit openzorg.roles zodat een beheerder eigen rollen
 * (controller, kwaliteitsmedewerker, etc.) kan aanmaken zonder release.
 *
 * Routes mounten onder /api/admin/rollen (niet master, wel tenant-scoped).
 */
export const rollenRoutes = new Hono<AppEnv>();

interface RoleRow {
  id: string;
  tenant_id: string | null;
  slug: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_system: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

async function resolveTenantUuid(tenantIdOrProjectId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
    [tenantIdOrProjectId],
  );
  return result.rows[0]?.id ?? null;
}

/**
 * GET / — List all active roles for the current tenant.
 */
rollenRoutes.get("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }

  const result = await pool.query<RoleRow>(
    `SELECT id, tenant_id, slug, display_name, description, permissions, is_system, active, created_at, updated_at
       FROM openzorg.roles
      WHERE tenant_id = $1 AND active = true
      ORDER BY is_system DESC, display_name ASC`,
    [tenantUuid],
  );
  return c.json({ roles: result.rows });
});

/**
 * POST / — Create a new (non-system) role.
 * Body: { slug, displayName, description, permissions }
 */
rollenRoutes.post("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }

  const body = await c.req.json<{
    slug?: string;
    displayName?: string;
    description?: string;
    permissions?: string[];
  }>().catch(() => null);
  if (!body?.slug || !body?.displayName) {
    return c.json({ error: "slug en displayName zijn vereist" }, 400);
  }

  // Valideer slug formaat
  if (!/^[a-z0-9-]+$/.test(body.slug)) {
    return c.json({ error: "slug mag alleen lowercase letters, cijfers en streepjes bevatten" }, 400);
  }

  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO openzorg.roles (tenant_id, slug, display_name, description, permissions, is_system)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id`,
      [
        tenantUuid,
        body.slug,
        body.displayName,
        body.description ?? "",
        body.permissions ?? [],
      ],
    );

    await pool.query(
      `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'role.create', 'Role', $3, $4)`,
      [
        tenantUuid,
        c.req.header("X-User-Id") ?? "system",
        result.rows[0]?.id,
        JSON.stringify({ slug: body.slug, displayName: body.displayName }),
      ],
    );

    return c.json({ id: result.rows[0]?.id, ...body }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "onbekende fout";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return c.json({ error: `Rol met slug '${body.slug}' bestaat al` }, 409);
    }
    return c.json({ error: msg }, 500);
  }
});

/**
 * PUT /:id — Update role (niet-system alleen). System-rollen zijn locked.
 */
rollenRoutes.put("/:id", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }

  const id = c.req.param("id");
  const body = await c.req.json<{
    displayName?: string;
    description?: string;
    permissions?: string[];
    active?: boolean;
  }>().catch(() => null);
  if (!body) {
    return c.json({ error: "Ongeldige JSON body" }, 400);
  }

  const existing = await pool.query<RoleRow>(
    "SELECT * FROM openzorg.roles WHERE id = $1 AND tenant_id = $2",
    [id, tenantUuid],
  );
  if (existing.rows.length === 0) {
    return c.json({ error: "Rol niet gevonden" }, 404);
  }
  const row = existing.rows[0]!;
  if (row.is_system) {
    return c.json({ error: "Systeem-rollen kunnen niet bewerkt worden" }, 403);
  }

  await pool.query(
    `UPDATE openzorg.roles
        SET display_name = COALESCE($1, display_name),
            description = COALESCE($2, description),
            permissions = COALESCE($3, permissions),
            active = COALESCE($4, active),
            updated_at = now()
      WHERE id = $5`,
    [
      body.displayName ?? null,
      body.description ?? null,
      body.permissions ?? null,
      body.active ?? null,
      id,
    ],
  );

  await pool.query(
    `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, 'role.update', 'Role', $3, $4)`,
    [
      tenantUuid,
      c.req.header("X-User-Id") ?? "system",
      id,
      JSON.stringify({ before: row, after: body }),
    ],
  );

  return c.json({ success: true });
});

/**
 * DELETE /:id — Soft-delete (set active=false) voor niet-system rollen.
 */
rollenRoutes.delete("/:id", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }

  const id = c.req.param("id");
  const existing = await pool.query<{ is_system: boolean }>(
    "SELECT is_system FROM openzorg.roles WHERE id = $1 AND tenant_id = $2",
    [id, tenantUuid],
  );
  if (existing.rows.length === 0) {
    return c.json({ error: "Rol niet gevonden" }, 404);
  }
  if (existing.rows[0]!.is_system) {
    return c.json({ error: "Systeem-rollen kunnen niet verwijderd worden" }, 403);
  }

  await pool.query(
    "UPDATE openzorg.roles SET active = false, updated_at = now() WHERE id = $1",
    [id],
  );

  await pool.query(
    `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, 'role.delete', 'Role', $3, $4)`,
    [tenantUuid, c.req.header("X-User-Id") ?? "system", id, JSON.stringify({})],
  );

  return c.json({ success: true });
});
