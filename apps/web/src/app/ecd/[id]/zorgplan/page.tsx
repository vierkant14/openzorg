"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PractitionerPicker } from "../../../../components/PractitionerPicker";
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

interface FhirCarePlan {
  resourceType: "CarePlan";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: { start?: string; end?: string };
}

interface FhirGoal {
  resourceType: "Goal";
  id?: string;
  lifecycleStatus?: string;
  description?: { text?: string };
  target?: Array<{ dueDate?: string }>;
  addresses?: Array<{ reference?: string }>;
  category?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string }> }>;
  extension?: Array<{ url?: string; valueString?: string }>;
}

interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
  intent?: string;
  code?: { text?: string; coding?: Array<{ display?: string }> };
  basedOn?: Array<{ reference?: string }>;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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

/** The 12 leefgebieden (life domains) conform Dutch VVT Zorgleefplan/Omaha methodology. */
const LEEFGEBIEDEN: ReadonlyArray<{ key: string; label: string; emoji: string; description: string }> = [
  { key: "lichamelijke-gezondheid", label: "Lichamelijke gezondheid", emoji: "\u2764\uFE0F", description: "Diagnoses, chronische aandoeningen, pijn" },
  { key: "geestelijke-gezondheid", label: "Geestelijke gezondheid", emoji: "\uD83E\uDDE0", description: "Stemming, cognitie, dementie, angst" },
  { key: "mobiliteit", label: "Mobiliteit", emoji: "\uD83D\uDEB6", description: "Transfers, lopen, balans, valrisico" },
  { key: "voeding", label: "Voeding", emoji: "\uD83C\uDF7D\uFE0F", description: "Eetpatroon, gewicht, dieet, slikproblemen" },
  { key: "huid-en-wondverzorging", label: "Huid en wondverzorging", emoji: "\uD83E\uDE79", description: "Decubitus, wonden, huidverzorging" },
  { key: "uitscheiding", label: "Uitscheiding", emoji: "\uD83D\uDCA7", description: "Incontinentie, obstipatie, katheter" },
  { key: "slaap-en-rust", label: "Slaap en rust", emoji: "\uD83D\uDE34", description: "Slaappatroon, onrust, nachtrust" },
  { key: "persoonlijke-verzorging", label: "Persoonlijke verzorging", emoji: "\uD83D\uDEC1", description: "Wassen, aankleden, eten (ADL)" },
  { key: "huishouden", label: "Huishouden", emoji: "\uD83C\uDFE0", description: "Huishoudelijke taken, woonomgeving" },
  { key: "sociale-participatie", label: "Sociale participatie", emoji: "\uD83E\uDDD1\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1", description: "Sociaal netwerk, activiteiten, eenzaamheid" },
  { key: "regie-en-autonomie", label: "Regie en autonomie", emoji: "\uD83C\uDFAF", description: "Eigen regie, competentie, wensen" },
  { key: "zingeving-en-spiritualiteit", label: "Zingeving en spiritualiteit", emoji: "\u2728", description: "Levensbeschouwing, rituelen, zingeving" },
];

