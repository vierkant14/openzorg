import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const featureFlagRoutes = new Hono<AppEnv>();

interface FeatureFlag {
  enabled: boolean;
  rolloutDate?: string;
  notes?: string;
}

interface PlatformSettings {
  featureFlags: Record<string, FeatureFlag>;
  session: {
    accessTokenLifetime: string;
    refreshTokenLifetime: string;
    idleTimeoutMinutes: number;
  };
  branding: {
    logoUrl: string;
    primaryColor: string;
    organizationNameOverride: string;
  };
}

const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  "workflow-engine": { enabled: true },
  "bpmn-canvas": { enabled: true },
  "dmn-editor": { enabled: true },
  "facturatie-module": { enabled: true },
  "planning-module": { enabled: true },
  "planning-intramuraal": { enabled: true },
  "mic-meldingen": { enabled: true },
  "rapportages-ai": { enabled: true },
  "sales-canvas": { enabled: true },
};

/**
 * GET /api/admin/feature-flags — returns feature flags for the current tenant.
 */
featureFlagRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId");

  const result = await pool.query<{ platform_settings: PlatformSettings | null }>(
    "SELECT platform_settings FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1",
    [tenantId],
  );

  if (result.rows.length === 0) {
    return c.json({ featureFlags: DEFAULT_FLAGS });
  }

  const settings = result.rows[0]?.platform_settings;
  const merged = { ...DEFAULT_FLAGS, ...(settings?.featureFlags ?? {}) };

  return c.json({ featureFlags: merged });
});

/**
 * PUT /api/admin/feature-flags — update feature flags for the current tenant.
 * Body: { featureFlags: Record<string, { enabled: boolean }> }
 */
featureFlagRoutes.put("/", async (c) => {
  const tenantId = c.get("tenantId");

  const body = await c.req.json<{ featureFlags: Record<string, { enabled: boolean }> }>().catch(() => null);
  if (!body?.featureFlags) {
    return c.json({ error: "featureFlags is verplicht" }, 400);
  }

  // Load current platform_settings
  const currentRes = await pool.query<{ id: string; platform_settings: PlatformSettings | null }>(
    "SELECT id, platform_settings FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1",
    [tenantId],
  );

  if (currentRes.rows.length === 0) {
    return c.json({ error: "Tenant niet gevonden" }, 404);
  }

  const row = currentRes.rows[0]!;
  const current = row.platform_settings ?? {
    featureFlags: DEFAULT_FLAGS,
    session: { accessTokenLifetime: "1d", refreshTokenLifetime: "30d", idleTimeoutMinutes: 60 },
    branding: { logoUrl: "", primaryColor: "", organizationNameOverride: "" },
  };

  // Merge only the featureFlags section — preserve session + branding
  const mergedFlags: Record<string, FeatureFlag> = { ...current.featureFlags };
  for (const [key, val] of Object.entries(body.featureFlags)) {
    mergedFlags[key] = { ...(mergedFlags[key] ?? { enabled: true }), enabled: val.enabled };
  }

  const updated: PlatformSettings = {
    ...current,
    featureFlags: mergedFlags,
  };

  await pool.query(
    "UPDATE openzorg.tenants SET platform_settings = $1, updated_at = now() WHERE id = $2",
    [JSON.stringify(updated), row.id],
  );

  // Audit log
  try {
    await pool.query(
      `INSERT INTO openzorg.audit_log (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        row.id,
        c.req.header("X-User-Id") ?? "tenant-admin",
        "feature-flags.update",
        "Tenant",
        row.id,
        JSON.stringify({ before: current.featureFlags, after: mergedFlags }),
      ],
    );
  } catch (err) {
    console.error("[FEATURE FLAGS] Audit log schrijven faalde:", err);
  }

  return c.json({ featureFlags: mergedFlags });
});
