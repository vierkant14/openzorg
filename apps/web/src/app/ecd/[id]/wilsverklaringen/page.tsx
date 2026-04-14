"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ecdFetch } from "../../../../lib/api";

/* -------------------------------------------------------------------------- */
/*  Gededupliceerd van monolith tijdens Plan 2A Task 4 migratie               */
/* -------------------------------------------------------------------------- */

const WILSVERKLARING_TYPES = [
  "Behandelverbod",
  "Euthanasieverklaring",
  "Volmacht",
  "Levenswensverklaring",
  "Donorcodicil",
  "BOPZ Mentorschap",
  "BOPZ Curatele",
  "BOPZ Beschermingsbewind",
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


function wilsverklaringBadgeCls(type?: string): string {
  if (type?.startsWith("BOPZ")) return "bg-coral-50 text-coral-700";
  if (type === "Euthanasieverklaring" || type === "Behandelverbod") return "bg-blue-100 text-blue-800";
  return "bg-green-100 text-green-800";
}


interface WilsverklaringItem {
  id?: string;
  type?: string;
  beschrijving?: string;
  datum?: string;
  geldigTot?: string;
  vertegenwoordiger?: string;
  opmerking?: string;
}

const WILSVERKLARING_TYPES = [
  "Behandelverbod",
  "Euthanasieverklaring",
  "Volmacht",
  "Levenswensverklaring",
  "Donorcodicil",
  "BOPZ Mentorschap",
  "BOPZ Curatele",
  "BOPZ Beschermingsbewind",
];

function wilsverklaringBadgeCls(type?: string): string {
  if (type?.startsWith("BOPZ")) return "bg-coral-50 text-coral-700";
  if (type === "Euthanasieverklaring" || type === "Behandelverbod") return "bg-blue-100 text-blue-800";
  return "bg-green-100 text-green-800";
}


/* -------------------------------------------------------------------------- */
/*  Tab content                                                               */
/* -------------------------------------------------------------------------- */

function WilsverklaringenTabInner({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<WilsverklaringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [type, setType] = useState(WILSVERKLARING_TYPES[0]!);
  const [beschrijving, setBeschrijving] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [geldigTot, setGeldigTot] = useState("");
  const [vertegenwoordiger, setVertegenwoordiger] = useState("");
  const [opmerking, setOpmerking] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<{ items?: WilsverklaringItem[] }>(`/api/clients/${clientId}/wilsverklaringen`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setItems(data?.items ?? []);
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const { error: err } = await ecdFetch(`/api/clients/${clientId}/wilsverklaringen`, {
      method: "POST",
      body: JSON.stringify({
        type,
        beschrijving,
        datum,
        ...(geldigTot ? { geldigTot } : {}),
        ...(vertegenwoordiger ? { vertegenwoordiger } : {}),
        ...(opmerking ? { opmerking } : {}),
      }),
    });
    setSaving(false);
    if (err) {
      setFormError(err);
    } else {
      setShowForm(false);
      setBeschrijving("");
      setGeldigTot("");
      setVertegenwoordiger("");
      setOpmerking("");
      load();
    }
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-page text-fg";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Wilsverklaringen</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Wilsverklaring toevoegen"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-default bg-raised p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-fg">Nieuwe wilsverklaring</h3>
          {formError && <ErrorMsg msg={formError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} required className={inputCls}>
                {WILSVERKLARING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Datum *</label>
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Beschrijving *</label>
              <textarea rows={3} value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} required placeholder="Omschrijving van de wilsverklaring" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Geldig tot</label>
              <input type="date" value={geldigTot} onChange={(e) => setGeldigTot(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Vertegenwoordiger</label>
              <input type="text" value={vertegenwoordiger} onChange={(e) => setVertegenwoordiger(e.target.value)} placeholder="Naam vertegenwoordiger" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Opmerking</label>
              <textarea rows={2} value={opmerking} onChange={(e) => setOpmerking(e.target.value)} placeholder="Aanvullende opmerkingen" className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50">
              {saving ? "Opslaan..." : "Wilsverklaring opslaan"}
            </button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Geen wilsverklaringen gevonden.</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((wv, i) => (
            <li key={wv.id ?? i} className="rounded-lg border border-default bg-raised p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${wilsverklaringBadgeCls(wv.type)}`}>
                      {wv.type ?? "-"}
                    </span>
                  </div>
                  <p className="text-sm text-fg">{wv.beschrijving ?? "-"}</p>
                  {wv.vertegenwoordiger && (
                    <p className="mt-1 text-xs text-fg-muted">Vertegenwoordiger: {wv.vertegenwoordiger}</p>
                  )}
                  {wv.opmerking && (
                    <p className="mt-1 text-xs text-fg-subtle">{wv.opmerking}</p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-fg-subtle">
                  <p>Datum: {formatDate(wv.datum)}</p>
                  {wv.geldigTot && <p>Geldig tot: {formatDate(wv.geldigTot)}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


export default function WilsverklaringenPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";
  return <WilsverklaringenTabInner clientId={clientId} />;
}

