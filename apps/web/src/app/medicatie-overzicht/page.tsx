"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* ── Types ── */

interface FhirMedicationRequest {
  resourceType?: string;
  id?: string;
  status?: string;
  intent?: string;
  medicationCodeableConcept?: { text?: string; coding?: Array<{ display?: string }> };
  subject?: { reference?: string; display?: string };
  requester?: { reference?: string; display?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { code?: { text?: string }; repeat?: { frequency?: number; period?: number; periodUnit?: string } };
    doseAndRate?: Array<{ doseQuantity?: { value?: number; unit?: string } }>;
  }>;
  extension?: Array<{ url?: string; extension?: Array<{ url?: string; valueBoolean?: boolean }> }>;
}

interface FhirPatient {
  id?: string;
  resourceType?: string;
  name?: Array<{ text?: string; given?: string[]; family?: string }>;
}

interface FhirBundle {
  resourceType?: string;
  total?: number;
  entry?: Array<{ resource: FhirMedicationRequest | FhirPatient }>;
}

/* ── Helpers ── */

function getMedicamentNaam(mr: FhirMedicationRequest): string {
  if (mr.medicationCodeableConcept?.text) return mr.medicationCodeableConcept.text;
  const coding = mr.medicationCodeableConcept?.coding?.[0];
  if (coding?.display) return coding.display;
  return "\u2014";
}

function getDosering(mr: FhirMedicationRequest): string {
  const instr = mr.dosageInstruction?.[0];
  if (!instr) return "\u2014";
  const dose = instr.doseAndRate?.[0]?.doseQuantity;
  if (dose?.value != null) return `${dose.value} ${dose.unit ?? ""}`.trim();
  if (instr.text) {
    const parts = instr.text.split(",");
    return parts[0]?.trim() ?? instr.text;
  }
  return "\u2014";
}

function getFrequentie(mr: FhirMedicationRequest): string {
  const instr = mr.dosageInstruction?.[0];
  if (!instr) return "\u2014";
  if (instr.timing?.code?.text) return instr.timing.code.text;
  const repeat = instr.timing?.repeat;
  if (repeat?.frequency && repeat.period && repeat.periodUnit) {
    return `${repeat.frequency}x per ${repeat.period} ${repeat.periodUnit}`;
  }
  if (instr.text) {
    const parts = instr.text.split(",");
    return parts[1]?.trim() ?? "\u2014";
  }
  return "\u2014";
}

function getVoorschrijver(mr: FhirMedicationRequest): string {
  if (mr.requester?.display) return mr.requester.display;
  if (mr.requester?.reference) return mr.requester.reference.replace("Practitioner/", "");
  return "\u2014";
}

function getClientId(mr: FhirMedicationRequest): string | undefined {
  const ref = mr.subject?.reference;
  if (!ref) return undefined;
  return ref.replace("Patient/", "");
}

function isHoogRisico(mr: FhirMedicationRequest): boolean {
  return mr.extension?.some((ext) =>
    ext.url?.endsWith("dubbele-controle") &&
    ext.extension?.some((sub) => sub.url === "akkoord"),
  ) ?? false;
}

function patientName(p: FhirPatient): string {
  if (p.name?.[0]?.text) return p.name[0].text;
  const given = p.name?.[0]?.given?.join(" ") ?? "";
  const family = p.name?.[0]?.family ?? "";
  return `${given} ${family}`.trim() || p.id || "Onbekend";
}

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  stopped: "bg-surface-100 text-surface-600 dark:bg-surface-800/40 dark:text-surface-400",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Actief",
  stopped: "Gestopt",
  "on-hold": "Gepauzeerd",
  cancelled: "Geannuleerd",
  completed: "Voltooid",
  draft: "Concept",
};

/* ── Component ── */

