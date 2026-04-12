"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* ── Types ── */

interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: Array<{ family?: string; given?: string[] }>;
  address?: Array<{ line?: string[]; city?: string; postalCode?: string }>;
  active?: boolean;
}

interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  code: { text: string };
  valueString?: string;
  effectiveDateTime?: string;
  extension?: Array<{ url: string; valueString: string }>;
}

interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface ClientOverdracht {
  client: FhirPatient;
  rapportages: FhirObservation[];
}

/* ── Shift definitions ── */

type Shift = "ochtend" | "middag" | "nacht";

interface ShiftDef {
  label: string;
  startHour: number;
  endHour: number;
}

const SHIFTS: Record<Shift, ShiftDef> = {
  ochtend: { label: "Ochtend (07:00 - 15:00)", startHour: 7, endHour: 15 },
  middag: { label: "Middag (15:00 - 23:00)", startHour: 15, endHour: 23 },
  nacht: { label: "Nacht (23:00 - 07:00)", startHour: 23, endHour: 7 },
};

function getCurrentShift(): Shift {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return "ochtend";
  if (hour >= 15 && hour < 23) return "middag";
  return "nacht";
}

/**
 * Returns the time range of the PREVIOUS shift relative to the selected shift.
 * For example, if the current shift is "ochtend" (07-15), the previous shift
 * was "nacht" (23:00 yesterday - 07:00 today).
 */
function getPreviousShiftRange(shift: Shift): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (shift) {
    case "ochtend": {
      // Previous shift: nacht 23:00 yesterday - 07:00 today
      const start = new Date(today);
      start.setDate(start.getDate() - 1);
      start.setHours(23, 0, 0, 0);
      const end = new Date(today);
      end.setHours(7, 0, 0, 0);
      return { start, end };
    }
    case "middag": {
      // Previous shift: ochtend 07:00 - 15:00 today
      const start = new Date(today);
      start.setHours(7, 0, 0, 0);
      const end = new Date(today);
      end.setHours(15, 0, 0, 0);
      return { start, end };
    }
    case "nacht": {
      // Previous shift: middag 15:00 - 23:00 today
      const start = new Date(today);
      start.setHours(15, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 0, 0, 0);
      return { start, end };
    }
  }
}

/* ── Helpers ── */

function formatNaam(patient: FhirPatient): string {
  const name = patient.name?.[0];
  if (!name) return "Onbekend";
  const given = name.given?.join(" ") ?? "";
  const family = name.family ?? "";
  return `${given} ${family}`.trim() || "Onbekend";
}

