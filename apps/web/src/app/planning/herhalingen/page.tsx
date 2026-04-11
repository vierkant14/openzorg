"use client";

import { useEffect, useState, type FormEvent } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { planningFetch } from "../../../lib/planning-api";

/* ---------- Types ---------- */

interface Practitioner {
  id: string;
  naam: string;
}

interface Client {
  id: string;
  naam: string;
}

interface FhirBundle<T> {
  resourceType: "Bundle";
  entry?: Array<{ resource: T }>;
}

interface FhirName {
  family?: string;
  given?: string[];
}

interface FhirResource {
  id?: string;
  name?: FhirName[];
}

interface HerhalingResult {
  total: number;
  created: number;
  errors: string[];
  appointments: Array<{ id: string; start: string; end: string }>;
}

const DAYS = [
  { code: "MO", label: "Ma" },
  { code: "TU", label: "Di" },
  { code: "WE", label: "Wo" },
  { code: "TH", label: "Do" },
  { code: "FR", label: "Vr" },
  { code: "SA", label: "Za" },
  { code: "SU", label: "Zo" },
];

const APPOINTMENT_TYPES = ["Huisbezoek", "Telefonisch", "Kantoor", "Groepssessie"];

/* ---------- Component ---------- */

export default function HerhalingenPage() {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Form state
  const [clientId, setClientId] = useState("");
  const [practitionerId, setPractitionerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [appointmentType, setAppointmentType] = useState("Huisbezoek");
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY">("WEEKLY");
  const [selectedDays, setSelectedDays] = useState<string[]>(["MO"]);
  const [endType, setEndType] = useState<"count" | "until">("count");
  const [count, setCount] = useState(10);
  const [untilDate, setUntilDate] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HerhalingResult | null>(null);

  useEffect(() => {
    ecdFetch<FhirBundle<FhirResource>>("/api/medewerkers?_count=100").then(({ data }) => {
      const items: Practitioner[] = (data?.entry ?? []).map((e) => {
        const n = e.resource.name?.[0];
        const naam = [n?.given?.[0], n?.family].filter(Boolean).join(" ") || "Onbekend";
        return { id: e.resource.id ?? "", naam };
      }).filter((p) => p.id);
      setPractitioners(items);
    });
    ecdFetch<FhirBundle<FhirResource>>("/api/clients?_count=200").then(({ data }) => {
      const items: Client[] = (data?.entry ?? []).map((e) => {
        const n = e.resource.name?.[0];
        const naam = [n?.given?.[0], n?.family].filter(Boolean).join(" ") || "Onbekend";
        return { id: e.resource.id ?? "", naam };
      }).filter((c) => c.id);
      setClients(items);
    });
  }, []);

  function toggleDay(code: string) {
    setSelectedDays((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code],
    );
  }

  function buildRRule(): string {
    let rule = `FREQ=${frequency}`;
    if (frequency === "WEEKLY" && selectedDays.length > 0) {
      rule += `;BYDAY=${selectedDays.join(",")}`;
    }
    if (endType === "count") {
      rule += `;COUNT=${count}`;
    } else if (untilDate) {
      rule += `;UNTIL=${untilDate.replace(/-/g, "")}T235959Z`;
    }
    return rule;
  }

  function previewDates(): string[] {
    if (!startDate) return [];
    const dates: string[] = [];
    const start = new Date(startDate);
    const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const maxCount = endType === "count" ? count : 52;
    const until = endType === "until" && untilDate ? new Date(untilDate) : null;

    if (frequency === "DAILY") {
      const d = new Date(start);
      for (let i = 0; i < maxCount && i < 365; i++) {
        if (until && d > until) break;
        dates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    } else {
      const d = new Date(start);
      let generated = 0;
      for (let iter = 0; iter < 365 && generated < maxCount; iter++) {
        if (until && d > until) break;
        const dayCode = Object.entries(dayMap).find(([, v]) => v === d.getDay())?.[0];
        if (dayCode && selectedDays.includes(dayCode)) {
          dates.push(d.toISOString().slice(0, 10));
          generated++;
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return dates;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !practitionerId || !startDate) return;

    setSaving(true);
    setError(null);
    setResult(null);

    const rrule = buildRRule();
    const startDateTime = `${startDate}T${startTime}:00`;
    const endDateTime = `${startDate}T${endTime}:00`;

    const { data, error: err } = await planningFetch<HerhalingResult>("/api/herhalingen", {
      method: "POST",
      body: JSON.stringify({
        rrule,
        appointment: {
          resourceType: "Appointment",
          status: "booked",
          appointmentType: { text: appointmentType },
          start: startDateTime,
          end: endDateTime,
          description: description || undefined,
          participant: [
            { actor: { reference: `Patient/${clientId}` }, status: "accepted" },
            { actor: { reference: `Practitioner/${practitionerId}` }, status: "accepted" },
          ],
        },
      }),
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else if (data) {
      setResult(data);
    }
  }

  const preview = previewDates();
  const inputClass = "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-display-lg text-fg">Terugkerende afspraken</h1>
          <p className="text-body text-fg-muted mt-1">
            Plan een reeks afspraken in op basis van een herhalingspatroon.
          </p>
        </div>

        {error && (
          <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-brand-50 border border-brand-200 text-brand-700 rounded-lg p-4 text-sm">
            <p className="font-medium">{result.created} van {result.total} afspraken aangemaakt.</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-4">
                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-raised rounded-lg border p-6 space-y-6">
          {/* Client & Medewerker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Client</label>
              <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                <option value="">Selecteer client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Medewerker</label>
              <select required value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} className={inputClass}>
                <option value="">Selecteer medewerker...</option>
                {practitioners.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
              </select>
            </div>
          </div>

          {/* Datum & Tijd */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Startdatum</label>
              <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Starttijd</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Eindtijd</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Type & Beschrijving */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Type afspraak</label>
              <select value={appointmentType} onChange={(e) => setAppointmentType(e.target.value)} className={inputClass}>
                {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Beschrijving (optioneel)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="bijv. Wondverzorging" className={inputClass} />
            </div>
          </div>

          {/* Herhaling configuratie */}
          <fieldset className="border border-subtle rounded-lg p-4 space-y-4">
            <legend className="text-sm font-semibold text-fg px-2">Herhalingspatroon</legend>

            <div className="flex items-center gap-4">
              <label className="block text-sm font-medium text-fg-muted">Frequentie</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as "DAILY" | "WEEKLY")} className="rounded-md border border-default px-3 py-2 text-sm">
                <option value="WEEKLY">Wekelijks</option>
                <option value="DAILY">Dagelijks</option>
              </select>
            </div>

            {frequency === "WEEKLY" && (
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-2">Dagen</label>
                <div className="flex gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => toggleDay(d.code)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        selectedDays.includes(d.code)
                          ? "bg-brand-600 text-white"
                          : "bg-sunken text-fg-muted hover:bg-surface-200"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <label className="block text-sm font-medium text-fg-muted">Eindigt na</label>
              <select value={endType} onChange={(e) => setEndType(e.target.value as "count" | "until")} className="rounded-md border border-default px-3 py-2 text-sm">
                <option value="count">Aantal keer</option>
                <option value="until">Datum</option>
              </select>
              {endType === "count" ? (
                <input type="number" min={1} max={52} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-20 rounded-md border border-default px-3 py-2 text-sm" />
              ) : (
                <input type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} className="rounded-md border border-default px-3 py-2 text-sm" />
              )}
            </div>
          </fieldset>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-sunken rounded-lg p-4">
              <h3 className="text-sm font-semibold text-fg mb-2">
                Voorbeeld: {preview.length} afspraken
              </h3>
              <div className="flex flex-wrap gap-2">
                {preview.slice(0, 20).map((d) => (
                  <span key={d} className="inline-block bg-raised border border-subtle rounded px-2 py-1 text-xs text-fg-muted">
                    {new Date(d).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                ))}
                {preview.length > 20 && (
                  <span className="inline-block text-xs text-fg-subtle py-1">
                    +{preview.length - 20} meer...
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !clientId || !practitionerId || !startDate}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Aanmaken..." : `${preview.length} afspraken aanmaken`}
          </button>
        </form>
      </main>
    </AppShell>
  );
}
