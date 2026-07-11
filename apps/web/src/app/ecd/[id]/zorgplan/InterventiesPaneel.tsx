"use client";

import { useState } from "react";

import { type FhirServiceRequest, type UseZorgplanResult } from "./useZorgplan";

const inputCls =
  "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface InterventiesPaneelProps {
  planId: string;
  interventies: FhirServiceRequest[];
  addInterventie: UseZorgplanResult["addInterventie"];
  onInterventieToegevoegd: () => void;
}

/** Interventies-sectie van een zorgplan: toevoegformulier en de lijst. */
export function InterventiesPaneel({
  planId,
  interventies,
  addInterventie,
  onInterventieToegevoegd,
}: InterventiesPaneelProps) {
  const [showForm, setShowForm] = useState(false);
  const [interventieCode, setInterventieCode] = useState("");
  const [interventieFrequentie, setInterventieFrequentie] = useState("");
  const [interventieSaving, setInterventieSaving] = useState(false);

  async function handleAdd() {
    setInterventieSaving(true);
    const codeText = interventieFrequentie
      ? `${interventieCode} (${interventieFrequentie})`
      : interventieCode;

    const { error } = await addInterventie(planId, codeText);

    setInterventieSaving(false);
    if (!error) {
      setShowForm(false);
      setInterventieCode("");
      setInterventieFrequentie("");
      onInterventieToegevoegd();
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-fg">Interventies</h4>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-medium text-brand-700 hover:text-brand-900"
        >
          {showForm ? "Annuleren" : "+ Interventie toevoegen"}
        </button>
      </div>

      {showForm && (
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
            <button onClick={handleAdd} disabled={interventieSaving || !interventieCode} className="rounded-md bg-brand-700 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press">
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
  );
}