export default function MedicatieOverzichtPage() {
  const [medicaties, setMedicaties] = useState<FhirMedicationRequest[]>([]);
  const [patients, setPatients] = useState<Map<string, FhirPatient>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterMedicament, setFilterMedicament] = useState("");
  const [filterStatus, setFilterStatus] = useState("alle");
  const [filterVoorschrijver, setFilterVoorschrijver] = useState("");

  const loadData = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle>("/api/medicatie-voorschriften?_count=200").then(({ data }) => {
      const entries = data?.entry ?? [];
      const meds: FhirMedicationRequest[] = [];
      const pats = new Map<string, FhirPatient>();

      for (const entry of entries) {
        if (entry.resource.resourceType === "Patient") {
          const p = entry.resource as FhirPatient;
          if (p.id) pats.set(p.id, p);
        } else {
          meds.push(entry.resource as FhirMedicationRequest);
        }
      }

      setMedicaties(meds);
      setPatients(pats);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* Filtered list */
  const filtered = useMemo(() => {
    return medicaties.filter((m) => {
      if (filterMedicament) {
        const naam = getMedicamentNaam(m).toLowerCase();
        if (!naam.includes(filterMedicament.toLowerCase())) return false;
      }
      if (filterStatus !== "alle" && m.status !== filterStatus) return false;
      if (filterVoorschrijver) {
        const vs = getVoorschrijver(m).toLowerCase();
        if (!vs.includes(filterVoorschrijver.toLowerCase())) return false;
      }
      return true;
    });
  }, [medicaties, filterMedicament, filterStatus, filterVoorschrijver]);

  /* Stats */
  const totaalActief = medicaties.filter((m) => m.status === "active").length;
  const clientenMetMedicatie = new Set(medicaties.map((m) => getClientId(m)).filter(Boolean)).size;
  const uniekeMedicamenten = new Set(medicaties.map((m) => getMedicamentNaam(m).toLowerCase())).size;
  const hoogRisicoCount = medicaties.filter((m) => isHoogRisico(m)).length;

  /* Unique voorschrijvers for filter */
  const voorschrijvers = useMemo(() => {
    const set = new Set<string>();
    for (const m of medicaties) {
      const vs = getVoorschrijver(m);
      if (vs !== "\u2014") set.add(vs);
    }
    return Array.from(set).sort();
  }, [medicaties]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-fg">Medicatie overzicht</h1>
          <p className="mt-1 text-sm text-fg-muted">Alle medicatievoorschriften binnen de organisatie</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Totaal actieve voorschriften" value={totaalActief} />
          <StatCard label="Clienten met medicatie" value={clientenMetMedicatie} />
          <StatCard label="Unieke medicamenten" value={uniekeMedicamenten} />
          <StatCard label="Hoog-risico medicatie" value={hoogRisicoCount} accent />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Medicament</label>
            <input
              type="text"
              value={filterMedicament}
              onChange={(e) => setFilterMedicament(e.target.value)}
              placeholder="Zoek medicament..."
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="alle">Alle</option>
              <option value="active">Actief</option>
              <option value="stopped">Gestopt</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Voorschrijver</label>
            <select
              value={filterVoorschrijver}
              onChange={(e) => setFilterVoorschrijver(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="">Alle</option>
              {voorschrijvers.map((vs) => (
                <option key={vs} value={vs}>{vs}</option>
              ))}
            </select>
          </div>
          {(filterMedicament || filterStatus !== "alle" || filterVoorschrijver) && (
            <button
              onClick={() => { setFilterMedicament(""); setFilterStatus("alle"); setFilterVoorschrijver(""); }}
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
            <p className="text-fg-muted">Geen medicatievoorschriften gevonden.</p>
            <p className="mt-2 text-xs text-fg-subtle">
              Pas de filters aan of voeg medicatie toe bij een client.
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Medicament</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Dosering</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Frequentie</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Voorschrijver</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filtered.map((m) => {
                    const cId = getClientId(m);
                    const patient = cId ? patients.get(cId) : undefined;
                    const clientDisplay = patient ? patientName(patient) : (m.subject?.display ?? cId ?? "\u2014");
                    const status = m.status ?? "active";
                    return (
                      <tr key={m.id} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg">
                          {cId ? (
                            <Link href={`/ecd/${cId}/medicatie`} className="text-brand-600 hover:underline dark:text-brand-400">
                              {clientDisplay}
                            </Link>
                          ) : (
                            clientDisplay
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-fg font-medium">{getMedicamentNaam(m)}</td>
                        <td className="px-4 py-3 text-sm text-fg-muted">{getDosering(m)}</td>
                        <td className="px-4 py-3 text-sm text-fg-muted">{getFrequentie(m)}</td>
                        <td className="px-4 py-3 text-sm text-fg-muted whitespace-nowrap">{getVoorschrijver(m)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status] ?? STATUS_CLASSES.active}`}>
                            {STATUS_LABELS[status] ?? status}
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
