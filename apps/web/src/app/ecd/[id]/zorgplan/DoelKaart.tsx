"use client";

import { useState } from "react";

import {
  formatDate,
  getGoalSituatieschets,
  type Evaluatie,
  type FhirGoal,
  type FhirServiceRequest,
  type GoalRapportage,
} from "./useZorgplan";

const inputCls =
  "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface DoelKaartProps {
  goal: FhirGoal;
  planId: string;
  interventies: FhirServiceRequest[];
  evaluaties: Evaluatie[];
  linkedRapportages: GoalRapportage[];
  open: boolean;
  onToggle: () => void;
  onEvalueer: (body: Record<string, unknown>) => Promise<{ error: string | null }>;
  onOpgeslagen: () => void;
}

/**
 * Eén doel binnen een leefgebied: status, gekoppelde interventies, het
 * evaluatieformulier, de evaluatiehistorie en de gerelateerde rapportages.
 */
export function DoelKaart({
  goal,
  planId,
  interventies,
  evaluaties,
  linkedRapportages,
  open,
  onToggle,
  onEvalueer,
  onOpgeslagen,
}: DoelKaartProps) {
  const [evalStatus, setEvalStatus] = useState("Geen verandering");
  const [evalOpmerking, setEvalOpmerking] = useState("");
  const [evalVoortgang, setEvalVoortgang] = useState(50);
  const [evalSaving, setEvalSaving] = useState(false);

  const situatieschets = getGoalSituatieschets(goal);
  const planInterventies = interventies.filter((sr) =>
    sr.basedOn?.some((ref) => ref.reference === `CarePlan/${planId}`),
  );

  async function handleSave() {
    if (!goal.id) return;
    setEvalSaving(true);
    const { error } = await onEvalueer({
      status: evalStatus,
      opmerking: evalOpmerking,
      voortgang: evalVoortgang,
    });
    setEvalSaving(false);
    if (!error) {
      setEvalStatus("Geen verandering");
      setEvalOpmerking("");
      setEvalVoortgang(50);
      onOpgeslagen();
    }
  }

  return (
    <div className="rounded-md border border-default bg-page p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-start gap-2">
            <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
              goal.lifecycleStatus === "completed" ? "bg-green-500" :
              goal.lifecycleStatus === "cancelled" ? "bg-coral-500" :
              "bg-brand-500"
            }`} />
            <div className="flex-1">
              <p className="text-sm font-medium text-fg">{goal.description?.text ?? "-"}</p>
              {situatieschets && (
                <p className="mt-1 text-xs text-fg-muted italic">Situatie: {situatieschets}</p>
              )}
              {goal.target?.[0]?.dueDate && (
                <p className="mt-0.5 text-xs text-fg-subtle">Streefdatum: {formatDate(goal.target[0].dueDate)}</p>
              )}
              {goal.lifecycleStatus && goal.lifecycleStatus !== "active" && (
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                  goal.lifecycleStatus === "completed" ? "bg-green-100 text-green-800" :
                  goal.lifecycleStatus === "cancelled" ? "bg-coral-50 text-coral-700" :
                  "bg-surface-100 dark:bg-surface-800 text-fg-muted"
                }`}>{goal.lifecycleStatus}</span>
              )}
            </div>
          </div>

          {planInterventies.length > 0 && (
            <div className="mt-2 ml-5">
              <p className="text-xs font-medium text-fg-subtle mb-1">Interventies:</p>
              <ul className="space-y-1">
                {planInterventies.map((sr, si) => (
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
          onClick={onToggle}
          className="shrink-0 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 btn-press"
        >
          Evalueren
        </button>
      </div>

      {open && (
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
            onClick={handleSave}
            disabled={evalSaving}
            className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50 btn-press"
          >
            {evalSaving ? "Opslaan..." : "Evaluatie opslaan"}
          </button>
        </div>
      )}

      {evaluaties.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-fg-subtle">Evaluatiehistorie:</p>
          {evaluaties.map((ev, evi) => (
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

      {open && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-fg-subtle">Gerelateerde rapportages ({linkedRapportages.length}):</p>
          {linkedRapportages.length === 0 ? (
            <p className="text-xs text-fg-subtle italic">Nog geen rapportages aan dit doel gekoppeld.</p>
          ) : (
            linkedRapportages.slice(0, 5).map((r, ri) => (
              <div key={r.id ?? ri} className="flex items-start gap-2 rounded bg-raised px-2 py-1 text-xs">
                <span className="shrink-0 rounded-full bg-brand-50 dark:bg-brand-950/20 px-1.5 py-0.5 font-semibold text-brand-700 dark:text-brand-300">
                  {r.type.toLowerCase().includes("soep") ? "SOEP" : "Vrij"}
                </span>
                <span className="flex-1 truncate text-fg-muted">{r.tekst}</span>
                <span className="shrink-0 text-fg-subtle">{formatDate(r.datum)}</span>
              </div>
            ))
          )}
          {linkedRapportages.length > 5 && (
            <p className="text-xs text-fg-subtle italic">+ {linkedRapportages.length - 5} meer (zie rapportages-tab)</p>
          )}
        </div>
      )}
    </div>
  );
}
