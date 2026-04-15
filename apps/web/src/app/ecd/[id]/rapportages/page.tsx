"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ecdFetch } from "../../../../lib/api";

/* -------------------------------------------------------------------------- */
/*  FHIR types                                                                */
/* -------------------------------------------------------------------------- */

interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  code: { text: string };
  valueString?: string;
  effectiveDateTime?: string;
  extension?: Array<{ url: string; valueString: string }>;
}

interface FhirGoal {
  resourceType: "Goal";
  id?: string;
  lifecycleStatus?: string;
  description?: { text?: string };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="my-2 text-sm text-coral-600">{msg}</p>;
}

/* -------------------------------------------------------------------------- */
/*  AI samenvatting (dagoverdracht / week / MDO)                              */
/* -------------------------------------------------------------------------- */

interface SamenvattingResponse {
  doel: string;
  model: string;
  samenvatting: string;
  durationMs: number;
  aantalRapportages: number;
}

function AiSamenvattingButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [doel, setDoel] = useState<"dagoverdracht" | "weekoverzicht" | "mdo-voorbereiding">("dagoverdracht");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SamenvattingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);

    // Fetch rapportages (last 24h for dagoverdracht, 7d for week, 30d for MDO)
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

    const { data, error: err } = await ecdFetch<SamenvattingResponse>("/api/ai/summarize-rapportages", {
      method: "POST",
      body: JSON.stringify({ rapportages, doel, clientNaam: "" }),
    });

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
        className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-950/20 dark:text-brand-300 dark:border-brand-700 btn-press"
        title="Laat de lokale AI de rapportages samenvatten"
      >
        ✨ AI samenvatting
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-default bg-page shadow-xl"
          >
            <div className="border-b border-default p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-fg">✨ AI samenvatting (lokaal)</h2>
                <button onClick={() => setOpen(false)} className="text-fg-muted hover:text-fg text-xl leading-none">×</button>
              </div>
              <p className="mt-1 text-xs text-fg-subtle">
                Draait lokaal op Ollama · data verlaat nooit het netwerk · NEN 7513 audit-logged
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-2">Doel</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "dagoverdracht", label: "Dagoverdracht", sub: "laatste 24u" },
                    { v: "weekoverzicht", label: "Weekoverzicht", sub: "laatste 7d" },
                    { v: "mdo-voorbereiding", label: "MDO-voorbereiding", sub: "laatste 30d" },
                  ] as const).map((opt) => (
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
                      <div className="text-xs text-fg-subtle mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {!result && !loading && (
                <button
                  onClick={generate}
                  className="w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 btn-press"
                >
                  Genereer samenvatting →
                </button>
              )}

              {loading && (
                <div className="rounded-lg border border-default bg-raised p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-fg-muted">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-brand-700" />
                    <span>De lokale LLM is aan het nadenken… (gemma3:4b, ~10-30s op CPU)</span>
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
                  <div className="rounded-lg border border-default bg-raised p-4 whitespace-pre-wrap text-sm text-fg leading-relaxed">
                    {result.samenvatting}
                  </div>
                  <div className="flex items-center justify-between text-xs text-fg-subtle">
                    <div>
                      {result.aantalRapportages} rapportages · {result.model} · {(result.durationMs / 1000).toFixed(1)}s
                    </div>
                    <button
                      onClick={() => {
                        setResult(null);
                        setError(null);
                      }}
                      className="text-brand-600 hover:text-brand-700 font-medium"
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

export default function RapportagesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [allItems, setAllItems] = useState<FhirObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<"alle" | "soep" | "vrij">("alle");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(() => {
    if (!clientId) return;
    setLoading(true);
    ecdFetch<FhirBundle<FhirObservation>>(`/api/clients/${clientId}/rapportages`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else {
          const sorted = (data?.entry?.map((e) => e.resource) ?? [])
            .sort((a, b) => (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""));
          setAllItems(sorted);
        }
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = allItems.filter((obs) => {
    const type = obs.code?.text?.toLowerCase() ?? "vrij";
    const isSoep = type === "soep";
    if (filterType === "soep" && !isSoep) return false;
    if (filterType === "vrij" && isSoep) return false;
    const dt = obs.effectiveDateTime ?? "";
    if (filterDateFrom && dt < filterDateFrom) return false;
    if (filterDateTo && dt > filterDateTo + "T23:59:59") return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const allText = [obs.valueString ?? "", ...(obs.extension?.map((e) => e.valueString ?? "") ?? [])].join(" ").toLowerCase();
      if (!allText.includes(q)) return false;
    }
    return true;
  });

  const filterCls = "rounded-lg border border-default bg-raised px-3 py-1.5 text-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-[border-color,box-shadow] duration-200 ease-out";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-fg">
          Rapportages
          <span className="ml-2 text-sm font-normal text-fg-subtle">({filteredItems.length}{filteredItems.length !== allItems.length ? ` van ${allItems.length}` : ""})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium btn-press ${showFilters || filterType !== "alle" || filterDateFrom || filterDateTo || searchText ? "border-brand-300 bg-brand-50 dark:bg-brand-950/20 text-brand-700" : "border-default text-fg-muted hover:bg-sunken"}`}
          >
            Filteren
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-default px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-sunken btn-press print:hidden"
            title="Rapportages afdrukken"
          >
            Afdrukken
          </button>
          <AiSamenvattingButton clientId={clientId} />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
          >
            {showForm ? "Annuleren" : "Nieuwe rapportage"}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-default bg-sunken p-3 animate-[fade-in_200ms_ease-out]">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as "alle" | "soep" | "vrij")} className={filterCls}>
              <option value="alle">Alle</option>
              <option value="soep">SOEP</option>
              <option value="vrij">Vrij</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Van</label>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className={filterCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Tot</label>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className={filterCls} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-fg-muted mb-1">Zoeken</label>
            <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Zoek in rapportages..." className={`${filterCls} w-full`} />
          </div>
          {(filterType !== "alle" || filterDateFrom || filterDateTo || searchText) && (
            <button onClick={() => { setFilterType("alle"); setFilterDateFrom(""); setFilterDateTo(""); setSearchText(""); }} className="text-xs font-medium text-coral-600 hover:text-coral-800 btn-press pb-1.5">Wissen</button>
          )}
        </div>
      )}

      {showForm && (
        <RapportageForm
          clientId={clientId}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && filteredItems.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">
          {allItems.length === 0 ? "Nog geen rapportages." : "Geen rapportages gevonden met deze filters."}
        </p>
      )}

      <ul className="space-y-3">
        {filteredItems.map((obs, i) => {
          const type = obs.code?.text ?? "vrij";
          const isSoep = type.toLowerCase() === "soep";
          return (
            <li key={obs.id ?? i} className="rounded-lg border border-default bg-raised p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xs font-medium text-fg-subtle">
                  {formatDateTime(obs.effectiveDateTime)}
                </span>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isSoep
                      ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300"
                      : "bg-surface-100 dark:bg-surface-800 text-fg-muted"
                  }`}
                >
                  {isSoep ? "SOEP" : "Vrij"}
                </span>
              </div>
              {isSoep ? (
                <dl className="grid gap-1 text-sm">
                  {(["Subjectief", "Objectief", "Evaluatie", "Plan"] as const).map(
                    (label, idx) => {
                      const val = obs.extension?.[idx]?.valueString;
                      if (!val) return null;
                      return (
                        <div key={label} className="flex gap-2">
                          <dt className="w-20 shrink-0 font-medium text-fg-muted">
                            {label[0]}
                          </dt>
                          <dd className="text-fg">{val}</dd>
                        </div>
                      );
                    },
                  )}
                </dl>
              ) : (
                <p className="text-sm text-fg">{obs.valueString ?? "-"}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RapportageForm({
  clientId,
  onSaved,
}: {
  clientId: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"soep" | "vrij">("soep");
  const [subjectief, setSubjectief] = useState("");
  const [objectief, setObjectief] = useState("");
  const [evaluatie, setEvaluatie] = useState("");
  const [plan, setPlan] = useState("");
  const [tekst, setTekst] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedGoalId, setLinkedGoalId] = useState("");
  const [goals, setGoals] = useState<Array<{ id: string; description: string }>>([]);

  useEffect(() => {
    ecdFetch<FhirBundle<FhirGoal>>(`/api/clients/${clientId}/zorgplan`).then(({ data: cpData }) => {
      const cpId = cpData?.entry?.[0]?.resource?.id;
      if (!cpId) return;
      ecdFetch<FhirBundle<FhirGoal>>(`/api/zorgplan/${cpId}/doelen`).then(({ data }) => {
        setGoals(
          (data?.entry?.map((e) => e.resource) ?? [])
            .filter((g) => g.lifecycleStatus !== "completed" && g.lifecycleStatus !== "cancelled")
            .map((g) => ({ id: g.id ?? "", description: g.description?.text ?? "Doel" })),
        );
      });
    });
  }, [clientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body =
      type === "soep"
        ? { type: "soep", subjectief, objectief, evaluatie, plan, goalId: linkedGoalId || undefined }
        : { type: "vrij", tekst, goalId: linkedGoalId || undefined };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/rapportages`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      onSaved();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-fg-muted">Type rapportage</legend>
          <div className="flex gap-4">
            {(["soep", "vrij"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rapportageType"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="accent-brand-700"
                />
                {t === "soep" ? "SOEP" : "Vrij"}
              </label>
            ))}
          </div>
        </fieldset>
        {goals.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-fg-muted">Koppelen aan doel</label>
            <select
              value={linkedGoalId}
              onChange={(e) => setLinkedGoalId(e.target.value)}
              className="rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Geen doel (optioneel)</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.description}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {type === "soep" ? (
        <div className="grid gap-3">
          {[
            { label: "Subjectief", value: subjectief, set: setSubjectief },
            { label: "Objectief", value: objectief, set: setObjectief },
            { label: "Evaluatie", value: evaluatie, set: setEvaluatie },
            { label: "Plan", value: plan, set: setPlan },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="mb-1 block text-sm font-medium text-fg-muted">{label}</label>
              <textarea
                rows={2}
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ))}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Tekst</label>
          <textarea
            rows={4}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-coral-600">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
        >
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
