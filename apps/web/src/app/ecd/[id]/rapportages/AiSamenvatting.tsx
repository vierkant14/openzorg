"use client";

import { useState } from "react";

import { ecdFetch } from "../../../../lib/api";

interface SamenvattingResponse {
  doel: string;
  model: string;
  samenvatting: string;
  durationMs: number;
  aantalRapportages: number;
}

interface AiSamenvattingProps {
  clientId: string;
  clientNaam: string;
}

/**
 * "Vat samen"-knop met modal die de lokale AI de rapportages laat samenvatten
 * (dagoverdracht / weekoverzicht / MDO-voorbereiding). Stuurt de echte
 * cliëntnaam mee zodat de samenvatting persoonlijk is.
 */
export function AiSamenvatting({ clientId, clientNaam }: AiSamenvattingProps) {
  const [open, setOpen] = useState(false);
  const [doel, setDoel] = useState<"dagoverdracht" | "weekoverzicht" | "mdo-voorbereiding">(
    "dagoverdracht",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SamenvattingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);

    const dagen = doel === "dagoverdracht" ? 1 : doel === "weekoverzicht" ? 7 : 30;
    const sinceIso = new Date(Date.now() - dagen * 24 * 60 * 60 * 1000).toISOString();

    const { data: bundle } = await ecdFetch<{
      entry?: Array<{
        resource: {
          code?: { text?: string };
          effectiveDateTime?: string;
          valueString?: string;
          performer?: Array<{ display?: string }>;
        };
      }>;
    }>(`/api/clients/${clientId}/rapportages?date=ge${sinceIso}&_count=50`);

    const rapportages = (bundle?.entry ?? [])
      .map((e) => ({
        datum: e.resource.effectiveDateTime?.slice(0, 16).replace("T", " ") ?? "",
        soort: e.resource.code?.text ?? "rapportage",
        tekst: e.resource.valueString ?? "",
        medewerker: e.resource.performer?.[0]?.display,
      }))
      .filter((r) => r.tekst);

    if (rapportages.length === 0) {
      setError(`Geen rapportages gevonden in de laatste ${dagen} dag${dagen > 1 ? "en" : ""}.`);
      setLoading(false);
      return;
    }

    const { data, error: err } = await ecdFetch<SamenvattingResponse>(
      "/api/ai/summarize-rapportages",
      {
        method: "POST",
        body: JSON.stringify({ rapportages, doel, clientNaam }),
      },
    );

    if (err) {
      setError(err);
    } else if (data) {
      setResult(data);
    }
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950/20 dark:text-brand-300 btn-press"
        title="Laat de lokale AI de rapportages samenvatten"
      >
        ✨ Vat samen
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-default bg-page shadow-xl"
          >
            <div className="border-b border-default p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-fg">✨ AI samenvatting (lokaal)</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xl leading-none text-fg-muted hover:text-fg"
                  aria-label="Sluiten"
                >
                  ×
                </button>
              </div>
              <p className="mt-1 text-xs text-fg-subtle">
                Draait lokaal op Ollama · data verlaat nooit het netwerk · NEN 7513 audit-logged
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-xs font-medium text-fg-muted">Doel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { v: "dagoverdracht", label: "Dagoverdracht", sub: "laatste 24u" },
                      { v: "weekoverzicht", label: "Weekoverzicht", sub: "laatste 7d" },
                      { v: "mdo-voorbereiding", label: "MDO-voorbereiding", sub: "laatste 30d" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setDoel(opt.v)}
                      className={`rounded-lg border p-3 text-left text-sm btn-press ${
                        doel === opt.v
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-950/20"
                          : "border-default bg-raised hover:border-brand-300"
                      }`}
                    >
                      <div className="font-medium text-fg">{opt.label}</div>
                      <div className="mt-0.5 text-xs text-fg-subtle">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {!result && !loading && (
                <button
                  onClick={generate}
                  className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 btn-press"
                >
                  Genereer samenvatting →
                </button>
              )}

              {loading && (
                <div className="rounded-lg border border-default bg-raised p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-fg-muted">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-brand-700" />
                    <span>De lokale LLM is aan het nadenken… (~10-30s op CPU)</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-coral-200 bg-coral-50 p-3 text-sm text-coral-700 dark:bg-coral-950/20 dark:text-coral-300">
                  {error}
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  <div className="whitespace-pre-wrap rounded-lg border border-default bg-raised p-4 text-sm leading-relaxed text-fg">
                    {result.samenvatting}
                  </div>
                  <div className="flex items-center justify-between text-xs text-fg-subtle">
                    <div>
                      {result.aantalRapportages} rapportages · {result.model} ·{" "}
                      {(result.durationMs / 1000).toFixed(1)}s
                    </div>
                    <button
                      onClick={() => {
                        setResult(null);
                        setError(null);
                      }}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      Opnieuw
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
