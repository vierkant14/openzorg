"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* ── Types ── */

interface FhirConsent {
  resourceType?: string;
  id?: string;
  status?: string;
  dateTime?: string;
  category?: Array<{
    coding?: Array<{ code?: string; display?: string; system?: string }>;
    text?: string;
  }>;
  patient?: { reference?: string; display?: string };
  performer?: Array<{ display?: string; reference?: string }>;
  provision?: { period?: { end?: string } };
  sourceAttachment?: { title?: string };
}

interface FhirPatient {
  id?: string;
  resourceType?: string;
  name?: Array<{ text?: string; given?: string[]; family?: string }>;
}

interface FhirBundle {
  resourceType?: string;
  total?: number;
  entry?: Array<{ resource: FhirConsent | FhirPatient }>;
}

interface PatientBundle {
  entry?: Array<{ resource: FhirPatient }>;
}

/* ── Helpers ── */

const TYPE_LABELS: Record<string, string> = {
  behandelverbod: "Behandelverbod",
  euthanasieverklaring: "Euthanasieverklaring",
  volmacht: "Volmacht",
  levenswensverklaring: "Levenswensverklaring",
  donorcodicil: "Donorcodicil",
  "bopz-mentorschap": "BOPZ Mentorschap",
  "bopz-curatele": "BOPZ Curatele",
  "bopz-beschermingsbewind": "BOPZ Beschermingsbewind",
};

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  inactive: "bg-surface-100 text-surface-600 dark:bg-surface-800/40 dark:text-surface-400",
  rejected: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Actief",
  inactive: "Inactief",
  rejected: "Afgewezen",
  proposed: "Voorgesteld",
  draft: "Concept",
};

function getTypeCode(consent: FhirConsent): string {
  return consent.category?.[0]?.coding?.[0]?.code ?? "onbekend";
}

function getTypeDisplay(consent: FhirConsent): string {
  const code = getTypeCode(consent);
  if (TYPE_LABELS[code]) return TYPE_LABELS[code];
  if (consent.category?.[0]?.text) return consent.category[0].text;
  if (consent.category?.[0]?.coding?.[0]?.display) return consent.category[0].coding[0].display;
  return "Onbekend";
}

function getVertegenwoordiger(consent: FhirConsent): string {
  if (consent.performer?.[0]?.display) return consent.performer[0].display;
  if (consent.performer?.[0]?.reference) return consent.performer[0].reference;
  return "\u2014";
}

function getClientId(consent: FhirConsent): string | undefined {
  const ref = consent.patient?.reference;
  if (!ref) return undefined;
  return ref.replace("Patient/", "");
}

function isVerlopen(consent: FhirConsent): boolean {
  const end = consent.provision?.period?.end;
  if (!end) return false;
  return new Date(end) < new Date();
}

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

/* ── Component ── */

