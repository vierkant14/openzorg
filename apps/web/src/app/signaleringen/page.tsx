"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* -- Types -- */

interface FhirFlag {
  id?: string;
  status?: string;
  code?: { text?: string };
  category?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
  subject?: { reference?: string; display?: string };
  period?: { start?: string };
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
  entry?: Array<{ resource: FhirFlag | FhirPatient }>;
}

/* -- Helpers -- */

const ERNST_CLASSES: Record<string, string> = {
  laag: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  midden: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  hoog: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
};

function formatDatum(iso?: string): string {
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

function getPatientId(flag: FhirFlag): string | undefined {
  return flag.subject?.reference?.replace("Patient/", "");
}

function getExtValue(flag: FhirFlag, key: string): string | undefined {
  return flag.extension?.find((e) => e.url?.endsWith(key))?.valueString;
}

function getErnst(flag: FhirFlag): string {
  return getExtValue(flag, "signalering-ernst") ?? "midden";
}

function getToelichting(flag: FhirFlag): string {
  return getExtValue(flag, "signalering-toelichting") ?? "\u2014";
}

function getCategorie(flag: FhirFlag): string {
  return flag.category?.[0]?.coding?.[0]?.display ?? flag.category?.[0]?.coding?.[0]?.code ?? "\u2014";
}

function isThisWeek(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 7);
  return d >= weekAgo && d <= now;
}

/* -- Component -- */

export default function SignaleringenOverzichtPage() {
  const [flags, setFlags] = useState<FhirFlag[]>([]);
  const [_patients, setPatients] = useState<Map<string, FhirPatient>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterErnst, setFilterErnst] = useState("alle");
  const [filterType, setFilterType] = useState("alle");

  const loadData = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle>("/api/signaleringen/overzicht?limit=200").then(({ data }) => {
      const f: FhirFlag[] = [];
      const pats = new Map<string, FhirPatient>();
      for (const entry of data?.entry ?? []) {
        const r = entry.resource;
        if ("code" in r && "period" in r) {
          f.push(r as FhirFlag);
        } else if ((r as FhirPatient).resourceType === "Patient" || "name" in r) {
          const pat = r as FhirPatient;
          if (pat.id) pats.set(pat.id, pat);
        }
      }
      setFlags(f);
      setPatients(pats);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Unique categories for filter */
  const categorieTypes = useMemo(() => {
    const types = new Set<string>();
    for (const flag of flags) {
      const cat = getCategorie(flag);
      if (cat !== "\u2014") types.add(cat);
    }
    return [...types].sort();
  }, [flags]);

  /* Filtered list */
  const filtered = useMemo(() => {
    return flags.filter((flag) => {
      if (filterErnst !== "alle" && getErnst(flag) !== filterErnst) return false;
      if (filterType !== "alle" && getCategorie(flag) !== filterType) return false;
      return true;
    });
  }, [flags, filterErnst, filterType]);

  /* Stats */
  const totaalActief = flags.length;
  const hoogRisico = flags.filter((f) => getErnst(f) === "hoog").length;
  const nieuwDezeWeek = flags.filter((f) => isThisWeek(f.period?.start)).length;

  function getPatientDisplay(flag: FhirFlag): string {
    const pid = getPatientId(flag);
    if (pid && _patients.has(pid)) return patientName(_patients.get(pid)!);
    if (flag.subject?.display) return flag.subject.display;
    return pid ?? "\u2014";
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-fg">Signaleringen overzicht</h1>
          <p className="mt-1 text-sm text-fg-muted">Alle actieve signaleringen binnen de organisatie</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Totaal actief" value={totaalActief} />
          <StatCard label="Hoog risico" value={hoogRisico} accent />
          <StatCard label="Nieuw deze week" value={nieuwDezeWeek} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Ernst</label>
            <select
              value={filterErnst}
              onChange={(e) => setFilterErnst(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="alle">Alle</option>
              <option value="hoog">Hoog</option>
              <option value="midden">Midden</option>
              <option value="laag">Laag</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="alle">Alle</option>
              {categorieTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {(filterErnst !== "alle" || filterType !== "alle") && (
            <button
              onClick={() => { setFilterErnst("alle"); setFilterType("alle"); }}
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
            <p className="text-fg-muted">Geen signaleringen gevonden.</p>
            <p className="mt-2 text-xs text-fg-subtle">Pas de filters aan of voeg signaleringen toe bij een client.</p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="rounded-xl border border-default bg-raised overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-page">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Signalering</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Ernst</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Sinds</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Toelichting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filtered.map((flag) => {
                    const pid = getPatientId(flag);
                    const ernst = getErnst(flag);
                    return (
                      <tr key={flag.id} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg">
                          {pid ? (
                            <Link href={`/ecd/${pid}/signaleringen`} className="text-brand-600 hover:underline dark:text-brand-400">
                              {getPatientDisplay(flag)}
                            </Link>
                          ) : (
                            getPatientDisplay(flag)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-fg">{flag.code?.text ?? getCategorie(flag)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ERNST_CLASSES[ernst] ?? ERNST_CLASSES.midden}`}>
                            {ernst.charAt(0).toUpperCase() + ernst.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-fg whitespace-nowrap">{formatDatum(flag.period?.start)}</td>
                        <td className="px-4 py-3 text-sm text-fg max-w-xs truncate">{getToelichting(flag)}</td>
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