export default function ZorgplanPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirCarePlan[]>([]);
  const [goals, setGoals] = useState<FhirGoal[]>([]);
  const [interventies, setInterventies] = useState<FhirServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  // New zorgplan form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState("");
  const [verantwoordelijke, setVerantwoordelijke] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState<string | null>(null);
  const [goalLeefgebied, setGoalLeefgebied] = useState(LEEFGEBIEDEN[0]!.key);
  const [goalDescription, setGoalDescription] = useState("");
  const [goalSituatieschets, setGoalSituatieschets] = useState("");
  const [goalDueDate, setGoalDueDate] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  // Leefgebied sections collapse state (track which are expanded)
  const [expandedLeefgebieden, setExpandedLeefgebieden] = useState<Set<string>>(new Set());

  // Interventie form
  const [showInterventieForm, setShowInterventieForm] = useState<string | null>(null);
  const [interventieCode, setInterventieCode] = useState("");
  const [interventieFrequentie, setInterventieFrequentie] = useState("");
  const [interventieSaving, setInterventieSaving] = useState(false);

  // Evaluatie form
  const [showEvalForm, setShowEvalForm] = useState<string | null>(null);
  const [evalStatus, setEvalStatus] = useState("Geen verandering");
  const [evalOpmerking, setEvalOpmerking] = useState("");
  const [evalVoortgang, setEvalVoortgang] = useState(50);
  const [evalSaving, setEvalSaving] = useState(false);
  const [evaluaties, setEvaluaties] = useState<Record<string, Array<{ status?: string; opmerking?: string; voortgang?: number; datum?: string }>>>({});

  // Handtekening form
  const [showHandtekeningForm, setShowHandtekeningForm] = useState<string | null>(null);
  const [handtekeningType, setHandtekeningType] = useState("Ondertekend");
  const [handtekeningNaam, setHandtekeningNaam] = useState("");
  const [handtekeningRol, setHandtekeningRol] = useState("Client");
  const [handtekeningOpmerking, setHandtekeningOpmerking] = useState("");
  const [handtekeningSaving, setHandtekeningSaving] = useState(false);
  const [handtekeningen, setHandtekeningen] = useState<Record<string, Array<{ type?: string; naam?: string; rol?: string; opmerking?: string; datum?: string }>>>({});

  const load = useCallback(() => {
    if (!clientId) return;
    setLoading(true);
    ecdFetch<FhirBundle<FhirCarePlan>>(`/api/clients/${clientId}/zorgplan`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setItems(data?.entry?.map((e) => e.resource) ?? []);
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  function loadPlanDetails(planId: string) {
    setExpandedPlan(expandedPlan === planId ? null : planId);
    if (expandedPlan === planId) return;

    ecdFetch<FhirBundle<FhirGoal>>(`/api/clients/${clientId}/zorgplan`)
      .then(({ data }) => {
        setGoals(data?.entry?.map((e) => e.resource).filter((r): r is FhirGoal => r.resourceType === "Goal") ?? []);
      });
    ecdFetch<FhirBundle<FhirServiceRequest>>(`/api/clients/${clientId}/zorgplan`)
      .then(({ data }) => {
        setInterventies(data?.entry?.map((e) => e.resource).filter((r): r is FhirServiceRequest => r.resourceType === "ServiceRequest") ?? []);
      });
    loadHandtekeningen(planId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const body = {
      title,
      description,
      period: {
        start: periodStart,
        ...(periodEnd ? { end: periodEnd } : {}),
      },
      ...(verantwoordelijke ? { author: [{ display: verantwoordelijke }] } : {}),
    };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/zorgplan`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setFormError(err);
    } else {
      setShowForm(false);
      setTitle("");
      setDescription("");
      setVerantwoordelijke("");
      load();
    }
  }

  function toggleLeefgebied(key: string) {
    setExpandedLeefgebieden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function getGoalLeefgebied(goal: FhirGoal): string {
    const ext = goal.extension?.find((e) => e.url === "https://openzorg.nl/extensions/leefgebied");
    if (ext?.valueString) return ext.valueString;
    const cat = goal.category?.find((c) =>
      c.coding?.some((cd) => cd.system === "https://openzorg.nl/CodeSystem/leefgebieden"),
    );
    const coding = cat?.coding?.find((cd) => cd.system === "https://openzorg.nl/CodeSystem/leefgebieden");
    return coding?.code ?? "";
  }

  function getGoalSituatieschets(goal: FhirGoal): string | undefined {
    return goal.extension?.find((e) => e.url === "https://openzorg.nl/extensions/situatieschets")?.valueString;
  }

  async function handleAddGoal(planId: string) {
    setGoalSaving(true);
    const body: Record<string, unknown> = {
      description: { text: goalDescription },
      leefgebied: goalLeefgebied,
      ...(goalSituatieschets ? { situatieschets: goalSituatieschets } : {}),
      ...(goalDueDate ? { target: [{ dueDate: goalDueDate }] } : {}),
    };

    const { error: err } = await ecdFetch(`/api/zorgplan/${planId}/doelen`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setGoalSaving(false);
    if (!err) {
      setShowGoalForm(null);
      setGoalDescription("");
      setGoalSituatieschets("");
      setGoalDueDate("");
      setGoalLeefgebied(LEEFGEBIEDEN[0]!.key);
      loadPlanDetails(planId);
    }
  }

  async function handleAddInterventie(planId: string) {
    setInterventieSaving(true);
    const codeText = interventieFrequentie
      ? `${interventieCode} (${interventieFrequentie})`
      : interventieCode;

    const { error: err } = await ecdFetch(`/api/zorgplan/${planId}/interventies`, {
      method: "POST",
      body: JSON.stringify({ code: { text: codeText } }),
    });

    setInterventieSaving(false);
    if (!err) {
      setShowInterventieForm(null);
      setInterventieCode("");
      setInterventieFrequentie("");
      loadPlanDetails(planId);
    }
  }

  async function handleAddEvaluatie(planId: string, goalId: string) {
    setEvalSaving(true);
    const { error: err } = await ecdFetch(`/api/zorgplan/${planId}/doelen/${goalId}/evaluatie`, {
      method: "POST",
      body: JSON.stringify({ status: evalStatus, opmerking: evalOpmerking, voortgang: evalVoortgang }),
    });
    setEvalSaving(false);
    if (!err) {
      setShowEvalForm(null);
      setEvalStatus("Geen verandering");
      setEvalOpmerking("");
      setEvalVoortgang(50);
      loadEvaluaties(planId, goalId);
    }
  }

  function loadEvaluaties(planId: string, goalId: string) {
    ecdFetch<{ items?: Array<{ status?: string; opmerking?: string; voortgang?: number; datum?: string }> }>(
      `/api/zorgplan/${planId}/doelen/${goalId}/evaluaties`,
    ).then(({ data }) => {
      setEvaluaties((prev) => ({ ...prev, [goalId]: data?.items ?? [] }));
    });
  }

  async function handleAddHandtekening(planId: string) {
    setHandtekeningSaving(true);
    const { error: err } = await ecdFetch(`/api/zorgplan/${planId}/handtekening`, {
      method: "POST",
      body: JSON.stringify({
        type: handtekeningType,
        naam: handtekeningNaam,
        rol: handtekeningRol,
        opmerking: handtekeningOpmerking,
      }),
    });
    setHandtekeningSaving(false);
    if (!err) {
      setShowHandtekeningForm(null);
      setHandtekeningNaam("");
      setHandtekeningOpmerking("");
      loadHandtekeningen(planId);
    }
  }

  function loadHandtekeningen(planId: string) {
    ecdFetch<{ items?: Array<{ type?: string; naam?: string; rol?: string; opmerking?: string; datum?: string }> }>(
      `/api/zorgplan/${planId}/handtekeningen`,
    ).then(({ data }) => {
      setHandtekeningen((prev) => ({ ...prev, [planId]: data?.items ?? [] }));
    });
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Zorgplan</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Nieuw zorgplan"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
        >
          <h3 className="mb-3 text-sm font-semibold text-fg">Nieuw zorgplan</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Titel</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="bijv. Individueel zorgplan 2026" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Beschrijving / Samenvatting</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Korte samenvatting van de zorgvraag en aandachtspunten" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Startdatum</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Einddatum (optioneel)</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Verantwoordelijk behandelaar</label>
              <PractitionerPicker
                value={verantwoordelijke}
                onChange={(_id, displayName) => setVerantwoordelijke(displayName)}
                placeholder="Zoek een medewerker..."
              />
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10 px-3 py-2">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Kwaliteitskader:</strong> Een voorlopig zorgplan moet binnen 48 uur na opname worden opgesteld. Het definitieve zorgplan binnen 6 weken.
            </p>
          </div>
          {formError && <p className="mt-2 text-sm text-coral-600">{formError}</p>}
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input type="checkbox" className="accent-brand-700" id="concept-toggle" />
              Opslaan als voorlopig zorgplan (concept)
            </label>
            <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press">
              {saving ? "Opslaan..." : "Zorgplan aanmaken"}
            </button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Geen zorgplannen gevonden.</p>
      )}

      <ul className="space-y-4">
        {items.map((cp, i) => {
          const isActive = cp.status === "active";
          const isExpanded = expandedPlan === cp.id;
          return (
            <li key={cp.id ?? i} className="rounded-lg border border-default bg-raised shadow-sm">
              <div
                className="flex cursor-pointer items-center justify-between p-4"
                onClick={() => cp.id && loadPlanDetails(cp.id)}
              >
                <div>
                  <div className="mb-1 flex items-center gap-3">
                    <h3 className="font-semibold text-fg">{cp.title ?? "Zorgplan"}</h3>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? "bg-green-100 text-green-800" : "bg-surface-100 dark:bg-surface-800 text-fg-muted"}`}>
                      {isActive ? "Actief" : cp.status ?? "-"}
                    </span>
                  </div>
                  {cp.description && <p className="text-sm text-fg-muted">{cp.description}</p>}
                  <p className="text-xs text-fg-subtle">
                    Periode: {formatDate(cp.period?.start)} &ndash; {formatDate(cp.period?.end)}
                  </p>
                </div>
                <svg className={`h-5 w-5 text-fg-subtle transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isExpanded && cp.id && (() => {
                const goalsByLg = new Map<string, FhirGoal[]>();
                for (const g of goals) {
                  const lgKey = getGoalLeefgebied(g);
                  const arr = goalsByLg.get(lgKey) ?? [];
                  arr.push(g);
                  goalsByLg.set(lgKey, arr);
                }
                const domainsWithGoals = LEEFGEBIEDEN.filter((lg) => (goalsByLg.get(lg.key) ?? []).length > 0);
                const domainsWithoutGoals = LEEFGEBIEDEN.filter((lg) => (goalsByLg.get(lg.key) ?? []).length === 0);

                return (
                <div className="border-t px-4 py-4 space-y-4">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-fg">
                        Doelen per leefgebied
                        <span className="ml-2 text-xs font-normal text-fg-subtle">
                          ({goals.length} {goals.length === 1 ? "doel" : "doelen"} in {domainsWithGoals.length} {domainsWithGoals.length === 1 ? "leefgebied" : "leefgebieden"})
                        </span>
                      </h4>
                      <button
                        onClick={() => setShowGoalForm(showGoalForm === cp.id ? null : cp.id!)}
                        className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
                      >
                        {showGoalForm === cp.id ? "Annuleren" : "+ Doel toevoegen"}
                      </button>
                    </div>

                    {showGoalForm === cp.id && (
                      <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4 space-y-3">
                        <h5 className="text-sm font-semibold text-fg">Nieuw doel toevoegen</h5>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Leefgebied *</label>
                            <select value={goalLeefgebied} onChange={(e) => setGoalLeefgebied(e.target.value)} className={inputCls}>
                              {LEEFGEBIEDEN.map((lg) => (
                                <option key={lg.key} value={lg.key}>{lg.emoji} {lg.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Streefdatum</label>
                            <input type="date" value={goalDueDate} onChange={(e) => setGoalDueDate(e.target.value)} className={inputCls} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-fg-muted mb-1">Doelomschrijving *</label>
                          <textarea rows={2} value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} placeholder="Wat wil de client bereiken?" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-fg-muted mb-1">Situatieschets (huidige situatie)</label>
                          <textarea rows={2} value={goalSituatieschets} onChange={(e) => setGoalSituatieschets(e.target.value)} placeholder="Beschrijf de huidige situatie van de client bij dit leefgebied" className={inputCls} />
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => handleAddGoal(cp.id!)} disabled={goalSaving || !goalDescription || !goalLeefgebied} className="rounded-md bg-brand-700 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press">
                            {goalSaving ? "Opslaan..." : "Doel opslaan"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {domainsWithGoals.map((lg) => {
                        const lgGoals = goalsByLg.get(lg.key) ?? [];
                        const isLgExpanded = expandedLeefgebieden.has(lg.key);
                        return (
                          <div key={lg.key} className="rounded-lg border border-default bg-raised overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleLeefgebied(lg.key)}
                              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-page transition-[border-color,background-color] duration-200 ease-out btn-press"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg" role="img" aria-label={lg.label}>{lg.emoji}</span>
                                <div>
                                  <span className="text-sm font-semibold text-fg">{lg.label}</span>
                                  <span className="ml-2 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                                    {lgGoals.length} {lgGoals.length === 1 ? "doel" : "doelen"}
                                  </span>
                                </div>
                              </div>
                              <svg className={`h-4 w-4 text-fg-subtle transition-transform duration-200 ${isLgExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {isLgExpanded && (
                              <div className="border-t border-default px-4 py-3 space-y-3">
                                {lgGoals.map((g, gi) => {
                                  const goalId = g.id ?? `goal-${gi}`;
                                  const goalEvals = evaluaties[goalId] ?? [];
                                  const situatieschets = getGoalSituatieschets(g);
                                  return (
                                    <div key={goalId} className="rounded-md border border-default bg-page p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <div className="flex items-start gap-2">
                                            <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                                              g.lifecycleStatus === "completed" ? "bg-green-500" :
                                              g.lifecycleStatus === "cancelled" ? "bg-coral-500" :
                                              "bg-brand-500"
                                            }`} />
                                            <div className="flex-1">
                                              <p className="text-sm font-medium text-fg">{g.description?.text ?? "-"}</p>
                                              {situatieschets && (
                                                <p className="mt-1 text-xs text-fg-muted italic">Situatie: {situatieschets}</p>
                                              )}
                                              {g.target?.[0]?.dueDate && (
                                                <p className="mt-0.5 text-xs text-fg-subtle">Streefdatum: {formatDate(g.target[0].dueDate)}</p>
                                              )}
                                              {g.lifecycleStatus && g.lifecycleStatus !== "active" && (
                                                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                  g.lifecycleStatus === "completed" ? "bg-green-100 text-green-800" :
                                                  g.lifecycleStatus === "cancelled" ? "bg-coral-50 text-coral-700" :
                                                  "bg-surface-100 dark:bg-surface-800 text-fg-muted"
                                                }`}>{g.lifecycleStatus}</span>
                                              )}
                                            </div>
                                          </div>

                                          {interventies.filter((sr) => sr.basedOn?.some((ref) => ref.reference === `CarePlan/${cp.id}`)).length > 0 && (
                                            <div className="mt-2 ml-5">
                                              <p className="text-xs font-medium text-fg-subtle mb-1">Interventies:</p>
                                              <ul className="space-y-1">
                                                {interventies.filter((sr) => sr.basedOn?.some((ref) => ref.reference === `CarePlan/${cp.id}`)).map((sr, si) => (
                                                  <li key={sr.id ?? si} className="flex items-center gap-1.5 text-xs text-fg-muted">
                                                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                                                    {sr.code?.text ?? sr.code?.coding?.[0]?.display ?? "-"}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>

                                        <button
                                          onClick={() => {
                                            setShowEvalForm(showEvalForm === goalId ? null : goalId);
                                            if (showEvalForm !== goalId && g.id && cp.id) loadEvaluaties(cp.id, g.id);
                                          }}
                                          className="shrink-0 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 btn-press"
                                        >
                                          Evalueren
                                        </button>
                                      </div>

                                      {showEvalForm === goalId && (
                                        <div className="mt-3 rounded-md border border-brand-100 bg-brand-50 p-3 space-y-2">
                                          <div className="grid gap-2 sm:grid-cols-3">
                                            <div>
                                              <label className="block text-xs font-medium text-fg-muted mb-1">Status</label>
                                              <select value={evalStatus} onChange={(e) => setEvalStatus(e.target.value)} className={inputCls}>
                                                <option value="Bereikt">Bereikt</option>
                                                <option value="Verbeterd">Verbeterd</option>
                                                <option value="Geen verandering">Geen verandering</option>
                                                <option value="Verslechterd">Verslechterd</option>
                                                <option value="Niet bereikt">Niet bereikt</option>
                                              </select>
                                            </div>
                                            <div className="sm:col-span-2">
                                              <label className="block text-xs font-medium text-fg-muted mb-1">Voortgang: {evalVoortgang}%</label>
                                              <input type="range" min={0} max={100} value={evalVoortgang} onChange={(e) => setEvalVoortgang(Number(e.target.value))} className="w-full accent-brand-700" />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-fg-muted mb-1">Opmerking</label>
                                            <textarea rows={2} value={evalOpmerking} onChange={(e) => setEvalOpmerking(e.target.value)} placeholder="Toelichting bij de evaluatie" className={inputCls} />
                                          </div>
                                          <button
                                            onClick={() => g.id && cp.id && handleAddEvaluatie(cp.id, g.id)}
                                            disabled={evalSaving}
                                            className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50 btn-press"
                                          >
                                            {evalSaving ? "Opslaan..." : "Evaluatie opslaan"}
                                          </button>
                                        </div>
                                      )}

                                      {goalEvals.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <p className="text-xs font-medium text-fg-subtle">Evaluatiehistorie:</p>
                                          {goalEvals.map((ev, evi) => (
                                            <div key={evi} className="flex items-center gap-2 rounded bg-raised px-2 py-1 text-xs">
                                              <span className={`inline-block rounded-full px-1.5 py-0.5 font-semibold ${
                                                ev.status === "Bereikt" ? "bg-green-100 text-green-800" :
                                                ev.status === "Verbeterd" ? "bg-blue-100 text-blue-800" :
                                                ev.status === "Verslechterd" ? "bg-coral-50 text-coral-700" :
                                                ev.status === "Niet bereikt" ? "bg-coral-50 text-coral-700" :
                                                "bg-surface-100 dark:bg-surface-800 text-fg-muted"
                                              }`}>{ev.status}</span>
                                              {ev.voortgang !== undefined && <span className="text-fg-muted">{ev.voortgang}%</span>}
                                              {ev.opmerking && <span className="text-fg-muted truncate">{ev.opmerking}</span>}
                                              <span className="ml-auto text-fg-subtle">{formatDate(ev.datum)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {domainsWithoutGoals.length > 0 && (
                        <div className="rounded-lg border border-default bg-raised overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleLeefgebied("__empty__")}
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-page transition-[border-color,background-color] duration-200 ease-out btn-press"
                          >
                            <span className="text-sm text-fg-muted">
                              Overige leefgebieden zonder doelen ({domainsWithoutGoals.length})
                            </span>
                            <svg className={`h-4 w-4 text-fg-subtle transition-transform duration-200 ${expandedLeefgebieden.has("__empty__") ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {expandedLeefgebieden.has("__empty__") && (
                            <div className="border-t border-default px-4 py-3">
                              <ul className="grid gap-1 sm:grid-cols-2">
                                {domainsWithoutGoals.map((lg) => (
                                  <li key={lg.key} className="flex items-center gap-2 text-xs text-fg-subtle py-1">
                                    <span role="img" aria-label={lg.label}>{lg.emoji}</span>
                                    <span>{lg.label}</span>
                                    <span className="text-fg-subtle">&mdash; Geen doelen</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-fg">Interventies</h4>
                      <button
                        onClick={() => setShowInterventieForm(showInterventieForm === cp.id ? null : cp.id!)}
                        className="text-xs font-medium text-brand-700 hover:text-brand-900"
                      >
                        {showInterventieForm === cp.id ? "Annuleren" : "+ Interventie toevoegen"}
                      </button>
                    </div>

                    {showInterventieForm === cp.id && (
                      <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50 p-4 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Interventie / handeling</label>
                            <input type="text" value={interventieCode} onChange={(e) => setInterventieCode(e.target.value)} placeholder="bijv. Hulp bij wassen en aankleden" className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Frequentie</label>
                            <input type="text" value={interventieFrequentie} onChange={(e) => setInterventieFrequentie(e.target.value)} placeholder="bijv. 2x per dag, 3x per week" className={inputCls} />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => handleAddInterventie(cp.id!)} disabled={interventieSaving || !interventieCode} className="rounded-md bg-brand-700 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press">
                            {interventieSaving ? "Opslaan..." : "Interventie opslaan"}
                          </button>
                        </div>
                      </div>
                    )}

                    {interventies.length === 0 ? (
                      <p className="text-xs text-fg-subtle">Nog geen interventies toegevoegd.</p>
                    ) : (
                      <ul className="space-y-2">
                        {interventies.map((sr, si) => (
                          <li key={sr.id ?? si} className="flex items-start gap-2 rounded border border-default bg-page p-2 text-sm">
                            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            <p className="text-fg">{sr.code?.text ?? sr.code?.coding?.[0]?.display ?? "-"}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-default pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-fg">Handtekening / Akkoord</h4>
                      <button
                        onClick={() => {
                          setShowHandtekeningForm(showHandtekeningForm === cp.id ? null : cp.id!);
                          if (showHandtekeningForm !== cp.id && cp.id) loadHandtekeningen(cp.id);
                        }}
                        className="text-xs font-medium text-brand-700 hover:text-brand-900"
                      >
                        {showHandtekeningForm === cp.id ? "Annuleren" : "+ Handtekening toevoegen"}
                      </button>
                    </div>

                    {showHandtekeningForm === cp.id && (
                      <div className="mb-3 rounded border border-brand-100 bg-brand-50 p-3 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Type</label>
                            <select value={handtekeningType} onChange={(e) => setHandtekeningType(e.target.value)} className={inputCls}>
                              <option value="Ondertekend">Ondertekend</option>
                              <option value="Besproken">Besproken</option>
                              <option value="Niet akkoord">Niet akkoord</option>
                              <option value="Later bespreken">Later bespreken</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Naam</label>
                            <input type="text" value={handtekeningNaam} onChange={(e) => setHandtekeningNaam(e.target.value)} placeholder="Naam ondertekenaar" className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Rol</label>
                            <select value={handtekeningRol} onChange={(e) => setHandtekeningRol(e.target.value)} className={inputCls}>
                              <option value="Client">Client</option>
                              <option value="Vertegenwoordiger">Vertegenwoordiger</option>
                              <option value="Zorgverlener">Zorgverlener</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Opmerking</label>
                            <input type="text" value={handtekeningOpmerking} onChange={(e) => setHandtekeningOpmerking(e.target.value)} placeholder="Optionele toelichting" className={inputCls} />
                          </div>
                        </div>
                        <button
                          onClick={() => cp.id && handleAddHandtekening(cp.id)}
                          disabled={handtekeningSaving || !handtekeningNaam}
                          className="rounded bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
                        >
                          {handtekeningSaving ? "Opslaan..." : "Handtekening opslaan"}
                        </button>
                      </div>
                    )}

                    {(handtekeningen[cp.id!] ?? []).length === 0 ? (
                      <p className="text-xs text-fg-subtle">Nog geen handtekeningen.</p>
                    ) : (
                      <ul className="space-y-1">
                        {(handtekeningen[cp.id!] ?? []).map((h, hi) => (
                          <li key={hi} className="flex items-center gap-2 rounded border border-default bg-page px-3 py-2 text-xs">
                            <span className={`inline-block rounded-full px-1.5 py-0.5 font-semibold ${
                              h.type === "Ondertekend" ? "bg-green-100 text-green-800" :
                              h.type === "Besproken" ? "bg-blue-100 text-blue-800" :
                              h.type === "Niet akkoord" ? "bg-coral-50 text-coral-700" :
                              "bg-yellow-100 text-yellow-800"
                            }`}>{h.type}</span>
                            <span className="font-medium text-fg">{h.naam}</span>
                            <span className="text-fg-muted">({h.rol})</span>
                            {h.opmerking && <span className="text-fg-subtle truncate">{h.opmerking}</span>}
                            <span className="ml-auto text-fg-subtle">{formatDate(h.datum)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                );
              })()}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