export default function WilsverklaringenOverzichtPage() {
  const [verklaringen, setVerklaringen] = useState<FhirConsent[]>([]);
  const [patients, setPatients] = useState<Map<string, FhirPatient>>(new Map());
  const [allPatients, setAllPatients] = useState<FhirPatient[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState("alle");
  const [filterStatus, setFilterStatus] = useState("alle");

  const loadData = useCallback(() => {
    setLoading(true);

    // Load wilsverklaringen and all patients in parallel
    const verklaringenPromise = ecdFetch<FhirBundle>("/api/wilsverklaringen-overzicht?_count=200");
    const patientenPromise = ecdFetch<PatientBundle>("/api/clients?_count=500");

    Promise.all([verklaringenPromise, patientenPromise]).then(([verklRes, patRes]) => {
      const entries = verklRes.data?.entry ?? [];
      const wils: FhirConsent[] = [];
      const pats = new Map<string, FhirPatient>();

      for (const entry of entries) {
        if (entry.resource.resourceType === "Patient") {
          const p = entry.resource as FhirPatient;
          if (p.id) pats.set(p.id, p);
        } else {
          wils.push(entry.resource as FhirConsent);
        }
      }

      setVerklaringen(wils);
      setPatients(pats);
      setAllPatients(patRes.data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Filtered list */
  const filtered = useMemo(() => {
    return verklaringen.filter((v) => {
      if (filterType !== "alle" && getTypeCode(v) !== filterType) return false;
      if (filterStatus === "actief" && (v.status !== "active" || isVerlopen(v))) return false;
      if (filterStatus === "verlopen" && !isVerlopen(v)) return false;
      if (filterStatus === "inactief" && v.status !== "inactive") return false;
      return true;
    });
  }, [verklaringen, filterType, filterStatus]);

  /* Stats */
  const totaal = verklaringen.length;
  const actueel = verklaringen.filter((v) => v.status === "active" && !isVerlopen(v)).length;
  const verlopen = verklaringen.filter((v) => isVerlopen(v)).length;

  // Clients zonder wilsverklaring
  const clientenMetWilsverklaring = new Set(
    verklaringen.map((v) => getClientId(v)).filter(Boolean),
  );
  const clientenZonder = allPatients.filter(
    (p) => p.id && !clientenMetWilsverklaring.has(p.id),
  );
  const clientenZonderCount = clientenZonder.length;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-fg">Wilsverklaringen overzicht</h1>
          <p className="mt-1 text-sm text-fg-muted">Alle wilsverklaringen en BOPZ-statussen binnen de organisatie</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Totaal wilsverklaringen" value={totaal} />
          <StatCard label="Actuele verklaringen" value={actueel} />
          <StatCard label="Verlopen" value={verlopen} accent />
          <StatCard label="Clienten zonder wilsverklaring" value={clientenZonderCount} accent />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="alle">Alle</option>
              {Object.entries(TYPE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
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
              <option value="actief">Actief</option>
              <option value="verlopen">Verlopen</option>
              <option value="inactief">Inactief</option>
            </select>
          </div>
          {(filterType !== "alle" || filterStatus !== "alle") && (
            <button
              onClick={() => { setFilterType("alle"); setFilterStatus("alle"); }}
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
            <p className="text-fg-muted">Geen wilsverklaringen gevonden.</p>
            <p className="mt-2 text-xs text-fg-subtle">
              Pas de filters aan of voeg een wilsverklaring toe bij een client.
            </p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Vertegenwoordiger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filtered.map((v) => {
                    const cId = getClientId(v);
                    const patient = cId ? patients.get(cId) : undefined;
                    const clientDisplay = patient ? patientName(patient) : (v.patient?.display ?? cId ?? "\u2014");
                    const verlopen = isVerlopen(v);
                    const statusKey = verlopen ? "inactive" : (v.status ?? "active");
                    const statusLabel = verlopen ? "Verlopen" : (STATUS_LABELS[v.status ?? "active"] ?? v.status);
                    return (
                      <tr key={v.id} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg">
                          {cId ? (
                            <Link href={`/ecd/${cId}/wilsverklaringen`} className="text-brand-600 hover:underline dark:text-brand-400">
                              {clientDisplay}
                            </Link>
                          ) : (
                            clientDisplay
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-fg font-medium">{getTypeDisplay(v)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[statusKey] ?? STATUS_CLASSES.active}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-fg-muted whitespace-nowrap">{formatDatum(v.dateTime)}</td>
                        <td className="px-4 py-3 text-sm text-fg-muted">{getVertegenwoordiger(v)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clients zonder wilsverklaring */}
        {!loading && clientenZonder.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-fg mb-4">
              Clienten zonder wilsverklaring ({clientenZonderCount})
            </h2>
            <div className="rounded-xl border border-default bg-raised overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default">
                  <thead className="bg-page">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Actie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {clientenZonder.map((p) => (
                      <tr key={p.id} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg">
                          <Link href={`/ecd/${p.id}/wilsverklaringen`} className="text-brand-600 hover:underline dark:text-brand-400">
                            {patientName(p)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/ecd/${p.id}/wilsverklaringen`}
                            className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                          >
                            Wilsverklaring toevoegen
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ── StatCard ── */

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
