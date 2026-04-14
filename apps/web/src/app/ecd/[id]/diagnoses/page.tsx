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

interface FhirCondition {
  id?: string;
  code?: { text?: string; coding?: Array<{ display?: string; code?: string }> };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  verificationStatus?: { coding?: Array<{ code?: string }> };
  onsetDateTime?: string;
  note?: Array<{ text?: string }>;
}

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

export default function DiagnosesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [naam, setNaam] = useState("");
  const [codelijst, setCodelijst] = useState<Array<{ code: string; display: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNaam, setEditNaam] = useState("");
  const [editStartdatum, setEditStartdatum] = useState("");
  const [editNotitie, setEditNotitie] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    ecdFetch<{ items: Array<{ code: string; display: string }> }>("/api/admin/codelijsten/diagnoses")
      .then(({ data }) => { if (data?.items) setCodelijst(data.items); });
  }, []);
  const [startdatum, setStartdatum] = useState("");
  const [notitie, setNotitie] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<FhirBundle<FhirCondition>>(`/api/clients/${clientId}/diagnoses`);
    if (err) setError(err);
    else setItems(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!naam.trim()) return;
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/diagnoses`, {
      method: "POST",
      body: JSON.stringify({
        code: { text: naam },
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] },
        ...(startdatum ? { onsetDateTime: startdatum } : {}),
        ...(notitie ? { note: [{ text: notitie }] } : {}),
      }),
    });
    setSaving(false);
    setShowForm(false);
    setNaam(""); setStartdatum(""); setNotitie("");
    load();
  }

  function startEdit(d: FhirCondition) {
    setEditingId(d.id ?? null);
    setEditNaam(d.code?.text ?? d.code?.coding?.[0]?.display ?? "");
    setEditStartdatum(d.onsetDateTime?.slice(0, 10) ?? "");
    setEditNotitie(d.note?.[0]?.text ?? "");
    setEditStatus(d.clinicalStatus?.coding?.[0]?.code ?? "active");
  }

  async function handleEditSave() {
    if (!editingId || !editNaam.trim()) return;
    setEditSaving(true);
    await ecdFetch(`/api/clients/${clientId}/diagnoses/${editingId}`, {
      method: "PUT",
      body: JSON.stringify({
        code: { text: editNaam },
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: editStatus }] },
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] },
        ...(editStartdatum ? { onsetDateTime: editStartdatum } : {}),
        ...(editNotitie ? { note: [{ text: editNotitie }] } : {}),
      }),
    });
    setEditSaving(false);
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet u zeker dat u deze diagnose wilt verwijderen?")) return;
    setDeletingId(id);
    await ecdFetch(`/api/clients/${clientId}/diagnoses/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-fg">Diagnoses & Aandoeningen</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {showForm ? "Annuleren" : "+ Toevoegen"}
        </button>
      </div>

      {showForm && (
        <div className="bg-raised rounded-xl border border-default p-4 mb-4 space-y-3">
          {codelijst.length > 0 ? (
            <select value={naam} onChange={(e) => setNaam(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
              <option value="">Selecteer diagnose / aandoening</option>
              {codelijst.map((c) => <option key={c.code} value={c.display}>{c.display}</option>)}
            </select>
          ) : (
            <input placeholder="Naam diagnose / aandoening" value={naam} onChange={(e) => setNaam(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          )}
          <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)}
            className="border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <textarea placeholder="Notitie (optioneel)" value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={2}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <button onClick={handleAdd} disabled={saving || !naam.trim()}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle py-4">Geen diagnoses of aandoeningen geregistreerd.</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => {
            const isEditing = d.id === editingId;
            if (isEditing) {
              return (
                <div key={d.id} className="bg-raised rounded-xl border border-default p-4 space-y-3">
                  {codelijst.length > 0 ? (
                    <select value={editNaam} onChange={(e) => setEditNaam(e.target.value)}
                      className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
                      <option value="">Selecteer diagnose / aandoening</option>
                      {codelijst.map((c) => <option key={c.code} value={c.display}>{c.display}</option>)}
                    </select>
                  ) : (
                    <input value={editNaam} onChange={(e) => setEditNaam(e.target.value)} placeholder="Naam diagnose"
                      className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={editStartdatum} onChange={(e) => setEditStartdatum(e.target.value)}
                      className="border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                      className="border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
                      <option value="active">Actief</option>
                      <option value="resolved">Hersteld</option>
                      <option value="inactive">Inactief</option>
                    </select>
                  </div>
                  <textarea value={editNotitie} onChange={(e) => setEditNotitie(e.target.value)} placeholder="Notitie (optioneel)" rows={2}
                    className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)}
                      className="border border-default text-fg-muted px-4 py-2 rounded-lg text-sm font-medium hover:bg-page btn-press">
                      Annuleren
                    </button>
                    <button onClick={handleEditSave} disabled={editSaving || !editNaam.trim()}
                      className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 btn-press">
                      {editSaving ? "Opslaan..." : "Wijzigingen opslaan"}
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={d.id} className="bg-raised rounded-xl border border-default p-4">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-fg">{d.code?.text ?? d.code?.coding?.[0]?.display ?? "Onbekend"}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-caption font-medium px-2 py-0.5 rounded ${
                      d.clinicalStatus?.coding?.[0]?.code === "active" ? "bg-brand-50 text-brand-700" : "bg-surface-100 text-fg-subtle"
                    }`}>
                      {d.clinicalStatus?.coding?.[0]?.code === "active" ? "Actief" : d.clinicalStatus?.coding?.[0]?.code ?? "---"}
                    </span>
                    <button onClick={() => startEdit(d)} className="text-sm text-brand-600 hover:text-brand-800 btn-press-sm">
                      Bewerken
                    </button>
                    <button onClick={() => d.id && handleDelete(d.id)} disabled={deletingId === d.id} className="text-sm text-coral-600 hover:text-coral-800 btn-press-sm disabled:opacity-50">
                      {deletingId === d.id ? "..." : "Verwijderen"}
                    </button>
                  </div>
                </div>
                {d.onsetDateTime && <p className="text-caption text-fg-subtle mt-1">Sinds {new Date(d.onsetDateTime).toLocaleDateString("nl-NL")}</p>}
                {d.note?.[0]?.text && <p className="text-sm text-fg-muted mt-1">{d.note[0].text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
