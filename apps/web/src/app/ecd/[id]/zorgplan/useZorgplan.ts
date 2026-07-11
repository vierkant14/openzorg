"use client";

import { useCallback, useEffect, useState } from "react";

import { ecdFetch } from "../../../../lib/api";

/* -------------------------------------------------------------------------- */
/*  FHIR types                                                                */
/* -------------------------------------------------------------------------- */

export interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

export interface FhirCarePlan {
  resourceType: "CarePlan";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: { start?: string; end?: string };
}

export interface FhirGoal {
  resourceType: "Goal";
  id?: string;
  lifecycleStatus?: string;
  description?: { text?: string };
  target?: Array<{ dueDate?: string }>;
  addresses?: Array<{ reference?: string }>;
  category?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string }> }>;
  extension?: Array<{ url?: string; valueString?: string }>;
}

export interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
  intent?: string;
  code?: { text?: string; coding?: Array<{ display?: string }> };
  basedOn?: Array<{ reference?: string }>;
}

export interface Evaluatie {
  status?: string;
  opmerking?: string;
  voortgang?: number;
  datum?: string;
}

export interface GoalRapportage {
  id?: string;
  type: string;
  tekst: string;
  datum?: string;
}

export interface Handtekening {
  type?: string;
  naam?: string;
  rol?: string;
  opmerking?: string;
  datum?: string;
}

export interface Leefgebied {
  key: string;
  label: string;
  emoji: string;
  description: string;
}

/* -------------------------------------------------------------------------- */
/*  Constanten                                                                */
/* -------------------------------------------------------------------------- */

