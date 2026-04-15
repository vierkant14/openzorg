"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { planningFetch } from "../../../lib/planning-api";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface FhirAppointment {
  resourceType: "Appointment";
  id?: string;
  status?: string;
  appointmentType?: { coding?: Array<{ display?: string }>; text?: string };
  start?: string;
  end?: string;
  description?: string;
  participant?: Array<{
    actor?: { reference?: string; display?: string };
    status?: string;
  }>;
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

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTijd(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getClientNaam(appointment: FhirAppointment): string {
  const patient = appointment.participant?.find((p) =>
    p.actor?.reference?.startsWith("Patient/"),
  );
  return patient?.actor?.display ?? "Onbekende client";
}

function getAfspraakType(appointment: FhirAppointment): string {
  return (
    appointment.appointmentType?.text ??
    appointment.appointmentType?.coding?.[0]?.display ??
    "Afspraak"
  );
}

function getLocatie(appointment: FhirAppointment): string {
  const location = appointment.participant?.find((p) =>
    p.actor?.reference?.startsWith("Location/"),
  );
  return location?.actor?.display ?? "";
}

/** Calculate duration in minutes */
function getDuur(start?: string, end?: string): number {
  if (!start || !end) return 0;
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

/** Calculate top offset as percentage of the day (6:00 - 22:00 = 16 hours) */
function getTimePosition(iso: string): number {
  const date = new Date(iso);
  const hours = date.getHours() + date.getMinutes() / 60;
  const startHour = 6;
  const endHour = 22;
  const pct = ((hours - startHour) / (endHour - startHour)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** Height as percentage of the day */
function getTimeHeight(startIso: string, endIso: string): number {
  const durationHours = getDuur(startIso, endIso) / 60;
  const totalHours = 16; // 6:00 - 22:00
  return Math.max(2, (durationHours / totalHours) * 100);
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                            */
/* -------------------------------------------------------------------------- */

interface Practitioner {
  id: string;
  naam: string;
}

export default function DagplanningPage() {
  const [datum, setDatum] = useState(todayString());
  const [practitionerId, setPractitionerId] = useState("");
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [appointments, setAppointments] = useState<FhirAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ecdFetch<{ resourceType: string; entry?: Array<{ resource: { id?: string; name?: Array<{ family?: string; given?: string[] }> } }> }>("/api/medewerkers?_count=100")
      .then(({ data }) => {
        const items: Practitioner[] = (data?.entry ?? []).map((e) => {
          const n = e.resource.name?.[0];
          const naam = [n?.given?.[0], n?.family].filter(Boolean).join(" ") || "Onbekend";
          return { id: e.resource.id ?? "", naam };
        }).filter((p) => p.id);
        setPractitioners(items);
        // Auto-select eerste medewerker zodat de pagina niet leeg blijft
        if (items.length > 0 && !practitionerId) {
          setPractitionerId(items[0]!.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAfspraken = useCallback(() => {
    if (!practitionerId.trim()) return;
    setLoading(true);
    setError(null);

    planningFetch<FhirBundle<FhirAppointment>>(
      `/api/dagplanning/medewerker/${practitionerId}?datum=${datum}`,
    ).then(({ data, error: err }) => {
      if (err) {
        setError(err);
        setAppointments([]);
      } else {
        const items = data?.entry?.map((e) => e.resource) ?? [];
        items.sort((a, b) => {
          const aTime = a.start ? new Date(a.start).getTime() : 0;
          const bTime = b.start ? new Date(b.start).getTime() : 0;
          return aTime - bTime;
        });
        setAppointments(items);
      }
      setLoading(false);
    });
  }, [practitionerId, datum]);

  useEffect(() => {
    if (practitionerId) {
      loadAfspraken();
    }
  }, [loadAfspraken, practitionerId]);

  function navigateDay(offset: number) {
    const d = new Date(datum);
    d.setDate(d.getDate() + offset);
    setDatum(d.toISOString().slice(0, 10));
  }

  const uurLabels = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 - 22:00

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="mb-6 rounded-lg border border-default bg-raised p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">
                Medewerker
              </label>
              <select
                value={practitionerId}
                onChange={(e) => setPractitionerId(e.target.value)}
                className="w-72 rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Selecteer medewerker...</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>{p.naam}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Datum</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateDay(-1)}
                  className="rounded-md border border-default px-2 py-2 text-sm hover:bg-sunken"
                  title="Vorige dag"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  onClick={() => navigateDay(1)}
                  className="rounded-md border border-default px-2 py-2 text-sm hover:bg-sunken"
                  title="Volgende dag"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setDatum(todayString())}
                  className="rounded-md border border-default px-3 py-2 text-sm font-medium hover:bg-sunken"
                >
                  Vandaag
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Date header */}
        {practitionerId && (
          <h2 className="mb-4 text-lg font-semibold text-fg capitalize">
            {formatDatum(datum)}
          </h2>
        )}

        {error && (
          <div className="mb-4 rounded-md bg-coral-50 border border-coral-200 p-3 text-sm text-coral-600">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
          </div>
        )}

        {!practitionerId && !loading && (
          <div className="rounded-lg border border-default bg-raised p-12 text-center shadow-sm">
            <p className="text-sm text-fg-subtle">
              Selecteer een medewerker om de dagplanning te bekijken.
            </p>
          </div>
        )}

        {practitionerId && !loading && appointments.length === 0 && !error && (
          <div className="rounded-lg border border-default bg-raised p-12 text-center shadow-sm">
            <p className="text-sm text-fg-subtle">
              Geen afspraken gevonden voor deze dag.
            </p>
          </div>
        )}

        {/* Timeline view */}
        {practitionerId && !loading && appointments.length > 0 && (
          <div className="rounded-lg border border-default bg-raised shadow-sm overflow-hidden">
            {/* List view (compact, always visible) */}
            <div className="divide-y divide-subtle">
              {appointments.map((apt, i) => {
                const duur = getDuur(apt.start, apt.end);
                const statusKleur =
                  apt.status === "booked"
                    ? "bg-blue-100 text-blue-800"
                    : apt.status === "fulfilled"
                      ? "bg-brand-50 text-brand-700"
                      : apt.status === "cancelled"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-fg-muted";

                return (
                  <div key={apt.id ?? i} className="flex items-stretch">
                    {/* Time column */}
                    <div className="flex w-28 shrink-0 flex-col items-center justify-center border-r border-subtle bg-page px-3 py-4">
                      <span className="text-sm font-semibold text-fg">
                        {formatTijd(apt.start)}
                      </span>
                      <span className="text-xs text-fg-subtle">
                        {formatTijd(apt.end)}
                      </span>
                      <span className="mt-1 text-xs text-fg-subtle">
                        {duur} min
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-fg">
                          {getClientNaam(apt)}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusKleur}`}
                        >
                          {afspraakStatusLabel(apt.status)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-fg-subtle">
                        <span>{getAfspraakType(apt)}</span>
                        {getLocatie(apt) && (
                          <span>{getLocatie(apt)}</span>
                        )}
                        {apt.description && (
                          <span>{apt.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visual timeline */}
            <div className="border-t border-default p-4">
              <h3 className="mb-3 text-sm font-medium text-fg-muted">Visuele tijdlijn</h3>
              <div className="relative" style={{ height: "640px" }}>
                {/* Hour lines */}
                {uurLabels.map((uur) => {
                  const pct = ((uur - 6) / 16) * 100;
                  return (
                    <div
                      key={uur}
                      className="absolute left-0 right-0 flex items-start"
                      style={{ top: `${pct}%` }}
                    >
                      <span className="w-12 shrink-0 text-right pr-2 text-xs text-fg-subtle">
                        {String(uur).padStart(2, "0")}:00
                      </span>
                      <div className="flex-1 border-t border-subtle" />
                    </div>
                  );
                })}

                {/* Appointment blocks */}
                {appointments.map((apt, i) => {
                  if (!apt.start) return null;
                  const top = getTimePosition(apt.start);
                  const height = apt.end
                    ? getTimeHeight(apt.start, apt.end)
                    : 4;

                  return (
                    <div
                      key={apt.id ?? `block-${i}`}
                      className="absolute left-14 right-2 rounded-md bg-brand-100 border border-brand-300 px-3 py-1 overflow-hidden"
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        minHeight: "24px",
                      }}
                    >
                      <div className="text-xs font-medium text-brand-900 truncate">
                        {getClientNaam(apt)}
                      </div>
                      <div className="text-xs text-brand-700 truncate">
                        {formatTijd(apt.start)} - {formatTijd(apt.end)} | {getAfspraakType(apt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function afspraakStatusLabel(status?: string): string {
  switch (status) {
    case "booked":
      return "Gepland";
    case "fulfilled":
      return "Uitgevoerd";
    case "cancelled":
      return "Geannuleerd";
    case "noshow":
      return "Niet verschenen";
    case "pending":
      return "In afwachting";
    case "proposed":
      return "Voorgesteld";
    default:
      return status ?? "Onbekend";
  }
}
