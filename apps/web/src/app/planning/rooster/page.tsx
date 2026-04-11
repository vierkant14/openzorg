"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { planningFetch } from "../../../lib/planning-api";

/* ---------- Types ---------- */

interface Practitioner {
  id: string;
  resourceType: "Practitioner";
  name?: Array<{ family?: string; given?: string[] }>;
  active?: boolean;
}

interface PractitionerBundle {
  entry?: Array<{ resource: Practitioner }>;
}

interface SlotResource {
  id?: string;
  status: string;
  start: string;
  end: string;
  comment?: string;
}

interface BeschikbaarheidResponse {
  schedule?: { id?: string; active?: boolean };
  slots?: {
    entry?: Array<{ resource: SlotResource }>;
  };
}

interface FhirAppointment {
  id?: string;
  status?: string;
  start?: string;
  end?: string;
  description?: string;
  participant?: Array<{
    actor?: { reference?: string; display?: string };
    status?: string;
  }>;
}

interface AppointmentBundle {
  entry?: Array<{ resource: FhirAppointment }>;
}

/* ---------- Helpers ---------- */

function getNaam(p: Practitioner): string {
  const name = p.name?.[0];
  if (!name) return "(onbekend)";
  const given = name.given?.join(" ") ?? "";
  return `${given} ${name.family ?? ""}`.trim() || "(onbekend)";
}

