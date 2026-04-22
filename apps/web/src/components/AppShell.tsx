"use client";

import type { OpenZorgRole, Permission } from "@openzorg/shared-domain";
import { ROLE_PERMISSIONS, getRoleDefinition } from "@openzorg/shared-domain";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { clearSession, getUserRole, isMasterAdmin, isLoggedIn } from "../lib/api";
import { isFeatureEnabled, type FeatureFlagSlug } from "../lib/features";

import { ChatPanel, useAiChatAvailable } from "./ChatPanel";
import TenantSwitcher from "./TenantSwitcher";

/* ── Navigation items ── */
interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  permission: Permission | null;
  /** Feature-flag vereist — als de flag uit staat verdwijnt dit item */
  featureFlag?: FeatureFlagSlug;
}

interface NavSection {
  label: string;
  items: NavItem[];
  /** If true, section is only shown to master admins */
  masterOnly?: boolean;
}

/**
 * Navigation structure:
 * - Overzicht: dashboard + berichten (everyone)
 * - Zorg: clienten, MIC-meldingen (zorgmedewerker/beheerder/teamleider)
 * - Planning: all planning pages (planner/beheerder/teamleider)
 * - Beheer: admin pages (beheerder only)
 * - Platform: master admin only
 */
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overzicht",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: IconGrid, permission: null },
      { href: "/berichten", label: "Berichten", icon: IconInbox, permission: "berichten:read" },
      { href: "/werkbak", label: "Werkbak", icon: IconClipboard, permission: null, featureFlag: "workflow-engine" },
      { href: "/wiki", label: "Wiki", icon: IconBook, permission: null },
    ],
  },
  {
    label: "Zorg",
    items: [
      { href: "/ecd", label: "Clienten", icon: IconUsers, permission: "clients:read" },
      { href: "/zorgplannen", label: "Zorgplannen", icon: IconClipboard, permission: "clients:read" },
      { href: "/overdracht", label: "Overdracht", icon: IconExchange, permission: "clients:read" },
    ],
  },
  {
    label: "Overzichten",
    items: [
      { href: "/mic-meldingen", label: "MIC-meldingen", icon: IconShield, permission: "mic:read" as Permission },
      { href: "/medicatie-overzicht", label: "Medicatie", icon: IconList, permission: "medicatie:read" as Permission },
      { href: "/wilsverklaringen", label: "Wilsverklaringen", icon: IconShield, permission: "clients:read" },
      { href: "/vaccinaties", label: "Vaccinaties", icon: IconShield, permission: "clients:read" },
      { href: "/rapportages", label: "Rapportages", icon: IconClipboard, permission: "rapportage:read" },
      { href: "/signaleringen", label: "Signaleringen", icon: IconList, permission: "clients:read" },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/planning", label: "Overzicht", icon: IconCalendar, permission: "planning:read" },
      { href: "/planning/bezetting", label: "Bezettingsrooster", icon: IconGrid, permission: "bezetting:read" },
      { href: "/planning/dagplanning", label: "Dagplanning", icon: IconCalendarDay, permission: "planning:read" },
      { href: "/planning/rooster", label: "Rooster", icon: IconClock, permission: "planning:read" },
      { href: "/planning/herhalingen", label: "Herhalingen", icon: IconRepeat, permission: "planning:write" },
      { href: "/planning/wachtlijst", label: "Wachtlijst", icon: IconQueue, permission: "planning:read" },
    ],
  },
  {
    label: "HR",
    items: [
      { href: "/admin/medewerkers", label: "Medewerkers", icon: IconUserCog, permission: "medewerkers:read" },
      { href: "/admin/contracten", label: "Contracten", icon: IconContract, permission: "medewerkers:read" },
      { href: "/admin/organisatie", label: "Organisatie", icon: IconBuilding, permission: "organisatie:read" },
    ],
  },
  {
    label: "Financieel",
    items: [
      { href: "/admin/facturatie", label: "Facturatie", icon: IconReceipt, permission: "configuratie:read", featureFlag: "facturatie-module" },
    ],
  },
  {
    label: "Configuratie",
    items: [
      { href: "/admin/configuratie", label: "Overzicht", icon: IconSettings, permission: "configuratie:read" },
      { href: "/admin/dienst-config", label: "Diensten", icon: IconClock, permission: "dienst-config:read" },
      { href: "/admin/bezetting", label: "Bezetting & normen", icon: IconUsers, permission: "bezetting:read" },
      { href: "/admin/competenties", label: "Competenties", icon: IconShield, permission: "competenties:read" },
      { href: "/admin/mic-trends", label: "MIC Trends", icon: IconList, permission: "mic:read" },
      { href: "/admin/workflows", label: "Workflows", icon: IconFlow, permission: "workflows:read", featureFlag: "workflow-engine" },
      { href: "/admin/workflows/voorbeelden", label: "Workflow Voorbeelden", icon: IconBook, permission: "workflows:read", featureFlag: "workflow-engine" },
      { href: "/admin/vragenlijsten", label: "Vragenlijsten", icon: IconClipboard, permission: "configuratie:read" },
      { href: "/admin/codelijsten", label: "Codelijsten", icon: IconList, permission: "configuratie:read" },
      { href: "/admin/validatie", label: "Validatieregels", icon: IconShield, permission: "configuratie:read" },
      { href: "/admin/task-form-options", label: "Taak-formulieren", icon: IconList, permission: "configuratie:read" },
      { href: "/admin/client-dashboard-config", label: "Client dashboard", icon: IconGrid, permission: "configuratie:read" },
      { href: "/admin/audit", label: "Audit log", icon: IconList, permission: "configuratie:read" },
      { href: "/admin/workflows/dmn", label: "DMN tabellen (bèta)", icon: IconList, permission: "workflows:read", featureFlag: "dmn-editor" },
    ],
  },
  {
    label: "Systeem",
    items: [
      { href: "/admin/modules", label: "Modules", icon: IconGrid, permission: "feature-flags:read" },
      { href: "/admin/state-machines", label: "State-machines", icon: IconFlow, permission: "state-machines:read" },
      { href: "/admin/rollen", label: "Rollen & rechten", icon: IconShield, permission: "rollen:read" },
      { href: "/admin/ai-instellingen", label: "AI Instellingen", icon: IconSettings, permission: "ai-config:read" },
    ],
  },
  {
    label: "Platform",
    masterOnly: true,
    items: [
      { href: "/master-admin", label: "Tenants", icon: IconGlobe, permission: null },
      { href: "/master-admin/onboarding", label: "Onboarding", icon: IconUserPlus, permission: null },
      { href: "/master-admin/wiki", label: "Wiki", icon: IconBook, permission: null },
    ],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const aiAvailable = useAiChatAvailable();
  const [sessionWarning, setSessionWarning] = useState(false);
  // Counter die wordt verhoogd wanneer feature-flags vernieuwd worden;
  // triggert re-render van filteredSections zodat UI live reageert.
  const [featureFlagsVersion, setFeatureFlagsVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setFeatureFlagsVersion((v) => v + 1);
    window.addEventListener("openzorg-features-updated", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("openzorg-features-updated", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  /* Keyboard shortcut: Ctrl+. toggles AI chat panel */
  useEffect(() => {
    if (!aiAvailable) return;
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === ".") {
        e.preventDefault();
        setChatOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [aiAvailable]);

  /* Auth guard — redirect to login if not authenticated */
  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.href = "/login";
    } else {
      setAuthChecked(true);
    }
  }, []);

  /* Session timeout — 15 min inactivity (NEN 7510) */
  useEffect(() => {
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    const WARNING_MS = 13 * 60 * 1000; // Warning at 13 min
    let timeoutId: ReturnType<typeof setTimeout>;
    let warningId: ReturnType<typeof setTimeout>;

    function resetTimer() {
      setSessionWarning(false);
      clearTimeout(timeoutId);
      clearTimeout(warningId);
      warningId = setTimeout(() => setSessionWarning(true), WARNING_MS);
      timeoutId = setTimeout(() => {
        clearSession();
        window.location.href = "/login?expired=1";
      }, TIMEOUT_MS);
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(warningId);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);

  const role = getUserRole() as OpenZorgRole;
  const rolePermissions = ROLE_PERMISSIONS[role] ?? [];
  const roleDef = getRoleDefinition(role);
  const masterAdmin = isMasterAdmin();

  const userName = typeof window !== "undefined"
    ? localStorage.getItem("openzorg_user_name") || "Gebruiker"
    : "Gebruiker";

  const userInitials = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  /* Filter nav sections based on role permissions + master admin flag */
  const filteredSections = useMemo(() => {
    return NAV_SECTIONS
      .filter((section) => {
        // Master-only sections require master admin flag
        if (section.masterOnly && !masterAdmin) return false;
        return true;
      })
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          // Feature-flag check eerst — feature uit = item weg, ongeacht rol
          if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) {
            return false;
          }
          // Master-only sections: show all items (no permission filtering)
          if (section.masterOnly) return true;
          return item.permission === null || rolePermissions.includes(item.permission);
        }),
      }))
      .filter((section) => section.items.length > 0);
    // featureFlagsVersion triggers re-render when flags are refreshed
  }, [rolePermissions, masterAdmin, featureFlagsVersion]);

  /* Close mobile drawer on navigation */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains("dark");
    html.classList.toggle("dark");
    localStorage.setItem("oz-theme", isDark ? "light" : "dark");
  }

  /** Check if a nav item (or any subpage) is currently active */
  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/planning") return pathname === "/planning";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-surface-950/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          lg:relative lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${collapsed ? "w-[4.5rem]" : "w-64"}
        `}
        style={{ background: "var(--color-sidebar-bg)" }}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-5 h-16 shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-500 shrink-0">
            <span className="font-display text-sm font-extrabold text-white tracking-tight">OZ</span>
          </div>
          {!collapsed && (
            <span
              className="font-display text-heading font-bold tracking-tight"
              style={{ color: "var(--color-sidebar-fg)" }}
            >
              OpenZorg
            </span>
          )}
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {filteredSections.map((section, sIdx) => (
            <div key={section.label}>
              {/* Section divider (not on first section) */}
              {sIdx > 0 && !collapsed && (
                <div
                  className="mx-2 mb-3 border-t"
                  style={{ borderColor: "var(--color-sidebar-hover)" }}
                />
              )}
              {!collapsed && (
                <span
                  className="block px-2 mb-1.5 text-[0.65rem] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--color-sidebar-fg-muted)", opacity: 0.6 }}
                >
                  {section.label}
                </span>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className={`
                          flex items-center gap-3 rounded-xl px-3 py-2
                          text-body-sm font-medium transition-colors duration-150
                          ${collapsed ? "justify-center px-0" : ""}
                        `}
                        style={{
                          color: active ? "var(--color-sidebar-fg)" : "var(--color-sidebar-fg-muted)",
                          background: active ? "var(--color-sidebar-active)" : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.background = "var(--color-sidebar-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.background = "";
                        }}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon className="w-[1.125rem] h-[1.125rem] shrink-0 opacity-80" />
                        {!collapsed && item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 pb-4 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 rounded-xl px-3 py-2 w-full text-body-sm font-medium transition-colors"
            style={{ color: "var(--color-sidebar-fg-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-sidebar-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
          >
            <IconMoon className="w-[1.125rem] h-[1.125rem] shrink-0 opacity-80 dark:hidden" />
            <IconSun className="w-[1.125rem] h-[1.125rem] shrink-0 opacity-80 hidden dark:block" />
            {!collapsed && <span className="dark:hidden">Donker thema</span>}
            {!collapsed && <span className="hidden dark:inline">Licht thema</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-3 rounded-xl px-3 py-2 w-full text-body-sm font-medium transition-colors"
            style={{ color: "var(--color-sidebar-fg-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-sidebar-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
          >
            <IconCollapse className={`w-[1.125rem] h-[1.125rem] shrink-0 opacity-80 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && "Inklappen"}
          </button>

          {/* Version indicator */}
          {!collapsed && (
            <p className="px-3 py-1 text-[10px] tracking-wide opacity-40" style={{ color: "var(--color-sidebar-fg-muted)" }}>
              v{process.env.NEXT_PUBLIC_APP_VERSION || "0.2.0"} · {process.env.NEXT_PUBLIC_GIT_SHA || "dev"}
            </p>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-16 px-6 shrink-0 bg-raised border-b border-default">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden mr-4 p-2 -ml-2 rounded-lg hover:bg-sunken transition-colors"
          >
            <IconMenu className="w-5 h-5 text-fg-muted" />
          </button>

          <div className="flex-1" />

          {/* Tenant switcher (master admin only) */}
          {masterAdmin && <TenantSwitcher />}

          {/* AI Chat toggle */}
          {aiAvailable && (
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`p-2 rounded-lg transition-colors ${chatOpen ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300" : "text-fg-muted hover:text-fg hover:bg-sunken"}`}
              title="AI Assistent (Ctrl+.)"
            >
              <IconChat className="w-5 h-5" />
            </button>
          )}

          {/* User */}
          <div className="flex items-center gap-3 ml-4">
            <div className="text-right hidden sm:block">
              <p className="text-body-sm font-medium text-fg">{userName}</p>
              <p className="text-caption text-fg-subtle">{roleDef.displayName}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
              <span className="text-body-sm font-bold text-brand-700 dark:text-brand-300">{userInitials}</span>
            </div>
            <button
              onClick={() => { clearSession(); window.location.href = "/login"; }}
              className="text-caption text-fg-subtle hover:text-coral-600 transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </header>

        {/* Session timeout warning */}
        {sessionWarning && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
            Je sessie verloopt binnenkort wegens inactiviteit. Klik ergens om je sessie te verlengen.
          </div>
        )}

        {/* Page content + AI chat panel */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        </div>
      </div>
    </div>
  );
}

/* ── Icons (inline SVG, no library dependency) ── */

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconCalendarDay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <rect x="8" y="14" width="3" height="3" rx="0.5" />
    </svg>
  );
}

function IconInbox({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconUserCog({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <circle cx="19.5" cy="17.5" r="2.5" />
      <path d="M19.5 14.5v-1M19.5 21.5v-1M22 16l.87-.5M17 19.5l.87-.5M22 19l-.87-.5M17.87 16l-.87-.5" />
    </svg>
  );
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconFlow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="6" height="6" rx="1" />
      <rect x="16" y="4" width="6" height="6" rx="1" />
      <rect x="9" y="14" width="6" height="6" rx="1" />
      <path d="M8 7h8M5 10v4c0 1.1.9 2 2 2h2M19 10v4c0 1.1-.9 2-2 2h-2" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconCollapse({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11 17 6 12 11 7" />
      <polyline points="18 17 13 12 18 7" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function IconReceipt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}

function IconContract({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function IconRepeat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconQueue({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
      <path d="m15 9 6-6" />
    </svg>
  );
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function IconBook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconExchange({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 5h18" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 19H3" />
    </svg>
  );
}
