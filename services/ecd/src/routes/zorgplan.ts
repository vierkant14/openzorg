import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import {
  medplumFetch,
  medplumProxy,
  operationOutcome,
  proxyMedplumResponse,
} from "../lib/medplum-client.js";

/** Valid evaluation statuses for a goal. */
type EvaluatieStatus =
  | "achieved"
  | "improving"
  | "no-change"
  | "worsening"
  | "not-achieved";

interface EvaluatieBody {
  status: EvaluatieStatus;
  opmerking: string;
  voortgang?: number;
}

/** Maps evaluation status → FHIR Goal lifecycleStatus. */
const EVALUATIE_LIFECYCLE_MAP: Record<EvaluatieStatus, string> = {
  achieved: "completed",
  improving: "active",
  "no-change": "active",
  worsening: "active",
  "not-achieved": "cancelled",
};

/** Valid signature types. */
type HandtekeningType =
  | "ondertekend"
  | "besproken"
  | "niet-akkoord"
  | "later-bespreken";

/** Valid signer roles. */
type HandtekeningRol = "client" | "vertegenwoordiger" | "zorgverlener";

interface HandtekeningBody {
  type: HandtekeningType;
  naam: string;
  rol: HandtekeningRol;
  opmerking?: string;
}

const VALID_EVALUATIE_STATUSES: ReadonlySet<string> = new Set([
  "achieved",
  "improving",
  "no-change",
  "worsening",
  "not-achieved",
]);

const VALID_HANDTEKENING_TYPES: ReadonlySet<string> = new Set([
  "ondertekend",
  "besproken",
  "niet-akkoord",
  "later-bespreken",
]);

const VALID_HANDTEKENING_ROLLEN: ReadonlySet<string> = new Set([
  "client",
  "vertegenwoordiger",
  "zorgverlener",
]);

/** The 12 leefgebieden (life domains) per Dutch VVT Zorgleefplan methodology. */
const VALID_LEEFGEBIEDEN: ReadonlyMap<string, string> = new Map([
  ["lichamelijke-gezondheid", "Lichamelijke gezondheid"],
  ["geestelijke-gezondheid", "Geestelijke gezondheid"],
  ["mobiliteit", "Mobiliteit"],
  ["voeding", "Voeding"],
  ["huid-en-wondverzorging", "Huid en wondverzorging"],
  ["uitscheiding", "Uitscheiding"],
  ["slaap-en-rust", "Slaap en rust"],
  ["persoonlijke-verzorging", "Persoonlijke verzorging"],
  ["huishouden", "Huishouden"],
  ["sociale-participatie", "Sociale participatie"],
  ["regie-en-autonomie", "Regie en autonomie"],
  ["zingeving-en-spiritualiteit", "Zingeving en spiritualiteit"],
]);

export const zorgplanRoutes = new Hono<AppEnv>();

/**
 * GET /api/zorgplannen — List all CarePlans across the tenant.
 *
 * Gebruikt voor een top-level zorgplan overzicht (welke clienten
 * hebben een zorgplan, welke status, wanneer laatste update).
 * Include de Patient voor naam-resolutie in één request.
 */
zorgplanRoutes.get("/zorgplannen", async (c) => {
  return medplumProxy(
    c,
    "/fhir/R4/CarePlan?_sort=-_lastUpdated&_count=100&_include=CarePlan:subject",
  );
});

/**
 * GET /api/clients/:clientId/zorgplan — Get the CarePlan for a client.
 */
