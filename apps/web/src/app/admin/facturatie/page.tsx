"use client";

import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";

const FACTURATIE_BASE = process.env.NEXT_PUBLIC_FACTURATIE_URL || "http://localhost:4004";

interface Declaratie {
  id: string;
  nummer: string;
  financieringstype: string;
  periode: { van: string; tot: string };
  status: string;
  totaalBedrag: number;
  aantalPrestaties: number;
  ingediendOp?: string;
  createdAt: string;
}

interface DeclaratieStats {
  totaal: number;
  totaalOpen: number;
  totaalBetaald: number;
  concept: number;
  ingediend: number;
  geaccepteerd: number;
  afgewezen: number;
  betaald: number;
}

const STATUS_STYLES: Record<string, string> = {
  concept: "bg-surface-100 dark:bg-surface-800 text-fg-muted",
  ingediend: "bg-navy-50 dark:bg-navy-900/30 text-navy-700 dark:text-navy-300",
  geaccepteerd: "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300",
  afgewezen: "bg-coral-50 dark:bg-coral-950/20 text-coral-600",
  betaald: "bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200",
};

const STATUS_LABELS: Record<string, string> = {
  concept: "Concept",
  ingediend: "Ingediend",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
  gecrediteerd: "Gecrediteerd",
  betaald: "Betaald",
};

const FINANCIERING_LABELS: Record<string, string> = {
  wlz: "WLZ",
  wmo: "WMO",
  zvw: "ZVW",
  jeugdwet: "Jeugdwet",
};

function formatBedrag(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

async function facturatieFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${FACTURATIE_BASE}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function FacturatiePage() {
  const [declaraties, setDeclaraties] = useState<Declaratie[]>([]);
  const [stats, setStats] = useState<DeclaratieStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("alle");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await facturatieFetch<{ declaraties: Declaratie[]; stats: DeclaratieStats }>("/api/declaraties");
      if (data) {
        setDeclaraties(data.declaraties);
        setStats(data.stats);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "alle"
    ? declaraties
    : declaraties.filter((d) => d.status === filter);

  return (
    <AppShell>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-display-lg text-fg">Facturatie</h1>
            <p className="text-body text-fg-muted mt-1">Declaraties en zorgprestaties beheren</p>
          </div>
          <a
            href="/admin/facturatie/nieuw"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nieuwe declaratie
          </a>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Open declaraties" value={stats ? formatBedrag(stats.totaalOpen) : "—"} sub={`${stats?.ingediend ?? 0} ingediend`} />
          <StatCard label="Betaald" value={stats ? formatBedrag(stats.totaalBetaald) : "—"} sub={`${stats?.betaald ?? 0} declaraties`} accent />
          <StatCard label="Afgewezen" value={String(stats?.afgewezen ?? 0)} sub="te corrigeren" warn={!!stats && stats.afgewezen > 0} />
          <StatCard label="Concept" value={String(stats?.concept ?? 0)} sub="nog in te dienen" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["alle", "concept", "ingediend", "geaccepteerd", "afgewezen", "betaald"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-caption font-semibold transition-all ${
                filter === s
                  ? "bg-brand-600 text-white"
                  : "bg-raised border border-default text-fg-muted hover:bg-sunken"
              }`}
            >
              {s === "alle" ? "Alle" : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-raised rounded-2xl border border-default">
            <h3 className="text-heading text-fg">Geen declaraties</h3>
            <p className="text-body-sm text-fg-muted mt-1">
              {filter === "alle"
                ? "Maak je eerste declaratie aan via de knop hierboven."
                : `Geen declaraties met status "${STATUS_LABELS[filter] ?? filter}".`}
            </p>
          </div>
        ) : (
          <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-default">
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Nummer</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Type</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Periode</th>
                    <th className="text-right px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Bedrag</th>
                    <th className="text-center px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Prestaties</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Status</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Aangemaakt</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-subtle last:border-0 hover:bg-sunken transition-colors">
                      <td className="px-6 py-4 font-mono text-caption text-brand-600 dark:text-brand-400 font-semibold">{d.nummer}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg text-caption font-medium bg-navy-50 dark:bg-navy-900/30 text-navy-700 dark:text-navy-300">
                          {FINANCIERING_LABELS[d.financieringstype] ?? d.financieringstype}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-fg-muted">
                        {new Date(d.periode.van).toLocaleDateString("nl-NL")} — {new Date(d.periode.tot).toLocaleDateString("nl-NL")}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-fg">{formatBedrag(d.totaalBedrag)}</td>
                      <td className="px-6 py-4 text-center text-fg-muted">{d.aantalPrestaties}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-caption font-medium ${STATUS_STYLES[d.status] ?? ""}`}>
                          {STATUS_LABELS[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-caption text-fg-subtle">
                        {new Date(d.createdAt).toLocaleDateString("nl-NL")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, sub, accent, warn }: { label: string; value: string; sub: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-raised rounded-2xl p-5 border border-default shadow-soft">
      <p className="text-overline text-fg-subtle uppercase tracking-wider">{label}</p>
      <p className={`text-display-sm mt-1 font-display ${warn ? "text-coral-600" : accent ? "text-brand-600 dark:text-brand-400" : "text-fg"}`}>
        {value}
      </p>
      <p className="text-caption text-fg-subtle mt-0.5">{sub}</p>
    </div>
  );
}
