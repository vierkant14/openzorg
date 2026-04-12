/**
 * Workflow Trigger Engine
 *
 * Evaluates FHIR resource lifecycle events against configured triggers
 * and starts matching Flowable BPMN processes via the workflow-bridge.
 *
 * All trigger firings are fire-and-forget: they never block the
 * original FHIR operation. Errors are logged but swallowed.
 */

import {
  DEFAULT_TRIGGERS,
  type WorkflowTrigger,
  type WorkflowTriggerEvent,
} from "../config/workflow-triggers.js";

import { pool } from "./db.js";

const WORKFLOW_BRIDGE_URL =
  process.env["WORKFLOW_BRIDGE_URL"] || "http://workflow-bridge:4003";

/* ── JSONPath extractor ───────────────────────────────────────────── */

/**
 * Resolve a simple JSONPath expression against a resource object.
 *
 * Supported syntax:
 *  - $.id              -> resource.id
 *  - $.name[0].family  -> resource.name[0].family
 *  - $.subject.reference -> resource.subject.reference
 *
 * Returns `undefined` when any segment cannot be resolved.
 */
export function extractJsonPath(
  path: string,
  resource: Record<string, unknown>,
): unknown {
  if (!path.startsWith("$.")) return undefined;

  const segments = path
    .slice(2) // strip "$."
    .split(/\.(?![^[]*\])/) // split on "." but not inside brackets
    .flatMap((seg) => {
      // Expand "name[0]" into ["name", "0"]
      const parts: string[] = [];
      const re = /([^[]+)|\[(\d+)\]/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(seg)) !== null) {
        const val = match[1] ?? match[2];
        if (val !== undefined) parts.push(val);
      }
      return parts;
    });

  let current: unknown = resource;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    const index = /^\d+$/.test(segment) ? Number(segment) : undefined;
    if (index !== undefined && Array.isArray(current)) {
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

/* ── Condition evaluator ──────────────────────────────────────────── */

/**
 * Evaluate a simple condition string against a resource.
 *
 * Supported forms:
 *   $.path === "value"
 *   $.path !== "value"
 *
 * Returns `true` when the condition is met or when no condition is specified.
 */
export function evaluateCondition(
  condition: string | undefined,
  resource: Record<string, unknown>,
): boolean {
  if (!condition) return true;

  // Match: $.some.path === "value" or $.some.path !== "value"
  const match = condition.match(
    /^(\$\.[^\s]+)\s*(===|!==)\s*"([^"]*)"$/,
  );
  if (!match) {
    // Unrecognised condition format -- default to not matching
    console.warn(
      `[workflow-triggers] Ongeldige conditie genegeerd: ${condition}`,
    );
    return false;
  }

  const [, path, operator, expected] = match;
  if (!path || !operator) return false;

  const actual = extractJsonPath(path, resource);
  const actualStr = typeof actual === "string" ? actual : String(actual ?? "");

  return operator === "===" ? actualStr === expected : actualStr !== expected;
}

/* ── Trigger loading ──────────────────────────────────────────────── */

/**
 * Load the effective trigger set for a tenant.
 *
 * Strategy: start from DEFAULT_TRIGGERS, then overlay any per-tenant
 * overrides stored in openzorg.tenant_configurations. Database
 * records with the same trigger id replace the default entirely.
 * Database records with new ids are appended.
 */
async function loadTriggers(tenantId: string): Promise<WorkflowTrigger[]> {
  let overrides: WorkflowTrigger[] = [];

  try {
    const res = await pool.query(
      `SELECT config_data
         FROM openzorg.tenant_configurations
        WHERE config_type = 'workflow_trigger'
          AND tenant_id IN (
            SELECT id FROM openzorg.tenants
             WHERE medplum_project_id = $1
                OR id::text = $1
                OR slug = $1
          )
        ORDER BY created_at`,
      [tenantId],
    );

    overrides = res.rows.map(
      (r) => r.config_data as WorkflowTrigger,
    );
  } catch {
    // DB unavailable -- fall back to defaults only
  }

  if (overrides.length === 0) return [...DEFAULT_TRIGGERS];

  const overrideMap = new Map(overrides.map((o) => [o.id, o]));
  const merged = DEFAULT_TRIGGERS.map((d) => overrideMap.get(d.id) ?? d);

  // Append triggers that exist only in the database
  for (const o of overrides) {
    if (!DEFAULT_TRIGGERS.some((d) => d.id === o.id)) {
      merged.push(o);
    }
  }

  return merged;
}

/* ── Public API ───────────────────────────────────────────────────── */

/**
 * Evaluate and fire all matching workflow triggers for a given event.
 *
 * This function is intentionally fire-and-forget. It catches all
 * errors internally so it never blocks or breaks the calling route.
 */
export async function fireWorkflowTriggers(
  event: WorkflowTriggerEvent,
  resourceType: string,
  resource: Record<string, unknown>,
  tenantId: string,
): Promise<void> {
  try {
    const triggers = await loadTriggers(tenantId);

    const matching = triggers.filter(
      (t) =>
        t.enabled &&
        t.event === event &&
        t.resourceType === resourceType &&
        evaluateCondition(t.condition, resource),
    );

    if (matching.length === 0) return;

    // Fire all matching triggers concurrently, fire-and-forget
    const promises = matching.map((trigger) =>
      startProcess(trigger, resource, tenantId),
    );

    // We await the batch so individual errors are logged,
    // but the calling route does NOT await fireWorkflowTriggers.
    await Promise.allSettled(promises);
  } catch (err) {
    console.error("[workflow-triggers] Fout bij verwerken triggers:", err);
  }
}

/* ── Internal helpers ─────────────────────────────────────────────── */

async function startProcess(
  trigger: WorkflowTrigger,
  resource: Record<string, unknown>,
  tenantId: string,
): Promise<void> {
  // Resolve variable mappings
  const variables = Object.entries(trigger.variables).map(
    ([name, path]) => ({
      name,
      value: extractJsonPath(path, resource) ?? "",
    }),
  );

  // Always pass tenantId
  variables.push({ name: "tenantId", value: tenantId });

  const url = `${WORKFLOW_BRIDGE_URL}/api/processen/${trigger.processKey}/start`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenantId,
      },
      body: JSON.stringify({ variables }),
    });

    if (res.ok) {
      console.warn(
        `[workflow-triggers] Trigger '${trigger.id}' gestart: ${trigger.processKey}`,
      );
    } else {
      const body = await res.text().catch(() => "");
      console.warn(
        `[workflow-triggers] Trigger '${trigger.id}' mislukt (${res.status}): ${body}`,
      );
    }
  } catch (err) {
    console.error(
      `[workflow-triggers] Trigger '${trigger.id}' fout:`,
      err,
    );
  }
}
