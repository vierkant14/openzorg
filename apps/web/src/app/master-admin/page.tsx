"use client";

import { useEffect, useState } from "react";

import { masterFetch } from "../../lib/master-api";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  medplum_project_id: string;
  enabled_modules: string[];
  sector: string | null;
  contact_email: string | null;
  contact_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface StatsResponse {
  totalTenants: number;
  activeTenants: number;
}

const SECTOR_LABELS: Record<string, string> = {
  vvt: "VVT",
  ggz: "GGZ",
  ghz: "GHZ",
  ziekenhuis: "Ziekenhuis",
  jeugdzorg: "Jeugdzorg",
  huisartsenzorg: "Huisartsenzorg",
  revalidatie: "Revalidatie",
};

export default function MasterAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [tenantsRes, statsRes] = await Promise.allSettled([
        masterFetch<{ tenants: Tenant[] }>("/api/master/tenants"),
        masterFetch<StatsResponse>("/api/master/tenants/stats/overview"),
      ]);

      if (tenantsRes.status === "fulfilled" && tenantsRes.value.data) {
        setTenants(tenantsRes.value.data.tenants);
      } else if (tenantsRes.status === "fulfilled" && tenantsRes.value.error) {
        setError(tenantsRes.value.error);
      }

      if (statsRes.status === "fulfilled" && statsRes.value.data) {
        setStats(statsRes.value.data);
      }

      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500">
                <span className="font-display text-sm font-extrabold text-white tracking-tight">OZ</span>
              </div>
              <div>
                <h1 className="font-display text-heading font-bold tracking-tight">Master Admin</h1>
                <p className="text-body-sm text-navy-300">Platform beheer &middot; Alle omgevingen</p>
              </div>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-navy-300 text-body-sm font-medium rounded-xl hover:text-white hover:bg-navy-800 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Terug naar app
            </a>
            <a
              href="/master-admin/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nieuwe omgeving
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Totaal omgevingen" value={stats?.totalTenants ?? 0} />
          <StatCard label="Actief" value={stats?.activeTenants ?? 0} accent />
          <StatCard label="Sectoren" value={new Set(tenants.map((t) => t.sector)).size} />
          <StatCard label="Modules actief" value={tenants.reduce((acc, t) => acc + t.enabled_modules.length, 0)} />
        </div>

        {/* Tenants table */}
        <div className="mb-6">
          <h2 className="text-heading text-fg mb-4">Omgevingen</h2>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-body-sm text-fg-muted">Omgevingen laden...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-6 mb-6">
            <p className="text-body-sm text-coral-700 dark:text-coral-300">{error}</p>
            <p className="text-caption text-coral-600 dark:text-coral-400 mt-2">
              Controleer of de ECD service draait en of de database bereikbaar is.
            </p>
          </div>
        )}

        {!loading && !error && tenants.length === 0 && (
          <div className="text-center py-24">
            <h3 className="text-heading text-fg">Nog geen omgevingen</h3>
            <p className="text-body-sm text-fg-muted mt-1 max-w-sm mx-auto">
              Maak je eerste omgeving aan via de onboarding wizard.
            </p>
            <a
              href="/master-admin/onboarding"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
            >
              Eerste omgeving aanmaken
            </a>
          </div>
        )}

        {!loading && !error && tenants.length > 0 && (
          <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-default">
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Organisatie</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Slug</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden md:table-cell">Sector</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden lg:table-cell">Modules</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden lg:table-cell">Contact</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Status</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Aangemaakt</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="border-b border-subtle last:border-0 hover:bg-sunken transition-colors cursor-pointer group"
                      onClick={() => { window.location.href = `/master-admin/tenants/${tenant.id}`; }}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <a
                            href={`/master-admin/tenants/${tenant.id}`}
                            className="font-semibold text-fg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tenant.name}
                          </a>
                          <p className="text-caption text-fg-subtle font-mono">{tenant.medplum_project_id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-caption text-fg-muted">{tenant.slug}</td>
                      <td className="px-6 py-4 text-fg-muted hidden md:table-cell">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-caption font-medium bg-navy-50 dark:bg-navy-900/30 text-navy-700 dark:text-navy-300">
                          {SECTOR_LABELS[tenant.sector ?? ""] ?? tenant.sector ?? "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-fg-muted hidden lg:table-cell">
                        <span className="text-caption">{tenant.enabled_modules.length} actief</span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div>
                          <p className="text-caption text-fg-muted">{tenant.contact_name ?? "—"}</p>
                          <p className="text-caption text-fg-subtle">{tenant.contact_email ?? ""}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {tenant.status === "active" ? (
                          <span className="inline-flex items-center gap-1.5 text-caption font-medium text-brand-600 dark:text-brand-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                            Actief
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-caption font-medium text-fg-subtle">
                            <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />
                            Inactief
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-caption text-fg-subtle">
                        {new Date(tenant.created_at).toLocaleDateString("nl-NL", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-subtle">
              <p className="text-caption text-fg-subtle">{tenants.length} omgevingen</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-raised rounded-2xl p-5 border border-subtle transition-shadow hover:shadow-soft">
      <p className="text-overline text-fg-subtle uppercase tracking-wider">{label}</p>
      <p className={`text-display-md mt-1 font-display ${accent ? "text-brand-600 dark:text-brand-400" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}
