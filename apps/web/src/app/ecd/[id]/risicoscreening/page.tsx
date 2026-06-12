"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ecdFetch } from "../../../../lib/api";

interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface FhirRiskAssessment {
  id?: string;
  code?: { text?: string };
  status?: string;
  occurrenceDateTime?: string;
  prediction?: Array<{ outcome?: { text?: string }; qualitativeRisk?: { text?: string }; relativeRisk?: number }>;
  note?: Array<{ text?: string }>;
}

const SCREENING_TYPES = [
  { value: "Valrisico (Morse Fall Scale)", label: "Valrisico" },
  { value: "Decubitus (Braden)", label: "Decubitus" },
  { value: "Ondervoeding (SNAQ/MUST)", label: "Ondervoeding" },
  { value: "Depressie (GDS-15)", label: "Depressie" },
  { value: "Pijn (NRS/VAS)", label: "Pijn" },
  { value: "Delier (DOS/DOSS)", label: "Delier" },
];

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

export default function RisicoscreeningPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirRiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [screeningType, setScreeningType] = useState(SCREENING_TYPES[0]?.value ?? "");
  const [risico, setRisico] = useState("laag");
  const [notitie, setNotitie] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<FhirBundle<FhirRiskAssessment>>(`/api/clients/${clientId}/risicoscreenings`);
    if (err) setError(err);
    else setItems(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/risicoscreenings`, {
      method: "POST",
      body: JSON.stringify({
        code: { text: screeningType },
        occurrenceDateTime: new Date().toISOString(),
        prediction: [{ qualitativeRisk: { text: risico } }],
        ...(notitie ? { note: [{ text: notitie }] } : {}),
      }),
    });
    setSaving(false);
    setShowForm(false);
    setNotitie("");
    load();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-fg">Risicoscreenings</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {showForm ? "Annuleren" : "+ Screening"}
        </button>
      </div>

      {showForm && (
        <div className="bg-raised rounded-xl border border-default p-4 mb-4 space-y-3">
          <select value={screeningType} onChange={(e) => setScreeningType(e.target.value)}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
            {SCREENING_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.value}</option>)}
          </select>
          <select value={risico} onChange={(e) => setRisico(e.target.value)}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
            <option value="laag">Laag risico</option>
            <option value="matig">Matig risico</option>
            <option value="hoog">Hoog risico</option>
            <option value="zeer hoog">Zeer hoog risico</option>
          </select>
          <textarea placeholder="Toelichting (optioneel)" value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={2}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <button onClick={handleAdd} disabled={saving}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Opslaan..." : "Screening opslaan"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle py-4">Geen risicoscreenings uitgevoerd.</p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const risicoNiveau = r.prediction?.[0]?.qualitativeRisk?.text ?? "onbekend";
            const isHoog = risicoNiveau === "hoog" || risicoNiveau === "zeer hoog";
            return (
              <div key={r.id} className="bg-raised rounded-xl border border-default p-4">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-fg">{r.code?.text ?? "Screening"}</p>
                  <span className={`text-caption font-medium px-2 py-0.5 rounded ${
                    isHoog ? "bg-coral-50 text-coral-600" : "bg-brand-50 text-brand-700"
                  }`}>
                    {risicoNiveau}
                  </span>
                </div>
                {r.occurrenceDateTime && (
                  <p className="text-caption text-fg-subtle mt-1">
                    Uitgevoerd op {new Date(r.occurrenceDateTime).toLocaleDateString("nl-NL")}
                  </p>
                )}
                {r.note?.[0]?.text && <p className="text-sm text-fg-muted mt-1">{r.note[0].text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
