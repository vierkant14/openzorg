"use client";

import { useEffect, useMemo, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

/* ── Types ── */

interface AuditEventEntity {
  what?: { reference?: string; display?: string };
}

interface FhirAuditEvent {
  id?: string;
  recorded?: string;
  outcome?: string;
  outcomeDesc?: string;
  entity?: AuditEventEntity[];
  extension?: Array<{ url?: string; valueString?: string }>;
  purposeOfEvent?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
}

interface AuditEventBundle {
  resourceType?: string;
  total?: number;
  entry?: Array<{ resource: FhirAuditEvent }>;
}

/* ── Helpers ── */

const ERNST_CLASSES: Record<string, string> = {
  laag: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  middel: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  midden: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  hoog: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
};

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

function getExtValue(ev: FhirAuditEvent, key: string): string | undefined {
  return ev.extension?.find((e) => e.url?.endsWith(key))?.valueString;
}

function getClientDisplay(ev: FhirAuditEvent): string {
  const entity = ev.entity?.[0];
  if (entity?.what?.display) return entity.what.display;
  if (entity?.what?.reference) return entity.what.reference.replace("Patient/", "");
  return "\u2014";
}

function toYearMonth(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const idx = parseInt(month ?? "1", 10) - 1;
  return `${MONTHS[idx]} ${year?.slice(2)}`;
}

/* ── Component ── */

export default function MicTrendsPage() {
  const [meldingen, setMeldingen] = useState<FhirAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterVan, setFilterVan] = useState("");
  const [filterTot, setFilterTot] = useState("");
  const [filterErnst, setFilterErnst] = useState("alle");
  const [filterSoort, setFilterSoort] = useState("alle");

  useEffect(() => {
    setLoading(true);
    ecdFetch<AuditEventBundle>("/api/mic-meldingen?_count=200").then(({ data }) => {
      setMeldingen(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, []);

  /* Filtered list */
  const filtered = useMemo(() => {
    return meldingen.filter((m) => {
      // Period filter
      if (filterVan && m.recorded && m.recorded < filterVan) return false;
      if (filterTot && m.recorded && m.recorded > filterTot + "T23:59:59") return false;
      // Ernst filter
      if (filterErnst !== "alle") {
        const ernst = getExtValue(m, "mic-ernst") ?? "midden";
        if (ernst !== filterErnst) return false;
      }
      // Soort filter
      if (filterSoort !== "alle") {
        const soort = getExtValue(m, "mic-soort") ?? m.purposeOfEvent?.[0]?.text ?? "Incident";
        if (soort.toLowerCase() !== filterSoort.toLowerCase()) return false;
      }
      return true;
    });
  }, [meldingen, filterVan, filterTot, filterErnst, filterSoort]);

  /* Stats */
  const totaal = filtered.length;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dezeMaand = filtered.filter((m) => toYearMonth(m.recorded) === currentMonth).length;

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of filtered) {
      const ym = toYearMonth(m.recorded);
      if (ym) counts[ym] = (counts[ym] ?? 0) + 1;
    }
    return counts;
  }, [filtered]);

  const uniqueMonths = Object.keys(monthCounts).length;
  const gemiddeld = uniqueMonths > 0 ? Math.round(totaal / uniqueMonths * 10) / 10 : 0;

  const openAfhandeling = filtered.filter((m) => m.outcome === "0" || !m.outcome).length;

  /* Bar chart data — last 6 months */
  const chartData = useMemo(() => {
    const months: { label: string; key: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ label: monthLabel(key), key, count: monthCounts[key] ?? 0 });
    }
    return months;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCounts]);

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  /* Unique soorten for filter dropdown */
  const soorten = useMemo(() => {
    const set = new Set<string>();
    for (const m of meldingen) {
      const s = getExtValue(m, "mic-soort") ?? m.purposeOfEvent?.[0]?.text;
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [meldingen]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-display-lg text-fg">MIC Trendrapportage</h1>
          <p className="text-body text-fg-muted mt-1">
            Overzicht en trends van Meldingen Incidenten Clientenzorg
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Totaal meldingen" value={totaal} />
          <StatCard label="Meldingen deze maand" value={dezeMaand} />
          <StatCard label="Gemiddeld per maand" value={gemiddeld} />
          <StatCard label="Open afhandeling" value={openAfhandeling} accent={openAfhandeling > 0} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-default bg-raised p-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Periode van</label>
            <input
              type="date"
              value={filterVan}
              onChange={(e) => setFilterVan(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Periode tot</label>
            <input
              type="date"
              value={filterTot}
              onChange={(e) => setFilterTot(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Ernst</label>
            <select
              value={filterErnst}
              onChange={(e) => setFilterErnst(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            >
              <option value="alle">Alle</option>
              <option value="hoog">Hoog</option>
              <option value="midden">Midden</option>
              <option value="laag">Laag</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Soort</label>
            <select
              value={filterSoort}
              onChange={(e) => setFilterSoort(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            >
              <option value="alle">Alle</option>
              {soorten.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {(filterVan || filterTot || filterErnst !== "alle" || filterSoort !== "alle") && (
            <button
              onClick={() => { setFilterVan(""); setFilterTot(""); setFilterErnst("alle"); setFilterSoort("alle"); }}
              className="text-sm text-brand-600 hover:text-brand-800 font-medium"
            >
              Filters wissen
            </button>
          )}
        </div>

        {/* Bar chart */}
        <div className="rounded-xl border border-default bg-raised p-6">
          <h2 className="text-lg font-bold text-fg mb-4">Meldingen per maand (laatste 6 maanden)</h2>
          <div className="flex items-end gap-3 h-48">
            {chartData.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-fg-muted">{d.count}</span>
                <div
                  className="w-full rounded-t-md bg-brand-500 transition-all duration-300"
                  style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0px" }}
                />
                <span className="text-[10px] text-fg-subtle mt-1">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading && <p className="text-fg-muted">Laden...</p>}

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-default bg-raised p-8 text-center">
            <p className="text-fg-muted">Geen MIC-meldingen gevonden voor de geselecteerde filters.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl border border-default bg-raised overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-page">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Ernst</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Soort</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Toelichting</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filtered.map((m) => {
                    const ernst = getExtValue(m, "mic-ernst") ?? "midden";
                    const soort = getExtValue(m, "mic-soort") ?? m.purposeOfEvent?.[0]?.text ?? "Incident";
                    const toelichting = getExtValue(m, "mic-toelichting") ?? m.outcomeDesc ?? "\u2014";
                    const isOpen = m.outcome === "0" || !m.outcome;
                    return (
                      <tr key={m.id} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg whitespace-nowrap">{formatDatum(m.recorded)}</td>
                        <td className="px-4 py-3 text-sm text-fg">{getClientDisplay(m)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ERNST_CLASSES[ernst] ?? ERNST_CLASSES.midden}`}>
                            {ernst.charAt(0).toUpperCase() + ernst.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-fg-muted">{soort}</td>
                        <td className="px-4 py-3 text-sm text-fg max-w-xs truncate">{toelichting}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${isOpen ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" : "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300"}`}>
                            {isOpen ? "Open" : "Afgehandeld"}
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
