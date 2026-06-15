"use client";

import { useCallback, useEffect, useState } from "react";

import { ecdFetch } from "../../../../lib/api";

/* -------------------------------------------------------------------------- */
/*  FHIR types                                                                */
/* -------------------------------------------------------------------------- */

export interface FhirBundle<T> {
  resourceType?: "Bundle";
  type?: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

export interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  code: { text: string };
  valueString?: string;
  effectiveDateTime?: string;
  extension?: Array<{ url: string; valueString: string }>;
  focus?: Array<{ reference?: string }>;
}

export interface FhirGoal {
  resourceType: "Goal";
  id?: string;
  lifecycleStatus?: string;
  description?: { text?: string };
}

interface FhirPatient {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Leest een Goal-id uit het `focus`-veld van een rapportage (Observation). */
export function getGoalIdFromObservation(obs: FhirObservation): string | undefined {
  const ref = obs.focus?.[0]?.reference;
  if (!ref || !ref.startsWith("Goal/")) return undefined;
  return ref.slice("Goal/".length);
}

function patientNaam(patient: FhirPatient | null): string {
  const n = patient?.name?.[0];
  if (n?.text) return n.text;
  const given = n?.given?.join(" ") ?? "";
  const family = n?.family ?? "";
  return `${given} ${family}`.trim();
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

export interface UseRapportagesResult {
  items: FhirObservation[];
  goals: FhirGoal[];
  clientNaam: string;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Laadt de rapportages, de zorgplan-doelen en de cliëntnaam voor één cliënt.
 * Rapportages worden aflopend op `effectiveDateTime` gesorteerd (nieuwste eerst).
 */
export function useRapportages(clientId: string): UseRapportagesResult {
  const [items, setItems] = useState<FhirObservation[]>([]);
  const [goals, setGoals] = useState<FhirGoal[]>([]);
  const [clientNaam, setClientNaam] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!clientId) return;
    setLoading(true);
    setError(null);

    ecdFetch<FhirBundle<FhirObservation>>(`/api/clients/${clientId}/rapportages`).then(
      ({ data, error: err }) => {
        if (err) {
          setError(err);
        } else {
          const sorted = (data?.entry?.map((e) => e.resource) ?? []).sort((a, b) =>
            (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""),
          );
          setItems(sorted);
        }
        setLoading(false);
      },
    );
  }, [clientId]);

  const loadGoals = useCallback(() => {
    if (!clientId) return;
    ecdFetch<FhirBundle<FhirGoal>>(`/api/clients/${clientId}/zorgplan`).then(({ data: cpData }) => {
      const cpId = cpData?.entry?.[0]?.resource?.id;
      if (!cpId) return;
      ecdFetch<FhirBundle<FhirGoal>>(`/api/zorgplan/${cpId}/doelen`).then(({ data }) => {
        setGoals(data?.entry?.map((e) => e.resource) ?? []);
      });
    });
  }, [clientId]);

  const loadNaam = useCallback(() => {
    if (!clientId) return;
    ecdFetch<FhirPatient>(`/api/clients/${clientId}`).then(({ data }) => {
      setClientNaam(patientNaam(data));
    });
  }, [clientId]);

  useEffect(() => {
    reload();
    loadGoals();
    loadNaam();
  }, [reload, loadGoals, loadNaam]);

  return { items, goals, clientNaam, loading, error, reload };
}
