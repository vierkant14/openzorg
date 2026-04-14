"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ecdFetch } from "../../../../lib/api";

/* -------------------------------------------------------------------------- */
/*  Gededupliceerd van monolith tijdens Plan 2A Task 4 migratie               */
/* -------------------------------------------------------------------------- */

const MEDICATIE_ROUTES = [
  { value: "oraal", label: "Oraal" },
  { value: "intraveneus", label: "Intraveneus" },
  { value: "subcutaan", label: "Subcutaan" },
  { value: "intramusculair", label: "Intramusculair" },
  { value: "transdermaal", label: "Transdermaal" },
  { value: "rectaal", label: "Rectaal" },
  { value: "inhalatie", label: "Inhalatie" },
];


const MEDICATIE_STATUSSEN = [
  { value: "actief", label: "Actief" },
  { value: "gepauzeerd", label: "Gepauzeerd" },
  { value: "gestopt", label: "Gestopt" },
  { value: "afgerond", label: "Afgerond" },
];


function ErrorMsg({ msg }: { msg: string }) {
  return <p className="my-2 text-sm text-coral-600">{msg}</p>;
}


function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
    </div>
  );
}


function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}


interface MedicatieOverzichtItem {
  id?: string;
  medicijnNaam?: string;
  dosering?: string;
  frequentie?: string;
  route?: string;
  status?: string;
  startdatum?: string;
  opmerking?: string;
}

const MEDICATIE_ROUTES = [
  { value: "oraal", label: "Oraal" },
  { value: "intraveneus", label: "Intraveneus" },
  { value: "subcutaan", label: "Subcutaan" },
  { value: "intramusculair", label: "Intramusculair" },
  { value: "transdermaal", label: "Transdermaal" },
  { value: "rectaal", label: "Rectaal" },
  { value: "inhalatie", label: "Inhalatie" },
];

const MEDICATIE_STATUSSEN = [
  { value: "actief", label: "Actief" },
  { value: "gepauzeerd", label: "Gepauzeerd" },
  { value: "gestopt", label: "Gestopt" },
  { value: "afgerond", label: "Afgerond" },
];

function MedicatieOverzichtTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<MedicatieOverzichtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicatieOverzichtItem | null>(null);

  const [medicijnNaam, setMedicijnNaam] = useState("");
  const [dosering, setDosering] = useState("");
  const [frequentie, setFrequentie] = useState("");
  const [route, setRoute] = useState("oraal");
  const [startdatum, setStartdatum] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("actief");
  const [opmerking, setOpmerking] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<{ items?: MedicatieOverzichtItem[] }>(`/api/clients/${clientId}/medicatie-overzicht`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setItems(data?.items ?? []);
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setMedicijnNaam("");
    setDosering("");
    setFrequentie("");
    setRoute("oraal");
    setStartdatum(new Date().toISOString().slice(0, 10));
    setStatus("actief");
    setOpmerking("");
    setFormError(null);
  }

  function startEdit(med: MedicatieOverzichtItem) {
    setEditingItem(med);
    setShowForm(true);
    setMedicijnNaam(med.medicijnNaam ?? "");
    setDosering(med.dosering ?? "");
    setFrequentie(med.frequentie ?? "");
    setRoute(med.route ?? "oraal");
    setStartdatum(med.startdatum?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setStatus(med.status ?? "actief");
    setOpmerking(med.opmerking ?? "");
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const url = editingItem?.id
      ? `/api/clients/${clientId}/medicatie-overzicht/${editingItem.id}`
      : `/api/clients/${clientId}/medicatie-overzicht`;
    const method = editingItem?.id ? "PUT" : "POST";

    const { error: err } = await ecdFetch(url, {
      method,
      body: JSON.stringify({
        medicijnNaam,
        dosering,
        frequentie,
        route,
        startdatum,
        status,
        ...(opmerking ? { opmerking } : {}),
      }),
    });
    setSaving(false);
    if (err) {
      setFormError(err);
    } else {
      setShowForm(false);
      setEditingItem(null);
      resetForm();
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet u zeker dat u deze medicatie wilt verwijderen?")) return;
    setDeletingId(id);
    await ecdFetch(`/api/clients/${clientId}/medicatie-overzicht/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-page text-fg";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Medicatieoverzicht</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setEditingItem(null); resetForm(); }}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm && !editingItem ? "Annuleren" : "Medicatie toevoegen"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-default bg-raised p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-fg">{editingItem ? "Medicatie bewerken" : "Nieuwe medicatie"}</h3>
          {formError && <ErrorMsg msg={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Medicijn naam *</label>
              <input type="text" value={medicijnNaam} onChange={(e) => setMedicijnNaam(e.target.value)} required placeholder="bijv. Paracetamol 500mg" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Dosering *</label>
              <input type="text" value={dosering} onChange={(e) => setDosering(e.target.value)} required placeholder="bijv. 2 tabletten" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Frequentie *</label>
              <input type="text" value={frequentie} onChange={(e) => setFrequentie(e.target.value)} required placeholder="bijv. 3x per dag" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Toedieningsweg *</label>
              <select value={route} onChange={(e) => setRoute(e.target.value)} required className={inputCls}>
                {MEDICATIE_ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Startdatum *</label>
              <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Status *</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} required className={inputCls}>
                {MEDICATIE_STATUSSEN.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Opmerking</label>
              <textarea rows={2} value={opmerking} onChange={(e) => setOpmerking(e.target.value)} placeholder="Aanvullende opmerkingen" className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {editingItem && (
              <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); resetForm(); }}
                className="rounded-md border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-page btn-press">
                Annuleren
              </button>
            )}
            <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50">
              {saving ? "Opslaan..." : editingItem ? "Wijzigingen opslaan" : "Medicatie opslaan"}
            </button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Geen medicatie gevonden.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-default bg-raised shadow-sm">
          <table className="min-w-full divide-y divide-default text-sm">
            <thead className="bg-page">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Medicijn</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Dosering</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Frequentie</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Toedieningsweg</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Startdatum</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Status</th>
                <th className="px-4 py-3 text-right font-medium text-fg-muted">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {items.map((med, i) => {
                const isActive = med.status === "actief";
                const isInactive = med.status === "gestopt" || med.status === "afgerond";
                return (
                  <tr key={med.id ?? i} className={isInactive ? "opacity-50" : ""}>
                    <td className="px-4 py-3 font-medium text-fg">
                      {med.medicijnNaam ?? "-"}
                      {med.opmerking && <p className="mt-0.5 text-xs font-normal text-fg-subtle">{med.opmerking}</p>}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{med.dosering ?? "-"}</td>
                    <td className="px-4 py-3 text-fg-muted">{med.frequentie ?? "-"}</td>
                    <td className="px-4 py-3 text-fg-muted capitalize">{med.route ?? "-"}</td>
                    <td className="px-4 py-3 text-fg-muted">{formatDate(med.startdatum)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive ? "bg-green-100 text-green-800" :
                        med.status === "gepauzeerd" ? "bg-yellow-100 text-yellow-800" :
                        "bg-surface-100 dark:bg-surface-800 text-fg-muted"
                      }`}>
                        {MEDICATIE_STATUSSEN.find((s) => s.value === med.status)?.label ?? med.status ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(med)} className="text-sm text-brand-600 hover:text-brand-800 btn-press-sm">
                          Bewerken
                        </button>
                        <button onClick={() => med.id && handleDelete(med.id)} disabled={deletingId === med.id} className="text-sm text-coral-600 hover:text-coral-800 btn-press-sm disabled:opacity-50">
                          {deletingId === med.id ? "..." : "Verwijderen"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


/* -------------------------------------------------------------------------- */
/*  Tab content                                                               */
/* -------------------------------------------------------------------------- */

function MedicatieOverzichtTabInner({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<MedicatieOverzichtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicatieOverzichtItem | null>(null);

  const [medicijnNaam, setMedicijnNaam] = useState("");
  const [dosering, setDosering] = useState("");
  const [frequentie, setFrequentie] = useState("");
  const [route, setRoute] = useState("oraal");
  const [startdatum, setStartdatum] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("actief");
  const [opmerking, setOpmerking] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<{ items?: MedicatieOverzichtItem[] }>(`/api/clients/${clientId}/medicatie-overzicht`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setItems(data?.items ?? []);
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setMedicijnNaam("");
    setDosering("");
    setFrequentie("");
    setRoute("oraal");
    setStartdatum(new Date().toISOString().slice(0, 10));
    setStatus("actief");
    setOpmerking("");
    setFormError(null);
  }

  function startEdit(med: MedicatieOverzichtItem) {
    setEditingItem(med);
    setShowForm(true);
    setMedicijnNaam(med.medicijnNaam ?? "");
    setDosering(med.dosering ?? "");
    setFrequentie(med.frequentie ?? "");
    setRoute(med.route ?? "oraal");
    setStartdatum(med.startdatum?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setStatus(med.status ?? "actief");
    setOpmerking(med.opmerking ?? "");
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const url = editingItem?.id
      ? `/api/clients/${clientId}/medicatie-overzicht/${editingItem.id}`
      : `/api/clients/${clientId}/medicatie-overzicht`;
    const method = editingItem?.id ? "PUT" : "POST";

    const { error: err } = await ecdFetch(url, {
      method,
      body: JSON.stringify({
        medicijnNaam,
        dosering,
        frequentie,
        route,
        startdatum,
        status,
        ...(opmerking ? { opmerking } : {}),
      }),
    });
    setSaving(false);
    if (err) {
      setFormError(err);
    } else {
      setShowForm(false);
      setEditingItem(null);
      resetForm();
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet u zeker dat u deze medicatie wilt verwijderen?")) return;
    setDeletingId(id);
    await ecdFetch(`/api/clients/${clientId}/medicatie-overzicht/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-page text-fg";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Medicatieoverzicht</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setEditingItem(null); resetForm(); }}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm && !editingItem ? "Annuleren" : "Medicatie toevoegen"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-default bg-raised p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-fg">{editingItem ? "Medicatie bewerken" : "Nieuwe medicatie"}</h3>
          {formError && <ErrorMsg msg={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Medicijn naam *</label>
              <input type="text" value={medicijnNaam} onChange={(e) => setMedicijnNaam(e.target.value)} required placeholder="bijv. Paracetamol 500mg" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Dosering *</label>
              <input type="text" value={dosering} onChange={(e) => setDosering(e.target.value)} required placeholder="bijv. 2 tabletten" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Frequentie *</label>
              <input type="text" value={frequentie} onChange={(e) => setFrequentie(e.target.value)} required placeholder="bijv. 3x per dag" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Toedieningsweg *</label>
              <select value={route} onChange={(e) => setRoute(e.target.value)} required className={inputCls}>
                {MEDICATIE_ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Startdatum *</label>
              <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Status *</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} required className={inputCls}>
                {MEDICATIE_STATUSSEN.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Opmerking</label>
              <textarea rows={2} value={opmerking} onChange={(e) => setOpmerking(e.target.value)} placeholder="Aanvullende opmerkingen" className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {editingItem && (
              <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); resetForm(); }}
                className="rounded-md border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-page btn-press">
                Annuleren
              </button>
            )}
            <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50">
              {saving ? "Opslaan..." : editingItem ? "Wijzigingen opslaan" : "Medicatie opslaan"}
            </button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Geen medicatie gevonden.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-default bg-raised shadow-sm">
          <table className="min-w-full divide-y divide-default text-sm">
            <thead className="bg-page">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Medicijn</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Dosering</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Frequentie</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Toedieningsweg</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Startdatum</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Status</th>
                <th className="px-4 py-3 text-right font-medium text-fg-muted">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {items.map((med, i) => {
                const isActive = med.status === "actief";
                const isInactive = med.status === "gestopt" || med.status === "afgerond";
                return (
                  <tr key={med.id ?? i} className={isInactive ? "opacity-50" : ""}>
                    <td className="px-4 py-3 font-medium text-fg">
                      {med.medicijnNaam ?? "-"}
                      {med.opmerking && <p className="mt-0.5 text-xs font-normal text-fg-subtle">{med.opmerking}</p>}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{med.dosering ?? "-"}</td>
                    <td className="px-4 py-3 text-fg-muted">{med.frequentie ?? "-"}</td>
                    <td className="px-4 py-3 text-fg-muted capitalize">{med.route ?? "-"}</td>
                    <td className="px-4 py-3 text-fg-muted">{formatDate(med.startdatum)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive ? "bg-green-100 text-green-800" :
                        med.status === "gepauzeerd" ? "bg-yellow-100 text-yellow-800" :
                        "bg-surface-100 dark:bg-surface-800 text-fg-muted"
                      }`}>
                        {MEDICATIE_STATUSSEN.find((s) => s.value === med.status)?.label ?? med.status ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(med)} className="text-sm text-brand-600 hover:text-brand-800 btn-press-sm">
                          Bewerken
                        </button>
                        <button onClick={() => med.id && handleDelete(med.id)} disabled={deletingId === med.id} className="text-sm text-coral-600 hover:text-coral-800 btn-press-sm disabled:opacity-50">
                          {deletingId === med.id ? "..." : "Verwijderen"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


export default function MedicatieOverzichtPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";
  return <MedicatieOverzichtTabInner clientId={clientId} />;
}

