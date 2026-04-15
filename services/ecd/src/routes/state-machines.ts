import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

/**
 * Plan 2E fase 3 — State-machines per resource-type.
 *
 * Opslag in openzorg.tenant_configurations met config_type='state_machine'
 * en config_data:
 * {
 *   resourceType: "Patient",
 *   fieldPath: "extension[trajectStatus]",  // informatief
 *   initialState: "aangemeld",
 *   states: [ { slug, label, color, terminal? } ],
 *   transitions: [ { from, to, label?, requiredRole?, guard? } ]
 * }
 *
 * De guard is een string-expressie zoals "zorgplanAanwezig == true".
 * Handhaving van de guard is voor fase 4 (save-hook); voor nu alleen
 * weergave + client-side transitie-dropdown filter.
 */
export const stateMachinesRoutes = new Hono<AppEnv>();

interface StateDef {
  slug: string;
  label: string;
  color: string;
  terminal?: boolean;
}

interface TransitionDef {
  from: string;
  to: string;
  label?: string;
  requiredRole?: string;
  guard?: string;
}

interface StateMachineConfig {
  resourceType: string;
  fieldPath?: string;
  initialState: string;
  states: StateDef[];
  transitions: TransitionDef[];
}

/** Default state-machines worden client-side als fallback gebruikt. */
const DEFAULT_MACHINES: StateMachineConfig[] = [
  {
    resourceType: "Patient",
    fieldPath: "extension[trajectStatus]",
    initialState: "aangemeld",
    states: [
      { slug: "aangemeld", label: "Aangemeld", color: "blue" },
      { slug: "in-intake", label: "In intake", color: "amber" },
      { slug: "in-zorg", label: "In zorg", color: "emerald" },
      { slug: "overdracht", label: "Overdracht", color: "navy" },
      { slug: "uitgeschreven", label: "Uitgeschreven", color: "gray" },
      { slug: "overleden", label: "Overleden", color: "coral", terminal: true },
    ],
    transitions: [
      { from: "aangemeld", to: "in-intake", label: "Intake starten", requiredRole: "planner" },
      { from: "aangemeld", to: "uitgeschreven", label: "Aanmelding afwijzen", requiredRole: "beheerder" },
      { from: "in-intake", to: "in-zorg", label: "In zorg nemen", requiredRole: "teamleider", guard: "zorgplanAanwezig == true" },
      { from: "in-intake", to: "uitgeschreven", label: "Intake afbreken", requiredRole: "teamleider" },
      { from: "in-zorg", to: "overdracht", label: "Overdracht inzetten" },
      { from: "in-zorg", to: "uitgeschreven", label: "Zorg beëindigen", requiredRole: "teamleider" },
      { from: "in-zorg", to: "overleden", label: "Cliënt overleden" },
      { from: "overdracht", to: "in-zorg", label: "Terug in zorg" },
      { from: "overdracht", to: "uitgeschreven", label: "Overdracht voltooid" },
      { from: "uitgeschreven", to: "aangemeld", label: "Heractiveren", requiredRole: "beheerder" },
    ],
  },
  {
    resourceType: "Practitioner",
    fieldPath: "extension[medewerkerStatus]",
    initialState: "onboarding",
    states: [
      { slug: "onboarding", label: "Onboarding", color: "blue" },
      { slug: "actief", label: "Actief", color: "emerald" },
      { slug: "ziek", label: "Ziek", color: "amber" },
      { slug: "verlof", label: "Met verlof", color: "navy" },
      { slug: "uit-dienst", label: "Uit dienst", color: "gray", terminal: true },
    ],
    transitions: [
      { from: "onboarding", to: "actief", label: "In dienst", requiredRole: "beheerder" },
      { from: "actief", to: "ziek", label: "Ziek melden" },
      { from: "actief", to: "verlof", label: "Met verlof" },
      { from: "actief", to: "uit-dienst", label: "Uit dienst", requiredRole: "beheerder" },
      { from: "ziek", to: "actief", label: "Hersteld" },
      { from: "ziek", to: "uit-dienst", label: "Langdurig ziek", requiredRole: "beheerder" },
      { from: "verlof", to: "actief", label: "Terug van verlof" },
    ],
  },
];

async function resolveTenantUuid(tenantIdOrProjectId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
    [tenantIdOrProjectId],
  );
  return result.rows[0]?.id ?? null;
}

/**
 * GET / — List all state-machines voor de tenant (merged met defaults).
 */
