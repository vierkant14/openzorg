"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AppShell from "../../../../components/AppShell";
import { ecdFetch } from "../../../../lib/api";
import { TabNav } from "../TabNav";

interface AuditEventEntity {
  what?: { reference?: string; display?: string };
  detail?: Array<{ type?: string; valueString?: string }>;
}

interface FhirAuditEvent {
  id?: string;
  recorded?: string;
  outcome?: string;
  outcomeDesc?: string;
  entity?: AuditEventEntity[];
  extension?: Array<{ url?: string; valueString?: string; valueCodeableConcept?: { text?: string } }>;
  purposeOfEvent?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
}

interface AuditEventBundle {
  resourceType?: string;
  entry?: Array<{ resource: FhirAuditEvent }>;
}

const ERNST_CLASSES: Record<string, string> = {
  laag: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  middel: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  midden: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  hoog: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
};

function formatDatum(iso?: string): string {
  if (!iso) return "—";
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

function getExtValue(ev: FhirAuditEvent, key: string): string | undefined {
  return ev.extension?.find((e) => e.url?.endsWith(key))?.valueString;
}

export default function MicMeldingenPage({ params }: { params: Promise<{ id: string }> }) {
  const [clientId, setClientId] = useState<string>("");
  const [meldingen, setMeldingen] = useState<FhirAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setClientId(p.id));
  }, [params]);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    ecdFetch<AuditEventBundle>(
      `/api/mic-meldingen?entity=Patient/${clientId}&_count=50`,
    ).then(({ data }) => {
      setMeldingen(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <TabNav clientId={clientId} />
        <div className="mt-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-fg mb-2">MIC-meldingen</h1>
              <p className="text-sm text-fg-muted">
                Meldingen Incidenten Cliëntenzorg voor deze cliënt. Worden vastgelegd als FHIR AuditEvent
                (NEN 7513-compliant) zodat ze in de landelijke audit-trail terecht komen.
              </p>
            </div>
            <Link
              href="/admin/mic-meldingen"
              className="rounded-lg border border-default bg-raised px-4 py-2 text-sm font-medium text-fg hover:bg-sunken btn-press"
            >
              + Nieuwe melding
            </Link>
          </div>

          {loading && <p className="text-fg-muted">Laden…</p>}

          {!loading && meldingen.length === 0 && (
            <div className="rounded-xl border border-default bg-raised p-8 text-center">
              <p className="text-fg-muted">Geen MIC-meldingen voor deze cliënt.</p>
              <p className="mt-2 text-xs text-fg-subtle">
                Een MIC-melding registreer je bij incidenten: val, medicatiefout, agressie, ongewenst gedrag.
              </p>
            </div>
          )}

          {!loading && meldingen.length > 0 && (
            <div className="space-y-3">
              {meldingen.map((melding) => {
                const ernst = getExtValue(melding, "mic-ernst") ?? "midden";
                const soort = getExtValue(melding, "mic-soort") ?? melding.purposeOfEvent?.[0]?.text ?? "Incident";
                const toelichting = getExtValue(melding, "mic-toelichting");
                return (
                  <div key={melding.id} className="rounded-xl border border-default bg-raised p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ERNST_CLASSES[ernst] ?? ERNST_CLASSES.midden}`}>
                            {ernst.charAt(0).toUpperCase() + ernst.slice(1)}
                          </span>
                          <span className="text-xs text-fg-subtle">{soort}</span>
                        </div>
                        {toelichting && (
                          <div className="mt-1 text-sm text-fg">{toelichting}</div>
                        )}
                        {melding.outcomeDesc && (
                          <div className="mt-1 text-xs text-fg-muted">
                            Uitkomst: {melding.outcomeDesc}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-fg-subtle whitespace-nowrap">
                        {formatDatum(melding.recorded)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