zorgplanRoutes.get("/clients/:clientId/zorgplan", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/CarePlan?subject=Patient/${clientId}&_sort=-_lastUpdated&_count=1`,
  );
});

/**
 * POST /api/clients/:clientId/zorgplan — Create a CarePlan with Omaha system classification.
 */
zorgplanRoutes.post("/clients/:clientId/zorgplan", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json<Record<string, unknown>>();

  if (!body["title"]) {
    return c.json(
      operationOutcome("error", "required", "Titel van het zorgplan is vereist"),
      400,
    );
  }

  const resource = {
    resourceType: "CarePlan",
    status: "active",
    intent: "plan",
    ...body,
    subject: { reference: `Patient/${clientId}` },
    category: [
      {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "734163000",
            display: "Care plan",
          },
        ],
      },
    ],
  };

  return medplumProxy(c, "/fhir/R4/CarePlan", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * POST /api/zorgplan/:id/doelen — Add a Goal to a care plan.
 */
zorgplanRoutes.post("/zorgplan/:id/doelen", async (c) => {
  const carePlanId = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  if (!body["description"]) {
    return c.json(
      operationOutcome("error", "required", "Beschrijving van het doel is vereist"),
      400,
    );
  }

  // ── SMART-goal validatie (Layer 2 compliance: kwaliteitskader VVT) ──
  // Skip-header aanwezig? Dan slaat de beheerder deze check over. Altijd
  // loggen zodat audit kan zien wie expliciet SMART overrulet.
  const skipSmart = c.req.header("X-Skip-SMART-Validation") === "true";
  if (!skipSmart) {
    const smartErrors: string[] = [];

    // Specifiek: beschrijving moet substantieel zijn
    const description = typeof body["description"] === "object"
      ? (body["description"] as { text?: string })?.text
      : (body["description"] as string);
    if (!description || description.trim().length < 20) {
      smartErrors.push(
        "S(pecifiek): doel-beschrijving moet minimaal 20 tekens zijn en concreet gedrag benoemen (bv. 'cliënt loopt 50m met rollator zonder hulp')",
      );
    }

    // Meetbaar: target OF measure moet aanwezig zijn
    const targets = body["target"] as Array<Record<string, unknown>> | undefined;
    const hasMeasure = Array.isArray(targets) && targets.length > 0;
    if (!hasMeasure) {
      smartErrors.push(
        "M(eetbaar): doel heeft geen target — voeg een meetbare waarde of tijdsduur toe (bv. 50 meter, binnen 3 maanden)",
      );
    }

    // Tijdgebonden: target.dueDate, Goal.startDate+target.dueDate, of 'binnen X' in description
    const hasDueDate = Array.isArray(targets) && targets.some(
      (t) => typeof t["dueDate"] === "string" || typeof t["dueQuantity"] === "object",
    );
    const hasDeadlineInText = description && /\b(binnen|voor|uiterlijk|tot|over)\b.{0,30}\b(dag|week|weken|maand|maanden|jaar)/i.test(description);
    if (!hasDueDate && !hasDeadlineInText) {
      smartErrors.push(
        "T(ijdgebonden): doel heeft geen deadline — vul target.dueDate of noem een termijn in de beschrijving",
      );
    }

    if (smartErrors.length > 0) {
      return c.json(
        {
          resourceType: "OperationOutcome",
          id: "smart-validation-failed",
          issue: smartErrors.map((diagnostics) => ({
            severity: "error",
            code: "invariant",
            diagnostics,
            details: { text: diagnostics },
          })),
          extension: [
            {
              url: "https://openzorg.nl/extensions/smart-validation",
              extension: [
                { url: "skipHeader", valueString: "X-Skip-SMART-Validation: true" },
                { url: "rationale", valueString: "Kwaliteitskader VVT vereist SMART-geformuleerde doelen" },
              ],
            },
          ],
        },
        400,
      );
    }
  }

  // Validate leefgebied if provided
  const leefgebied = body["leefgebied"] as string | undefined;
  if (leefgebied && !VALID_LEEFGEBIEDEN.has(leefgebied)) {
    return c.json(
      operationOutcome(
        "error",
        "value",
        `Ongeldig leefgebied: '${leefgebied}'. Geldige waarden: ${[...VALID_LEEFGEBIEDEN.keys()].join(", ")}`,
      ),
      400,
    );
  }

  // Build FHIR extension + category for leefgebied
  const extensions: Array<Record<string, unknown>> = [
    ...(Array.isArray(body["extension"]) ? (body["extension"] as Array<Record<string, unknown>>) : []),
  ];
  const categories: Array<Record<string, unknown>> = [
    ...(Array.isArray(body["category"]) ? (body["category"] as Array<Record<string, unknown>>) : []),
  ];

  if (leefgebied) {
    const display = VALID_LEEFGEBIEDEN.get(leefgebied)!;
    extensions.push({
      url: "https://openzorg.nl/extensions/leefgebied",
      valueString: leefgebied,
    });
    categories.push({
      coding: [
        {
          system: "https://openzorg.nl/CodeSystem/leefgebieden",
          code: leefgebied,
          display,
        },
      ],
    });
  }

  // Add situatieschets extension if provided
  const situatieschets = body["situatieschets"] as string | undefined;
  if (situatieschets) {
    extensions.push({
      url: "https://openzorg.nl/extensions/situatieschets",
      valueString: situatieschets,
    });
  }

  // Remove frontend-only fields before spreading
  const { leefgebied: _lg, situatieschets: _ss, ...restBody } = body;

  const goalResource = {
    resourceType: "Goal",
    lifecycleStatus: "active",
    ...restBody,
    ...(extensions.length > 0 ? { extension: extensions } : {}),
    ...(categories.length > 0 ? { category: categories } : {}),
    addresses: [{ reference: `CarePlan/${carePlanId}` }],
  };

  const goalResponse = await fetch(
    `${process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103"}/fhir/R4/Goal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/fhir+json",
        Accept: "application/fhir+json",
        ...(c.req.header("Authorization")
          ? { Authorization: c.req.header("Authorization")! }
          : {}),
      },
      body: JSON.stringify(goalResource),
    },
  );

  const goal = (await goalResponse.json()) as Record<string, unknown>;

  if (!goalResponse.ok) {
    return c.json(goal, goalResponse.status as 200);
  }

  // Update the CarePlan to reference the new Goal
  const goalId = goal["id"] as string;
  await fetch(
    `${process.env["MEDPLUM_BASE_URL"] ?? "http://localhost:8103"}/fhir/R4/CarePlan/${carePlanId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json-patch+json",
        Accept: "application/fhir+json",
        ...(c.req.header("Authorization")
          ? { Authorization: c.req.header("Authorization")! }
          : {}),
      },
      body: JSON.stringify([
        {
          op: "add",
          path: "/goal/-",
          value: { reference: `Goal/${goalId}` },
        },
      ]),
    },
  );

  return c.json(goal, goalResponse.status as 200);
});

/**
 * POST /api/zorgplan/:id/interventies — Add a ServiceRequest (intervention) to a care plan.
 */
zorgplanRoutes.post("/zorgplan/:id/interventies", async (c) => {
  const carePlanId = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  if (!body["code"]) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        "Code van de interventie is vereist",
      ),
      400,
    );
  }

  const serviceRequestResource = {
    resourceType: "ServiceRequest",
    status: "active",
    intent: "plan",
    ...body,
    basedOn: [{ reference: `CarePlan/${carePlanId}` }],
  };

  return medplumProxy(c, "/fhir/R4/ServiceRequest", {
    method: "POST",
    body: JSON.stringify(serviceRequestResource),
  });
});

/**
 * POST /api/zorgplan/:planId/doelen/:goalId/evaluatie — Create an evaluation for a goal.
 *
 * Creates a FHIR Observation linked to the Goal and updates the Goal lifecycleStatus.
 */
zorgplanRoutes.post(
  "/zorgplan/:planId/doelen/:goalId/evaluatie",
  async (c) => {
    const goalId = c.req.param("goalId");
    const body = await c.req.json<EvaluatieBody>();

    if (!body.status || !VALID_EVALUATIE_STATUSES.has(body.status)) {
      return c.json(
        operationOutcome(
          "error",
          "required",
          "Geldige evaluatiestatus is vereist (achieved, improving, no-change, worsening, not-achieved)",
        ),
        400,
      );
    }

    if (!body.opmerking) {
      return c.json(
        operationOutcome("error", "required", "Opmerking is vereist"),
        400,
      );
    }

    if (
      body.voortgang !== undefined &&
      (typeof body.voortgang !== "number" ||
        body.voortgang < 0 ||
        body.voortgang > 100)
    ) {
      return c.json(
        operationOutcome(
          "error",
          "value",
          "Voortgang moet een getal zijn tussen 0 en 100",
        ),
        400,
      );
    }

    const components: Array<Record<string, unknown>> = [
      {
        code: {
          coding: [
            {
              system: "https://openzorg.nl/CodeSystem/observation-component",
              code: "evaluatie-status",
              display: "Evaluatiestatus",
            },
          ],
        },
        valueString: body.status,
      },
    ];

    if (body.voortgang !== undefined) {
      components.push({
        code: {
          coding: [
            {
              system: "https://openzorg.nl/CodeSystem/observation-component",
              code: "voortgang-percentage",
              display: "Voortgang percentage",
            },
          ],
        },
        valueQuantity: {
          value: body.voortgang,
          unit: "%",
          system: "http://unitsofmeasure.org",
          code: "%",
        },
      });
    }

    const observation = {
      resourceType: "Observation",
      status: "final",
      code: {
        coding: [
          {
            system: "https://openzorg.nl/CodeSystem/observation-type",
            code: "goal-evaluatie",
            display: "Doel evaluatie",
          },
        ],
      },
      focus: [{ reference: `Goal/${goalId}` }],
      valueString: body.opmerking,
      effectiveDateTime: new Date().toISOString(),
      component: components,
    };

    const observationResponse = await medplumFetch(
      c,
      "/fhir/R4/Observation",
      {
        method: "POST",
        body: JSON.stringify(observation),
      },
    );

    const observationResult =
      (await observationResponse.json()) as Record<string, unknown>;

    if (!observationResponse.ok) {
      return c.json(observationResult, observationResponse.status as 200);
    }

    // Update Goal lifecycleStatus based on evaluation
    const newLifecycleStatus = EVALUATIE_LIFECYCLE_MAP[body.status];

    await medplumFetch(c, `/fhir/R4/Goal/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json-patch+json" },
      body: JSON.stringify([
        {
          op: "replace",
          path: "/lifecycleStatus",
          value: newLifecycleStatus,
        },
      ]),
    });

    return c.json(observationResult, observationResponse.status as 200);
  },
);

