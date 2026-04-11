import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";

export const berichtenRoutes = new Hono<AppEnv>();

interface BerichtInput {
  recipientId: string;
  senderId: string;
  onderwerp: string;
  bericht: string;
}

/**
 * GET /api/berichten — List Communication resources for the current user.
 * Accepts ?recipient=Practitioner/xxx to filter by recipient.
 */
berichtenRoutes.get("/", async (c) => {
  const queryString = new URL(c.req.url).search;
  return medplumProxy(
    c,
    `/fhir/R4/Communication?_sort=-sent${queryString ? `&${queryString.slice(1)}` : ""}`,
  );
});

/**
 * POST /api/berichten — Create a Communication resource (message).
 */
berichtenRoutes.post("/", async (c) => {
  const body = (await c.req.json()) as BerichtInput;

  if (!body.bericht) {
    return c.json(
      operationOutcome("error", "required", "Bericht is vereist"),
      400,
    );
  }

  if (!body.recipientId) {
    return c.json(
      operationOutcome("error", "required", "Ontvanger is vereist"),
      400,
    );
  }

  const resource: Record<string, unknown> = {
    resourceType: "Communication",
    status: "completed",
    sent: new Date().toISOString(),
    ...(body.senderId
      ? { sender: { reference: body.senderId } }
      : {}),
    recipient: [{ reference: body.recipientId }],
    payload: [
      {
        contentString: body.bericht,
      },
    ],
    topic: body.onderwerp
      ? {
          text: body.onderwerp,
        }
      : undefined,
    // Use received=null to indicate "unread" — we set it when marked as read
  };

  return medplumProxy(c, "/fhir/R4/Communication", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PATCH /api/berichten/:id/gelezen — Mark a Communication as read by setting received timestamp.
 */
berichtenRoutes.patch("/:id/gelezen", async (c) => {
  const id = c.req.param("id");

  const current = await medplumFetch(c, `/fhir/R4/Communication/${id}`);
  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const communication = (await current.json()) as Record<string, unknown>;
  communication["received"] = new Date().toISOString();

  return medplumProxy(c, `/fhir/R4/Communication/${id}`, {
    method: "PUT",
    body: JSON.stringify(communication),
  });
});
