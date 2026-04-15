"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: Array<{ family?: string; given?: string[] }>;
}

interface FhirCarePlan {
  resourceType: "CarePlan";
  id: string;
  status?: string;
  intent?: string;
  title?: string;
  period?: { start?: string; end?: string };
  subject?: { reference?: string; display?: string };
  meta?: { lastUpdated?: string };
  goal?: Array<{ reference?: string }>;
}

interface FhirBundle {
  entry?: Array<{ resource: FhirCarePlan | FhirPatient }>;
}

type FilterStatus = "alle" | "draft" | "active" | "on-hold" | "completed" | "revoked";

function getPatientNaam(patient: FhirPatient | undefined): string {
  if (!patient) return "Onbekend";
  const n = patient.name?.[0];
  if (!n) return "Onbekend";
  return `${(n.given ?? []).join(" ")} ${n.family ?? ""}`.trim() || "Onbekend";
}

function daysBetween(iso: string): number {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Concept", cls: "bg-surface-200 text-fg-muted dark:bg-surface-800" },
  active: { label: "Actief", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" },
  "on-hold": { label: "Gepauzeerd", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" },
  completed: { label: "Afgerond", cls: "bg-navy-100 text-navy-800 dark:bg-navy-950/30 dark:text-navy-300" },
  revoked: { label: "Ingetrokken", cls: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300" },
};

export default function ZorgplannenOverzichtPage() {
  const [plans, setPlans] = useState<FhirCarePlan[]>([]);
  const [patients, setPatients] = useState<Record<string, FhirPatient>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("alle");
  const [zoekterm, setZoekterm] = useState("");

  useEffect(() => {
    setLoading(true);
    ecdFetch<FhirBundle>("/api/zorgplannen").then(({ data, error: err }) => {
      if (err) {
        setError(err);
      } else if (data?.entry) {
        const carePlans: FhirCarePlan[] = [];
        const patientMap: Record<string, FhirPatient> = {};
        for (const e of data.entry) {
          if (e.resource.resourceType === "CarePlan") {
            carePlans.push(e.resource);
          } else if (e.resource.resourceType === "Patient") {
            patientMap[`Patient/${e.resource.id}`] = e.resource;
          }
        }
        setPlans(carePlans);
        setPatients(patientMap);
      }
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (filterStatus !== "alle" && p.status !== filterStatus) return false;
      if (zoekterm) {
        const ref = p.subject?.reference ?? "";
        const naam = getPatientNaam(patients[ref]).toLowerCase();
        const title = (p.title ?? "").toLowerCase();
        if (!naam.includes(zoekterm.toLowerCase()) && !title.includes(zoekterm.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [plans, patients, filterStatus, zoekterm]);

  const stats = useMemo(() => {
    return {
      totaal: plans.length,
      actief: plans.filter((p) => p.status === "active").length,
      concept: plans.filter((p) => p.status === "draft").length,
      overdue: plans.filter((p) => {
        if (p.status !== "active") return false;
        const last = p.meta?.lastUpdated;
        return last ? daysBetween(last) > 180 : false;
      }).length,
    };
  }, [plans]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-fg">Zorgplan-overzicht</h1>
          <p className="mt-2 text-fg-muted">
            Alle zorgplannen binnen je tenant. Monitor status, evaluatie-deadlines en welke cliënten nog geen plan hebben.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Totaal" value={stats.totaal} />
          <StatCard label="Actief" value={stats.actief} cls="text-emerald-600" />
          <StatCard label="Concept" value={stats.concept} cls="text-fg-muted" />
          <StatCard
            label="Evaluatie verlopen (>6mnd)"
            value={stats.overdue}
            cls={stats.overdue > 0 ? "text-coral-600" : "text-fg"}
          />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
          >
            <option value="alle">Alle statussen</option>
            <option value="draft">Concept</option>
            <option value="active">Actief</option>
            <option value="on-hold">Gepauzeerd</option>
            <option value="completed">Afgerond</option>
            <option value="revoked">Ingetrokken</option>
          </select>
          <input
            type="text"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoek op cliëntnaam of titel…"
            className="flex-1 min-w-[240px] rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
          />
        </div>

        {loading && <p className="text-fg-muted">Laden…</p>}
        {error && <p className="text-coral-600">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-default bg-raised p-12 text-center">
            <p className="text-fg-muted">Geen zorgplannen gevonden.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="rounded-xl border border-default bg-raised overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default bg-sunken text-left">
                  <th className="px-4 py-3 font-semibold text-fg-muted">Cliënt</th>
                  <th className="px-4 py-3 font-semibold text-fg-muted">Titel</th>
                  <th className="px-4 py-3 font-semibold text-fg-muted">Status</th>
                  <th className="px-4 py-3 font-semibold text-fg-muted">Periode</th>
                  <th className="px-4 py-3 font-semibold text-fg-muted">Laatst bijgewerkt</th>
                  <th className="px-4 py-3 font-semibold text-fg-muted">Doelen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((plan) => {
                  const patient = patients[plan.subject?.reference ?? ""];
                  const patientId = plan.subject?.reference?.replace("Patient/", "") ?? "";
                  const naam = getPatientNaam(patient);
                  const status = plan.status ?? "draft";
                  const statusInfo = STATUS_BADGE[status] ?? STATUS_BADGE.draft!;
                  const lastUpdated = plan.meta?.lastUpdated;
                  const daysSinceUpdate = lastUpdated ? daysBetween(lastUpdated) : null;
                  const overdue = status === "active" && daysSinceUpdate !== null && daysSinceUpdate > 180;
                  return (
                    <tr key={plan.id} className="border-b border-default last:border-0 hover:bg-sunken/50">
                      <td className="px-4 py-3">
                        <Link href={`/ecd/${patientId}/zorgplan`} className="font-medium text-fg hover:text-brand-700">
                          {naam}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-fg-muted">{plan.title ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-fg-subtle">
                        {plan.period?.start ? new Date(plan.period.start).toLocaleDateString("nl-NL") : "—"}
                        {plan.period?.end && ` → ${new Date(plan.period.end).toLocaleDateString("nl-NL")}`}
                      </td>
                      <td className="px-4 py-3 text-fg-subtle">
                        {daysSinceUpdate !== null ? (
                          <span className={overdue ? "text-coral-600 font-medium" : ""}>
                            {daysSinceUpdate} dagen
                            {overdue && " ⚠"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-fg-subtle">{plan.goal?.length ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && (
          <p className="mt-6 text-xs text-fg-subtle">
            💡 Zorgplannen met status <strong>Actief</strong> en een laatste-update ouder dan 6 maanden worden gemarkeerd als verlopen. Het kwaliteitskader VVT vereist minimaal een halfjaarlijkse evaluatie.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, cls = "" }: { label: string; value: number; cls?: string }) {
  return (
    <div className="rounded-xl border border-default bg-raised p-4">
      <div className={`text-3xl font-bold ${cls}`}>{value}</div>
      <div className="text-xs text-fg-muted mt-1">{label}</div>
    </div>
  );
}
