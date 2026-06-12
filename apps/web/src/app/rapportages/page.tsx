"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* -- Types -- */

interface FhirObservation {
  id?: string;
  status?: string;
  code?: { text?: string };
  subject?: { reference?: string; display?: string };
  effectiveDateTime?: string;
  valueString?: string;
  performer?: Array<{ display?: string; reference?: string }>;
  extension?: Array<{ url?: string; valueString?: string }>;
}

interface FhirPatient {
  id?: string;
  resourceType?: string;
  name?: Array<{ text?: string; given?: string[]; family?: string }>;
}

interface FhirBundle {
  resourceType?: string;
  total?: number;
  entry?: Array<{ resource: FhirObservation | FhirPatient }>;
}

/* -- Helpers -- */

function formatDatum(iso?: string): string {
  if (!iso) return "\u2014";
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

function formatDatumShort(iso?: string): string {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function patientName(p: FhirPatient): string {
  if (p.name?.[0]?.text) return p.name[0].text;
  const given = p.name?.[0]?.given?.join(" ") ?? "";
  const family = p.name?.[0]?.family ?? "";
  return `${given} ${family}`.trim() || p.id || "Onbekend";
}

function getPatientId(obs: FhirObservation): string | undefined {
  return obs.subject?.reference?.replace("Patient/", "");
}

function getRapportageType(obs: FhirObservation): "SOEP" | "Vrij" {
  return obs.code?.text?.toLowerCase().includes("soep") ? "SOEP" : "Vrij";
}

function getMedewerkerDisplay(obs: FhirObservation): string {
  if (obs.performer?.[0]?.display) return obs.performer[0].display;
  if (obs.performer?.[0]?.reference) return obs.performer[0].reference.replace("Practitioner/", "");
  return "\u2014";
}

function getSamenvatting(obs: FhirObservation): string {
  const text = obs.valueString ?? "";
  return text.length > 100 ? text.slice(0, 100) + "\u2026" : text || "\u2014";
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const TYPE_CLASSES: Record<string, string> = {
  SOEP: "bg-brand-100 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300",
  Vrij: "bg-slate-100 text-slate-800 dark:bg-slate-950/30 dark:text-slate-300",
};

/* -- Component -- */

export default function RapportagesOverzichtPage() {
  const [observations, setObservations] = useState<FhirObservation[]>([]);
  const [patients, setPatients] = useState<Map<string, FhirPatient>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterVan, setFilterVan] = useState("");
  const [filterTot, setFilterTot] = useState("");
  const [filterType, setFilterType] = useState("alle");
  const [filterMedewerker, setFilterMedewerker] = useState("");

  const loadData = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle>("/api/rapportages-overzicht?_count=200").then(({ data }) => {
      const obs: FhirObservation[] = [];
      const pats = new Map<string, FhirPatient>();
      for (const entry of data?.entry ?? []) {
        const r = entry.resource;
        if ("valueString" in r || ("code" in r && !("name" in r))) {
          obs.push(r as FhirObservation);
        } else if ((r as FhirPatient).resourceType === "Patient" || "name" in r) {
          const pat = r as FhirPatient;
          if (pat.id) pats.set(pat.id, pat);
        }
      }
      setObservations(obs);
      setPatients(pats);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Unique medewerkers for filter */
  const medewerkers = useMemo(() => {
    const names = new Set<string>();
    for (const obs of observations) {
      const name = getMedewerkerDisplay(obs);
      if (name !== "\u2014") names.add(name);
    }
    return [...names].sort();
  }, [observations]);

  /* Filtered list */
  const filtered = useMemo(() => {
    return observations.filter((obs) => {
      if (filterVan && obs.effectiveDateTime && obs.effectiveDateTime < filterVan) return false;
      if (filterTot && obs.effectiveDateTime && obs.effectiveDateTime > filterTot + "T23:59:59") return false;
      if (filterType !== "alle") {
        const type = getRapportageType(obs);
        if (type !== filterType) return false;
      }
      if (filterMedewerker && getMedewerkerDisplay(obs) !== filterMedewerker) return false;
      return true;
    });
  }, [observations, filterVan, filterTot, filterType, filterMedewerker]);

  /* Stats */
  const totaalVandaag = observations.filter((o) => isToday(o.effectiveDateTime)).length;
  const soepCount = observations.filter((o) => getRapportageType(o) === "SOEP").length;
  const vrijCount = observations.filter((o) => getRapportageType(o) === "Vrij").length;
  // Average per day: count unique days, divide total
  const uniqueDays = new Set(
    observations.map((o) => o.effectiveDateTime ? formatDatumShort(o.effectiveDateTime) : "").filter(Boolean),
  );
  const gemiddeldPerDag = uniqueDays.size > 0 ? Math.round((observations.length / uniqueDays.size) * 10) / 10 : 0;

  function getPatientDisplay(obs: FhirObservation): string {
    const pid = getPatientId(obs);
    if (pid && patients.has(pid)) return patientName(patients.get(pid)!);
    if (obs.subject?.display) return obs.subject.display;
    return pid ?? "\u2014";
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-fg">Rapportages overzicht</h1>
          <p className="mt-1 text-sm text-fg-muted">Alle rapportages binnen de organisatie</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Totaal vandaag" value={totaalVandaag} />
          <StatCard label="SOEP-rapportages" value={soepCount} />
          <StatCard label="Vrije tekst" value={vrijCount} />
          <StatCard label="Gemiddeld per dag" value={gemiddeldPerDag} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Van</label>
            <input
              type="date"
              value={filterVan}
              onChange={(e) => setFilterVan(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Tot</label>
            <input
              type="date"
              value={filterTot}
              onChange={(e) => setFilterTot(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="alle">Alle</option>
              <option value="SOEP">SOEP</option>
              <option value="Vrij">Vrij</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Medewerker</label>
            <select
              value={filterMedewerker}
              onChange={(e) => setFilterMedewerker(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="">Alle</option>
              {medewerkers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          {(filterVan || filterTot || filterType !== "alle" || filterMedewerker) && (
            <button
              onClick={() => { setFilterVan(""); setFilterTot(""); setFilterType("alle"); setFilterMedewerker(""); }}
              className="text-xs text-fg-muted hover:text-fg transition-colors"
            >
              Filters wissen
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && <p className="text-fg-muted">Laden...</p>}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-default bg-raised p-8 text-center">
            <p className="text-fg-muted">Geen rapportages gevonden.</p>
            <p className="mt-2 text-xs text-fg-subtle">Pas de filters aan of maak een rapportage aan bij een client.</p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="rounded-xl border border-default bg-raised overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-page">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Medewerker</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Samenvatting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filtered.map((obs) => {
                    const pid = getPatientId(obs);
                    const type = getRapportageType(obs);
                    return (
                      <tr key={obs.id} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg whitespace-nowrap">{formatDatum(obs.effectiveDateTime)}</td>
                        <td className="px-4 py-3 text-sm text-fg">
                          {pid ? (
                            <Link href={`/ecd/${pid}/rapportages`} className="text-brand-600 hover:underline dark:text-brand-400">
                              {getPatientDisplay(obs)}
                            </Link>
                          ) : (
                            getPatientDisplay(obs)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_CLASSES[type] ?? TYPE_CLASSES.Vrij}`}>
                            {type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-fg-muted whitespace-nowrap">{getMedewerkerDisplay(obs)}</td>
                        <td className="px-4 py-3 text-sm text-fg max-w-xs truncate">{getSamenvatting(obs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* -- StatCard -- */

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-default bg-raised p-5">
      <p className="text-xs font-medium text-fg-subtle uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-coral-600 dark:text-coral-400" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}
