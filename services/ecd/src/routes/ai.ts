/**
 * AI-assistant endpoints.
 *
 * Dunne laag bovenop Ollama met:
 * - RBAC (via middleware, zie app.ts)
 * - NEN 7513 audit-logging (welke gebruiker, welke prompt, welk model, hoe lang)
 * - Per-tenant model-override via openzorg.tenant_configurations
 *
 * De LLM draait lokaal. Data verlaat nooit het netwerk. Prompts worden
 * naar de audit-log geschreven zodat er altijd een spoor is van wat er
 * aan de AI is gevraagd over welke cliënt.
 */

import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { pool } from "../lib/db.js";
import {
  DEFAULT_MODEL,
  OLLAMA_BASE_URL,
  ollamaChat,
  ollamaHealth,
  type OllamaMessage,
} from "../lib/ollama-client.js";

export const aiRoutes = new Hono<AppEnv>();

async function resolveTenantUuid(tenantIdOrProjectId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM openzorg.tenants WHERE id::text = $1 OR medplum_project_id = $1 LIMIT 1",
    [tenantIdOrProjectId],
  );
  return result.rows[0]?.id ?? null;
}

async function getTenantModel(tenantUuid: string): Promise<string> {
  const result = await pool.query<{ config_data: { model?: string } }>(
    `SELECT config_data FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'ai_model' LIMIT 1`,
    [tenantUuid],
  );
  return result.rows[0]?.config_data?.model ?? DEFAULT_MODEL;
}

async function logAiCall(
  tenantUuid: string,
  userId: string,
  action: string,
  model: string,
  durationMs: number,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO openzorg.audit_log
         (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantUuid,
        userId,
        action,
        "AI",
        model,
        JSON.stringify({ durationMs, model, ...details }),
      ],
    );
  } catch (err) {
    console.error("[AI] audit failed:", err);
  }
}

/**
 * GET /health — Ollama server status + beschikbare modellen
 */
aiRoutes.get("/health", async (c) => {
  const status = await ollamaHealth();
  return c.json({
    ...status,
    baseUrl: OLLAMA_BASE_URL,
    defaultModel: DEFAULT_MODEL,
  });
});

/**
 * GET /models — lijst van Ollama-modellen die op de server geladen zijn
 */
aiRoutes.get("/models", async (c) => {
  const status = await ollamaHealth();
  if (!status.healthy) {
    return c.json({ models: [], error: status.error }, 503);
  }
  return c.json({ models: status.models, default: DEFAULT_MODEL });
});

/**
 * GET /config — de geconfigureerde model-voorkeur van de huidige tenant
 */
aiRoutes.get("/config", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) {
    return c.json({ model: DEFAULT_MODEL, source: "default" });
  }
  const model = await getTenantModel(tenantUuid);
  return c.json({
    model,
    source: model === DEFAULT_MODEL ? "default" : "tenant-override",
  });
});

/**
 * PUT /config — zet de model-voorkeur voor deze tenant
 * Body: { model: string }
 */
