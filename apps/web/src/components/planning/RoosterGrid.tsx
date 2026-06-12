"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useState } from "react";

import type { CaoViolation, Shift } from "../../lib/cao-engine";
import { validateAllCaoRules } from "../../lib/cao-engine";
import { planningFetch } from "../../lib/planning-api";

import type { FhirAppointment } from "./AfspraakBlock";
import { CaoWarning } from "./CaoWarning";
import { InlineAfspraakForm } from "./InlineAfspraakForm";
import { RoosterRow } from "./RoosterRow";

interface Practitioner {
  id: string;
  naam: string;
}

interface ContractData {
  medewerkerId: string;
  urenPerWeek: number;
  contractType: string;
}

interface RoosterGridProps {
  practitioners: Practitioner[];
  afsprakenMap: Record<string, FhirAppointment[]>; // keyed by practitionerId
  contractMap: Record<string, ContractData>;
  weekDays: Date[];
  onAfspraakMoved: () => void;
  onAfspraakCreated: () => void;
}

const CEL_BREEDTE = 60;

function timeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h < 22; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = timeSlots();

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDagKort(d: Date): string {
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

function sumDurationMinutes(afspraken: FhirAppointment[]): number {
  let total = 0;
  for (const a of afspraken) {
    if (!a.start || !a.end || a.status === "cancelled") continue;
    total += (new Date(a.end).getTime() - new Date(a.start).getTime()) / (1000 * 60);
  }
  return total;
}

function addMinutes(isoStart: string, minutes: number): string {
  const d = new Date(isoStart);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

/** Convert FhirAppointments for a practitioner into Shift[] for the CAO engine */
function toShifts(pracId: string, appts: FhirAppointment[]): Shift[] {
  return appts
    .filter((a) => a.start && a.end && a.status !== "cancelled")
    .map((a) => ({
      start: new Date(a.start!),
      end: new Date(a.end!),
      practitionerId: pracId,
    }));
}

export function RoosterGrid({
  practitioners,
  afsprakenMap,
  contractMap,
  weekDays,
  onAfspraakMoved,
  onAfspraakCreated,
}: RoosterGridProps) {
  const [localAfspraken, setLocalAfspraken] = useState(afsprakenMap);
  const [violations, setViolations] = useState<CaoViolation[]>([]);
  const [overrides, setOverrides] = useState<Set<string>>(new Set());
  const [inlineForm, setInlineForm] = useState<{
    practitionerId: string;
    medewerkerNaam: string;
    datum: string;
    startTijd: string;
  } | null>(null);

  // Keep local state in sync when parent data changes
  if (afsprakenMap !== localAfspraken && Object.keys(afsprakenMap).length > 0) {
    setLocalAfspraken(afsprakenMap);
    runAllCaoChecks(afsprakenMap);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  function runAllCaoChecks(apMap: Record<string, FhirAppointment[]>) {
    const allViolations: CaoViolation[] = [];
    for (const prac of practitioners) {
      const appts = apMap[prac.id] ?? [];
      const shifts = toShifts(prac.id, appts);
      const contract = contractMap[prac.id];
      const contractInfo = { urenPerWeek: contract?.urenPerWeek ?? 36, fte: 1.0 };
      const v = validateAllCaoRules(shifts, prac.id, contractInfo);
      allViolations.push(...v);
    }
    setViolations(allViolations);
  }

  function findAfspraakById(id: string): { afspraak: FhirAppointment; pracId: string } | null {
    for (const [pracId, appts] of Object.entries(localAfspraken)) {
      const found = appts.find((a) => a.id === id);
      if (found) return { afspraak: found, pracId };
    }
    return null;
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overIdStr = over.id.toString();
    if (!overIdStr.startsWith("slot:")) return;

    const parts = overIdStr.split(":");
    const newPracId = parts[1]!;
    const newDate = parts[2]!;
    const newTime = parts[3]!;

    const afspraakId = active.id.toString();
    const found = findAfspraakById(afspraakId);
    if (!found) return;

    const { afspraak, pracId: oldPracId } = found;
    if (!afspraak.start || !afspraak.end) return;

    const duurMs = new Date(afspraak.end).getTime() - new Date(afspraak.start).getTime();
    const duurMinuten = duurMs / (1000 * 60);
    const newStart = `${newDate}T${newTime}:00`;
    const newEnd = addMinutes(newStart, duurMinuten);

    // Optimistic update
    const prevState = { ...localAfspraken };
    const updated = { ...localAfspraken };

    // Remove from old practitioner
    updated[oldPracId] = (updated[oldPracId] ?? []).filter((a) => a.id !== afspraakId);

    // Add to new practitioner
    const movedAppt: FhirAppointment = {
      ...afspraak,
      start: newStart,
      end: newEnd,
      participant: afspraak.participant?.map((p) => {
        if (p.actor?.reference?.startsWith("Practitioner/")) {
          return { ...p, actor: { ...p.actor, reference: `Practitioner/${newPracId}` } };
        }
        return p;
      }),
    };
    updated[newPracId] = [...(updated[newPracId] ?? []), movedAppt];

    setLocalAfspraken(updated);
    runAllCaoChecks(updated);

    // PUT to backend
    const body = {
      resourceType: "Appointment",
      id: afspraakId,
      status: afspraak.status ?? "booked",
      start: newStart,
      end: newEnd,
      description: afspraak.description,
      participant: movedAppt.participant,
    };

    const { error } = await planningFetch(`/api/afspraken/${afspraakId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (error) {
      // Rollback
      setLocalAfspraken(prevState);
      runAllCaoChecks(prevState);
    } else {
      onAfspraakMoved();
    }
  }, [localAfspraken, practitioners, contractMap, onAfspraakMoved]);

  function handleSlotClick(practitionerId: string, datum: string, time: string) {
    const prac = practitioners.find((p) => p.id === practitionerId);
    setInlineForm({
      practitionerId,
      medewerkerNaam: prac?.naam ?? "(onbekend)",
      datum,
      startTijd: time,
    });
  }

  function handleOverride(violation: CaoViolation, _reden: string) {
    const key = `${violation.rule}:${violation.practitionerId}`;
    setOverrides((prev) => new Set([...prev, key]));
  }

  function handleOverrideAll(reden: string) {
    const activeViolations = violations.filter(
      (v) => !overrides.has(`${v.rule}:${v.practitionerId}`),
    );
    for (const v of activeViolations) {
      handleOverride(v, reden);
    }
  }

  const isToday = (d: Date) => dateString(d) === dateString(new Date());

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft relative">
        <div className="overflow-x-auto">
          {/* Header row: day labels + time slot headers */}
          <div className="flex border-b border-default">
            {/* Spacer for medewerker column */}
            <div className="sticky left-0 z-20 bg-raised border-r border-default"
                 style={{ minWidth: "180px", width: "180px" }}>
              <div className="px-3 py-2 text-xs font-semibold text-fg-subtle uppercase tracking-wider">
                Medewerker
              </div>
            </div>

            {/* Day columns with time headers */}
            {weekDays.map((day) => {
              const isWknd = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={dateString(day)}
                  className={`border-r border-default ${isWknd ? "bg-sunken/30" : ""}`}
                  style={{ minWidth: `${TIME_SLOTS.length * CEL_BREEDTE}px` }}
                >
                  {/* Day label */}
                  <div className={`px-2 py-1 text-xs font-semibold border-b border-subtle text-center ${
                    isToday(day)
                      ? "text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/20"
                      : "text-fg-subtle"
                  }`}>
                    {formatDagKort(day)}
                    {isToday(day) && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 ml-1.5 align-middle" />
                    )}
                  </div>

                  {/* Time slot headers */}
                  <div className="flex">
                    {TIME_SLOTS.map((time) => (
                      <div
                        key={time}
                        className="text-[10px] text-fg-subtle text-center border-r border-subtle py-0.5"
                        style={{ minWidth: `${CEL_BREEDTE}px`, width: `${CEL_BREEDTE}px` }}
                      >
                        {time.endsWith(":00") ? time : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Practitioner rows */}
          {practitioners.map((prac) => {
            const appts = localAfspraken[prac.id] ?? [];
            const contract = contractMap[prac.id];
            const contractUren = contract?.urenPerWeek ?? 36;
            const contractOnbekend = !contract || contract.contractType === "onbekend";
            const geplandMinuten = sumDurationMinutes(appts);
            const geplandUren = geplandMinuten / 60;

            return (
              <RoosterRow
                key={prac.id}
                practitionerId={prac.id}
                naam={prac.naam}
                geplandUren={geplandUren}
                contractUren={contractUren}
                contractOnbekend={contractOnbekend}
                afspraken={appts}
                weekDays={weekDays}
                onSlotClick={handleSlotClick}
                celBreedte={CEL_BREEDTE}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-subtle flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-100 dark:bg-brand-900/30 border border-brand-300 dark:border-brand-700" />
            <span className="text-[11px] text-fg-subtle">Persoonlijke verzorging</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-navy-50 dark:bg-navy-900/30 border border-navy-300 dark:border-navy-700" />
            <span className="text-[11px] text-fg-subtle">Verpleging</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700" />
            <span className="text-[11px] text-fg-subtle">Begeleiding</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-surface-200 dark:bg-surface-800 border border-surface-400 dark:border-surface-600" />
            <span className="text-[11px] text-fg-subtle">Huishoudelijke hulp</span>
          </div>
        </div>

        {/* CAO Warnings */}
        <CaoWarning
          violations={violations}
          overrides={overrides}
          onOverride={handleOverride}
          onOverrideAll={handleOverrideAll}
        />

        {/* Inline create form */}
        {inlineForm && (
          <InlineAfspraakForm
            practitionerId={inlineForm.practitionerId}
            medewerkerNaam={inlineForm.medewerkerNaam}
            datum={inlineForm.datum}
            startTijd={inlineForm.startTijd}
            onClose={() => setInlineForm(null)}
            onCreated={() => {
              setInlineForm(null);
              onAfspraakCreated();
            }}
          />
        )}
      </div>
    </DndContext>
  );
}
