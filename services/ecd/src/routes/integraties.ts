import crypto from "node:crypto";

import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";

export const integratieRoutes = new Hono<AppEnv>();

/* ── API Keys ── */

/**
 * GET /api/admin/integraties/api-keys — List API keys for this tenant.
 */
integratieRoutes.get("/api-keys", async (c) => {
  const tenantId = c.get("tenantId");

  const tenantResult = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1",
    [tenantId],
  );
  const tenantUuid = (tenantResult.rows[0] as { id: string } | undefined)?.id;
  if (!tenantUuid) return c.json({ keys: [] });

  const result = await pool.query(
    "SELECT id, name, permissions, active, last_used_at, created_at FROM openzorg.api_keys WHERE tenant_id = $1 ORDER BY created_at DESC",
    [tenantUuid],
  );

  return c.json({ keys: result.rows });
});

/**
 * POST /api/admin/integraties/api-keys — Create a new API key.
 * Body: { name: string, permissions: string[] }
 * Returns the key ONCE — it's hashed and never shown again.
 */
integratieRoutes.post("/api-keys", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{ name: string; permissions?: string[] }>();

  if (!body.name) return c.json({ error: "Naam is verplicht" }, 400);

  const tenantResult = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1",
    [tenantId],
  );
  const tenantUuid = (tenantResult.rows[0] as { id: string } | undefined)?.id;
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  // Generate a secure API key
  const rawKey = `ozk_${crypto.randomBytes(32).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const permissions = body.permissions ?? ["clients:read"];

  await pool.query(
    `INSERT INTO openzorg.api_keys (tenant_id, name, key_hash, permissions)
     VALUES ($1, $2, $3, $4)`,
    [tenantUuid, body.name, keyHash, permissions],
  );

  // Return the key ONCE
  return c.json({
    key: rawKey,
    name: body.name,
    permissions,
    message: "Bewaar deze sleutel veilig — hij wordt niet meer getoond.",
  }, 201);
});

/**
 * DELETE /api/admin/integraties/api-keys/:id — Revoke an API key.
 */
integratieRoutes.delete("/api-keys/:id", async (c) => {
  const id = c.req.param("id");
  await pool.query("UPDATE openzorg.api_keys SET active = false WHERE id = $1", [id]);
  return c.json({ message: "API sleutel ingetrokken" });
});

/* ── Webhooks ── */

/**
 * GET /api/admin/integraties/webhooks — List webhooks for this tenant.
 */
integratieRoutes.get("/webhooks", async (c) => {
  const tenantId = c.get("tenantId");

  const tenantResult = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1",
    [tenantId],
  );
  const tenantUuid = (tenantResult.rows[0] as { id: string } | undefined)?.id;
  if (!tenantUuid) return c.json({ webhooks: [] });

  const result = await pool.query(
    "SELECT id, url, events, active, created_at FROM openzorg.webhooks WHERE tenant_id = $1 ORDER BY created_at DESC",
    [tenantUuid],
  );

  return c.json({ webhooks: result.rows });
});

/**
 * POST /api/admin/integraties/webhooks — Register a webhook.
 * Body: { url: string, events: string[] }
 */
integratieRoutes.post("/webhooks", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json<{ url: string; events?: string[] }>();

  if (!body.url) return c.json({ error: "URL is verplicht" }, 400);

  const tenantResult = await pool.query(
    "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1",
    [tenantId],
  );
  const tenantUuid = (tenantResult.rows[0] as { id: string } | undefined)?.id;
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const secret = crypto.randomBytes(32).toString("hex");
  const events = body.events ?? ["*"];

  const result = await pool.query(
    `INSERT INTO openzorg.webhooks (tenant_id, url, events, secret)
     VALUES ($1, $2, $3, $4)
     RETURNING id, url, events, secret, active, created_at`,
    [tenantUuid, body.url, events, secret],
  );

  return c.json({
    webhook: result.rows[0],
    message: "Webhook geregistreerd. Bewaar het secret voor signature verificatie.",
  }, 201);
});

/**
 * DELETE /api/admin/integraties/webhooks/:id — Remove a webhook.
 */
integratieRoutes.delete("/webhooks/:id", async (c) => {
  const id = c.req.param("id");
  await pool.query("UPDATE openzorg.webhooks SET active = false WHERE id = $1", [id]);
  return c.json({ message: "Webhook uitgeschakeld" });
});
