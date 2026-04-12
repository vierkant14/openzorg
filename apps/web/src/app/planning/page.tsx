"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editPractitioner, setEditPractitioner] = useState("");
  const [editStatus, setEditStatus] = useState("booked");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Cancel state
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const fetchAppointments = useCallback(() => {
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

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  function openEdit(appt: AppointmentResource) {
    setEditingId(appt.id);
    setEditStart(appt.start ? new Date(appt.start).toISOString().slice(0, 16) : "");
    setEditEnd(appt.end ? new Date(appt.end).toISOString().slice(0, 16) : "");
    setEditPractitioner(
      appt.participant.find((p) => p.actor.reference.startsWith("Practitioner"))?.actor.reference.replace("Practitioner/", "") ?? "",
    );
    setEditStatus(appt.status);
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);

    const currentAppt = appointments.find((a) => a.id === editingId);
    if (!currentAppt) return;

    if (!editStart || !editEnd) {
      setEditError("Start- en eindtijd zijn verplicht.");
      return;
    }

    setEditSubmitting(true);

    // Build updated participant list — replace practitioner, keep rest
    const updatedParticipants = currentAppt.participant.map((p) => {
      if (p.actor.reference.startsWith("Practitioner")) {
        return {
          ...p,
          actor: { reference: `Practitioner/${editPractitioner.trim()}`, display: p.actor.display },
        };
      }
      return p;
    });

    const body = {
      ...currentAppt,
      start: new Date(editStart).toISOString(),
      end: new Date(editEnd).toISOString(),
      status: editStatus,
      participant: updatedParticipants,
    };

    const res = await planningFetch(`/api/afspraken/${editingId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (res.error) {
      setEditError(res.error);
    } else {
      setEditingId(null);
      fetchAppointments();
    }
    setEditSubmitting(false);
  }

  async function handleCancel() {
    if (!cancelId) return;
    setCancelSubmitting(true);

    const res = await planningFetch(`/api/afspraken/${cancelId}`, {
      method: "DELETE",
    });

    if (res.error) {
      setError(res.error);
    } else {
      setCancelId(null);
      fetchAppointments();
    }
    setCancelSubmitting(false);
  }

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
                  <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">
                    Acties
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
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        {appt.status !== "cancelled" && (
                          <>
                            <button
                              onClick={() => openEdit(appt)}
                              className="text-brand-600 hover:text-brand-800 text-xs font-medium btn-press"
                            >
                              Bewerken
                            </button>
                            <button
                              onClick={() => setCancelId(appt.id)}
                              className="text-coral-600 hover:text-coral-800 text-xs font-medium btn-press"
                            >
                              Annuleren
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bewerken modal */}
        {editingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-lg bg-raised p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-fg mb-4">
                Afspraak bewerken
              </h3>

              <p className="text-sm text-fg-muted mb-4">
                Client:{" "}
                <span className="font-medium">
                  {getParticipant(
                    appointments.find((a) => a.id === editingId)?.participant ?? [],
                    "Patient",
                  )}
                </span>
              </p>

              <form onSubmit={handleEdit} className="space-y-4">
                {editError && (
                  <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded p-3 text-sm">
                    {editError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Starttijd
                  </label>
                  <input
                    type="datetime-local"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    required
                    className="w-full border border-default rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Eindtijd
                  </label>
                  <input
                    type="datetime-local"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    required
                    className="w-full border border-default rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Medewerker ID
                  </label>
                  <input
                    type="text"
                    value={editPractitioner}
                    onChange={(e) => setEditPractitioner(e.target.value)}
                    placeholder="Practitioner UUID"
                    required
                    className="w-full border border-default rounded px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full border border-default rounded px-3 py-2 text-sm"
                  >
                    <option value="booked">Booked</option>
                    <option value="arrived">Arrived</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="noshow">No-show</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 text-sm font-medium text-fg-muted border border-default rounded hover:bg-sunken btn-press"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press disabled:opacity-50"
                  >
                    {editSubmitting ? "Opslaan..." : "Opslaan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Annuleren bevestiging */}
        {cancelId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-lg bg-raised p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-fg mb-2">
                Afspraak annuleren
              </h3>
              <p className="text-sm text-fg-muted mb-6">
                Weet u zeker dat u de afspraak van{" "}
                <span className="font-medium">
                  {getParticipant(
                    appointments.find((a) => a.id === cancelId)?.participant ?? [],
                    "Patient",
                  )}
                </span>{" "}
                wilt annuleren? De status wordt op &apos;cancelled&apos; gezet.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setCancelId(null)}
                  className="px-4 py-2 text-sm font-medium text-fg-muted border border-default rounded hover:bg-sunken btn-press"
                >
                  Terug
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelSubmitting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 btn-press disabled:opacity-50"
                >
                  {cancelSubmitting ? "Annuleren..." : "Afspraak annuleren"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
