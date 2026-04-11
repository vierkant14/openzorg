"use client";

import { useEffect, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* ── Types ── */
interface QuickStat {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}

interface FhirBundle {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource: Record<string, unknown> }>;
}

/* ── Module cards ── */
const MODULES = [
  {
    title: "Clienten",
    description: "Dossiers, zorgplannen, rapportages",
    href: "/ecd",
    accent: "brand" as const,
    icon: IconHeart,
  },
  {
    title: "Planning",
    description: "Roosters, afspraken, beschikbaarheid",
    href: "/planning",
    accent: "brand" as const,
    icon: IconClock,
  },
  {
    title: "Workflows",
    description: "Processen en taken",
    href: "/admin/workflows",
    accent: "navy" as const,
    icon: IconZap,
  },
  {
    title: "Configuratie",
    description: "Velden, regels, instellingen",
    href: "/admin/configuratie",
    accent: "navy" as const,
    icon: IconSliders,
  },
  {
    title: "Medewerkers",
    description: "Medewerkerbeheer en AGB-registratie",
    href: "/admin/medewerkers",
    accent: "navy" as const,
    icon: IconUsers,
  },
  {
    title: "Organisatie",
    description: "Organisatiestructuur en locaties",
    href: "/admin/organisatie",
    accent: "navy" as const,
    icon: IconBuilding,
  },
  {
    title: "Berichten",
    description: "Notificaties en interne berichten",
    href: "/berichten",
    accent: "brand" as const,
    icon: IconMail,
  },
] as const;

const QUICK_ACTIONS = [
  { label: "Nieuwe client", href: "/ecd/nieuw" },
  { label: "Nieuwe afspraak", href: "/planning/nieuw" },
  { label: "Wachtlijst", href: "/planning/wachtlijst" },
  { label: "Beschikbaarheid", href: "/planning/beschikbaarheid" },
] as const;

export default function DashboardPage() {
  const [stats, setStats] = useState<QuickStat[]>([
    { label: "Clienten", value: "—" },
    { label: "Afspraken vandaag", value: "—" },
    { label: "Open taken", value: "—" },
    { label: "Wachtlijst", value: "—" },
  ]);

  useEffect(() => {
    async function loadStats() {
      const [clientsRes, _appointmentsRes] = await Promise.allSettled([
        ecdFetch<FhirBundle>("/api/clients"),
        ecdFetch<FhirBundle>("/api/afspraken"),
      ]);

      const clientCount =
        clientsRes.status === "fulfilled" && clientsRes.value.data?.entry
          ? clientsRes.value.data.entry.length
          : 0;

      setStats([
        { label: "Clienten", value: String(clientCount), sub: "geregistreerd" },
        { label: "Afspraken vandaag", value: "—", sub: "gepland" },
        { label: "Open taken", value: "—", sub: "in werkbak" },
        { label: "Wachtlijst", value: "—", sub: "wachtend" },
      ]);
    }
    loadStats();
  }, []);

  const greeting = getGreeting();

  return (
    <AppShell>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        {/* ── Greeting ── */}
        <div className="mb-10">
          <h1 className="text-display-lg text-fg">{greeting}</h1>
          <p className="text-body text-fg-muted mt-1">
            Hier is je overzicht voor vandaag.
          </p>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 stagger">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-raised rounded-2xl p-5 border border-subtle transition-shadow hover:shadow-soft"
            >
              <p className="text-overline text-fg-subtle uppercase tracking-wider">{stat.label}</p>
              <p className="text-display-md text-fg mt-1 font-display">{stat.value}</p>
              {stat.sub && <p className="text-caption text-fg-subtle mt-0.5">{stat.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Main grid: modules + quick actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Modules — takes 2 cols */}
          <div className="lg:col-span-2">
            <h2 className="text-heading text-fg mb-4">Modules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger">
              {MODULES.map((mod) => (
                <a
                  key={mod.href}
                  href={mod.href}
                  className="group bg-raised rounded-2xl p-6 border border-subtle transition-all duration-200 hover:shadow-lifted hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        mod.accent === "brand"
                          ? "bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400"
                          : "bg-navy-100 dark:bg-navy-900/40 text-navy-600 dark:text-navy-400"
                      }`}
                    >
                      <mod.icon className="w-5 h-5" />
                    </div>
                    <svg
                      className="w-5 h-5 text-fg-subtle opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-subheading text-fg">{mod.title}</h3>
                  <p className="text-body-sm text-fg-muted mt-1">{mod.description}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Quick actions sidebar */}
          <div>
            <h2 className="text-heading text-fg mb-4">Snelle acties</h2>
            <div className="bg-raised rounded-2xl border border-subtle p-2 space-y-1">
              {QUICK_ACTIONS.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-body-sm font-medium text-fg-muted hover:text-fg hover:bg-sunken transition-colors"
                >
                  <svg
                    className="w-4 h-4 text-brand-500 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {action.label}
                </a>
              ))}
            </div>

            {/* Active modules status */}
            <h2 className="text-heading text-fg mt-8 mb-4">Actieve modules</h2>
            <div className="bg-raised rounded-2xl border border-subtle p-5">
              <div className="space-y-3">
                {[
                  "Clientregistratie", "Zorgplan", "SOEP Rapportage",
                  "MIC-meldingen", "Planning", "Workflows",
                  "Custom velden", "Validatieregels",
                  "Medewerkers", "Organisatie", "Berichten",
                ].map((mod) => (
                  <div key={mod} className="flex items-center justify-between">
                    <span className="text-body-sm text-fg-muted">{mod}</span>
                    <span className="flex items-center gap-1.5 text-caption font-medium text-brand-600 dark:text-brand-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                      Actief
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-subtle">
                  <span className="text-body-sm text-fg-muted">Facturatie</span>
                  <span className="flex items-center gap-1.5 text-caption font-medium text-fg-subtle">
                    <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />
                    Gepland
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ── Helpers ── */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

/* ── Icons ── */
function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconZap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconSliders({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <line x1="8" y1="6" x2="8" y2="6" />
      <line x1="12" y1="6" x2="12" y2="6" />
      <line x1="16" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" />
      <line x1="12" y1="10" x2="12" y2="10" />
      <line x1="16" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" />
      <line x1="12" y1="14" x2="12" y2="14" />
      <line x1="16" y1="14" x2="16" y2="14" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
