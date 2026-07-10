import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumFetch, medplumProxy, operationOutcome } from "../lib/medplum-client.js";

/**
 * FHIR-taken — de tweede taakbron van de werkbak naast Flowable (spec §4.3.5).
 *
 * FHIR Tasks (bv. de automatisch aangemaakte zorgplan-evaluatietaak) waren
 * vóór W1 niet claim- of voltooibaar: de werkbak routeerde ze naar de
 * Flowable-bridge, die de `fhir-…`-id's niet kent (→ 500). Deze routes
 * geven de werkbak een correct doel per bron: claimen = Task.owner zetten,
 * voltooien = status → completed, beide met audit via de middleware-keten.
 */
export const fhirTakenRoutes = new Hono<AppEnv>();

interface FhirTask {
  resourceType: "Task";
  id?: string;
  status?: string;
  owner?: { reference?: string; display?: string };
  note?: Array<{ text?: string }>;
}

/**
 * GET /fhir-taken — open FHIR-taken voor de werkbak.
 */
fhirTakenRoutes.get("/fhir-taken", async (c) => {
  return medplumProxy(
    c,
    "/fhir/R4/Task?status=requested,accepted,in-progress&_sort=-_lastUpdated&_count=100",
  );
});

async function haalTaak(c: Parameters<typeof medplumFetch>[0], id: string): Promise<{ taak: FhirTask | null; res: Response }> {
  const res = await medplumFetch(c, `/fhir/R4/Task/${id}`);
  if (!res.ok) return { taak: null, res };
  return { taak: (await res.json()) as FhirTask, res };
}

/**
 * POST /fhir-taken/:id/claim — claim de taak voor de ingelogde persoon.
 */
fhirTakenRoutes.post("/fhir-taken/:id/claim", async (c) => {
  const userId = c.req.header("X-User-Id");
  if (!userId) {
    return c.json(
      operationOutcome("error", "required", "X-User-Id-header is vereist om een taak op te pakken"),
      400,
    );
  }

  const id = c.req.param("id");
  const { taak, res } = await haalTaak(c, id);
  if (!taak) {
    return c.json(await res.json().catch(() => ({})), res.status as 404);
  }

  const huidigeOwner = taak.owner?.reference;
  if (huidigeOwner && huidigeOwner !== `Practitioner/${userId}`) {
    return c.json(
      operationOutcome("error", "conflict", "Deze taak is al opgepakt door een collega"),
      409,
    );
  }

  const bijgewerkt: FhirTask = {
    ...taak,
    status: "accepted",
    owner: { reference: `Practitioner/${userId}` },
  };

  const updateRes = await medplumFetch(c, `/fhir/R4/Task/${id}`, {
    method: "PUT",
    body: JSON.stringify(bijgewerkt),
  });
  const body: unknown = await updateRes.json();
  return c.json(body as Record<string, unknown>, updateRes.status as 200);
});

/**
 * POST /fhir-taken/:id/complete — rond de taak af (optionele opmerking).
 */
fhirTakenRoutes.post("/fhir-taken/:id/complete", async (c) => {
  const userId = c.req.header("X-User-Id");
  if (!userId) {
    return c.json(
      operationOutcome("error", "required", "X-User-Id-header is vereist om een taak af te ronden"),
      400,
    );
  }

  const id = c.req.param("id");
  const { taak, res } = await haalTaak(c, id);
  if (!taak) {
    return c.json(await res.json().catch(() => ({})), res.status as 404);
  }

  const body = await c.req
    .json<{ opmerking?: string }>()
    .catch((): { opmerking?: string } => ({}));

  const bijgewerkt: FhirTask = {
    ...taak,
    status: "completed",
    owner: taak.owner ?? { reference: `Practitioner/${userId}` },
    ...(body.opmerking
      ? { note: [...(taak.note ?? []), { text: body.opmerking }] }
      : {}),
  };

  const updateRes = await medplumFetch(c, `/fhir/R4/Task/${id}`, {
    method: "PUT",
    body: JSON.stringify(bijgewerkt),
  });
  const antwoord: unknown = await updateRes.json();
  return c.json(antwoord as Record<string, unknown>, updateRes.status as 200);
});
