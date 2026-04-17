"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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

const TYPE_COLORS: Record<string, string> = {
  "Persoonlijke verzorging": "bg-brand-100 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700 text-brand-800 dark:text-brand-200",
  "Verpleging": "bg-navy-50 dark:bg-navy-900/30 border-navy-300 dark:border-navy-700 text-navy-800 dark:text-navy-200",
  "Begeleiding": "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200",
  "Huishoudelijke hulp": "bg-surface-200 dark:bg-surface-800 border-surface-400 dark:border-surface-600 text-fg",
};

const DEFAULT_COLOR = "bg-raised border-default text-fg";

function formatTijd(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getClientName(appt: FhirAppointment): string {
  const patient = appt.participant?.find((p) =>
    p.actor?.reference?.startsWith("Patient/"),
  );
  return patient?.actor?.display ?? "";
}

interface AfspraakBlockProps {
  afspraak: FhirAppointment;
  celBreedte: number;
  gridStartMinuut: number; // 360 = 06:00
}

export type { FhirAppointment };

export function AfspraakBlock({
  afspraak,
  celBreedte,
  gridStartMinuut,
}: AfspraakBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: afspraak.id ?? "",
      data: { afspraak },
    });

  if (!afspraak.start || !afspraak.end) return null;

  const start = new Date(afspraak.start);
  const end = new Date(afspraak.end);
  const startMinuut = start.getHours() * 60 + start.getMinutes();
  const duurMinuten = (end.getTime() - start.getTime()) / (1000 * 60);

  const left = ((startMinuut - gridStartMinuut) / 30) * celBreedte;
  const width = (duurMinuten / 30) * celBreedte;

  const beschrijving = afspraak.description ?? "Afspraak";
  const colorClass = TYPE_COLORS[beschrijving] ?? DEFAULT_COLOR;
  const clientNaam = getClientName(afspraak);

  const style = {
    transform: CSS.Translate.toString(transform),
    left: `${left}px`,
    width: `${Math.max(width - 2, celBreedte - 2)}px`,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute top-0.5 bottom-0.5 rounded-md border px-1.5 py-0.5 text-[11px] cursor-grab overflow-hidden z-10
        ${colorClass}
        ${isDragging ? "opacity-50 scale-[1.02] shadow-lg z-50" : "hover:shadow-sm"}
        transition-shadow`}
      style={style}
      title={`${beschrijving}${clientNaam ? ` — ${clientNaam}` : ""}\n${formatTijd(afspraak.start)}–${formatTijd(afspraak.end)}`}
    >
      <span className="font-medium block truncate leading-tight">
        {formatTijd(afspraak.start)}–{formatTijd(afspraak.end)}
      </span>
      <span className="block truncate leading-tight opacity-80">
        {clientNaam || beschrijving}
      </span>
    </div>
  );
}
