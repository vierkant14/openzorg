"use client";

import { useDroppable } from "@dnd-kit/core";

import type { FhirAppointment } from "./AfspraakBlock";
import { AfspraakBlock } from "./AfspraakBlock";
import { MedewerkerLabel } from "./MedewerkerLabel";

interface TimeSlotCellProps {
  slotId: string;
  isWeekend: boolean;
  onClick: () => void;
}

function TimeSlotCell({ slotId, isWeekend, onClick }: TimeSlotCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`h-full border-r border-subtle cursor-pointer transition-colors
        ${isWeekend ? "bg-sunken/30" : ""}
        ${isOver ? "bg-brand-100/50 dark:bg-brand-900/20 ring-1 ring-brand-300" : "hover:bg-sunken/50"}`}
      style={{ minWidth: "60px", width: "60px" }}
    />
  );
}

export interface RoosterRowProps {
  practitionerId: string;
  naam: string;
  geplandUren: number;
  contractUren: number;
  contractOnbekend: boolean;
  afspraken: FhirAppointment[];
  weekDays: Date[];
  onSlotClick: (practitionerId: string, date: string, time: string) => void;
  celBreedte: number;
}

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function timeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h < 22; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const GRID_START_MINUUT = 360; // 06:00 = 6 * 60
const TIME_SLOTS = timeSlots();

export function RoosterRow({
  practitionerId,
  naam,
  geplandUren,
  contractUren,
  contractOnbekend,
  afspraken,
  weekDays,
  onSlotClick,
  celBreedte,
}: RoosterRowProps) {
  return (
    <div className="flex border-b border-subtle last:border-0 hover:bg-sunken/20 transition-colors">
      {/* Sticky medewerker label */}
      <div className="sticky left-0 z-20 bg-raised border-r border-default px-3 py-2 flex items-center"
           style={{ minWidth: "180px", width: "180px" }}>
        <MedewerkerLabel
          naam={naam}
          geplandUren={geplandUren}
          contractUren={contractUren}
          contractOnbekend={contractOnbekend}
        />
      </div>

      {/* Day groups */}
      {weekDays.map((day) => {
        const dateStr = dateString(day);
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const dayAfspraken = afspraken.filter(
          (a) => a.start?.slice(0, 10) === dateStr,
        );

        return (
          <div
            key={dateStr}
            className="flex relative border-r border-default"
            style={{ minWidth: `${TIME_SLOTS.length * celBreedte}px` }}
          >
            {/* Time slot cells (droppable targets) */}
            {TIME_SLOTS.map((time) => {
              const slotId = `slot:${practitionerId}:${dateStr}:${time}`;
              return (
                <TimeSlotCell
                  key={slotId}
                  slotId={slotId}
                  isWeekend={isWeekend}
                  onClick={() => onSlotClick(practitionerId, dateStr, time)}
                />
              );
            })}

            {/* Appointment blocks (absolute positioned) */}
            {dayAfspraken.map((appt) => (
              <AfspraakBlock
                key={appt.id}
                afspraak={appt}
                celBreedte={celBreedte}
                gridStartMinuut={GRID_START_MINUUT}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