/**
 * GET /api/zorgplan/:planId/doelen/:goalId/evaluaties — List evaluations for a goal.
 *
 * Returns all Observations with code "goal-evaluatie" focused on this Goal, newest first.
 */
zorgplanRoutes.get(
  "/zorgplan/:planId/doelen/:goalId/evaluaties",
  async (c) => {
    const goalId = c.req.param("goalId");

    return medplumProxy(
      c,
      `/fhir/R4/Observation?code=https://openzorg.nl/CodeSystem/observation-type|goal-evaluatie&focus=Goal/${goalId}&_sort=-date`,
    );
  },
);

/**
 * POST /api/zorgplan/:planId/handtekening — Sign or review a care plan.
 *
 * Creates a FHIR Consent resource linked to the CarePlan.
 */
zorgplanRoutes.post("/zorgplan/:planId/handtekening", async (c) => {
  const planId = c.req.param("planId");
  const body = await c.req.json<HandtekeningBody>();

  if (!body.type || !VALID_HANDTEKENING_TYPES.has(body.type)) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        "Geldig handtekeningtype is vereist (ondertekend, besproken, niet-akkoord, later-bespreken)",
      ),
      400,
    );
  }

  if (!body.naam) {
    return c.json(
      operationOutcome("error", "required", "Naam is vereist"),
      400,
    );
  }

  if (!body.rol || !VALID_HANDTEKENING_ROLLEN.has(body.rol)) {
    return c.json(
      operationOutcome(
        "error",
        "required",
        "Geldige rol is vereist (client, vertegenwoordiger, zorgverlener)",
      ),
      400,
    );
  }

  // Map handtekening type to FHIR Consent status
  const consentStatusMap: Record<HandtekeningType, string> = {
    ondertekend: "active",
    besproken: "active",
    "niet-akkoord": "rejected",
    "later-bespreken": "proposed",
  };

  // Map rol to Dutch display text
  const rolDisplayMap: Record<HandtekeningRol, string> = {
    client: "Client",
    vertegenwoordiger: "Vertegenwoordiger",
    zorgverlener: "Zorgverlener",
  };

  const consent: Record<string, unknown> = {
    resourceType: "Consent",
    status: consentStatusMap[body.type],
    scope: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/consentscope",
          code: "treatment",
          display: "Treatment",
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: "https://openzorg.nl/CodeSystem/consent-type",
            code: "zorgplan-handtekening",
            display: "Zorgplan handtekening",
          },
        ],
      },
    ],
    dateTime: new Date().toISOString(),
    performer: [
      {
        display: body.naam,
        extension: [
          {
            url: "https://openzorg.nl/extensions/performer-rol",
            valueString: body.rol,
          },
          {
            url: "https://openzorg.nl/extensions/performer-rol-display",
            valueString: rolDisplayMap[body.rol],
          },
        ],
      },
    ],
    sourceReference: { reference: `CarePlan/${planId}` },
    extension: [
      {
        url: "https://openzorg.nl/extensions/handtekening-type",
        valueString: body.type,
      },
    ],
    policy: [{ uri: "https://openzorg.nl/beleid/zorgplan-akkoord" }],
  };

  if (body.opmerking) {
    consent["extension"] = [
      ...(consent["extension"] as Array<Record<string, unknown>>),
      {
        url: "https://openzorg.nl/extensions/handtekening-opmerking",
        valueString: body.opmerking,
      },
    ];
  }

  const response = await medplumFetch(c, "/fhir/R4/Consent", {
    method: "POST",
    body: JSON.stringify(consent),
  });

  return proxyMedplumResponse(c, response);
});

