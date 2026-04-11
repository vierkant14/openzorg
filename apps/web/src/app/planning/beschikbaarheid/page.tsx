"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import AppShell from "../../../components/AppShell";
import { planningFetch } from "../../../lib/planning-api";

interface SlotResource {
  id?: string;
  status: string;
  start: string;
  end: string;
  comment?: string;
}

interface ScheduleResource {
  id?: string;
  active?: boolean;
}

interface BeschikbaarheidResponse {
  schedule?: ScheduleResource;
  slots?: {
    entry?: Array<{ resource: SlotResource }>;
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: "Beschikbaar", color: "bg-brand-50 text-brand-700" },
  busy: { label: "Bezet", color: "bg-yellow-100 text-yellow-800" },
  "busy-unavailable": { label: "Niet beschikbaar", color: "bg-red-100 text-red-800" },
  "busy-tentative": { label: "Voorlopig bezet", color: "bg-orange-100 text-orange-800" },
};

export default function BeschikbaarheidPage() {
  const [practitionerId, setPractitionerId] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<SlotResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New slot form
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotStart, setSlotStart] = useState("08:00");
  const [slotEnd, setSlotEnd] = useState("17:00");
  const [slotSaving, setSlotSaving] = useState(false);

  // Block form
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReden, setBlockReden] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);

  async function loadBeschikbaarheid(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!practitionerId.trim()) return;

    setLoading(true);
    setError(null);

    const params = datum ? `?datum=${datum}` : "";
    const res = await planningFetch<BeschikbaarheidResponse>(
      `/api/beschikbaarheid/medewerker/${practitionerId}${params}`,
    );

    if (res.error) {
      setError(res.error);
      setSlots([]);
    } else {
      const entries = res.data?.slots?.entry ?? [];
      setSlots(entries.map((e) => e.resource));
    }
    setLoading(false);
  }

  async function handleAddSlot() {
    if (!practitionerId) return;
    setSlotSaving(true);

    const startISO = `${datum}T${slotStart}:00`;
    const endISO = `${datum}T${slotEnd}:00`;

    const res = await planningFetch(
      `/api/beschikbaarheid/medewerker/${practitionerId}`,
      {
        method: "POST",
        body: JSON.stringify({
          slots: [{ start: startISO, end: endISO, status: "free" }],
        }),
      },
    );

    setSlotSaving(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowSlotForm(false);
      await loadBeschikbaarheid();
    }
  }

  async function handleBlock() {
    if (!practitionerId || !blockStart || !blockEnd) return;
    setBlockSaving(true);

    const res = await planningFetch(
      `/api/beschikbaarheid/medewerker/${practitionerId}/blokkeer`,
      {
        method: "PUT",
        body: JSON.stringify({
          start: blockStart,
          end: blockEnd,
          reden: blockReden || undefined,
        }),
      },
    );

    setBlockSaving(false);
    if (res.error) {
      setError(res.error);
    } else {
      setShowBlockForm(false);
      setBlockReden("");
      await loadBeschikbaarheid();
    }
  }

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  function formatDateTime(iso: string): string {
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

  const inputCls =
    "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <Link
          href="/planning"
          className="inline-flex items-center text-sm text-brand-700 hover:text-brand-900"
        >
          &larr; Terug naar planning
        </Link>

        <h2 className="text-2xl font-bold text-fg">Beschikbaarheid beheren</h2>

        {/* Search form */}
        <form
          onSubmit={loadBeschikbaarheid}
          className="bg-raised rounded-lg border p-5 flex flex-wrap gap-4 items-end"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-fg-muted mb-1">
              Medewerker ID (Practitioner)
            </label>
            <input
              type="text"
              value={practitionerId}
              onChange={(e) => setPractitionerId(e.target.value)}
              placeholder="Practitioner ID"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-muted mb-1">
              Datum
            </label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !practitionerId.trim()}
            className="bg-brand-700 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-brand-800 disabled:opacity-50"
          >
            {loading ? "Laden..." : "Ophalen"}
          </button>
        </form>

        {error && (
          <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-4 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        {practitionerId && (
          <div className="flex gap-3">
            <button
              onClick={() => { setShowSlotForm(!showSlotForm); setShowBlockForm(false); }}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
            >
              {showSlotForm ? "Annuleren" : "+ Beschikbaarheid toevoegen"}
            </button>
            <button
              onClick={() => { setShowBlockForm(!showBlockForm); setShowSlotForm(false); }}
              className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
            >
              {showBlockForm ? "Annuleren" : "Tijd blokkeren"}
            </button>
          </div>
        )}

        {/* Add slot form */}
        {showSlotForm && (
          <div className="bg-raised rounded-lg border p-5 space-y-3">
            <h3 className="text-sm font-semibold text-fg">Beschikbaarheid toevoegen</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Starttijd</label>
                <input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Eindtijd</label>
                <input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
            <button
              onClick={handleAddSlot}
              disabled={slotSaving}
              className="bg-brand-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-800 disabled:opacity-50"
            >
              {slotSaving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        )}

        {/* Block form */}
        {showBlockForm && (
          <div className="bg-raised rounded-lg border p-5 space-y-3">
            <h3 className="text-sm font-semibold text-fg">Tijd blokkeren (verlof, ziekte)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Van (datum+tijd)</label>
                <input type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Tot (datum+tijd)</label>
                <input type="datetime-local" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1">Reden</label>
              <select value={blockReden} onChange={(e) => setBlockReden(e.target.value)} className={inputCls}>
                <option value="">Selecteer reden</option>
                <option value="Vakantie">Vakantie</option>
                <option value="Ziekmelding">Ziekmelding</option>
                <option value="Training/Scholing">Training / Scholing</option>
                <option value="Persoonlijk verlof">Persoonlijk verlof</option>
                <option value="Zwangerschapsverlof">Zwangerschapsverlof</option>
                <option value="Ouderschapsverlof">Ouderschapsverlof</option>
                <option value="Calamiteitenverlof">Calamiteitenverlof</option>
                <option value="Overig">Overig</option>
              </select>
            </div>
            <button
              onClick={handleBlock}
              disabled={blockSaving || !blockStart || !blockEnd}
              className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {blockSaving ? "Blokkeren..." : "Tijd blokkeren"}
            </button>
          </div>
        )}

        {/* Slots table */}
        {slots.length > 0 && (
          <div className="bg-raised rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-default">
              <thead className="bg-page">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Tijd</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Opmerking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {slots.map((slot, i) => {
                  const statusInfo = STATUS_LABELS[slot.status] ?? { label: slot.status, color: "bg-gray-100 text-fg-muted" };
                  return (
                    <tr key={slot.id ?? i} className="hover:bg-sunken">
                      <td className="px-4 py-3 text-sm text-fg">
                        {formatTime(slot.start)} - {formatTime(slot.end)}
                        <span className="ml-2 text-xs text-fg-subtle">{formatDateTime(slot.start)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-muted">
                        {slot.comment ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && slots.length === 0 && practitionerId && (
          <p className="text-center text-sm text-fg-subtle py-8">
            Geen beschikbaarheid gevonden voor deze medewerker.
          </p>
        )}
      </main>
    </AppShell>
  );
}
