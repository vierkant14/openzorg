import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";

export const beschikbaarheidRoutes = new Hono<AppEnv>();

interface SlotInput {
  start: string;
  end: string;
  status?: string;
}

interface ScheduleInput {
  slots: SlotInput[];
  planningHorizon?: {
    start: string;
    end: string;
  };
}

interface BlockInput {
  start: string;
  end: string;
  reden?: string;
}

/**
 * GET /api/beschikbaarheid/medewerker/:practitionerId — Get schedule and slots.
 */
beschikbaarheidRoutes.get("/medewerker/:practitionerId", async (c) => {
  const practitionerId = c.req.param("practitionerId");

  // First, find the Schedule for this practitioner
  const scheduleRes = await medplumFetch(
    c,
    `/fhir/R4/Schedule?actor=Practitioner/${practitionerId}`,
  );

  if (!scheduleRes.ok) {
    return proxyMedplumResponse(c, scheduleRes);
  }

  const scheduleBundle = (await scheduleRes.json()) as Record<string, unknown>;
  const entries = (scheduleBundle["entry"] as Array<{ resource: Record<string, unknown> }>) ?? [];

  if (entries.length === 0) {
    return c.json({
      resourceType: "Bundle",
      type: "searchset",
      total: 0,
      entry: [],
    });
  }

  const scheduleId = entries[0]?.resource?.["id"] as string;

  // Then fetch the Slots for this schedule
  const date = c.req.query("datum");
  const params = new URLSearchParams();
  params.set("schedule", `Schedule/${scheduleId}`);
  if (date) {
    params.set("start", date);
  }

  const slotsRes = await medplumFetch(c, `/fhir/R4/Slot?${params.toString()}`);
  if (!slotsRes.ok) {
    return proxyMedplumResponse(c, slotsRes);
  }

  const slotsBundle = (await slotsRes.json()) as Record<string, unknown>;

  return c.json({
    schedule: entries[0]?.resource,
    slots: slotsBundle,
  });
});

/**
 * POST /api/beschikbaarheid/medewerker/:practitionerId — Set availability.
 * Creates a Schedule with associated Slots.
 */
beschikbaarheidRoutes.post("/medewerker/:practitionerId", async (c) => {
  const practitionerId = c.req.param("practitionerId");
  const body = await c.req.json<ScheduleInput>();

  if (!body.slots || body.slots.length === 0) {
    return c.json(
      operationOutcome("error", "required", "Minimaal een slot is vereist"),
      400,
    );
  }

  // Create or update the Schedule resource
  const schedule = {
    resourceType: "Schedule",
    active: true,
    actor: [{ reference: `Practitioner/${practitionerId}` }],
    ...(body.planningHorizon
      ? {
          planningHorizon: {
            start: body.planningHorizon.start,
            end: body.planningHorizon.end,
          },
        }
      : {}),
  };

  const scheduleRes = await medplumFetch(c, "/fhir/R4/Schedule", {
    method: "POST",
    body: JSON.stringify(schedule),
  });

  if (!scheduleRes.ok) {
    return proxyMedplumResponse(c, scheduleRes);
  }

  const createdSchedule = (await scheduleRes.json()) as Record<string, unknown>;
  const scheduleId = createdSchedule["id"] as string;

  // Create Slot resources for this schedule
  const slotResults: Array<Record<string, unknown>> = [];

  for (const slotInput of body.slots) {
    const slot = {
      resourceType: "Slot",
      schedule: { reference: `Schedule/${scheduleId}` },
      status: slotInput.status ?? "free",
      start: slotInput.start,
      end: slotInput.end,
    };

    const slotRes = await medplumFetch(c, "/fhir/R4/Slot", {
      method: "POST",
      body: JSON.stringify(slot),
    });

    if (slotRes.ok) {
      const created = (await slotRes.json()) as Record<string, unknown>;
      slotResults.push(created);
    }
  }

  return c.json(
    {
      schedule: createdSchedule,
      slots: slotResults,
    },
    201,
  );
});

/**
 * PUT /api/beschikbaarheid/medewerker/:practitionerId/blokkeer — Block time slots.
 * Marks slots as busy-unavailable (for vacation, sick leave, etc.)
 */
beschikbaarheidRoutes.put("/medewerker/:practitionerId/blokkeer", async (c) => {
  const practitionerId = c.req.param("practitionerId");
  const body = await c.req.json<BlockInput>();

  if (!body.start || !body.end) {
    return c.json(
      operationOutcome("error", "required", "Start- en eindtijd zijn vereist"),
      400,
    );
  }

  // Find the schedule for this practitioner
  const scheduleRes = await medplumFetch(
    c,
    `/fhir/R4/Schedule?actor=Practitioner/${practitionerId}`,
  );

  if (!scheduleRes.ok) {
    return proxyMedplumResponse(c, scheduleRes);
  }

  const scheduleBundle = (await scheduleRes.json()) as Record<string, unknown>;
  const entries = (scheduleBundle["entry"] as Array<{ resource: Record<string, unknown> }>) ?? [];

  let scheduleId: string;

  if (entries.length === 0) {
    // Create a schedule if one does not exist
    const schedule = {
      resourceType: "Schedule",
      active: true,
      actor: [{ reference: `Practitioner/${practitionerId}` }],
    };

    const newScheduleRes = await medplumFetch(c, "/fhir/R4/Schedule", {
      method: "POST",
      body: JSON.stringify(schedule),
    });

    if (!newScheduleRes.ok) {
      return proxyMedplumResponse(c, newScheduleRes);
    }

    const newSchedule = (await newScheduleRes.json()) as Record<string, unknown>;
    scheduleId = newSchedule["id"] as string;
  } else {
    scheduleId = entries[0]?.resource?.["id"] as string;
  }

  // Create a busy-unavailable slot for the blocked period
  const slot = {
    resourceType: "Slot",
    schedule: { reference: `Schedule/${scheduleId}` },
    status: "busy-unavailable",
    start: body.start,
    end: body.end,
    ...(body.reden
      ? {
          comment: body.reden,
        }
      : {}),
  };

  const slotRes = await medplumFetch(c, "/fhir/R4/Slot", {
    method: "POST",
    body: JSON.stringify(slot),
  });

  return proxyMedplumResponse(c, slotRes);
});
