"use client";

import { useState } from "react";

import { DoelKaart } from "./DoelKaart";
import {
  getGoalLeefgebied,
  LEEFGEBIEDEN,
  type Evaluatie,
  type FhirGoal,
  type FhirServiceRequest,
  type GoalRapportage,
  type UseZorgplanResult,
} from "./useZorgplan";

const inputCls =
  "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface DoelenLijstProps {
  planId: string;
  goals: FhirGoal[];
  interventies: FhirServiceRequest[];
  evaluaties: Record<string, Evaluatie[]>;
  goalRapportages: Record<string, GoalRapportage[]>;
  addGoal: UseZorgplanResult["addGoal"];
  addEvaluatie: UseZorgplanResult["addEvaluatie"];
  loadEvaluaties: UseZorgplanResult["loadEvaluaties"];
  loadGoalRapportages: UseZorgplanResult["loadGoalRapportages"];
  onDoelToegevoegd: () => void;
}

/**
 * Doelen van één zorgplan, gegroepeerd per leefgebied, met het formulier om
 * een nieuw doel toe te voegen (incl. SMART-validatiefouten) en de lege
 * leefgebieden onderaan.
 */
export function DoelenLijst({
  planId,
  goals,
  interventies,
  evaluaties,
  goalRapportages,
  addGoal,
  addEvaluatie,
  loadEvaluaties,
  loadGoalRapportages,
  onDoelToegevoegd,
}: DoelenLijstProps) {
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalLeefgebied, setGoalLeefgebied] = useState(LEEFGEBIEDEN[0]!.key);
  const [goalDescription, setGoalDescription] = useState("");
  const [goalSituatieschets, setGoalSituatieschets] = useState("");
  const [goalDueDate, setGoalDueDate] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSmartErrors, setGoalSmartErrors] = useState<string[]>([]);
  const [expandedLeefgebieden, setExpandedLeefgebieden] = useState<Set<string>>(new Set());
  const [openEvalGoalId, setOpenEvalGoalId] = useState<string | null>(null);

  function toggleLeefgebied(key: string) {
    setExpandedLeefgebieden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleEval(goalId: string, realId?: string) {
    const willOpen = openEvalGoalId !== goalId;
    setOpenEvalGoalId(willOpen ? goalId : null);
    if (willOpen && realId) {
      loadEvaluaties(planId, realId);
      loadGoalRapportages(realId);
    }
  }

  async function handleAddGoal() {
    setGoalSaving(true);
    setGoalSmartErrors([]);
    const body: Record<string, unknown> = {
      description: { text: goalDescription },
      leefgebied: goalLeefgebied,
      ...(goalSituatieschets ? { situatieschets: goalSituatieschets } : {}),
      ...(goalDueDate ? { target: [{ dueDate: goalDueDate }] } : {}),
    };

    const res = await addGoal(planId, body);
    setGoalSaving(false);

    // Parse SMART-validation errors from OperationOutcome
    if (res.error) {
      if (res.data?.id === "smart-validation-failed" && Array.isArray(res.data.issue)) {
        setGoalSmartErrors(
          res.data.issue.map((iss) => iss.diagnostics ?? iss.details?.text ?? "Onbekende validatiefout"),
        );
      } else {
        setGoalSmartErrors([res.error]);
      }
      return;
    }

    setShowGoalForm(false);
    setGoalDescription("");
    setGoalSituatieschets("");
    setGoalDueDate("");
    setGoalLeefgebied(LEEFGEBIEDEN[0]!.key);
    onDoelToegevoegd();
  }

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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-fg">
          Doelen per leefgebied
          <span className="ml-2 text-xs font-normal text-fg-subtle">
            ({goals.length} {goals.length === 1 ? "doel" : "doelen"} in {domainsWithGoals.length} {domainsWithGoals.length === 1 ? "leefgebied" : "leefgebieden"})
          </span>
        </h4>
        <button
          onClick={() => setShowGoalForm((v) => !v)}
          className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showGoalForm ? "Annuleren" : "+ Doel toevoegen"}
        </button>
      </div>

      {showGoalForm && (
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
          {goalSmartErrors.length > 0 && (
            <div className="rounded-md border border-coral-200 bg-coral-50 dark:border-coral-800 dark:bg-coral-950/20 p-3 space-y-1">
              <p className="text-xs font-semibold text-coral-800 dark:text-coral-300">SMART-validatiefouten:</p>
              <ul className="list-disc list-inside space-y-1">
                {goalSmartErrors.map((msg, i) => (
                  <li key={i} className="text-xs text-coral-700 dark:text-coral-300">{msg}</li>
                ))}
              </ul>
              <p className="text-xs text-coral-600 dark:text-coral-400 mt-2">
                Pas het doel aan zodat het voldoet aan de SMART-criteria (Specifiek, Meetbaar, Tijdgebonden).
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={handleAddGoal} disabled={goalSaving || !goalDescription || !goalLeefgebied} className="rounded-md bg-brand-700 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press">
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
                    return (
                      <DoelKaart
                        key={goalId}
                        goal={g}
                        planId={planId}
                        interventies={interventies}
                        evaluaties={evaluaties[goalId] ?? []}
                        linkedRapportages={goalRapportages[goalId] ?? []}
                        open={openEvalGoalId === goalId}
                        onToggle={() => toggleEval(goalId, g.id)}
                        onEvalueer={(body) => addEvaluatie(planId, g.id ?? "", body)}
                        onOpgeslagen={() => {
                          setOpenEvalGoalId(null);
                          if (g.id) loadEvaluaties(planId, g.id);
                        }}
                      />
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
  );
}
