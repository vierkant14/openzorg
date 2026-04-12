"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { planningFetch } from "../../../lib/planning-api";

/* -------------------------------------------------------------------------- */
/*  FHIR types                                                                */
/* -------------------------------------------------------------------------- */

interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
  intent?: string;
  priority?: string;
  subject?: { reference?: string; display?: string };
  code?: { text?: string; coding?: Array<{ display?: string }> };
  note?: Array<{ text?: string }>;
  authoredOn?: string;
  meta?: { lastUpdated?: string };
}

interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

type Prioriteit = "urgent" | "asap" | "routine";

const PRIORITEIT_CONFIG: Record<Prioriteit, { label: string; kleur: string; sortOrder: number }> = {
  urgent: { label: "Urgent", kleur: "bg-red-100 text-red-800 border-coral-200", sortOrder: 0 },
  asap: { label: "Normaal", kleur: "bg-yellow-100 text-yellow-800 border-yellow-200", sortOrder: 1 },
  routine: { label: "Laag", kleur: "bg-gray-100 text-fg-muted border-default", sortOrder: 2 },
};

function getPrioriteit(sr: FhirServiceRequest): Prioriteit {
  const p = sr.priority;
  if (p === "urgent" || p === "stat") return "urgent";
  if (p === "asap") return "asap";
  return "routine";
}

function berekenWachttijd(authoredOn?: string): { dagen: number; label: string } {
  if (!authoredOn) return { dagen: 0, label: "-" };
  const start = new Date(authoredOn);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  const dagen = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (dagen === 0) return { dagen: 0, label: "Vandaag" };
  if (dagen === 1) return { dagen: 1, label: "1 dag" };
  return { dagen, label: `${dagen} dagen` };
}

