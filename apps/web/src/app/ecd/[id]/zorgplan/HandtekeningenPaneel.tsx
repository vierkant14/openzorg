"use client";

import { useState } from "react";

import { formatDate, type Handtekening, type UseZorgplanResult } from "./useZorgplan";

const inputCls =
  "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface HandtekeningenPaneelProps {
  planId: string;
  handtekeningen: Handtekening[];
  addHandtekening: UseZorgplanResult["addHandtekening"];
  loadHandtekeningen: UseZorgplanResult["loadHandtekeningen"];
}

/** Handtekening- / akkoord-sectie van een zorgplan: toevoegformulier en lijst. */
export function HandtekeningenPaneel({
  planId,
  handtekeningen,
  addHandtekening,
  loadHandtekeningen,
}: HandtekeningenPaneelProps) {
  const [showForm, setShowForm] = useState(false);
  const [handtekeningType, setHandtekeningType] = useState("Ondertekend");
  const [handtekeningNaam, setHandtekeningNaam] = useState("");
  const [handtekeningRol, setHandtekeningRol] = useState("Client");
  const [handtekeningOpmerking, setHandtekeningOpmerking] = useState("");
  const [handtekeningSaving, setHandtekeningSaving] = useState(false);

  function toggleForm() {
    const willOpen = !showForm;
    setShowForm(willOpen);
    if (willOpen) loadHandtekeningen(planId);
  }

  async function handleAdd() {
    setHandtekeningSaving(true);
    const { error } = await addHandtekening(planId, {
      type: handtekeningType,
      naam: handtekeningNaam,
      rol: handtekeningRol,
      opmerking: handtekeningOpmerking,
    });
    setHandtekeningSaving(false);
    if (!error) {
      setShowForm(false);
      setHandtekeningNaam("");
      setHandtekeningOpmerking("");
      loadHandtekeningen(planId);
    }
  }

  return (
    <div className="border-t border-default pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-fg">Handtekening / Akkoord</h4>
        <button
          onClick={toggleForm}
          className="text-xs font-medium text-brand-700 hover:text-brand-900"
        >
          {showForm ? "Annuleren" : "+ Handtekening toevoegen"}
        </button>
      </div>

      {showForm && (
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
            onClick={handleAdd}
            disabled={handtekeningSaving || !handtekeningNaam}
            className="rounded bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {handtekeningSaving ? "Opslaan..." : "Handtekening opslaan"}
          </button>
        </div>
      )}

      {handtekeningen.length === 0 ? (
        <p className="text-xs text-fg-subtle">Nog geen handtekeningen.</p>
      ) : (
        <ul className="space-y-1">
          {handtekeningen.map((h, hi) => (
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
  );
}
