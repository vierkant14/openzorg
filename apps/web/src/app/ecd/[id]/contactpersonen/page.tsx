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

interface FhirRelatedPerson {
  resourceType: "RelatedPerson";
  id?: string;
  name?: Array<{ family?: string; given?: string[] }>;
  telecom?: Array<{ system?: string; value?: string }>;
  relationship?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string }> }>;
}

const RELATIE_TYPES = [
  { code: "FAMMEMB", display: "Familielid" },
  { code: "SPS", display: "Partner/echtgeno(o)t(e)" },
  { code: "CHILD", display: "Kind" },
  { code: "PRN", display: "Ouder" },
  { code: "SIBLING", display: "Broer/zus" },
  { code: "GUARD", display: "Wettelijk vertegenwoordiger" },
  { code: "POWATT", display: "Gemachtigde" },
  { code: "FRND", display: "Vriend(in)" },
  { code: "NBOR", display: "Buur" },
  { code: "O", display: "Overig" },
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

export default function ContactpersonenPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirRelatedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [family, setFamily] = useState("");
  const [given, setGiven] = useState("");
  const [phone, setPhone] = useState("");
  const [relatie, setRelatie] = useState("FAMMEMB");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFamily, setEditFamily] = useState("");
  const [editGiven, setEditGiven] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRelatie, setEditRelatie] = useState("FAMMEMB");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirRelatedPerson>>(
      `/api/clients/${clientId}/contactpersonen`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setItems(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const relatieInfo = RELATIE_TYPES.find((r) => r.code === relatie);
    const body = {
      name: [{ family, given: [given] }],
      telecom: [
        ...(phone ? [{ system: "phone", value: phone }] : []),
        ...(contactEmail ? [{ system: "email", value: contactEmail }] : []),
      ],
      relationship: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              code: relatie,
              display: relatieInfo?.display ?? relatie,
            },
          ],
        },
      ],
    };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/contactpersonen`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setFormError(err);
    } else {
      setShowForm(false);
      setFamily("");
      setGiven("");
      setPhone("");
      setContactEmail("");
      setRelatie("FAMMEMB");
      load();
    }
  }

  function startEdit(rp: FhirRelatedPerson) {
    setEditingId(rp.id ?? null);
    setEditGiven(rp.name?.[0]?.given?.[0] ?? "");
    setEditFamily(rp.name?.[0]?.family ?? "");
    setEditPhone(rp.telecom?.find((t) => t.system === "phone")?.value ?? "");
    setEditEmail(rp.telecom?.find((t) => t.system === "email")?.value ?? "");
    setEditRelatie(rp.relationship?.[0]?.coding?.[0]?.code ?? "FAMMEMB");
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editingId) return;
    setEditSaving(true);
    setEditError(null);

    const relatieInfo = RELATIE_TYPES.find((r) => r.code === editRelatie);
    const body = {
      name: [{ family: editFamily, given: [editGiven] }],
      telecom: [
        ...(editPhone ? [{ system: "phone", value: editPhone }] : []),
        ...(editEmail ? [{ system: "email", value: editEmail }] : []),
      ],
      relationship: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              code: editRelatie,
              display: relatieInfo?.display ?? editRelatie,
            },
          ],
        },
      ],
    };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/contactpersonen/${editingId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    setEditSaving(false);
    if (err) {
      setEditError(err);
    } else {
      setEditingId(null);
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet u zeker dat u deze contactpersoon wilt verwijderen?")) return;
    setDeletingId(id);
    await ecdFetch(`/api/clients/${clientId}/contactpersonen/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Contactpersonen</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Toevoegen"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Voornaam</label>
              <input type="text" value={given} onChange={(e) => setGiven(e.target.value)} required className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Achternaam</label>
              <input type="text" value={family} onChange={(e) => setFamily(e.target.value)} required className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Relatie</label>
              <select value={relatie} onChange={(e) => setRelatie(e.target.value)} className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                {RELATIE_TYPES.map((r) => (
                  <option key={r.code} value={r.code}>{r.display}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Telefoon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">E-mail</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>
          {formError && <p className="mt-2 text-sm text-coral-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">
          Geen contactpersonen gevonden.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-default bg-raised shadow-sm">
        <table className="min-w-full divide-y divide-default text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Naam</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Relatie</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Telefoon</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">E-mail</th>
              <th className="px-4 py-3 text-right font-medium text-fg-muted">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {items.map((rp, i) => {
              const isEditing = rp.id === editingId;
              if (isEditing) {
                return (
                  <tr key={rp.id ?? i}>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <input type="text" value={editGiven} onChange={(e) => setEditGiven(e.target.value)} placeholder="Voornaam" className="w-24 rounded-md border border-default px-2 py-1 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                        <input type="text" value={editFamily} onChange={(e) => setEditFamily(e.target.value)} placeholder="Achternaam" className="w-24 rounded-md border border-default px-2 py-1 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select value={editRelatie} onChange={(e) => setEditRelatie(e.target.value)} className="rounded-md border border-default px-2 py-1 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                        {RELATIE_TYPES.map((r) => <option key={r.code} value={r.code}>{r.display}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Telefoon" className="w-32 rounded-md border border-default px-2 py-1 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="E-mail" className="w-40 rounded-md border border-default px-2 py-1 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleEditSave} disabled={editSaving} className="rounded-md bg-brand-700 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press">
                          {editSaving ? "..." : "Opslaan"}
                        </button>
                        <button onClick={() => setEditingId(null)} className="rounded-md border border-default px-3 py-1 text-xs font-medium text-fg-muted hover:bg-page btn-press">
                          Annuleren
                        </button>
                      </div>
                      {editError && <p className="mt-1 text-xs text-coral-600">{editError}</p>}
                    </td>
                  </tr>
                );
              }

              const naam = [rp.name?.[0]?.given?.[0], rp.name?.[0]?.family]
                .filter(Boolean)
                .join(" ");
              const telefoon = rp.telecom?.find((t) => t.system === "phone")?.value;
              const email = rp.telecom?.find((t) => t.system === "email")?.value;
              return (
                <tr key={rp.id ?? i}>
                  <td className="px-4 py-3 text-fg">{naam || "-"}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {rp.relationship?.[0]?.coding?.[0]?.display ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{telefoon ?? "-"}</td>
                  <td className="px-4 py-3 text-fg-muted">{email ?? "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(rp)} className="text-sm text-brand-600 hover:text-brand-800 btn-press-sm">
                        Bewerken
                      </button>
                      <button onClick={() => rp.id && handleDelete(rp.id)} disabled={deletingId === rp.id} className="text-sm text-coral-600 hover:text-coral-800 btn-press-sm disabled:opacity-50">
                        {deletingId === rp.id ? "..." : "Verwijderen"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
