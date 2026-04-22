/**
 * Admin API route for querying the NEN 7513 audit log.
 *
 * Reads from openzorg.audit_log (PostgreSQL with RLS).
 * Filters: action, user, date range. Paginated.
 */

import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const auditLogRoutes = new Hono<AppEnv>();

async function resolveTenantUuid(tenantId: string): Promise<string | null> {
  const res = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 OR slug = $1 LIMIT 1",
    [tenantId],
  );
  return (res.rows[0] as { id: string } | undefined)?.id ?? null;
}

auditLogRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantId);
  if (!tenantUuid) {
    return c.json({ entries: [], total: 0 });
  }

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10)));
  const offset = (page - 1) * limit;

  const action = c.req.query("action") ?? "";
  const user = c.req.query("user") ?? "";
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";

  // Build WHERE clauses
  const conditions: string[] = ["tenant_id = $1"];
  const params: (string | number)[] = [tenantUuid];
  let paramIdx = 2;

  if (action) {
    conditions.push(`action = $${paramIdx}`);
    params.push(action);
    paramIdx++;
  }

  if (user) {
    conditions.push(`user_id ILIKE $${paramIdx}`);
    params.push(`%${user}%`);
    paramIdx++;
  }

  if (from) {
    conditions.push(`timestamp >= $${paramIdx}::timestamptz`);
    params.push(from);
    paramIdx++;
  }

  if (to) {
    conditions.push(`timestamp <= $${paramIdx}::timestamptz`);
    params.push(to);
    paramIdx++;
  }

  const whereClause = conditions.join(" AND ");

  // The openzorg user is the DB owner / superuser and bypasses RLS.
  // We filter explicitly by tenant_id instead.
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM openzorg.audit_log WHERE ${whereClause}`,
    params,
  );
  const total = (countResult.rows[0] as { total: number })?.total ?? 0;

  const dataResult = await pool.query(
    `SELECT id, user_id, action, resource_type, resource_id, timestamp, details
     FROM openzorg.audit_log
     WHERE ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );

  const entries = dataResult.rows.map((row) => {
    const details = row.details as Record<string, unknown> | null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      action: row.action as string,
      resource_type: row.resource_type as string,
      resource_id: row.resource_id as string | null,
      path: (details?.path as string) ?? "",
      details: details ?? {},
      duration_ms: (details?.durationMs as number) ?? null,
      created_at: row.timestamp as string,
    };
  });

  return c.json({ entries, total });
});
