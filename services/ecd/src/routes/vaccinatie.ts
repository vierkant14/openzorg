import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const vaccinatieRoutes = new Hono<AppEnv>();

/**
 * Vaccinaties stored as FHIR Immunization resources.
 *
 * Key fields:
 * - patient: reference to Patient
 * - vaccineCode: coding (CVX/ATC/SNOMED)
 * - occurrenceDateTime: when administered
 * - status: completed | entered-in-error | not-done
 * - performer: who administered (Practitioner)
 * - lotNumber: batch/lot number
 * - site: body site (e.g. left arm)
 * - route: administration route (e.g. intramuscular)
 * - doseQuantity: dose amount
 * - note: additional notes
 */

/**
 * GET /api/vaccinaties-overzicht — List all vaccinations across all clients.
 * Used by the cross-client vaccinaties overview page.
 */
vaccinatieRoutes.get("/overzicht", async (c) => {
  const count = c.req.query("_count") ?? "200";
  return medplumProxy(
    c,
    `/fhir/R4/Immunization?_sort=-date&_count=${encodeURIComponent(count)}&_include=Immunization:patient`,
  );
});

/**
 * GET /api/clients/:patientId/vaccinaties — List all vaccinations for a patient.
 */
vaccinatieRoutes.get("/:patientId/vaccinaties", async (c) => {
  const patientId = c.req.param("patientId");
  return medplumProxy(
    c,
    `/fhir/R4/Immunization?patient=Patient/${patientId}&_sort=-date&_count=100`,
  );
});

/**
 * GET /api/clients/:patientId/vaccinaties/:id — Get a single vaccination.
 */
vaccinatieRoutes.get("/:patientId/vaccinaties/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Immunization/${id}`);
});

/**
 * POST /api/clients/:patientId/vaccinaties — Register a vaccination.
 *
 * Body: {
 *   vaccineCode: string,          // e.g. "J07BX03" (ATC) or SNOMED code
 *   vaccineDisplay: string,       // e.g. "COVID-19 vaccin"
 *   datum: string,                // ISO datetime
 *   status?: string,              // "completed" | "not-done" (default: completed)
 *   uitvoerder?: string,          // Practitioner ID
 *   lotNummer?: string,           // Batch/lot number
 *   locatie?: string,             // Body site, e.g. "Linker bovenarm"
 *   toedieningsweg?: string,      // Route, e.g. "Intramusculair"
 *   dosis?: { waarde: number, eenheid: string },
 *   opmerking?: string,
 *   redenNietGegeven?: string,    // Reason if status = not-done
 *   herhalend?: boolean,          // Is this a recurring vaccination?
 *   frequentie?: string,          // "jaarlijks" | "halfjaarlijks" | "eenmalig"
 *   volgendeDatum?: string,       // ISO date — next due date
 *   geldigTot?: string,           // ISO date — expiration / protection end date
 * }
 */
vaccinatieRoutes.post("/:patientId/vaccinaties", async (c) => {
  const patientId = c.req.param("patientId");
  const body = await c.req.json<{
    vaccineCode: string;
    vaccineDisplay: string;
    datum: string;
    status?: string;
    uitvoerder?: string;
    lotNummer?: string;
    locatie?: string;
    toedieningsweg?: string;
    dosis?: { waarde: number; eenheid: string };
    opmerking?: string;
    redenNietGegeven?: string;
    herhalend?: boolean;
    frequentie?: string;
    volgendeDatum?: string;
    geldigTot?: string;
  }>();

  if (!body.vaccineCode || !body.vaccineDisplay || !body.datum) {
    return c.json(
      operationOutcome("error", "required", "vaccineCode, vaccineDisplay en datum zijn verplicht"),
      400,
    );
  }

  const status = body.status || "completed";

  const resource: Record<string, unknown> = {
    resourceType: "Immunization",
    status,
    vaccineCode: {
      coding: [
        {
          system: "http://www.whocc.no/atc",
          code: body.vaccineCode,
          display: body.vaccineDisplay,
        },
      ],
      text: body.vaccineDisplay,
    },
    patient: { reference: `Patient/${patientId}` },
    occurrenceDateTime: body.datum,
    recorded: new Date().toISOString(),
    primarySource: true,
  };

  if (body.uitvoerder) {
    resource.performer = [
      {
        actor: { reference: `Practitioner/${body.uitvoerder}` },
        function: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0443",
              code: "AP",
              display: "Administering Provider",
            },
          ],
        },
      },
    ];
  }

  if (body.lotNummer) {
    resource.lotNumber = body.lotNummer;
  }

  if (body.locatie) {
    resource.site = {
      coding: [
        {
          system: "http://snomed.info/sct",
          display: body.locatie,
        },
      ],
      text: body.locatie,
    };
  }

  if (body.toedieningsweg) {
    resource.route = {
      coding: [
        {
          system: "http://snomed.info/sct",
          display: body.toedieningsweg,
        },
      ],
      text: body.toedieningsweg,
    };
  }

  if (body.dosis) {
    resource.doseQuantity = {
      value: body.dosis.waarde,
      unit: body.dosis.eenheid,
      system: "http://unitsofmeasure.org",
    };
  }

  if (body.opmerking) {
    resource.note = [{ text: body.opmerking }];
  }

  if (status === "not-done" && body.redenNietGegeven) {
    resource.statusReason = {
      text: body.redenNietGegeven,
    };
  }

  // Recurring vaccination extensions
  const extensions: Array<{ url: string; valueBoolean?: boolean; valueString?: string; valueDate?: string }> = [];
  if (body.herhalend !== undefined) {
    extensions.push({
      url: "https://openzorg.nl/extensions/herhalend",
      valueBoolean: body.herhalend,
    });
  }
  if (body.frequentie) {
    extensions.push({
      url: "https://openzorg.nl/extensions/frequentie",
      valueString: body.frequentie,
    });
  }
  if (body.volgendeDatum) {
    extensions.push({
      url: "https://openzorg.nl/extensions/volgende-datum",
      valueDate: body.volgendeDatum,
    });
  }
  if (body.geldigTot) {
    extensions.push({
      url: "https://openzorg.nl/extensions/geldig-tot",
      valueDate: body.geldigTot,
    });
  }
  if (extensions.length > 0) {
    resource.extension = extensions;
  }

  return medplumProxy(c, "/fhir/R4/Immunization", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /api/clients/:patientId/vaccinaties/:id — Update a vaccination record.
 */
vaccinatieRoutes.put("/:patientId/vaccinaties/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  return medplumProxy(c, `/fhir/R4/Immunization/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...body, resourceType: "Immunization", id }),
  });
});

/**
 * DELETE /api/clients/:patientId/vaccinaties/:id — Remove a vaccination record.
 */
vaccinatieRoutes.delete("/:patientId/vaccinaties/:id", async (c) => {
  const id = c.req.param("id");
  return medplumProxy(c, `/fhir/R4/Immunization/${id}`, {
    method: "DELETE",
  });
});
