import type { Context, Next } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

/**
 * NEN 7513 Audit Logging Middleware.
 *
 * Dutch healthcare requires that all access to patient data is logged:
 * - Who accessed the data (user ID / role)
 * - What was accessed (resource type + ID)
 * - When (timestamp)
 * - What action (read / create / update / delete)
 *
 * This middleware logs after the response is sent (non-blocking).
 */

const METHOD_TO_ACTION: Record<string, string> = {
  GET: "read",
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

/** Routes that contain patient data and must be audited */
const AUDITABLE_PATTERNS = [
  /^\/api\/clients/,
  /^\/api\/clients\/[^/]+\/contactpersonen/,
  /^\/api\/clients\/[^/]+\/zorgplan/,
  /^\/api\/clients\/[^/]+\/rapportages/,
  /^\/api\/clients\/[^/]+\/documenten/,
  /^\/api\/clients\/[^/]+\/medicatie/,
  /^\/api\/mic-meldingen/,
  /^\/api\/berichten/,
];

function shouldAudit(path: string): boolean {
  return AUDITABLE_PATTERNS.some((pattern) => pattern.test(path));
}

function extractResourceInfo(path: string): { resourceType: string; resourceId: string | null } {
  // /api/clients/:id/... → Patient
  const clientMatch = path.match(/^\/api\/clients\/([^/]+)/);
  if (clientMatch) {
    const subPath = path.replace(/^\/api\/clients\/[^/]+\/?/, "");
    if (subPath.startsWith("contactpersonen")) return { resourceType: "RelatedPerson", resourceId: null };
    if (subPath.startsWith("zorgplan")) return { resourceType: "CarePlan", resourceId: null };
    if (subPath.startsWith("rapportages")) return { resourceType: "Observation", resourceId: null };
    if (subPath.startsWith("documenten")) return { resourceType: "DocumentReference", resourceId: null };
    if (subPath.startsWith("medicatie")) return { resourceType: "MedicationRequest", resourceId: null };
    return { resourceType: "Patient", resourceId: clientMatch[1] ?? null };
  }

  if (path.startsWith("/api/mic-meldingen")) return { resourceType: "AuditEvent", resourceId: null };
  if (path.startsWith("/api/berichten")) return { resourceType: "Communication", resourceId: null };

  return { resourceType: "Unknown", resourceId: null };
}

export async function auditMiddleware(c: Context<AppEnv>, next: Next): Promise<void> {
  const path = new URL(c.req.url).pathname;

  // Skip non-auditable routes
  if (!shouldAudit(path)) {
    await next();
    return;
  }

  // Skip master admin routes
  if (path.startsWith("/api/master/")) {
    await next();
    return;
  }

  const startTime = Date.now();

  await next();

  // Log asynchronously — don't block the response
  const tenantId = c.get("tenantId");
  const userId = c.req.header("Authorization")?.replace("Bearer ", "").slice(0, 36) ?? "anonymous";
  const role = c.req.header("X-User-Role") ?? "unknown";
  const action = METHOD_TO_ACTION[c.req.method] ?? "unknown";
  const { resourceType, resourceId } = extractResourceInfo(path);
  const status = c.res.status;
  const durationMs = Date.now() - startTime;

  // Fire and forget — audit log insert should never block the request
  writeAuditLog({
    tenantId,
    userId,
    role,
    action,
    resourceType,
    resourceId,
    path,
    method: c.req.method,
    statusCode: status,
    durationMs,
  }).catch((err) => {
    console.error("[AUDIT] Failed to write audit log:", err);
  });
}

interface AuditEntry {
  tenantId: string;
  userId: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
}

async function writeAuditLog(entry: AuditEntry): Promise<void> {
  // Try to find the tenant UUID from medplum_project_id or direct UUID
  const tenantResult = await pool.query(
    `SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1`,
    [entry.tenantId],
  );

  const tenantUuid = (tenantResult.rows[0] as { id: string } | undefined)?.id;

  if (!tenantUuid) {
    // Can't log without a valid tenant — skip silently
    return;
  }

  await pool.query(
    `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      tenantUuid,
      entry.userId,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      JSON.stringify({
        role: entry.role,
        path: entry.path,
        method: entry.method,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
      }),
    ],
  );
}
