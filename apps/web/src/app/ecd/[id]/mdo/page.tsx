"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PractitionerPicker } from "../../../../components/PractitionerPicker";
import { ecdFetch } from "../../../../lib/api";

interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface FhirEncounter {
  id?: string;
  status?: string;
  class?: { code?: string; display?: string };
  reasonCode?: Array<{ text?: string }>;
  period?: { start?: string; end?: string };
  participant?: Array<{ individual?: { display?: string }; type?: Array<{ text?: string }> }>;
  extension?: Array<{ url: string; valueString?: string }>;
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

function MdoForm({ clientId, onSaved }: { clientId: string; onSaved: () => void }) {
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [onderwerp, setOnderwerp] = useState("");
  const [deelnemerNaam, setDeelnemerNaam] = useState("");
  const [besluiten, setBesluiten] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deelnemerNaam.trim()) { setError("Voeg minimaal 1 deelnemer toe"); return; }
    setSaving(true);
    setError(null);
    const { error: err } = await ecdFetch(`/api/clients/${clientId}/mdo`, {
      method: "POST",
      body: JSON.stringify({
        datum,
        onderwerp,
        deelnemers: [{ practitionerId: "unknown", naam: deelnemerNaam }],
        status: "planned",
        besluiten: besluiten.trim() || undefined,
      }),
    });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-page text-fg";

  return (
    <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-default bg-raised p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-fg">MDO plannen</h3>
      {error && <ErrorMsg msg={error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Datum *</label>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Deelnemer *</label>
          <PractitionerPicker
            value={deelnemerNaam}
            onChange={(_id, displayName) => setDeelnemerNaam(displayName)}
            placeholder="Zoek een medewerker..."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-fg-muted">Onderwerp *</label>
          <input type="text" value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} required className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-fg-muted">Besluiten / actiepunten</label>
          <textarea rows={3} value={besluiten} onChange={(e) => setBesluiten(e.target.value)} placeholder="Vastleggen van besluiten en actiepunten uit het MDO..." className={inputCls} />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press">
          {saving ? "Opslaan..." : "MDO plannen"}
        </button>
      </div>
    </form>
  );
}

export default function MdoPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirEncounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirEncounter>>(`/api/clients/${clientId}/mdo`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setItems(data?.entry?.map((e) => e.resource) ?? []);
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const statusLabel: Record<string, string> = {
    planned: "Gepland",
    "in-progress": "Bezig",
    finished: "Afgerond",
    cancelled: "Geannuleerd",
  };

  const statusCls: Record<string, string> = {
    planned: "bg-blue-100 text-blue-800",
    "in-progress": "bg-yellow-100 text-yellow-800",
    finished: "bg-green-100 text-green-800",
    cancelled: "bg-surface-100 dark:bg-surface-800 text-fg-muted",
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Multidisciplinair Overleg</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "MDO plannen"}
        </button>
      </div>

      {showForm && (
        <MdoForm clientId={clientId} onSaved={() => { setShowForm(false); load(); }} />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Nog geen MDO&apos;s geregistreerd.</p>
      )}

      <ul className="space-y-3">
        {items.map((enc, i) => {
          const st = enc.status ?? "planned";
          return (
            <li key={enc.id ?? i} className="rounded-lg border border-default bg-raised p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-fg">
                    {enc.reasonCode?.[0]?.text ?? "MDO overleg"}
                  </p>
                  {enc.participant && enc.participant.length > 0 && (
                    <p className="text-sm text-fg-muted">
                      Deelnemers: {enc.participant.map((p) => p.individual?.display).filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-fg-subtle mt-1">
                    {formatDate(enc.period?.start)}
                  </p>
                  {enc.extension?.find((e) => e.url === "https://openzorg.nl/extensions/mdo-besluiten")?.valueString && (
                    <div className="mt-2 rounded border border-brand-100 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/10 px-3 py-2">
                      <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 mb-0.5">Besluiten</p>
                      <p className="text-sm text-fg">{enc.extension?.find((e) => e.url === "https://openzorg.nl/extensions/mdo-besluiten")?.valueString}</p>
                    </div>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[st] ?? "bg-surface-100 dark:bg-surface-800 text-fg-muted"}`}>
                  {statusLabel[st] ?? st}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
