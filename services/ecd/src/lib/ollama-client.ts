/**
 * Thin client voor de Ollama HTTP API.
 *
 * Ollama draait lokaal (in-huis of op dezelfde Docker host als de ECD
 * service). Data verlaat nooit het netwerk: de LLM krijgt prompt + context
 * en stuurt tokens terug, dat is alles.
 *
 * Modellen worden per tenant geconfigureerd in openzorg.tenant_configurations
 * met config_type='ai_model'. Default is 'gemma3:4b' — klein, CPU-haalbaar,
 * redelijk Nederlands.
 */

const OLLAMA_BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://ollama:11434";
const DEFAULT_MODEL = process.env["OLLAMA_DEFAULT_MODEL"] ?? "gemma3:4b";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_k?: number;
    top_p?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: "assistant";
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: OllamaChatRequest["options"];
}

export interface OllamaTagsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
    details?: {
      family?: string;
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

/** Non-streaming chat. Returns the full assistant message. */
export async function ollamaChat(
  messages: OllamaMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<OllamaChatResponse> {
  const body: OllamaChatRequest = {
    model: options.model ?? DEFAULT_MODEL,
    messages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.3,
      num_predict: options.maxTokens ?? 1024,
    },
  };

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama chat faalde (${res.status}): ${text}`);
  }

  return (await res.json()) as OllamaChatResponse;
}

/** Check whether the Ollama server is reachable and which models are loaded. */
export async function ollamaHealth(): Promise<{
  healthy: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { healthy: false, models: [], error: `status ${res.status}` };
    }
    const data = (await res.json()) as OllamaTagsResponse;
    return {
      healthy: true,
      models: data.models.map((m) => m.name),
    };
  } catch (err) {
    return {
      healthy: false,
      models: [],
      error: err instanceof Error ? err.message : "onbekende fout",
    };
  }
}

export { DEFAULT_MODEL, OLLAMA_BASE_URL };