function formatTijd(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function getWeekDays(startDate: Date): Date[] {
  const monday = new Date(startDate);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDagKort(d: Date): string {
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

const STATUS_COLORS: Record<string, string> = {
  free: "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800",
  busy: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  "busy-unavailable": "bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-300 border-coral-200 dark:border-coral-800",
};

const STATUS_LABELS: Record<string, string> = {
  free: "Beschikbaar",
  busy: "Bezet",
  "busy-unavailable": "Niet beschikbaar",
  "busy-tentative": "Voorlopig",
};

/* ---------- Page ---------- */

export default function RoosterPage() {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slots keyed by "practitionerId:date"
  const [slotsMap, setSlotsMap] = useState<Record<string, SlotResource[]>>({});
  const [appointmentsMap, setAppointmentsMap] = useState<Record<string, FhirAppointment[]>>({});

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);

  const loadPractitioners = useCallback(async () => {
    const { data, error: err } = await ecdFetch<PractitionerBundle>(
      "/api/medewerkers?_count=50&_sort=name",
    );
    if (err) {
      setError(err);
      return [];
    }
    const pracs = (data?.entry?.map((e) => e.resource) ?? []).filter((p) => p.active !== false);
    setPractitioners(pracs);
    return pracs;
  }, []);

  const loadWeekData = useCallback(async (pracs: Practitioner[], days: Date[]) => {
    setLoading(true);
    setError(null);

    const newSlots: Record<string, SlotResource[]> = {};
    const newAppointments: Record<string, FhirAppointment[]> = {};

    // Load beschikbaarheid for each practitioner for the week
    const promises = pracs.map(async (prac) => {
      for (const day of days) {
        const key = `${prac.id}:${dateString(day)}`;
        const res = await planningFetch<BeschikbaarheidResponse>(
          `/api/beschikbaarheid/medewerker/${prac.id}?datum=${dateString(day)}`,
        );
        if (!res.error && res.data) {
          newSlots[key] = res.data.slots?.entry?.map((e) => e.resource) ?? [];
        }
      }
    });

    // Load appointments for the week
    const weekStart = dateString(days[0]!);
    const weekEnd = dateString(days[6]!);
    const apptRes = await planningFetch<AppointmentBundle>(
      `/api/afspraken?date=ge${weekStart}&date=le${weekEnd}&_count=200`,
    );

    if (!apptRes.error && apptRes.data?.entry) {
      for (const entry of apptRes.data.entry) {
        const appt = entry.resource;
        if (!appt.start) continue;
        const apptDate = appt.start.slice(0, 10);

        // Find which practitioner this belongs to
        const pracRef = appt.participant?.find((p) =>
          p.actor?.reference?.startsWith("Practitioner/"),
        )?.actor?.reference;

        if (pracRef) {
          const pracId = pracRef.replace("Practitioner/", "");
          const key = `${pracId}:${apptDate}`;
          if (!newAppointments[key]) newAppointments[key] = [];
          newAppointments[key].push(appt);
        }
      }
    }

    await Promise.allSettled(promises);
    setSlotsMap(newSlots);
    setAppointmentsMap(newAppointments);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const pracs = await loadPractitioners();
      if (pracs.length > 0) {
        await loadWeekData(pracs, weekDays);
      } else {
        setLoading(false);
      }
    })();
  }, [weekOffset]);

  const isToday = (d: Date) => dateString(d) === dateString(new Date());

  return (
    <AppShell>
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/planning"
                className="text-sm text-brand-700 hover:text-brand-900"
              >
                &larr; Planning
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-fg">Rooster</h1>
            <p className="text-sm text-fg-muted mt-1">
              Weekoverzicht beschikbaarheid en afspraken per medewerker
            </p>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-2 rounded-lg hover:bg-sunken transition-colors text-fg-muted"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-sunken transition-colors text-fg"
            >
              Vandaag
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-2 rounded-lg hover:bg-sunken transition-colors text-fg-muted"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 rounded-xl text-coral-600 dark:text-coral-400 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-sm text-fg-muted">Rooster laden...</p>
            </div>
          </div>
        ) : practitioners.length === 0 ? (
          <div className="text-center py-24">
            <h3 className="text-lg font-semibold text-fg">Geen medewerkers</h3>
            <p className="text-sm text-fg-muted mt-1">
              Voeg eerst medewerkers toe via Beheer &gt; Medewerkers.
            </p>
          </div>
        ) : (
          <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-default">
                    <th className="text-left px-4 py-3 text-overline text-fg-subtle uppercase tracking-wider font-semibold w-48 sticky left-0 bg-raised z-10">
                      Medewerker
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={dateString(day)}
                        className={`text-left px-3 py-3 text-overline uppercase tracking-wider font-semibold min-w-[140px] ${
                          isToday(day) ? "text-brand-600 dark:text-brand-400" : "text-fg-subtle"
                        }`}
                      >
                        <span className="block">{formatDagKort(day)}</span>
                        {isToday(day) && (
                          <span className="block w-1.5 h-1.5 rounded-full bg-brand-500 mt-1" />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {practitioners.map((prac) => (
                    <tr key={prac.id} className="border-b border-subtle last:border-0 hover:bg-sunken/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-fg sticky left-0 bg-raised z-10">
                        {getNaam(prac)}
                      </td>
                      {weekDays.map((day) => {
                        const key = `${prac.id}:${dateString(day)}`;
                        const slots = slotsMap[key] ?? [];
                        const appointments = appointmentsMap[key] ?? [];
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                        return (
                          <td
                            key={dateString(day)}
                            className={`px-3 py-2 align-top ${isWeekend ? "bg-sunken/30" : ""}`}
                          >
                            {/* Slots (beschikbaarheid) */}
                            {slots.map((slot, i) => (
                              <div
                                key={slot.id ?? i}
                                className={`text-xs rounded-lg px-2 py-1 mb-1 border ${STATUS_COLORS[slot.status] ?? "bg-surface-100 text-fg-muted border-default"}`}
                              >
                                <span className="font-medium">
                                  {formatTijd(slot.start)}–{formatTijd(slot.end)}
                                </span>
                                <span className="block text-[10px] opacity-75">
                                  {STATUS_LABELS[slot.status] ?? slot.status}
                                </span>
                              </div>
                            ))}

                            {/* Afspraken */}
                            {appointments.map((appt) => (
                              <div
                                key={appt.id}
                                className="text-xs rounded-lg px-2 py-1 mb-1 border bg-navy-50 dark:bg-navy-900/30 text-navy-700 dark:text-navy-300 border-navy-200 dark:border-navy-800"
                              >
                                <span className="font-medium">
                                  {appt.start ? formatTijd(appt.start) : ""}
                                  {appt.end ? `–${formatTijd(appt.end)}` : ""}
                                </span>
                                <span className="block text-[10px] opacity-75 truncate max-w-[120px]">
                                  {appt.description ?? "Afspraak"}
                                </span>
                              </div>
                            ))}

                            {slots.length === 0 && appointments.length === 0 && (
                              <span className="text-xs text-fg-subtle">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-3 border-t border-subtle flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-brand-100 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800" />
                <span className="text-caption text-fg-subtle">Beschikbaar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800" />
                <span className="text-caption text-fg-subtle">Bezet</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-coral-100 dark:bg-coral-900/30 border border-coral-200 dark:border-coral-800" />
                <span className="text-caption text-fg-subtle">Niet beschikbaar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-navy-50 dark:bg-navy-900/30 border border-navy-200 dark:border-navy-800" />
                <span className="text-caption text-fg-subtle">Afspraak</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
