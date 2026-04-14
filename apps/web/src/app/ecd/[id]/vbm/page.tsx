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

interface FhirProcedure {
  id?: string;
  status?: string;
  code?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  performedPeriod?: { start?: string; end?: string };
  reasonCode?: Array<{ text?: string }>;
  performer?: Array<{ actor?: { display?: string } }>;
  note?: Array<{ text?: string }>;
  extension?: Array<{ url?: string; extension?: Array<{ url?: string; valueCoding?: { display?: string } }> }>;
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

function VbmForm({ clientId, onSaved }: { clientId: string; onSaved: () => void }) {
  const [maatregelType, setMaatregelType] = useState("");
  const [grondslag, setGrondslag] = useState("");
  const [reden, setReden] = useState("");
  const [startdatum, setStartdatum] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAATREGEL_TYPES = [
    { code: "fixatie", display: "Fixatie" },
    { code: "afzondering", display: "Afzondering" },
    { code: "separatie", display: "Separatie" },
    { code: "medicatie-onvrijwillig", display: "Onvrijwillige medicatie" },
    { code: "bewegingsbeperking", display: "Bewegingsbeperking" },
    { code: "toezicht", display: "Continu toezicht" },
    { code: "beperking-communicatie", display: "Beperking communicatiemiddelen" },
    { code: "beperking-bezoek", display: "Beperking bezoek" },
    { code: "deur-op-slot", display: "Deur op slot (individueel)" },
    { code: "gesloten-afdeling", display: "Gesloten afdeling" },
    { code: "camerabewaking", display: "Camerabewaking" },
    { code: "sensor", display: "Sensortechnologie" },
  ];

  const GRONDSLAGEN = [
    { code: "wvggz", display: "Wvggz" },
    { code: "wzd", display: "Wzd" },
    { code: "wmo", display: "Wmo" },
    { code: "instemming", display: "Met instemming" },
    { code: "noodsituatie", display: "Noodsituatie" },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await ecdFetch(`/api/clients/${clientId}/vbm`, {
      method: "POST",
      body: JSON.stringify({ maatregelType, grondslag, reden, startdatum }),
    });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-page text-fg";

  return (
    <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-default bg-raised p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-fg">VBM registreren</h3>
      {error && <ErrorMsg msg={error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Type maatregel *</label>
          <select value={maatregelType} onChange={(e) => setMaatregelType(e.target.value)} required className={inputCls}>
            <option value="">— Kies type —</option>
            {MAATREGEL_TYPES.map((m) => <option key={m.code} value={m.code}>{m.display}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Grondslag *</label>
          <select value={grondslag} onChange={(e) => setGrondslag(e.target.value)} required className={inputCls}>
            <option value="">— Kies grondslag —</option>
            {GRONDSLAGEN.map((g) => <option key={g.code} value={g.code}>{g.display}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Startdatum *</label>
          <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} required className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-fg-muted">Reden / toelichting *</label>
          <textarea value={reden} onChange={(e) => setReden(e.target.value)} required rows={2} className={inputCls} />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50">
          {saving ? "Opslaan..." : "Maatregel opslaan"}
        </button>
      </div>
    </form>
  );
}

export default function VbmPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirProcedure>>(`/api/clients/${clientId}/vbm`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setItems(data?.entry?.map((e) => e.resource) ?? []);
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const statusCls: Record<string, string> = {
    "in-progress": "bg-coral-50 text-coral-700",
    completed: "bg-green-100 text-green-800",
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Vrijheidsbeperkende Maatregelen</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Maatregel registreren"}
        </button>
      </div>

      {showForm && (
        <VbmForm clientId={clientId} onSaved={() => { setShowForm(false); load(); }} />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Geen vrijheidsbeperkende maatregelen geregistreerd.</p>
      )}

      <ul className="space-y-3">
        {items.map((proc, i) => {
          const st = proc.status ?? "in-progress";
          const grondslagExt = proc.extension
            ?.find((e) => e.url === "https://openzorg.nl/extensions/vbm")
            ?.extension?.find((e) => e.url === "grondslag");
          return (
            <li key={proc.id ?? i} className="rounded-lg border border-default bg-raised p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-fg">
                    {proc.code?.coding?.[0]?.display ?? proc.code?.text ?? "Maatregel"}
                  </p>
                  {proc.reasonCode?.[0]?.text && (
                    <p className="text-sm text-fg-muted">Reden: {proc.reasonCode[0].text}</p>
                  )}
                  {grondslagExt?.valueCoding?.display && (
                    <p className="text-xs text-fg-subtle">Grondslag: {grondslagExt.valueCoding.display}</p>
                  )}
                  <p className="text-xs text-fg-subtle mt-1">
                    Van: {formatDate(proc.performedPeriod?.start)}
                    {proc.performedPeriod?.end ? ` t/m ${formatDate(proc.performedPeriod.end)}` : " (actief)"}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[st] ?? "bg-surface-100 dark:bg-surface-800 text-fg-muted"}`}>
                  {st === "in-progress" ? "Actief" : "Beëindigd"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
