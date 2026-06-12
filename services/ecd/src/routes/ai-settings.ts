import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

/**
 * AI-instellingen per tenant — opgeslagen in openzorg.tenant_configurations
 * met config_type = 'ai_settings'. Beheert Ollama URL, model en tenant-prompt.
 */
export const aiSettingsRoutes = new Hono<AppEnv>();

interface AiSettings {
  enabled: boolean;
  ollamaUrl: string;
  model: string;
  tenantPrompt: string;
}

const DEFAULT_SETTINGS: AiSettings = {
  enabled: false,
  ollamaUrl: "",
  model: "",
  tenantPrompt: "",
};

async function resolveTenantUuid(tenantIdOrProjectId: string): Promise<string | null> {
  try {
    const result = await pool.query<{ id: string }>(
      "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
      [tenantIdOrProjectId],
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * GET / — Lees AI-instellingen voor de huidige tenant.
 * Geeft standaardwaarden terug als er nog niets is ingesteld.
 */
aiSettingsRoutes.get("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  console.log("[AI-SETTINGS] GET tenantHeader:", tenantHeader);
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  console.log("[AI-SETTINGS] resolved UUID:", tenantUuid);
  if (!tenantUuid) {
    return c.json({ settings: DEFAULT_SETTINGS });
  }

  // Set RLS context for tenant_configurations access
  await pool.query("SELECT set_config('openzorg.current_tenant_id', $1, true)", [tenantUuid]);

  const result = await pool.query<{ config_data: AiSettings }>(
    `SELECT config_data
       FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'ai_settings'
      LIMIT 1`,
    [tenantUuid],
  );

  const settings: AiSettings = result.rows[0]?.config_data ?? DEFAULT_SETTINGS;
  return c.json({ settings });
});

/**
 * PUT / — Upsert AI-instellingen voor de huidige tenant.
 * Body: { enabled, ollamaUrl, model, tenantPrompt }
 */
aiSettingsRoutes.put("/", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ error: `Tenant niet gevonden voor id '${tenantHeader}'` }, 404);
  }

  const body = await c.req.json<Partial<AiSettings>>().catch(() => null);
  if (!body) {
    return c.json({ error: "Ongeldige JSON body" }, 400);
  }

  const settings: AiSettings = {
    enabled: typeof body.enabled === "boolean" ? body.enabled : DEFAULT_SETTINGS.enabled,
    ollamaUrl: typeof body.ollamaUrl === "string" ? body.ollamaUrl : DEFAULT_SETTINGS.ollamaUrl,
    model: typeof body.model === "string" ? body.model : DEFAULT_SETTINGS.model,
    tenantPrompt: typeof body.tenantPrompt === "string" ? body.tenantPrompt : DEFAULT_SETTINGS.tenantPrompt,
  };

  try {
    await pool.query(
      `INSERT INTO openzorg.tenant_configurations (tenant_id, config_type, config_data, version)
       VALUES ($1, 'ai_settings', $2, 1)
       ON CONFLICT (tenant_id, config_type)
       DO UPDATE SET config_data = EXCLUDED.config_data, version = tenant_configurations.version + 1, updated_at = now()`,
      [tenantUuid, JSON.stringify(settings)],
    );

    return c.json({ settings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "onbekende fout";
    console.error("[AI-SETTINGS] PUT faalde:", msg);
    return c.json({ error: `Database-fout: ${msg}` }, 500);
  }
});

/**
 * POST /test — Test de Ollama-verbinding op de opgegeven URL.
 * Body: { ollamaUrl: string }
 * Retourneert: { healthy: boolean, models: string[], error?: string }
 */
aiSettingsRoutes.post("/test", async (c) => {
  const body = await c.req.json<{ ollamaUrl?: string }>().catch(() => null);
  if (!body?.ollamaUrl) {
    return c.json({ error: "ollamaUrl is vereist" }, 400);
  }

  const url = body.ollamaUrl.replace(/\/$/, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 15000);

    let response: Response;
    try {
      response = await fetch(`${url}/api/tags`, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return c.json({
        healthy: false,
        models: [],
        error: `Ollama antwoordde met HTTP ${response.status}`,
      });
    }

    const data = await response.json() as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);

    return c.json({ healthy: true, models });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "onbekende fout";
    return c.json({ healthy: false, models: [], error: msg });
  }
});
