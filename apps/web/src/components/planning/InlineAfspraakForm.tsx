"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ecdFetch } from "../../lib/api";
import { planningFetch } from "../../lib/planning-api";

interface Patient {
  id: string;
  name?: Array<{ family?: string; given?: string[] }>;
}

interface PatientBundle {
  entry?: Array<{ resource: Patient }>;
}

interface InlineAfspraakFormProps {
  practitionerId: string;
  medewerkerNaam: string;
  datum: string;       // "2026-04-17"
  startTijd: string;   // "09:00"
  onClose: () => void;
  onCreated: () => void;
}

const DUUR_OPTIES = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 uur", value: 60 },
  { label: "1,5 uur", value: 90 },
  { label: "2 uur", value: 120 },
];

const TYPE_OPTIES = [
  "Persoonlijke verzorging",
  "Verpleging",
  "Begeleiding",
  "Huishoudelijke hulp",
  "Overig",
];

function addMinutesToTime(datum: string, tijd: string, minuten: number): string {
  const dt = new Date(`${datum}T${tijd}:00`);
  dt.setMinutes(dt.getMinutes() + minuten);
  return dt.toISOString();
}

function formatNaam(p: Patient): string {
  const name = p.name?.[0];
  if (!name) return "(onbekend)";
  const given = name.given?.join(" ") ?? "";
  return `${given} ${name.family ?? ""}`.trim() || "(onbekend)";
}

export function InlineAfspraakForm({
  practitionerId,
  medewerkerNaam,
  datum,
  startTijd,
  onClose,
  onCreated,
}: InlineAfspraakFormProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [clientId, setClientId] = useState("");
  const [clientZoek, setClientZoek] = useState("");
  const [clienten, setClienten] = useState<Patient[]>([]);
  const [showSuggesties, setShowSuggesties] = useState(false);
  const [type, setType] = useState(TYPE_OPTIES[0]!);
  const [duur, setDuur] = useState(30);
  const [opmerking, setOpmerking] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Search clients
  const zoekClienten = useCallback(async (query: string) => {
    if (query.length < 2) {
      setClienten([]);
      return;
    }
    const { data } = await ecdFetch<PatientBundle>(
      `/api/clients?name=${encodeURIComponent(query)}&_count=10`,
    );
    if (data?.entry) {
      setClienten(data.entry.map((e) => e.resource));
      setShowSuggesties(true);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => zoekClienten(clientZoek), 300);
    return () => clearTimeout(timeout);
  }, [clientZoek, zoekClienten]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Selecteer een client");
      return;
    }

    setSubmitting(true);
    setError(null);

    const start = `${datum}T${startTijd}:00`;
    const end = addMinutesToTime(datum, startTijd, duur);

    const body = {
      resourceType: "Appointment",
      status: "booked",
      start,
      end,
      description: type,
      comment: opmerking || undefined,
      participant: [
        {
          actor: { reference: `Practitioner/${practitionerId}` },
          status: "accepted",
        },
        {
          actor: { reference: `Patient/${clientId}` },
          status: "accepted",
        },
      ],
    };

    const { error: err } = await planningFetch("/api/afspraken", {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSubmitting(false);

    if (err) {
      setError(err);
    } else {
      onCreated();
    }
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-raised border border-default rounded-xl shadow-lg p-4 w-80"
      style={{ top: "100%", left: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-fg">Nieuwe afspraak</h3>
        <button onClick={onClose} className="text-fg-subtle hover:text-fg">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-fg-muted mb-3">
        {medewerkerNaam} &middot; {datum} om {startTijd}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Client zoeken */}
        <div className="relative">
          <label className="text-xs font-medium text-fg-muted block mb-1">Client</label>
          <input
            type="text"
            value={clientZoek}
            onChange={(e) => {
              setClientZoek(e.target.value);
              setClientId("");
            }}
            placeholder="Zoek op naam..."
            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {showSuggesties && clienten.length > 0 && (
            <ul className="absolute top-full left-0 right-0 bg-raised border border-default rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto z-50">
              {clienten.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setClientId(c.id);
                      setClientZoek(formatNaam(c));
                      setShowSuggesties(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-sunken text-fg"
                  >
                    {formatNaam(c)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="text-xs font-medium text-fg-muted block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {TYPE_OPTIES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Duur */}
        <div>
          <label className="text-xs font-medium text-fg-muted block mb-1">Duur</label>
          <select
            value={duur}
            onChange={(e) => setDuur(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {DUUR_OPTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Opmerking */}
        <div>
          <label className="text-xs font-medium text-fg-muted block mb-1">Opmerking (optioneel)</label>
          <textarea
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            placeholder="Bijzonderheden..."
            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-1.5 text-fg resize-none h-14 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {error && (
          <p className="text-xs text-coral-600 dark:text-coral-400">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md border border-default bg-raised hover:bg-sunken text-fg-muted transition-colors"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={submitting || !clientId}
            className="text-xs px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Opslaan..." : "Afspraak aanmaken"}
          </button>
        </div>
      </form>
    </div>
  );
}
