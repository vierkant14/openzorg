"use client";

import { ErrorState, LoadingSkeleton } from "@openzorg/shared-ui";
import { useParams } from "next/navigation";
import { useState } from "react";

import { DoelenLijst } from "./DoelenLijst";
import { HandtekeningenPaneel } from "./HandtekeningenPaneel";
import { InterventiesPaneel } from "./InterventiesPaneel";
import { NieuwZorgplanForm } from "./NieuwZorgplanForm";
import { formatDate, useZorgplan } from "./useZorgplan";

export default function ZorgplanPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const {
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
  } = useZorgplan(clientId);

  const [showForm, setShowForm] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  // Klik op een zorgplan: uitklappen (en detail laden) of dichtklappen. Bij het
  // dichtklappen halen we niets op — zo blijft het gedrag identiek aan voorheen.
  function loadPlanDetails(planId: string) {
    setExpandedPlan(expandedPlan === planId ? null : planId);
    if (expandedPlan === planId) return;
    loadGoals();
    loadInterventies();
    loadHandtekeningen(planId);
  }

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
        <NieuwZorgplanForm
          createZorgplan={createZorgplan}
          onOpgeslagen={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      {loading && <LoadingSkeleton regels={6} />}
      {!loading && error && <ErrorState melding={error} onOpnieuw={reload} />}

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

              {isExpanded && cp.id && (
                <div className="border-t px-4 py-4 space-y-4">
                  <DoelenLijst
                    planId={cp.id}
                    goals={goals}
                    interventies={interventies}
                    evaluaties={evaluaties}
                    goalRapportages={goalRapportages}
                    addGoal={addGoal}
                    addEvaluatie={addEvaluatie}
                    loadEvaluaties={loadEvaluaties}
                    loadGoalRapportages={loadGoalRapportages}
                    onDoelToegevoegd={() => loadPlanDetails(cp.id!)}
                  />
                  <InterventiesPaneel
                    planId={cp.id}
                    interventies={interventies}
                    addInterventie={addInterventie}
                    onInterventieToegevoegd={() => loadPlanDetails(cp.id!)}
                  />
                  <HandtekeningenPaneel
                    planId={cp.id}
                    handtekeningen={handtekeningen[cp.id] ?? []}
                    addHandtekening={addHandtekening}
                    loadHandtekeningen={loadHandtekeningen}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
