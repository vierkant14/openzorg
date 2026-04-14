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

interface FhirAllergyIntolerance {
  id?: string;
  code?: { text?: string; coding?: Array<{ display?: string }> };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  category?: string[];
  criticality?: string;
  recordedDate?: string;
  note?: Array<{ text?: string }>;
}

const CRITICALITY_LABELS: Record<string, string> = { low: "Laag", high: "Hoog", "unable-to-assess": "Onbekend" };

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

export default function AllergieenPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirAllergyIntolerance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [naam, setNaam] = useState("");
  const [codelijst, setCodelijst] = useState<Array<{ code: string; display: string }>>([]);

  useEffect(() => {
    ecdFetch<{ items: Array<{ code: string; display: string }> }>("/api/admin/codelijsten/allergieen")
      .then(({ data }) => { if (data?.items) setCodelijst(data.items); });
  }, []);
  const [categorie, setCategorie] = useState("medication");
  const [ernst, setErnst] = useState("low");
  const [notitie, setNotitie] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<FhirBundle<FhirAllergyIntolerance>>(`/api/clients/${clientId}/allergieen`);
    if (err) setError(err);
    else setItems(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!naam.trim()) return;
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/allergieen`, {
      method: "POST",
      body: JSON.stringify({
        code: { text: naam },
        category: [categorie],
        criticality: ernst,
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
        ...(notitie ? { note: [{ text: notitie }] } : {}),
      }),
    });
    setSaving(false);
    setShowForm(false);
    setNaam(""); setNotitie("");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet u zeker dat u deze allergie/intolerantie wilt verwijderen?")) return;
    setDeletingId(id);
    await ecdFetch(`/api/clients/${clientId}/allergieen/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-fg">Allergieën & Intoleranties</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {showForm ? "Annuleren" : "+ Toevoegen"}
        </button>
      </div>

      {showForm && (
        <div className="bg-raised rounded-xl border border-default p-4 mb-4 space-y-3">
          {codelijst.length > 0 ? (
            <select value={naam} onChange={(e) => setNaam(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
              <option value="">Selecteer allergie/intolerantie</option>
              {codelijst.map((c) => <option key={c.code} value={c.display}>{c.display}</option>)}
            </select>
          ) : (
            <input placeholder="Naam allergie/intolerantie" value={naam} onChange={(e) => setNaam(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          )}
          <div className="grid grid-cols-2 gap-3">
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
              className="border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
              <option value="food">Voedsel</option>
              <option value="medication">Medicatie</option>
              <option value="environment">Omgeving</option>
              <option value="biologic">Biologisch</option>
            </select>
            <select value={ernst} onChange={(e) => setErnst(e.target.value)}
              className="border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
              <option value="low">Laag risico</option>
              <option value="high">Hoog risico</option>
              <option value="unable-to-assess">Onbekend</option>
            </select>
          </div>
          <textarea placeholder="Notitie (optioneel)" value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={2}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <button onClick={handleAdd} disabled={saving || !naam.trim()}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle py-4">Geen allergieën of intoleranties geregistreerd.</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="bg-raised rounded-xl border border-default p-4 flex items-start justify-between">
              <div>
                <p className="font-medium text-fg">{a.code?.text ?? a.code?.coding?.[0]?.display ?? "Onbekend"}</p>
                <div className="flex gap-3 mt-1 text-caption text-fg-subtle">
                  <span>{a.category?.[0] === "food" ? "Voedsel" : a.category?.[0] === "medication" ? "Medicatie" : a.category?.[0] ?? "---"}</span>
                  <span>Ernst: {CRITICALITY_LABELS[a.criticality ?? ""] ?? a.criticality ?? "---"}</span>
                </div>
                {a.note?.[0]?.text && <p className="text-sm text-fg-muted mt-1">{a.note[0].text}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.criticality === "high" && (
                  <span className="px-2 py-0.5 rounded text-caption font-medium bg-coral-50 text-coral-600">Hoog risico</span>
                )}
                <button onClick={() => a.id && handleDelete(a.id)} disabled={deletingId === a.id} className="text-sm text-coral-600 hover:text-coral-800 btn-press-sm disabled:opacity-50">
                  {deletingId === a.id ? "..." : "Verwijderen"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
