import { pool } from "./db.js";

/**
 * NEN 7513-compatibele audit-logging voor workflow-taken.
 *
 * Elke taak-transitie (claim, complete, etc.) schrijft een regel naar
 * openzorg.audit_log. Dit is de enige bron voor BI-rapportages over
 * doorlooptijden, wie wat heeft afgehandeld, en welke besluiten zijn
 * genomen (via de details JSONB).
 *
 * Fire-and-forget: een audit-fout blokkeert nooit de taak-actie zelf.
 */

export interface WorkflowAuditEntry {
  tenantId: string;
  userId: string;
  role?: string;
  action: "workflow.task.claim" | "workflow.task.complete" | "workflow.task.start" | "workflow.task.deploy";
  taskId?: string;
  taskName?: string;
  processKey?: string;
  processInstanceId?: string;
  details?: Record<string, unknown>;
}

async function resolveTenantUuid(rawTenant: string): Promise<string | null> {
  try {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM openzorg.tenants
         WHERE medplum_project_id = $1 OR id::text = $1
         LIMIT 1`,
      [rawTenant],
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export function writeWorkflowAudit(entry: WorkflowAuditEntry): void {
  // Fire-and-forget: de aanroeper hoeft niet te awaiten.
  (async () => {
    try {
      const tenantUuid = await resolveTenantUuid(entry.tenantId);
      if (!tenantUuid) {
        console.warn(`[AUDIT] Kon tenant niet resolven: ${entry.tenantId}`);
        return;
      }

      const details = {
        role: entry.role,
        taskName: entry.taskName,
        processKey: entry.processKey,
        processInstanceId: entry.processInstanceId,
        ...(entry.details ?? {}),
      };

      await pool.query(
        `INSERT INTO openzorg.audit_log
           (tenant_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantUuid,
          entry.userId,
          entry.action,
          "Task",
          entry.taskId ?? null,
          JSON.stringify(details),
        ],
      );
    } catch (err) {
      console.error("[AUDIT] writeWorkflowAudit faalde:", err);
    }
  })();
}
