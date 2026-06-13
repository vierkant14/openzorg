"use client";

import type { OpenZorgRole } from "@openzorg/shared-domain";
import { getRoleDefinition } from "@openzorg/shared-domain";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { clearSession, getUserRole, isMasterAdmin, isLoggedIn } from "../lib/api";
import { isFeatureEnabled } from "../lib/features";

import { ChatPanel, useAiChatAvailable } from "./ChatPanel";
import {
  KeyboardShortcutsButton,
  KeyboardShortcutsModal,
  useKeyboardShortcuts,
} from "./KeyboardShortcuts";
import TenantSwitcher from "./TenantSwitcher";
import {
  WERKRUIMTES,
  werkruimteVoorPad,
  werkruimtesVoorGebruiker,
  type WerkruimteIcoon,
} from "./werkruimtes";

/* ── Werkruimte-icoon-map ── */
/**
 * Mapt de databestand-icoon-sleutels (werkruimtes.ts) naar de inline-SVG-iconen
 * onderaan dit bestand. Zo blijft werkruimtes.ts vrij van React/JSX.
 */
const ICOON_MAP: Record<WerkruimteIcoon, (props: { className?: string }) => React.JSX.Element> = {
  vandaag: IconCalendarDay,
  clienten: IconUsers,
  berichten: IconInbox,
  rooster: IconClock,
  dagplanning: IconCalendarDay,
  wachtlijst: IconQueue,
  medewerkers: IconUserCog,
  overzicht: IconGrid,
  mic: IconShield,
  signaleringen: IconList,
  processen: IconFlow,
  formulieren: IconClipboard,
  regels: IconShield,
  organisatie: IconBuilding,
  rollen: IconShield,
  "state-machines": IconFlow,
  modules: IconGrid,
  ai: IconSettings,
  tenants: IconGlobe,
  onboarding: IconUserPlus,
  wiki: IconBook,
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const aiAvailable = useAiChatAvailable();
  const { open: shortcutsOpen, setOpen: setShortcutsOpen } = useKeyboardShortcuts();
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
  const roleDef = getRoleDefinition(role);
  const masterAdmin = isMasterAdmin();

  /* Werkruimtes per rol (taak-gerichte IA, zie werkruimtes.ts).
     De actieve werkruimte volgt het huidige pad — de nav reflecteert waar je
     bent, en bij meerdere werkruimtes wissel je via de link-lijst hieronder. */
  const werkruimtes = werkruimtesVoorGebruiker(role, masterAdmin);
  const actieveWerkruimte =
    werkruimteVoorPad(pathname, werkruimtes) ?? werkruimtes[0] ?? WERKRUIMTES.vandaag!;

  const userName = typeof window !== "undefined"
    ? localStorage.getItem("openzorg_user_name") || "Gebruiker"
    : "Gebruiker";

  const userInitials = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  /* Items van de actieve werkruimte, gefilterd op feature-flags. featureFlagsVersion
     wordt gelezen zodat de flag-listener (boven) een re-render forceert; de filter
     draait elke render opnieuw en pakt zo verse flag-waarden mee. */
  void featureFlagsVersion;
  const zichtbareItems = actieveWerkruimte.items.filter(
    (item) => !item.featureFlag || isFeatureEnabled(item.featureFlag),
  );

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
    // Routes die een prefix zijn van andere nav-items: exact matchen, anders
    // lichten parent én child tegelijk op.
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/planning") return pathname === "/planning";
    if (href === "/master-admin") return pathname === "/master-admin";
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

        {/* Werkruimte-switcher: link-lijst (alleen bij meerdere werkruimtes).
            Echte <a href> → toetsenbord-toegankelijk, default focus-ring, en
            navigeren is een bewuste klik (geen WCAG 3.2.2 on-input-verrassing). */}
        {werkruimtes.length > 1 && (
          <div className="px-3 pt-1 pb-2 flex flex-col gap-0.5">
            {werkruimtes.map((w) => {
              const actief = w.slug === actieveWerkruimte.slug;
              return (
                <a
                  key={w.slug}
                  href={w.startRoute}
                  aria-current={actief ? "page" : undefined}
                  title={collapsed ? w.label : undefined}
                  className={`
                    rounded-xl px-3 py-1.5 text-body-sm font-semibold transition-colors duration-150
                    ${collapsed ? "text-center" : ""}
                  `}
                  style={{
                    color: actief ? "var(--color-sidebar-fg)" : "var(--color-sidebar-fg-muted)",
                    background: actief ? "var(--color-sidebar-active)" : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!actief) e.currentTarget.style.background = "var(--color-sidebar-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!actief) e.currentTarget.style.background = "";
                  }}
                >
                  {collapsed ? w.label.slice(0, 1) : w.label}
                </a>
              );
            })}
          </div>
        )}

        {/* Nav-items van de actieve werkruimte */}
        <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={actieveWerkruimte.label}>
          <ul className="space-y-0.5">
            {zichtbareItems.map((item) => {
              const active = isActive(item.href);
              const Icoon = ICOON_MAP[item.icon];
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
                    <Icoon className="w-[1.125rem] h-[1.125rem] shrink-0 opacity-80" />
                    {!collapsed && item.label}
                  </a>
                </li>
              );
            })}
          </ul>
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

      <KeyboardShortcutsButton onClick={() => setShortcutsOpen(true)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
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