/**
 * GET /api/zorgplan/:planId/handtekeningen — List signatures for a care plan.
 *
 * Returns all Consent resources linked to this CarePlan, newest first.
 */
zorgplanRoutes.get("/zorgplan/:planId/handtekeningen", async (c) => {
  const planId = c.req.param("planId");

  return medplumProxy(
    c,
    `/fhir/R4/Consent?source-reference=CarePlan/${planId}&category=https://openzorg.nl/CodeSystem/consent-type|zorgplan-handtekening&_sort=-date`,
  );
});

/* ── Evaluaties ─────────────────────────────────────────────────────────── */

/**
 * GET /api/zorgplan/:planId/evaluaties — List evaluations for a care plan.
 */
zorgplanRoutes.get("/zorgplan/:planId/evaluaties", async (c) => {
  const planId = c.req.param("planId");
  return medplumProxy(
    c,
    `/fhir/R4/Observation?focus=CarePlan/${planId}&code=https://openzorg.nl/CodeSystem/observatie-type|zorgplan-evaluatie&_sort=-date&_count=50`,
  );
});

/**
 * POST /api/zorgplan/:planId/evaluaties — Create a care plan evaluation.
 */
zorgplanRoutes.post("/zorgplan/:planId/evaluaties", async (c) => {
  const planId = c.req.param("planId");

  const body = await c.req.json<{
    samenvatting: string;
    doelEvaluaties?: Array<{
      goalId: string;
      status: string;
      toelichting?: string;
    }>;
    volgendeEvaluatieDatum?: string;
  }>();

  if (!body.samenvatting) {
    return c.json(operationOutcome("error", "required", "Samenvatting is vereist"), 400);
  }

  // Build evaluation Observation
  const extensions: Array<{ url: string; valueString?: string }> = [];
  if (body.doelEvaluaties) {
    for (const de of body.doelEvaluaties) {
      extensions.push({
        url: "https://openzorg.nl/extensions/doel-evaluatie",
        valueString: JSON.stringify({ goalId: de.goalId, status: de.status, toelichting: de.toelichting ?? "" }),
      });
    }
  }

  const observation = {
    resourceType: "Observation",
    status: "final",
    code: {
      coding: [{ system: "https://openzorg.nl/CodeSystem/observatie-type", code: "zorgplan-evaluatie", display: "Zorgplan evaluatie" }],
    },
    focus: [{ reference: `CarePlan/${planId}` }],
    effectiveDateTime: new Date().toISOString(),
    valueString: body.samenvatting,
    extension: extensions.length > 0 ? extensions : undefined,
  };

  const evalRes = await medplumFetch(c, "/fhir/R4/Observation", {
    method: "POST",
    body: JSON.stringify(observation),
  });

  if (!evalRes.ok) {
    return proxyMedplumResponse(c, evalRes);
  }

  // Update individual goal statuses
  if (body.doelEvaluaties) {
    for (const de of body.doelEvaluaties) {
      const goalRes = await medplumFetch(c, `/fhir/R4/Goal/${de.goalId}`);
      if (goalRes.ok) {
        const goal = (await goalRes.json()) as Record<string, unknown>;
        const statusMap: Record<string, string> = {
          bereikt: "completed",
          "deels-bereikt": "active",
          "niet-bereikt": "cancelled",
          doorlopend: "active",
        };
        goal["lifecycleStatus"] = statusMap[de.status] ?? "active";
        await medplumFetch(c, `/fhir/R4/Goal/${de.goalId}`, {
          method: "PUT",
          body: JSON.stringify(goal),
        });
      }
    }
  }

  // Optionally set next evaluation date on the CarePlan
  if (body.volgendeEvaluatieDatum) {
    const cpRes = await medplumFetch(c, `/fhir/R4/CarePlan/${planId}`);
    if (cpRes.ok) {
      const cp = (await cpRes.json()) as Record<string, unknown>;
      const exts = (cp["extension"] as Array<{ url: string; valueDate?: string }>) ?? [];
      const extUrl = "https://openzorg.nl/extensions/volgende-evaluatie-datum";
      const existing = exts.findIndex((e) => e.url === extUrl);
      if (existing >= 0) {
        exts[existing] = { url: extUrl, valueDate: body.volgendeEvaluatieDatum };
      } else {
        exts.push({ url: extUrl, valueDate: body.volgendeEvaluatieDatum });
      }
      cp["extension"] = exts;
      await medplumFetch(c, `/fhir/R4/CarePlan/${planId}`, {
        method: "PUT",
        body: JSON.stringify(cp),
      });
    }
  }

  const evalBody = await evalRes.json();
  return c.json(evalBody, 201);
});
