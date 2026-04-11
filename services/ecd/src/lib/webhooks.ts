/**
 * Webhook Event System.
 *
 * Fires events to registered webhook URLs when CRUD actions happen.
 * Webhook registrations are stored per tenant in PostgreSQL.
 *
 * Events are fired async (fire-and-forget) to not block API responses.
 */

import { pool } from "./db.js";

export interface WebhookEvent {
  event: string;         // e.g. "client.created", "appointment.updated"
  tenantId: string;
  resourceType: string;
  resourceId?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface WebhookRegistration {
  id: string;
  tenant_id: string;
  url: string;
  events: string[];      // ["client.*", "appointment.created"]
  secret: string;
  active: boolean;
}

/**
 * Fire a webhook event. Non-blocking, logs errors but doesn't throw.
 */
export async function fireWebhookEvent(event: WebhookEvent): Promise<void> {
  try {
    // Find tenant UUID
    const tenantResult = await pool.query(
      "SELECT id FROM openzorg.tenants WHERE medplum_project_id = $1 OR id::text = $1 LIMIT 1",
      [event.tenantId],
    );
    const tenantUuid = (tenantResult.rows[0] as { id: string } | undefined)?.id;
    if (!tenantUuid) return;

    // Find matching webhook registrations
    const webhooksResult = await pool.query<WebhookRegistration>(
      "SELECT * FROM openzorg.webhooks WHERE tenant_id = $1 AND active = true",
      [tenantUuid],
    );

    for (const webhook of webhooksResult.rows) {
      // Check if this webhook subscribes to this event
      const matches = webhook.events.some((pattern) => {
        if (pattern === "*") return true;
        if (pattern.endsWith(".*")) {
          return event.event.startsWith(pattern.slice(0, -1));
        }
        return pattern === event.event;
      });

      if (!matches) continue;

      // Fire webhook async
      sendWebhook(webhook.url, webhook.secret, event).catch((err) => {
        console.error(`[WEBHOOK] Failed to send to ${webhook.url}:`, err);
      });
    }
  } catch (err) {
    console.error("[WEBHOOK] Error processing event:", err);
  }
}

async function sendWebhook(url: string, secret: string, event: WebhookEvent): Promise<void> {
  const body = JSON.stringify(event);

  // Create HMAC signature for verification
  const crypto = await import("node:crypto");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OpenZorg-Signature": `sha256=${signature}`,
      "X-OpenZorg-Event": event.event,
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`[WEBHOOK] ${url} returned ${res.status}: ${await res.text()}`);
  }
}
