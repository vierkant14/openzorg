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

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

interface FhirMedicationAdministration {
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string; coding?: Array<{ display?: string }> };
  effectiveDateTime?: string;
  dosage?: { text?: string; dose?: { value?: number; unit?: string } };
  performer?: Array<{ actor?: { display?: string } }>;
  note?: Array<{ text?: string }>;
  extension?: Array<{ url?: string; valueString?: string }>;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

function ToedieningForm({
  clientId,
  medicatieList,
  onSaved,
}: {
  clientId: string;
  medicatieList: FhirMedicationRequest[];
  onSaved: () => void;
}) {
  const [medicatieRequestId, setMedicatieRequestId] = useState("");
  const [status, setStatus] = useState<"completed" | "not-done">("completed");
  const [reden, setReden] = useState("");
  const [toedieningsdatum, setToedieningsdatum] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await ecdFetch(`/api/clients/${clientId}/toediening`, {
      method: "POST",
      body: JSON.stringify({
        medicatieRequestId: medicatieRequestId || undefined,
        status,
        reden: reden || undefined,
        toedieningsdatum,
      }),
    });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-page text-fg";

  return (
    <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-default bg-raised p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-fg">Toediening registreren</h3>
      {error && <ErrorMsg msg={error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Medicament</label>
          <select value={medicatieRequestId} onChange={(e) => setMedicatieRequestId(e.target.value)} className={inputCls}>
            <option value="">— Kies uit actieve medicatie —</option>
            {medicatieList.map((m) => (
              <option key={m.id} value={m.id ?? ""}>
                {m.medicationCodeableConcept?.text ?? m.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Datum & tijd</label>
          <input type="datetime-local" value={toedieningsdatum} onChange={(e) => setToedieningsdatum(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as "completed" | "not-done")} className={inputCls}>
            <option value="completed">Toegediend</option>
            <option value="not-done">Niet gegeven</option>
          </select>
        </div>

        {status === "not-done" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-fg-muted">Reden niet gegeven</label>
            <input type="text" value={reden} onChange={(e) => setReden(e.target.value)} className={inputCls} placeholder="bijv. client weigert" />
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50">
          {saving ? "Opslaan..." : "Registreren"}
        </button>
      </div>
    </form>
  );
}

export default function ToedieningPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirMedicationAdministration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [medicatieList, setMedicatieList] = useState<FhirMedicationRequest[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirMedicationAdministration>>(
      `/api/clients/${clientId}/toediening`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setItems(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
    ecdFetch<FhirBundle<FhirMedicationRequest>>(
      `/api/clients/${clientId}/medicatie`,
    ).then(({ data }) => {
      setMedicatieList(data?.entry?.map((e) => e.resource) ?? []);
    });
  }, [clientId, load]);

  const statusLabel: Record<string, string> = {
    completed: "Toegediend",
    "not-done": "Niet gegeven",
    "in-progress": "Bezig",
  };

  const statusCls: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    "not-done": "bg-coral-50 text-coral-700",
    "in-progress": "bg-blue-100 text-blue-800",
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Toedienregistratie</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Registreer toediening"}
        </button>
      </div>

      {showForm && (
        <ToedieningForm
          clientId={clientId}
          medicatieList={medicatieList}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Nog geen toedienregistraties.</p>
      )}

      <ul className="space-y-3">
        {items.map((item, i) => {
          const st = item.status ?? "completed";
          return (
            <li key={item.id ?? i} className="rounded-lg border border-default bg-raised p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-fg">
                    {item.medicationCodeableConcept?.text ??
                      item.medicationCodeableConcept?.coding?.[0]?.display ??
                      "Onbekend medicament"}
                  </p>
                  {item.dosage?.text && (
                    <p className="text-sm text-fg-muted">{item.dosage.text}</p>
                  )}
                  {item.performer?.[0]?.actor?.display && (
                    <p className="text-xs text-fg-subtle">
                      Door: {item.performer[0].actor.display}
                    </p>
                  )}
                  {item.note?.[0]?.text && (
                    <p className="mt-1 text-sm text-fg-muted italic">{item.note[0].text}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[st] ?? "bg-surface-100 dark:bg-surface-800 text-fg-muted"}`}>
                    {statusLabel[st] ?? st}
                  </span>
                  <p className="mt-1 text-xs text-fg-subtle">{formatDateTime(item.effectiveDateTime)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