stateMachinesRoutes.get("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    // Zonder tenant-match: return defaults
    return c.json({ machines: DEFAULT_MACHINES });
  }

  const result = await pool.query<{ config_data: StateMachineConfig }>(
    `SELECT config_data FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'state_machine'
      ORDER BY created_at DESC`,
    [tenantUuid],
  );

  // Merge: tenant-override wint per resourceType, anders default
  const tenantMachines = result.rows.map((row) => row.config_data);
  const byType = new Map<string, StateMachineConfig>();
  for (const m of DEFAULT_MACHINES) byType.set(m.resourceType, m);
  for (const m of tenantMachines) byType.set(m.resourceType, m);

  return c.json({ machines: Array.from(byType.values()) });
});

/**
 * GET /:resourceType — Return only the state-machine for one resource type.
 */
stateMachinesRoutes.get("/:resourceType", async (c) => {
  const tenantHeader = c.get("tenantId");
  const resourceType = c.req.param("resourceType");
  const tenantUuid = await resolveTenantUuid(tenantHeader);

  if (tenantUuid) {
    const result = await pool.query<{ config_data: StateMachineConfig }>(
      `SELECT config_data FROM openzorg.tenant_configurations
        WHERE tenant_id = $1 AND config_type = 'state_machine'
          AND config_data->>'resourceType' = $2
        ORDER BY created_at DESC LIMIT 1`,
      [tenantUuid, resourceType],
    );
    if (result.rows.length > 0) {
      return c.json({ machine: result.rows[0]!.config_data });
    }
  }

  const fallback = DEFAULT_MACHINES.find((m) => m.resourceType === resourceType);
  if (!fallback) {
    return c.json({ error: `Geen state-machine gevonden voor ${resourceType}` }, 404);
  }
  return c.json({ machine: fallback });
});

/**
 * PUT /:resourceType — Upsert de state-machine config.
 * Body: StateMachineConfig
 */
stateMachinesRoutes.put("/:resourceType", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }

  const resourceType = c.req.param("resourceType");
  const body = await c.req.json<StateMachineConfig>().catch(() => null);
  if (!body) {
    return c.json({ error: "Ongeldige JSON body" }, 400);
  }
  if (body.resourceType !== resourceType) {
    return c.json({ error: "resourceType in body moet matchen met URL" }, 400);
  }
  if (!Array.isArray(body.states) || body.states.length === 0) {
    return c.json({ error: "states-array is vereist" }, 400);
  }
  if (!Array.isArray(body.transitions)) {
    return c.json({ error: "transitions-array is vereist" }, 400);
  }
  if (!body.states.some((s) => s.slug === body.initialState)) {
    return c.json({ error: "initialState moet een bestaande state zijn" }, 400);
  }

  const existing = await pool.query<{ id: string; config_data: StateMachineConfig }>(
    `SELECT id, config_data FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'state_machine'
        AND config_data->>'resourceType' = $2
      ORDER BY created_at DESC LIMIT 1`,
    [tenantUuid, resourceType],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE openzorg.tenant_configurations
          SET config_data = $1, version = version + 1, updated_at = now()
        WHERE id = $2`,
      [JSON.stringify(body), existing.rows[0]!.id],
    );
    await pool.query(
      `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'state-machine.update', $3, $4, $5)`,
      [
        tenantUuid,
        c.req.header("X-User-Id") ?? "system",
        resourceType,
        existing.rows[0]!.id,
        JSON.stringify({ before: existing.rows[0]!.config_data, after: body }),
      ],
    );
  } else {
    const insert = await pool.query<{ id: string }>(
      `INSERT INTO openzorg.tenant_configurations (tenant_id, config_type, config_data, version)
       VALUES ($1, 'state_machine', $2, 1)
       RETURNING id`,
      [tenantUuid, JSON.stringify(body)],
    );
    await pool.query(
      `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'state-machine.create', $3, $4, $5)`,
      [
        tenantUuid,
        c.req.header("X-User-Id") ?? "system",
        resourceType,
        insert.rows[0]!.id,
        JSON.stringify({ config: body }),
      ],
    );
  }

  return c.json({ success: true, machine: body });
});

/**
 * POST /:resourceType/reset — Verwijder tenant-override, terug naar defaults.
 */
stateMachinesRoutes.post("/:resourceType/reset", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }
  const resourceType = c.req.param("resourceType");

  await pool.query(
    `DELETE FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'state_machine'
        AND config_data->>'resourceType' = $2`,
    [tenantUuid, resourceType],
  );

  const fallback = DEFAULT_MACHINES.find((m) => m.resourceType === resourceType);
  return c.json({ success: true, machine: fallback });
});