/** The 12 leefgebieden (life domains) conform Dutch VVT Zorgleefplan/Omaha methodology. */
export const LEEFGEBIEDEN: ReadonlyArray<Leefgebied> = [
  { key: "lichamelijke-gezondheid", label: "Lichamelijke gezondheid", emoji: "❤️", description: "Diagnoses, chronische aandoeningen, pijn" },
  { key: "geestelijke-gezondheid", label: "Geestelijke gezondheid", emoji: "🧠", description: "Stemming, cognitie, dementie, angst" },
  { key: "mobiliteit", label: "Mobiliteit", emoji: "🚶", description: "Transfers, lopen, balans, valrisico" },
  { key: "voeding", label: "Voeding", emoji: "🍽️", description: "Eetpatroon, gewicht, dieet, slikproblemen" },
  { key: "huid-en-wondverzorging", label: "Huid en wondverzorging", emoji: "🩹", description: "Decubitus, wonden, huidverzorging" },
  { key: "uitscheiding", label: "Uitscheiding", emoji: "💧", description: "Incontinentie, obstipatie, katheter" },
  { key: "slaap-en-rust", label: "Slaap en rust", emoji: "😴", description: "Slaappatroon, onrust, nachtrust" },
  { key: "persoonlijke-verzorging", label: "Persoonlijke verzorging", emoji: "🛁", description: "Wassen, aankleden, eten (ADL)" },
  { key: "huishouden", label: "Huishouden", emoji: "🏠", description: "Huishoudelijke taken, woonomgeving" },
  { key: "sociale-participatie", label: "Sociale participatie", emoji: "🧑‍🤝‍🧑", description: "Sociaal netwerk, activiteiten, eenzaamheid" },
  { key: "regie-en-autonomie", label: "Regie en autonomie", emoji: "🎯", description: "Eigen regie, competentie, wensen" },
  { key: "zingeving-en-spiritualiteit", label: "Zingeving en spiritualiteit", emoji: "✨", description: "Levensbeschouwing, rituelen, zingeving" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

export function formatDate(iso?: string): string {
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

/** Leest het leefgebied van een doel: eerst uit de extensie, anders uit de category-coding. */
export function getGoalLeefgebied(goal: FhirGoal): string {
  const ext = goal.extension?.find((e) => e.url === "https://openzorg.nl/extensions/leefgebied");
  if (ext?.valueString) return ext.valueString;
  const cat = goal.category?.find((c) =>
    c.coding?.some((cd) => cd.system === "https://openzorg.nl/CodeSystem/leefgebieden"),
  );
  const coding = cat?.coding?.find((cd) => cd.system === "https://openzorg.nl/CodeSystem/leefgebieden");
  return coding?.code ?? "";
}

/** Leest de situatieschets van een doel uit de extensie. */
export function getGoalSituatieschets(goal: FhirGoal): string | undefined {
  return goal.extension?.find((e) => e.url === "https://openzorg.nl/extensions/situatieschets")?.valueString;
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Laadt de zorgplannen van een cliënt en levert alle data-fetching en acties
 * voor doelen, interventies, evaluaties, gekoppelde rapportages en
 * handtekeningen. De UI-staat (welk plan is uitgeklapt, formulier-velden)
 * blijft in de componenten.
 */
export function useZorgplan(clientId: string) {
  const [items, setItems] = useState<FhirCarePlan[]>([]);
  const [goals, setGoals] = useState<FhirGoal[]>([]);
  const [interventies, setInterventies] = useState<FhirServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluaties, setEvaluaties] = useState<Record<string, Evaluatie[]>>({});
  const [goalRapportages, setGoalRapportages] = useState<Record<string, GoalRapportage[]>>({});
  const [handtekeningen, setHandtekeningen] = useState<Record<string, Handtekening[]>>({});

  const reload = useCallback(() => {
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
    reload();
  }, [reload]);

  const loadGoals = useCallback(() => {
    ecdFetch<FhirBundle<FhirGoal>>(`/api/clients/${clientId}/zorgplan`).then(({ data }) => {
      setGoals(
        data?.entry?.map((e) => e.resource).filter((r): r is FhirGoal => r.resourceType === "Goal") ?? [],
      );
    });
  }, [clientId]);

  const loadInterventies = useCallback(() => {
    ecdFetch<FhirBundle<FhirServiceRequest>>(`/api/clients/${clientId}/zorgplan`).then(({ data }) => {
      setInterventies(
        data?.entry?.map((e) => e.resource).filter((r): r is FhirServiceRequest => r.resourceType === "ServiceRequest") ?? [],
      );
    });
  }, [clientId]);

  const loadHandtekeningen = useCallback((planId: string) => {
    ecdFetch<{ items?: Handtekening[] }>(`/api/zorgplan/${planId}/handtekeningen`).then(({ data }) => {
      setHandtekeningen((prev) => ({ ...prev, [planId]: data?.items ?? [] }));
    });
  }, []);

  const loadEvaluaties = useCallback((planId: string, goalId: string) => {
    ecdFetch<{ items?: Evaluatie[] }>(`/api/zorgplan/${planId}/doelen/${goalId}/evaluaties`).then(({ data }) => {
      setEvaluaties((prev) => ({ ...prev, [goalId]: data?.items ?? [] }));
    });
  }, []);

  const loadGoalRapportages = useCallback((goalId: string) => {
    ecdFetch<FhirBundle<{ id?: string; code?: { text?: string }; valueString?: string; effectiveDateTime?: string; focus?: Array<{ reference?: string }> }>>(
      `/api/clients/${clientId}/rapportages`,
    ).then(({ data }) => {
      const list = (data?.entry?.map((e) => e.resource) ?? [])
        .filter((obs) => obs.focus?.some((f) => f.reference === `Goal/${goalId}`))
        .map((obs) => ({
          id: obs.id,
          type: obs.code?.text ?? "Rapportage",
          tekst: obs.valueString ?? "",
          datum: obs.effectiveDateTime,
        }));
      setGoalRapportages((prev) => ({ ...prev, [goalId]: list }));
    });
  }, [clientId]);

  const createZorgplan = useCallback(
    (body: Record<string, unknown>) =>
      ecdFetch(`/api/clients/${clientId}/zorgplan`, { method: "POST", body: JSON.stringify(body) }),
    [clientId],
  );

  const addGoal = useCallback(
    (planId: string, body: Record<string, unknown>) =>
      ecdFetch<{ resourceType?: string; id?: string; issue?: Array<{ diagnostics?: string; details?: { text?: string } }> }>(
        `/api/zorgplan/${planId}/doelen`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    [],
  );

  const addInterventie = useCallback(
    (planId: string, codeText: string) =>
      ecdFetch(`/api/zorgplan/${planId}/interventies`, {
        method: "POST",
        body: JSON.stringify({ code: { text: codeText } }),
      }),
    [],
  );

  const addEvaluatie = useCallback(
    (planId: string, goalId: string, body: Record<string, unknown>) =>
      ecdFetch(`/api/zorgplan/${planId}/doelen/${goalId}/evaluatie`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    [],
  );

  const addHandtekening = useCallback(
    (planId: string, body: Record<string, unknown>) =>
      ecdFetch(`/api/zorgplan/${planId}/handtekening`, { method: "POST", body: JSON.stringify(body) }),
    [],
  );

  return {
    items,
    goals,
    interventies,
    loading,
    error,
    evaluaties,
    goalRapportages,
    handtekeningen,
    reload,
    loadGoals,
    loadInterventies,
    loadHandtekeningen,
    loadEvaluaties,
    loadGoalRapportages,
    createZorgplan,
    addGoal,
    addInterventie,
    addEvaluatie,
    addHandtekening,
  };
}

export type UseZorgplanResult = ReturnType<typeof useZorgplan>;