function getInitials(patient: FhirPatient): string {
  const name = patient.name?.[0];
  const first = name?.given?.[0]?.[0] ?? "";
  const last = name?.family?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function getLocatie(patient: FhirPatient): string {
  const addr = patient.address?.[0];
  if (!addr) return "";
  const parts: string[] = [];
  if (addr.city) parts.push(addr.city);
  return parts.join(", ");
}

function formatTime(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDatumLang(d: Date): string {
  return d.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const AVATAR_COLORS = [
  ["bg-brand-100 dark:bg-brand-900/40", "text-brand-700 dark:text-brand-300"],
  ["bg-coral-100 dark:bg-coral-900/40", "text-coral-700 dark:text-coral-300"],
  ["bg-navy-100 dark:bg-navy-900/40", "text-navy-700 dark:text-navy-300"],
  ["bg-emerald-100 dark:bg-emerald-900/40", "text-emerald-700 dark:text-emerald-300"],
  ["bg-amber-100 dark:bg-amber-900/40", "text-amber-700 dark:text-amber-300"],
] as const;

function avatarColor(name: string): [string, string] {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  const entry = AVATAR_COLORS[idx] ?? AVATAR_COLORS[0]!;
  return [entry[0], entry[1]];
}

/* ── Page ── */

export default function OverdrachtPage() {
  const [shift, setShift] = useState<Shift>(getCurrentShift);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overdrachten, setOverdrachten] = useState<ClientOverdracht[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [akkoordClients, setAkkoordClients] = useState<Set<string>>(new Set());

  const { start: prevStart, end: prevEnd } = useMemo(
    () => getPreviousShiftRange(shift),
    [shift],
  );

  const previousShiftLabel = useMemo(() => {
    switch (shift) {
      case "ochtend": return "nachtdienst";
      case "middag": return "ochtenddienst";
      case "nacht": return "middagdienst";
    }
  }, [shift]);

  const loadOverdrachten = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOverdrachten([]);
    setExpandedClients(new Set());

    // Fetch all clients
    const { data: clientData, error: clientError } = await ecdFetch<FhirBundle<FhirPatient>>(
      "/api/clients?_count=200",
    );

    if (clientError) {
      setError(clientError);
      setLoading(false);
      return;
    }

    const clients = clientData?.entry?.map((e) => e.resource).filter((c) => c.active !== false) ?? [];

    if (clients.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch rapportages for each client in parallel
    const results = await Promise.allSettled(
      clients.map(async (client) => {
        const { data } = await ecdFetch<FhirBundle<FhirObservation>>(
          `/api/clients/${client.id}/rapportages`,
        );
        const allRapportages = data?.entry?.map((e) => e.resource) ?? [];

        // Filter to the previous shift time window
        const filtered = allRapportages.filter((obs) => {
          if (!obs.effectiveDateTime) return false;
          const d = new Date(obs.effectiveDateTime);
          return d >= prevStart && d < prevEnd;
        });

        // Sort by time descending
        filtered.sort((a, b) =>
          (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""),
        );

        return { client, rapportages: filtered };
      }),
    );

    // Only show clients with rapportages in the previous shift
    const withData: ClientOverdracht[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.rapportages.length > 0) {
        withData.push(result.value);
      }
    }

    // Sort by client name
    withData.sort((a, b) => formatNaam(a.client).localeCompare(formatNaam(b.client)));

    // Auto-expand all by default
    setExpandedClients(new Set(withData.map((o) => o.client.id)));
    setOverdrachten(withData);
    setLoading(false);
  }, [prevStart, prevEnd]);

  useEffect(() => {
    loadOverdrachten();
  }, [loadOverdrachten]);

  function toggleExpanded(clientId: string) {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }

  function markAkkoord(clientId: string) {
    setAkkoordClients((prev) => {
      const next = new Set(prev);
      next.add(clientId);
      return next;
    });
  }

  const totalRapportages = overdrachten.reduce((n, o) => n + o.rapportages.length, 0);

  return (
    <AppShell>
      <div className="px-6 lg:px-10 py-8 max-w-[1200px] mx-auto">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-display-lg text-fg">Dienst Overdracht</h1>
            <p className="text-body text-fg-muted mt-1">
              {formatDatumLang(new Date())}
            </p>
          </div>

          {/* Shift selector */}
          <div className="flex items-center gap-2">
            {(Object.entries(SHIFTS) as [Shift, ShiftDef][]).map(([key, _def]) => (
              <button
                key={key}
                onClick={() => setShift(key)}
                className={`px-4 py-2 rounded-xl text-body-sm font-medium transition-colors btn-press ${
                  shift === key
                    ? "bg-brand-600 text-white shadow-soft"
                    : "bg-raised border border-default text-fg-muted hover:bg-sunken"
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Info banner ── */}
        <div className="rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 px-5 py-3 mb-6 flex items-center gap-3">
          <IconInfo className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0" />
          <p className="text-body-sm text-brand-800 dark:text-brand-200">
            Overzicht van de <span className="font-semibold">{previousShiftLabel}</span>{" "}
            ({formatTime(prevStart.toISOString())} - {formatTime(prevEnd.toISOString())}).{" "}
            {!loading && (
              <span>
                {overdrachten.length} {overdrachten.length === 1 ? "client" : "clienten"} met {totalRapportages}{" "}
                {totalRapportages === 1 ? "rapportage" : "rapportages"}.
              </span>
            )}
          </p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600"
                style={{ animation: "spin 0.7s linear infinite" }}
              />
              <p className="text-body-sm text-fg-muted">Overdracht laden...</p>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="rounded-2xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-coral-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div>
                <h3 className="text-subheading text-coral-800 dark:text-coral-200">Fout bij het laden</h3>
                <p className="text-body-sm text-coral-700 dark:text-coral-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && overdrachten.length === 0 && (
          <div className="rounded-2xl border border-dashed border-default bg-raised p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/30 mb-4">
              <IconExchangeLarge className="w-8 h-8 text-brand-400" />
            </div>
            <h3 className="text-heading text-fg">Geen bijzonderheden</h3>
            <p className="text-body-sm text-fg-muted mt-1 max-w-md mx-auto">
              Er zijn geen rapportages gevonden in de {previousShiftLabel}. Dit kan betekenen dat er een rustige dienst was, of dat er nog geen rapportages zijn ingevoerd.
            </p>
          </div>
        )}

        {/* ── Client overdracht cards ── */}
        {!loading && !error && overdrachten.length > 0 && (
          <div className="space-y-4 stagger">
            {overdrachten.map((item) => {
              const naam = formatNaam(item.client);
              const initials = getInitials(item.client);
              const [bgColor, textColor] = avatarColor(naam);
              const locatie = getLocatie(item.client);
              const isExpanded = expandedClients.has(item.client.id);
              const isAkkoord = akkoordClients.has(item.client.id);

              return (
                <div
                  key={item.client.id}
                  className={`rounded-2xl border bg-raised transition-shadow duration-200 ease-out hover:shadow-md ${
                    isAkkoord
                      ? "border-brand-300 dark:border-brand-700"
                      : "border-default"
                  }`}
                >
                  {/* Card header — clickable to collapse/expand */}
                  <button
                    onClick={() => toggleExpanded(item.client.id)}
                    className="w-full flex items-center gap-4 p-5 text-left btn-press"
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}>
                      <span className={`text-body-sm font-bold ${textColor}`}>{initials}</span>
                    </div>

                    {/* Client info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-subheading text-fg font-semibold truncate">{naam}</h3>
                        {isAkkoord && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 dark:bg-brand-950/20 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
                            <IconCheck className="w-3 h-3" />
                            Gelezen
                          </span>
                        )}
                      </div>
                      <p className="text-caption text-fg-subtle">
                        {locatie && <span>{locatie} &middot; </span>}
                        {item.rapportages.length} {item.rapportages.length === 1 ? "rapportage" : "rapportages"}
                      </p>
                    </div>

                    {/* Expand/collapse chevron */}
                    <IconChevron
                      className={`w-5 h-5 text-fg-subtle shrink-0 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Collapsible content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 animate-[fade-in_300ms_cubic-bezier(0.16,1,0.3,1)]">
                      <div className="border-t border-default pt-4">
                        {/* Bijzonderheden — rapportages */}
                        <div className="mb-4">
                          <h4 className="text-overline text-fg-subtle uppercase tracking-wider font-semibold mb-3">
                            Bijzonderheden
                          </h4>
                          <ul className="space-y-3">
                            {item.rapportages.map((obs, idx) => {
                              const type = obs.code?.text ?? "vrij";
                              const isSoep = type.toLowerCase() === "soep";
                              return (
                                <li
                                  key={obs.id ?? idx}
                                  className="rounded-xl border border-subtle bg-page p-4"
                                >
                                  <div className="mb-2 flex items-center gap-3">
                                    <span className="text-xs font-medium text-fg-subtle">
                                      {formatTime(obs.effectiveDateTime)}
                                    </span>
                                    <span
                                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                                        isSoep
                                          ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300"
                                          : "bg-surface-100 dark:bg-surface-800 text-fg-muted"
                                      }`}
                                    >
                                      {isSoep ? "SOEP" : "Vrij"}
                                    </span>
                                  </div>
                                  {isSoep ? (
                                    <dl className="grid gap-1 text-sm">
                                      {(["Subjectief", "Objectief", "Evaluatie", "Plan"] as const).map(
                                        (label, sIdx) => {
                                          const val = obs.extension?.[sIdx]?.valueString;
                                          if (!val) return null;
                                          return (
                                            <div key={label} className="flex gap-2">
                                              <dt className="w-20 shrink-0 font-medium text-fg-muted">
                                                {label[0]}
                                              </dt>
                                              <dd className="text-fg">{val}</dd>
                                            </div>
                                          );
                                        },
                                      )}
                                    </dl>
                                  ) : (
                                    <p className="text-sm text-fg">{obs.valueString ?? "-"}</p>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        {/* Signaleringen placeholder */}
                        <div className="mb-4">
                          <h4 className="text-overline text-fg-subtle uppercase tracking-wider font-semibold mb-2">
                            Signaleringen
                          </h4>
                          <p className="text-caption text-fg-subtle italic">
                            Geen actieve signaleringen
                          </p>
                        </div>

                        {/* Lopende acties placeholder */}
                        <div className="mb-5">
                          <h4 className="text-overline text-fg-subtle uppercase tracking-wider font-semibold mb-2">
                            Lopende acties
                          </h4>
                          <p className="text-caption text-fg-subtle italic">
                            Geen openstaande taken
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <a
                            href={`/ecd/${item.client.id}?tab=rapportages`}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-body-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors btn-press shadow-soft"
                          >
                            <IconPencil className="w-4 h-4" />
                            Rapportage toevoegen
                          </a>
                          {!isAkkoord && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAkkoord(item.client.id);
                              }}
                              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-body-sm font-medium border border-default text-fg-muted hover:bg-sunken transition-colors btn-press"
                            >
                              <IconCheck className="w-4 h-4" />
                              Akkoord
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Refresh button ── */}
        {!loading && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={loadOverdrachten}
              className="inline-flex items-center gap-2 rounded-xl border border-default px-5 py-2.5 text-body-sm font-medium text-fg-muted hover:bg-sunken transition-colors btn-press"
            >
              <IconRefresh className="w-4 h-4" />
              Vernieuwen
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ── Icons ── */

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconExchangeLarge({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 5h18" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 19H3" />
    </svg>
  );
}
