"use client";

import { EmptyState, LoadingSkeleton, Section } from "@openzorg/shared-ui";
import { useEffect, useState } from "react";

import { ecdFetch } from "../../../lib/api";

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  created_at: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
}

interface ActiviteitenFeedProps {
  /** Meldt aan de container of de sectie kon laden (voor de alles-faalt-staat). */
  onResultaat: (gelukt: boolean) => void;
}

/** FHIR-resourcetype → Nederlands zelfstandig naamwoord met lidwoord. */
const RESOURCE_LABELS: Record<string, string> = {
  Patient: "een cliëntdossier",
  RelatedPerson: "een contactpersoon",
  CarePlan: "een zorgplan",
  Observation: "een rapportage",
  DocumentReference: "een document",
  MedicationRequest: "een medicatievoorschrift",
  AuditEvent: "een MIC-melding",
  Communication: "een bericht",
};

const ACTIE_WERKWOORDEN: Record<string, string> = {
  read: "bekeken",
  create: "toegevoegd",
  update: "bijgewerkt",
  delete: "verwijderd",
};

function zinVoor(entry: AuditEntry): string {
  const wat = RESOURCE_LABELS[entry.resource_type] ?? "gegevens";
  const werkwoord = ACTIE_WERKWOORDEN[entry.action] ?? "geopend";
  return `Je hebt ${wat} ${werkwoord}`;
}

function tijdLabel(iso: string): string {
  const datum = new Date(iso);
  const tijd = datum.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  if (datum.toDateString() === new Date().toDateString()) return tijd;
  return `${datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}, ${tijd}`;
}

/**
 * De laatste 10 audit-events van de ingelogde gebruiker als leesbare zinnen.
 * De audit-log registreert per gebruiker het token-voorvoegsel; daarop
 * filteren we. Inzage kan permissie-gebonden zijn: bij 403 (stil403) of een
 * fout verdwijnt de sectie volledig.
 */
export function ActiviteitenFeed({ onResultaat }: ActiviteitenFeedProps) {
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [laden, setLaden] = useState(true);
  const [verborgen, setVerborgen] = useState(false);

  useEffect(() => {
    let actief = true;
    const token = localStorage.getItem("openzorg_token");
    if (!token) {
      // Zonder sessie-token is er geen gebruikersspoor — sectie overslaan.
      setVerborgen(true);
      setLaden(false);
      onResultaat(true);
      return;
    }
    // De audit-middleware registreert de eerste 36 tekens van het token als user_id.
    const auditGebruiker = token.slice(0, 36);
    ecdFetch<AuditResponse>(
      `/api/admin/audit-log?page=1&limit=10&user=${encodeURIComponent(auditGebruiker)}`,
      { stil403: true },
    ).then(({ data, error, status }) => {
      if (!actief) return;
      if (error || !data) {
        setVerborgen(true);
        onResultaat(status === 403);
      } else {
        setEvents(data.entries.slice(0, 10));
        onResultaat(true);
      }
      setLaden(false);
    });
    return () => {
      actief = false;
    };
  }, [onResultaat]);

  if (verborgen) return null;

  return (
    <Section titel="Recente activiteit">
      {laden ? (
        <LoadingSkeleton regels={4} />
      ) : events.length === 0 ? (
        <EmptyState
          titel="Nog geen activiteit"
          uitleg="Zodra je in dossiers werkt, verschijnen je recente acties hier."
        />
      ) : (
        <ul className="divide-y divide-default">
          {events.map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-sm text-fg">{zinVoor(event)}</span>
              <time dateTime={event.created_at} className="shrink-0 text-xs text-fg-subtle">
                {tijdLabel(event.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
