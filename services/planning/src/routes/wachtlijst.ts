import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";

export const wachtlijstRoutes = new Hono<AppEnv>();

interface WachtlijstBody {
  resourceType?: string;
  status?: string;
  intent?: string;
  subject?: { reference?: string };
  performer?: Array<{ reference?: string }>;
  note?: Array<{ text?: string }>;
  [key: string]: unknown;
}

/**
 * GET /api/wachtlijst — List waiting list entries (ServiceRequest with status=draft).
 */
wachtlijstRoutes.get("/", async (c) => {
  const params = new URLSearchParams();
  params.set("status", "draft");

  const queryString = new URL(c.req.url).search;
  const extraParams = new URLSearchParams(queryString);

  // Preserve any additional filters but always enforce status=draft
  extraParams.forEach((value, key) => {
    if (key !== "status") {
      params.set(key, value);
    }
  });

  return medplumProxy(c, `/fhir/R4/ServiceRequest?${params.toString()}`);
});

/**
 * POST /api/wachtlijst — Add to waiting list (create ServiceRequest with status=draft).
 */
wachtlijstRoutes.post("/", async (c) => {
  const body = await c.req.json<WachtlijstBody>();

  if (!body.subject?.reference) {
    return c.json(
      operationOutcome("error", "required", "Client referentie is vereist"),
      400,
    );
  }

  const resource = {
    ...body,
    resourceType: "ServiceRequest",
    status: "draft",
    intent: body.intent ?? "plan",
  };

  return medplumProxy(c, "/fhir/R4/ServiceRequest", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /api/wachtlijst/:id/inplannen — Move from waiting list to planned.
 * Updates ServiceRequest status to active and optionally creates an Appointment.
 */
wachtlijstRoutes.put("/:id/inplannen", async (c) => {
  const id = c.req.param("id");

  const body = await c.req.json<{
    appointment?: Record<string, unknown>;
  }>();

  // Fetch the current ServiceRequest
  const current = await medplumFetch(c, `/fhir/R4/ServiceRequest/${id}`);
  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const serviceRequest = (await current.json()) as Record<string, unknown>;

  // Verify it is still in draft status
  if (serviceRequest["status"] !== "draft") {
    return c.json(
      operationOutcome(
        "error",
        "business-rule",
        "Alleen wachtlijst-items met status 'draft' kunnen worden ingepland",
      ),
      400,
    );
  }

  // Update ServiceRequest status to active
  serviceRequest["status"] = "active";

  const updateRes = await medplumFetch(c, `/fhir/R4/ServiceRequest/${id}`, {
    method: "PUT",
    body: JSON.stringify(serviceRequest),
  });

  if (!updateRes.ok) {
    return proxyMedplumResponse(c, updateRes);
  }

  const updatedServiceRequest = (await updateRes.json()) as Record<string, unknown>;

  // Optionally create an Appointment if appointment data is provided
  if (body.appointment) {
    const appointment = {
      ...body.appointment,
      resourceType: "Appointment",
      basedOn: [{ reference: `ServiceRequest/${id}` }],
    };

    const appointmentRes = await medplumFetch(c, "/fhir/R4/Appointment", {
      method: "POST",
      body: JSON.stringify(appointment),
    });

    if (appointmentRes.ok) {
      const createdAppointment = (await appointmentRes.json()) as Record<string, unknown>;
      return c.json({
        serviceRequest: updatedServiceRequest,
        appointment: createdAppointment,
      });
    }
  }

  return c.json({ serviceRequest: updatedServiceRequest });
});

/**
 * DELETE /api/wachtlijst/:id — Remove from waiting list (set status to revoked).
 */
wachtlijstRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const current = await medplumFetch(c, `/fhir/R4/ServiceRequest/${id}`);
  if (!current.ok) {
    return proxyMedplumResponse(c, current);
  }

  const serviceRequest = (await current.json()) as Record<string, unknown>;
  serviceRequest["status"] = "revoked";

  return medplumProxy(c, `/fhir/R4/ServiceRequest/${id}`, {
    method: "PUT",
    body: JSON.stringify(serviceRequest),
  });
});
