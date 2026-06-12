"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* -- Types -- */

interface FhirImmunization {
  id?: string;
  status?: string;
  vaccineCode?: { text?: string; coding?: Array<{ display?: string }> };
  patient?: { reference?: string; display?: string };
  occurrenceDateTime?: string;
  extension?: Array<{ url?: string; valueDate?: string; valueBoolean?: boolean; valueString?: string }>;
}

interface FhirPatient {
  id?: string;
  resourceType?: string;
  name?: Array<{ text?: string; given?: string[]; family?: string }>;
}

interface FhirBundle {
  resourceType?: string;
  total?: number;
  entry?: Array<{ resource: FhirImmunization | FhirPatient }>;
}

/* -- Helpers -- */

const STATUS_CLASSES: Record<string, string> = {
  geldig: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  "bijna-verlopen": "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  verlopen: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
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

function getExtValue(imm: FhirImmunization, key: string): string | undefined {
  return imm.extension?.find((e) => e.url?.endsWith(key))?.valueDate
    ?? imm.extension?.find((e) => e.url?.endsWith(key))?.valueString;
}

function getPatientId(imm: FhirImmunization): string | undefined {
  return imm.patient?.reference?.replace("Patient/", "");
}

function getVaccineName(imm: FhirImmunization): string {
  return imm.vaccineCode?.text ?? imm.vaccineCode?.coding?.[0]?.display ?? "Onbekend vaccin";
}

function computeStatus(imm: FhirImmunization): "geldig" | "bijna-verlopen" | "verlopen" {
  const geldigTot = getExtValue(imm, "geldig-tot");
  if (!geldigTot) {
    // No expiry set — check if occurrence > 1 year ago
    if (imm.occurrenceDateTime) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (new Date(imm.occurrenceDateTime) < oneYearAgo) return "verlopen";
    }
    return "geldig";
  }
  const expiry = new Date(geldigTot);
  const now = new Date();
  if (expiry < now) return "verlopen";
  const threeMonths = new Date();
  threeMonths.setMonth(threeMonths.getMonth() + 3);
  if (expiry < threeMonths) return "bijna-verlopen";
  return "geldig";
}

const STATUS_LABELS: Record<string, string> = {
  geldig: "Geldig",
  "bijna-verlopen": "Bijna verlopen",
  verlopen: "Verlopen",
};

/* -- Component -- */

export default function VaccinatiesOverzichtPage() {
  const [immunizations, setImmunizations] = useState<FhirImmunization[]>([]);
  const [patients, setPatients] = useState<Map<string, FhirPatient>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterVan, setFilterVan] = useState("");
  const [filterTot, setFilterTot] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("alle");

  const loadData = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle>("/api/vaccinaties/overzicht?_count=200").then(({ data }) => {
      const imms: FhirImmunization[] = [];
      const pats = new Map<string, FhirPatient>();
      for (const entry of data?.entry ?? []) {
        const r = entry.resource;
        if ("vaccineCode" in r) {
          imms.push(r as FhirImmunization);
        } else if ((r as FhirPatient).resourceType === "Patient" || ("name" in r && !("vaccineCode" in r))) {
          const pat = r as FhirPatient;
          if (pat.id) pats.set(pat.id, pat);
        }
      }
      setImmunizations(imms);
      setPatients(pats);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Unique vaccine types for filter */
  const vaccineTypes = useMemo(() => {
    const types = new Set<string>();
    for (const imm of immunizations) {
      types.add(getVaccineName(imm));
    }
    return [...types].sort();
  }, [immunizations]);

  /* Filtered list */
  const filtered = useMemo(() => {
    return immunizations.filter((imm) => {
      if (filterVan && imm.occurrenceDateTime && imm.occurrenceDateTime < filterVan) return false;
      if (filterTot && imm.occurrenceDateTime && imm.occurrenceDateTime > filterTot + "T23:59:59") return false;
      if (filterType && getVaccineName(imm) !== filterType) return false;
      if (filterStatus !== "alle") {
        const status = computeStatus(imm);
        if (status !== filterStatus) return false;
      }
      return true;
    });
  }, [immunizations, filterVan, filterTot, filterType, filterStatus]);

  /* Stats */
  const totaal = immunizations.length;
  const verlopen = immunizations.filter((i) => computeStatus(i) === "verlopen").length;
  const bijnaVerlopen = immunizations.filter((i) => computeStatus(i) === "bijna-verlopen").length;
  // Clients without griepprik: count unique patients, minus those with a flu-related vaccine
  const allPatientIds = new Set(immunizations.map(getPatientId).filter(Boolean));
  const patientsWithGriepprik = new Set(
    immunizations
      .filter((i) => {
        const name = getVaccineName(i).toLowerCase();
        return name.includes("griep") || name.includes("influenza");
      })
      .map(getPatientId)
      .filter(Boolean),
  );
  const zonderGriepprik = allPatientIds.size - patientsWithGriepprik.size;

  function getPatientDisplay(imm: FhirImmunization): string {
    const pid = getPatientId(imm);
    if (pid && patients.has(pid)) return patientName(patients.get(pid)!);
    if (imm.patient?.display) return imm.patient.display;
    return pid ?? "\u2014";
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-fg">Vaccinaties overzicht</h1>
          <p className="mt-1 text-sm text-fg-muted">Alle vaccinaties binnen de organisatie</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Totaal vaccinaties" value={totaal} />
          <StatCard label="Verlopen (> 1 jaar)" value={verlopen} accent />
          <StatCard label="Bijna verlopen (< 3 mnd)" value={bijnaVerlopen} />
          <StatCard label="Clienten zonder griepprik" value={zonderGriepprik} />
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
            <label className="block text-xs font-medium text-fg-subtle mb-1">Type vaccin</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="">Alle</option>
              {vaccineTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="alle">Alle</option>
              <option value="geldig">Geldig</option>
              <option value="bijna-verlopen">Bijna verlopen</option>
              <option value="verlopen">Verlopen</option>
            </select>
          </div>
          {(filterVan || filterTot || filterType || filterStatus !== "alle") && (
            <button
              onClick={() => { setFilterVan(""); setFilterTot(""); setFilterType(""); setFilterStatus("alle"); }}
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
            <p className="text-fg-muted">Geen vaccinaties gevonden.</p>
            <p className="mt-2 text-xs text-fg-subtle">Pas de filters aan of voeg vaccinaties toe bij een client.</p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Vaccinatie</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Volgende datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filtered.map((imm) => {
                    const pid = getPatientId(imm);
                    const status = computeStatus(imm);
                    const volgendeDatum = getExtValue(imm, "volgende-datum");
                    return (
                      <tr key={imm.id} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg">
                          {pid ? (
                            <Link href={`/ecd/${pid}/vaccinaties`} className="text-brand-600 hover:underline dark:text-brand-400">
                              {getPatientDisplay(imm)}
                            </Link>
                          ) : (
                            getPatientDisplay(imm)
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-fg">{getVaccineName(imm)}</td>
                        <td className="px-4 py-3 text-sm text-fg whitespace-nowrap">{formatDatum(imm.occurrenceDateTime)}</td>
                        <td className="px-4 py-3 text-sm text-fg-muted whitespace-nowrap">{formatDatum(volgendeDatum)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status] ?? STATUS_CLASSES.geldig}`}>
                            {STATUS_LABELS[status]}
                          </span>
                        </td>
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
