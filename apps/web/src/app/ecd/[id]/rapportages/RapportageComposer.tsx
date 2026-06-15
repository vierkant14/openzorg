"use client";

import { useId, useState } from "react";

import { ecdFetch } from "../../../../lib/api";

import type { FhirGoal } from "./useRapportages";

interface RapportageComposerProps {
  clientId: string;
  goals: FhirGoal[];
  onSaved: () => void;
}

/** De vier SOEP-velden met label en bijbehorende state-sleutel. */
const SOEP_VELDEN = [
  { label: "Subjectief", key: "subjectief" },
  { label: "Objectief", key: "objectief" },
  { label: "Evaluatie", key: "evaluatie" },
  { label: "Plan", key: "plan" },
] as const;

type SoepKey = (typeof SOEP_VELDEN)[number]["key"];

const textareaCls =
  "w-full rounded-md border border-default bg-raised px-3 py-2 text-sm text-fg shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/**
 * Persistente composer bovenaan de rapportagelijst. Altijd zichtbaar (geen
 * toggle). Type-keuze SOEP/Vrij via toegankelijke radio's, een optionele
 * doel-koppeling, en gekoppelde labels op elke textarea (a11y).
 */
export function RapportageComposer({ clientId, goals, onSaved }: RapportageComposerProps) {
  const [type, setType] = useState<"soep" | "vrij">("vrij");
  const [soep, setSoep] = useState<Record<SoepKey, string>>({
    subjectief: "",
    objectief: "",
    evaluatie: "",
    plan: "",
  });
  const [tekst, setTekst] = useState("");
  const [linkedGoalId, setLinkedGoalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseId = useId();
  const doelSelectId = `${baseId}-doel`;
  const tekstId = `${baseId}-tekst`;

  // Alleen actieve doelen aanbieden om aan te koppelen.
  const openGoals = goals.filter(
    (g) => g.lifecycleStatus !== "completed" && g.lifecycleStatus !== "cancelled",
  );

  function reset() {
    setSoep({ subjectief: "", objectief: "", evaluatie: "", plan: "" });
    setTekst("");
    setLinkedGoalId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body =
      type === "soep"
        ? {
            type: "soep",
            subjectief: soep.subjectief,
            objectief: soep.objectief,
            evaluatie: soep.evaluatie,
            plan: soep.plan,
            goalId: linkedGoalId || undefined,
          }
        : { type: "vrij", tekst, goalId: linkedGoalId || undefined };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/rapportages`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      reset();
      onSaved();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-end gap-6">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-fg-muted">Type rapportage</legend>
          <div className="flex gap-4">
            {(["vrij", "soep"] as const).map((t) => {
              const radioId = `${baseId}-type-${t}`;
              return (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <input
                    id={radioId}
                    type="radio"
                    name={`${baseId}-rapportageType`}
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="accent-brand-700"
                  />
                  <label htmlFor={radioId} className="text-fg">
                    {t === "soep" ? "SOEP" : "Vrij"}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>

        {openGoals.length > 0 && (
          <div>
            <label htmlFor={doelSelectId} className="mb-1 block text-sm font-medium text-fg-muted">
              Koppelen aan doel
            </label>
            <select
              id={doelSelectId}
              value={linkedGoalId}
              onChange={(e) => setLinkedGoalId(e.target.value)}
              className="rounded-md border border-default bg-raised px-3 py-2 text-sm text-fg shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Geen doel (optioneel)</option>
              {openGoals.map((g) => (
                <option key={g.id} value={g.id ?? ""}>
                  {g.description?.text ?? "Doel"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {type === "soep" ? (
        <div className="grid gap-3">
          {SOEP_VELDEN.map(({ label, key }) => {
            const fieldId = `${baseId}-${key}`;
            return (
              <div key={key}>
                <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-fg-muted">
                  {label}
                </label>
                <textarea
                  id={fieldId}
                  rows={2}
                  value={soep[key]}
                  onChange={(e) => setSoep((prev) => ({ ...prev, [key]: e.target.value }))}
                  className={textareaCls}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <label htmlFor={tekstId} className="mb-1 block text-sm font-medium text-fg-muted">
            Rapportage
          </label>
          <textarea
            id={tekstId}
            rows={4}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            className={textareaCls}
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-coral-600">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 btn-press"
        >
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