function formatDatum(iso?: string): string {
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

function clientNaam(sr: FhirServiceRequest): string {
  return sr.subject?.display ?? sr.subject?.reference ?? "Onbekend";
}

function getReden(sr: FhirServiceRequest): string {
  return sr.code?.text ?? sr.code?.coding?.[0]?.display ?? sr.note?.[0]?.text ?? "-";
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                            */
/* -------------------------------------------------------------------------- */

export default function WachtlijstPage() {
  const [entries, setEntries] = useState<FhirServiceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formClientNaam, setFormClientNaam] = useState("");
  const [formClientRef, setFormClientRef] = useState("");
  const [formReden, setFormReden] = useState("");
  const [formPrioriteit, setFormPrioriteit] = useState<Prioriteit>("routine");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Inplannen modal state
  const [inplannenId, setInplannenId] = useState<string | null>(null);
  const [inplannenStart, setInplannenStart] = useState("");
  const [inplannenEnd, setInplannenEnd] = useState("");
  const [inplannenPractitioner, setInplannenPractitioner] = useState("");
  const [inplannenError, setInplannenError] = useState<string | null>(null);
  const [inplannenSubmitting, setInplannenSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrioriteit, setEditPrioriteit] = useState<Prioriteit>("routine");
  const [editReden, setEditReden] = useState("");
  const [editNotitie, setEditNotitie] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchEntries = useCallback(() => {
    setLoading(true);
    planningFetch<FhirBundle<FhirServiceRequest>>("/api/wachtlijst").then((res) => {
      if (res.error) {
        setError(res.error);
        setEntries([]);
      } else {
        const items = res.data?.entry?.map((e) => e.resource) ?? [];
        // Sort by priority then by date
        items.sort((a, b) => {
          const prioA = PRIORITEIT_CONFIG[getPrioriteit(a)].sortOrder;
          const prioB = PRIORITEIT_CONFIG[getPrioriteit(b)].sortOrder;
          if (prioA !== prioB) return prioA - prioB;
          const dateA = a.authoredOn ? new Date(a.authoredOn).getTime() : 0;
          const dateB = b.authoredOn ? new Date(b.authoredOn).getTime() : 0;
          return dateA - dateB;
        });
        setEntries(items);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formClientNaam.trim() || !formClientRef.trim()) {
      setFormError("Clientnaam en referentie zijn verplicht.");
      return;
    }

    setSubmitting(true);

    const resource: Record<string, unknown> = {
      resourceType: "ServiceRequest",
      status: "draft",
      intent: "plan",
      priority: formPrioriteit,
      subject: {
        reference: formClientRef.trim(),
        display: formClientNaam.trim(),
      },
      authoredOn: new Date().toISOString(),
    };

    if (formReden.trim()) {
      resource["code"] = { text: formReden.trim() };
      resource["note"] = [{ text: formReden.trim() }];
    }

    const res = await planningFetch("/api/wachtlijst", {
      method: "POST",
      body: JSON.stringify(resource),
    });

    if (res.error) {
      setFormError(res.error);
    } else {
      setFormClientNaam("");
      setFormClientRef("");
      setFormReden("");
      setFormPrioriteit("routine");
      setShowForm(false);
      fetchEntries();
    }
    setSubmitting(false);
  }

  async function handleInplannen(e: React.FormEvent) {
    e.preventDefault();
    if (!inplannenId) return;

    setInplannenError(null);

    if (!inplannenStart || !inplannenEnd || !inplannenPractitioner.trim()) {
      setInplannenError("Alle velden zijn verplicht.");
      return;
    }

    setInplannenSubmitting(true);

    const entry = entries.find((sr) => sr.id === inplannenId);
    const patientRef = entry?.subject?.reference ?? "";

    const appointment: Record<string, unknown> = {
      status: "booked",
      start: new Date(inplannenStart).toISOString(),
      end: new Date(inplannenEnd).toISOString(),
      participant: [
        {
          actor: { reference: patientRef, display: entry?.subject?.display },
          status: "accepted",
        },
        {
          actor: { reference: `Practitioner/${inplannenPractitioner.trim()}` },
          status: "accepted",
        },
      ],
    };

    const res = await planningFetch(`/api/wachtlijst/${inplannenId}/inplannen`, {
      method: "PUT",
      body: JSON.stringify({ appointment }),
    });

    if (res.error) {
      setInplannenError(res.error);
    } else {
      setInplannenId(null);
      setInplannenStart("");
      setInplannenEnd("");
      setInplannenPractitioner("");
      fetchEntries();
    }
    setInplannenSubmitting(false);
  }

  function openEdit(entry: FhirServiceRequest) {
    setEditingId(entry.id ?? null);
    setEditPrioriteit(getPrioriteit(entry));
    setEditReden(entry.code?.text ?? entry.code?.coding?.[0]?.display ?? "");
    setEditNotitie(entry.note?.[0]?.text ?? "");
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    setEditSubmitting(true);

    const body: Record<string, unknown> = {
      priority: editPrioriteit,
      code: { text: editReden.trim() || undefined },
      note: editNotitie.trim() ? [{ text: editNotitie.trim() }] : [],
    };

    const res = await planningFetch(`/api/wachtlijst/${editingId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (res.error) {
      setEditError(res.error);
    } else {
      setEditingId(null);
      fetchEntries();
    }
    setEditSubmitting(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteSubmitting(true);

    const res = await planningFetch(`/api/wachtlijst/${deleteId}`, {
      method: "DELETE",
    });

    if (res.error) {
      setError(res.error);
    } else {
      setDeleteId(null);
      fetchEntries();
    }
    setDeleteSubmitting(false);
  }

  function openInplannen(id: string) {
    setInplannenId(id);
    setInplannenError(null);
    // Default: tomorrow 09:00 - 10:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setInplannenStart(tomorrow.toISOString().slice(0, 16));
    const end = new Date(tomorrow);
    end.setHours(10);
    setInplannenEnd(end.toISOString().slice(0, 16));
  }

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-fg">Wachtlijst</h2>
            {!loading && (
              <p className="text-sm text-fg-subtle mt-1">
                {entries.length} {entries.length === 1 ? "registratie" : "registraties"}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700 text-sm font-medium"
          >
            {showForm ? "Annuleren" : "Toevoegen"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="bg-raised rounded-lg border p-6 mb-6 space-y-4"
          >
            <h3 className="font-semibold text-fg-muted">
              Nieuwe wachtlijst-registratie
            </h3>

            {formError && (
              <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-3 text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="wl-naam" className="block text-sm font-medium text-fg-muted mb-1">
                  Clientnaam
                </label>
                <input
                  id="wl-naam"
                  type="text"
                  value={formClientNaam}
                  onChange={(e) => setFormClientNaam(e.target.value)}
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="wl-ref" className="block text-sm font-medium text-fg-muted mb-1">
                  Client referentie
                </label>
                <input
                  id="wl-ref"
                  type="text"
                  placeholder="Patient/uuid"
                  value={formClientRef}
                  onChange={(e) => setFormClientRef(e.target.value)}
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="wl-reden" className="block text-sm font-medium text-fg-muted mb-1">
                  Reden
                </label>
                <textarea
                  id="wl-reden"
                  value={formReden}
                  onChange={(e) => setFormReden(e.target.value)}
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="wl-prio" className="block text-sm font-medium text-fg-muted mb-1">
                  Prioriteit
                </label>
                <select
                  id="wl-prio"
                  value={formPrioriteit}
                  onChange={(e) => setFormPrioriteit(e.target.value as Prioriteit)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="urgent">Urgent</option>
                  <option value="asap">Normaal</option>
                  <option value="routine">Laag</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Toevoegen..." : "Toevoegen aan wachtlijst"}
            </button>
          </form>
        )}

        {error && (
          <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-fg-subtle text-sm">Geen wachtlijst-registraties gevonden.</p>
        ) : (
          <div className="bg-raised rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-default">
              <thead className="bg-page">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Prioriteit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Aanmelddatum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Wachttijd
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Reden
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {entries.map((entry) => {
                  const prio = getPrioriteit(entry);
                  const config = PRIORITEIT_CONFIG[prio];
                  const wacht = berekenWachttijd(entry.authoredOn);
                  const isLangWachtend = wacht.dagen > 14;

                  return (
                    <tr key={entry.id} className="hover:bg-sunken">
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.kleur}`}
                        >
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-fg font-medium">
                        {clientNaam(entry)}
                      </td>
                      <td className="px-4 py-3 text-sm text-fg">
                        {formatDatum(entry.authoredOn)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={isLangWachtend ? "font-semibold text-coral-600" : "text-fg"}>
                          {wacht.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-fg">
                        {getReden(entry)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => entry.id && openInplannen(entry.id)}
                            className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
                          >
                            Omzetten naar afspraak
                          </button>
                          <button
                            onClick={() => openEdit(entry)}
                            className="text-brand-600 hover:text-brand-800 text-xs font-medium btn-press"
                          >
                            Bewerken
                          </button>
                          <button
                            onClick={() => setDeleteId(entry.id ?? null)}
                            className="text-coral-600 hover:text-coral-800 text-xs font-medium btn-press"
                          >
                            Verwijderen
                          </button>
                          <Link
                            href={`/planning/nieuw?client=${encodeURIComponent(entry.subject?.reference ?? "")}`}
                            className="text-brand-600 hover:text-brand-800 text-xs font-medium"
                          >
                            Inplannen
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bewerken modal */}
        {editingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-lg bg-raised p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-fg mb-4">
                Wachtlijst-registratie bewerken
              </h3>

              <p className="text-sm text-fg-muted mb-4">
                Client:{" "}
                <span className="font-medium">
                  {clientNaam(entries.find((e) => e.id === editingId) ?? {} as FhirServiceRequest)}
                </span>
              </p>

              <form onSubmit={handleEdit} className="space-y-4">
                {editError && (
                  <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-3 text-sm">
                    {editError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Prioriteit
                  </label>
                  <select
                    value={editPrioriteit}
                    onChange={(e) => setEditPrioriteit(e.target.value as Prioriteit)}
                    className="w-full border border-default rounded px-3 py-2 text-sm"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="asap">Normaal</option>
                    <option value="routine">Laag</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Reden
                  </label>
                  <input
                    type="text"
                    value={editReden}
                    onChange={(e) => setEditReden(e.target.value)}
                    className="w-full border border-default rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Notitie
                  </label>
                  <textarea
                    value={editNotitie}
                    onChange={(e) => setEditNotitie(e.target.value)}
                    rows={3}
                    className="w-full border border-default rounded px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 text-sm font-medium text-fg-muted border border-default rounded hover:bg-sunken btn-press"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press disabled:opacity-50"
                  >
                    {editSubmitting ? "Opslaan..." : "Opslaan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Verwijderen bevestiging */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-lg bg-raised p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-fg mb-2">
                Verwijderen bevestigen
              </h3>
              <p className="text-sm text-fg-muted mb-6">
                Weet u zeker dat u de wachtlijst-registratie van{" "}
                <span className="font-medium">
                  {clientNaam(entries.find((e) => e.id === deleteId) ?? {} as FhirServiceRequest)}
                </span>{" "}
                wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 text-sm font-medium text-fg-muted border border-default rounded hover:bg-sunken btn-press"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteSubmitting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 btn-press disabled:opacity-50"
                >
                  {deleteSubmitting ? "Verwijderen..." : "Verwijderen"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inplannen modal */}
        {inplannenId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-lg bg-raised p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-fg mb-4">
                Omzetten naar afspraak
              </h3>

              <p className="text-sm text-fg-muted mb-4">
                Client: <span className="font-medium">{clientNaam(entries.find((e) => e.id === inplannenId) ?? {} as FhirServiceRequest)}</span>
              </p>

              <form onSubmit={handleInplannen} className="space-y-4">
                {inplannenError && (
                  <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-3 text-sm">
                    {inplannenError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Starttijd
                  </label>
                  <input
                    type="datetime-local"
                    value={inplannenStart}
                    onChange={(e) => setInplannenStart(e.target.value)}
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Eindtijd
                  </label>
                  <input
                    type="datetime-local"
                    value={inplannenEnd}
                    onChange={(e) => setInplannenEnd(e.target.value)}
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Medewerker ID
                  </label>
                  <input
                    type="text"
                    value={inplannenPractitioner}
                    onChange={(e) => setInplannenPractitioner(e.target.value)}
                    placeholder="Practitioner UUID"
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setInplannenId(null)}
                    className="px-4 py-2 text-sm font-medium text-fg-muted border rounded hover:bg-sunken"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={inplannenSubmitting}
                    className="bg-brand-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {inplannenSubmitting ? "Inplannen..." : "Afspraak aanmaken"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