aiRoutes.put("/config", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const body = await c.req.json<{ model?: string }>().catch(() => null);
  if (!body?.model) return c.json({ error: "model is vereist" }, 400);

  const existing = await pool.query(
    `SELECT id FROM openzorg.tenant_configurations
      WHERE tenant_id = $1 AND config_type = 'ai_model' LIMIT 1`,
    [tenantUuid],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE openzorg.tenant_configurations
          SET config_data = $1, version = version + 1, updated_at = now()
        WHERE id = $2`,
      [JSON.stringify({ model: body.model }), existing.rows[0]!.id],
    );
  } else {
    await pool.query(
      `INSERT INTO openzorg.tenant_configurations
         (tenant_id, config_type, config_data, version)
       VALUES ($1, 'ai_model', $2, 1)`,
      [tenantUuid, JSON.stringify({ model: body.model })],
    );
  }

  return c.json({ success: true, model: body.model });
});

/**
 * POST /ask — algemene prompt → antwoord endpoint
 * Body: {
 *   prompt: string,         // de vraag van de gebruiker
 *   system?: string,        // optioneel system prompt
 *   context?: string,       // optionele context (bv. cliëntrapportages)
 *   temperature?: number,
 *   maxTokens?: number
 * }
 *
 * LET OP: dit endpoint is bedoeld voor beheerders om de LLM te testen.
 * Voor productie-use cases (samenvatting, codering, signaal-detectie)
 * komen dedicated endpoints met vaste system prompts.
 */
aiRoutes.post("/ask", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);

  const body = await c.req.json<{
    prompt?: string;
    system?: string;
    context?: string;
    temperature?: number;
    maxTokens?: number;
  }>().catch(() => null);

  if (!body?.prompt) {
    return c.json({ error: "prompt is vereist" }, 400);
  }

  const model = tenantUuid ? await getTenantModel(tenantUuid) : DEFAULT_MODEL;

  const messages: OllamaMessage[] = [];
  if (body.system) {
    messages.push({ role: "system", content: body.system });
  }
  const userContent = body.context
    ? `Context:\n${body.context}\n\nVraag: ${body.prompt}`
    : body.prompt;
  messages.push({ role: "user", content: userContent });

  const start = Date.now();
  try {
    const response = await ollamaChat(messages, {
      model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });
    const durationMs = Date.now() - start;

    if (tenantUuid) {
      await logAiCall(
        tenantUuid,
        c.req.header("X-User-Id") ?? "system",
        "ai.ask",
        model,
        durationMs,
        {
          promptLength: body.prompt.length,
          contextLength: body.context?.length ?? 0,
          responseLength: response.message.content.length,
          evalCount: response.eval_count,
        },
      );
    }

    return c.json({
      model,
      response: response.message.content,
      durationMs,
      tokens: {
        prompt: response.prompt_eval_count,
        completion: response.eval_count,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "onbekende fout";
    console.error("[AI] ask failed:", msg);
    return c.json(
      {
        error: "AI-aanroep mislukt",
        details: msg,
        hint: "Controleer of Ollama draait op " + OLLAMA_BASE_URL,
      },
      503,
    );
  }
});

/**
 * POST /summarize-rapportages — Samenvat een reeks rapportages voor één cliënt.
 *
 * Skeleton endpoint: ontvangt een array van rapportage-teksten en geeft
 * een gestructureerde samenvatting terug. De feitelijke FHIR-fetch (op
 * basis van clientId + periode) bouwen we later als de backend in productie
 * draait met een echt model.
 *
 * Body: {
 *   rapportages: Array<{ datum: string; soort: string; tekst: string; medewerker?: string }>,
 *   clientNaam?: string,
 *   doel?: "dagoverdracht" | "weekoverzicht" | "mdo-voorbereiding"
 * }
 */
aiRoutes.post("/summarize-rapportages", async (c) => {
  const tenantHeader = c.get("tenantId");
  const tenantUuid = await resolveTenantUuid(tenantHeader);

  const body = await c.req.json<{
    rapportages?: Array<{ datum: string; soort: string; tekst: string; medewerker?: string }>;
    clientNaam?: string;
    doel?: "dagoverdracht" | "weekoverzicht" | "mdo-voorbereiding";
  }>().catch(() => null);

  if (!body?.rapportages || !Array.isArray(body.rapportages) || body.rapportages.length === 0) {
    return c.json({ error: "rapportages (array) is vereist" }, 400);
  }

  const doel = body.doel ?? "dagoverdracht";
  const model = tenantUuid ? await getTenantModel(tenantUuid) : DEFAULT_MODEL;

  const systemPrompts: Record<string, string> = {
    dagoverdracht: `Je bent een zorgassistent die verpleegkundigen helpt bij de dagoverdracht. Vat de rapportages van de afgelopen 24 uur bondig samen in TWEE korte alinea's:

1. Algemene status & medicatie (max 3 zinnen)
2. Aandachtspunten & signaleringen voor de volgende dienst (max 3 zinnen)

Schrijf in het Nederlands, feitelijk, zonder jargon. Noem nooit iets dat niet letterlijk in de rapportages staat. Als iets onduidelijk is, schrijf dat op.`,
    weekoverzicht: `Je bent een zorgassistent. Maak een weekoverzicht voor een cliënt op basis van de rapportages. Drie alinea's: (1) trend/verandering ten opzichte van vorige week, (2) belangrijkste gebeurtenissen, (3) aandachtspunten voor komende week. Feitelijk, Nederlands, geen speculatie.`,
    "mdo-voorbereiding": `Je bereidt een multidisciplinair overleg voor. Vat de rapportages samen in vier secties: somatisch, psychisch, functioneel, sociaal. Noem per sectie max 3 punten. Eindigen met één alinea "Open vragen voor het MDO". Nederlands, feitelijk.`,
  };

  const systemPrompt = systemPrompts[doel];
  const context = body.rapportages
    .map((r) => `[${r.datum} · ${r.soort}${r.medewerker ? ` · ${r.medewerker}` : ""}]\n${r.tekst}`)
    .join("\n\n---\n\n");

  const start = Date.now();
  try {
    const response = await ollamaChat(
      [
        { role: "system", content: systemPrompt ?? systemPrompts.dagoverdracht! },
        { role: "user", content: `Cliënt: ${body.clientNaam ?? "onbekend"}\n\nRapportages:\n${context}` },
      ],
      { model, temperature: 0.2, maxTokens: 800 },
    );
    const durationMs = Date.now() - start;

    if (tenantUuid) {
      await logAiCall(
        tenantUuid,
        c.req.header("X-User-Id") ?? "system",
        `ai.summarize.${doel}`,
        model,
        durationMs,
        {
          clientNaam: body.clientNaam,
          rapportageCount: body.rapportages.length,
          responseLength: response.message.content.length,
        },
      );
    }

    return c.json({
      doel,
      model,
      samenvatting: response.message.content,
      durationMs,
      aantalRapportages: body.rapportages.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "onbekende fout";
    console.error("[AI] summarize failed:", msg);
    return c.json(
      {
        error: "Samenvatting mislukt",
        details: msg,
        hint: "Ollama bereikbaar? Model geladen? Zie GET /api/ai/health",
      },
      503,
    );
  }
});
