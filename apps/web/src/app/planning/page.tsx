"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "../../components/AppShell";
import { planningFetch } from "../../lib/planning-api";

interface Participant {
  actor: { reference: string; display?: string };
  status: string;
}

interface AppointmentResource {
  resourceType: "Appointment";
  id: string;
  status: string;
  start: string;
  end: string;
  participant: Participant[];
  appointmentType?: { text: string };
}

interface FhirBundle {
  entry?: Array<{ resource: AppointmentResource }>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getParticipant(
  participants: Participant[],
  type: "Patient" | "Practitioner",
): string {
  const p = participants.find((x) => x.actor.reference.startsWith(type));
  return p?.actor.display || p?.actor.reference || "-";
}

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-blue-100 text-blue-800",
  arrived: "bg-brand-50 text-brand-700",
  fulfilled: "bg-gray-100 text-fg-muted",
  cancelled: "bg-red-100 text-red-800",
  noshow: "bg-yellow-100 text-yellow-800",
};

export default function PlanningPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [appointments, setAppointments] = useState<AppointmentResource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    planningFetch<FhirBundle>(`/api/afspraken?date=${date}`).then((res) => {
      if (res.error) {
        setError(res.error);
        setAppointments([]);
      } else {
        setAppointments(
          res.data?.entry?.map((e) => e.resource) || [],
        );
      }
      setLoading(false);
    });
  }, [date]);

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-fg">Dagplanning</h2>
          <Link
            href="/planning/nieuw"
            className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700 text-sm font-medium"
          >
            Nieuwe afspraak
          </Link>
        </div>

        <div className="mb-6">
          <label htmlFor="date" className="block text-sm font-medium text-fg-muted mb-1">
            Datum
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-fg-subtle text-sm">Laden...</p>
        ) : appointments.length === 0 ? (
          <p className="text-fg-subtle text-sm">
            Geen afspraken gevonden voor {date}.
          </p>
        ) : (
          <div className="bg-raised rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-default">
              <thead className="bg-page">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Tijd
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Medewerker
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-sunken">
                    <td className="px-4 py-3 text-sm text-fg whitespace-nowrap">
                      {formatTime(appt.start)} - {formatTime(appt.end)}
                    </td>
                    <td className="px-4 py-3 text-sm text-fg">
                      {getParticipant(appt.participant, "Patient")}
                    </td>
                    <td className="px-4 py-3 text-sm text-fg">
                      {getParticipant(appt.participant, "Practitioner")}
                    </td>
                    <td className="px-4 py-3 text-sm text-fg">
                      {appt.appointmentType?.text || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[appt.status] || "bg-gray-100 text-fg-muted"}`}
                      >
                        {appt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
