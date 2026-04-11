"use client";

import { useMemo, useState } from "react";

import AppShell from "../../../components/AppShell";
import type { OpenZorgRole, Permission } from "@openzorg/shared-domain";
import { ALL_ROLES, ROLE_DEFINITIONS, ROLE_PERMISSIONS } from "@openzorg/shared-domain";

/* ── Permission categories for display ── */
const PERMISSION_CATEGORIES = [
  {
    label: "Clienten",
    permissions: ["clients:read", "clients:write", "clients:delete"] as Permission[],
  },
  {
    label: "Zorgplan",
    permissions: ["zorgplan:read", "zorgplan:write"] as Permission[],
  },
  {
    label: "Rapportage",
    permissions: ["rapportage:read", "rapportage:write"] as Permission[],
  },
  {
    label: "Documenten",
    permissions: ["documenten:read", "documenten:write"] as Permission[],
  },
  {
    label: "Medicatie",
    permissions: ["medicatie:read", "medicatie:write"] as Permission[],
  },
  {
    label: "MIC-meldingen",
    permissions: ["mic:read", "mic:write"] as Permission[],
  },
  {
    label: "Planning",
    permissions: ["planning:read", "planning:write"] as Permission[],
  },
  {
    label: "Berichten",
    permissions: ["berichten:read", "berichten:write"] as Permission[],
  },
  {
    label: "Medewerkers",
    permissions: ["medewerkers:read", "medewerkers:write"] as Permission[],
  },
  {
    label: "Organisatie",
    permissions: ["organisatie:read", "organisatie:write"] as Permission[],
  },
  {
    label: "Configuratie",
    permissions: ["configuratie:read", "configuratie:write"] as Permission[],
  },
  {
    label: "Workflows",
    permissions: ["workflows:read", "workflows:write"] as Permission[],
  },
  {
    label: "Rollenbeheer",
    permissions: ["rollen:read", "rollen:write"] as Permission[],
  },
] as const;

function permissionLabel(p: Permission): string {
  const action = p.split(":")[1];
  switch (action) {
    case "read": return "Lezen";
    case "write": return "Schrijven";
    case "delete": return "Verwijderen";
    default: return action ?? p;
  }
}

export default function RollenPage() {
  const [selectedRole, setSelectedRole] = useState<OpenZorgRole>("beheerder");

  const roleDef = useMemo(
    () => ROLE_DEFINITIONS.find((d) => d.role === selectedRole),
    [selectedRole],
  );

  const rolePerms = ROLE_PERMISSIONS[selectedRole];

  return (
    <AppShell>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-display-lg text-fg">Rollenbeheer</h1>
          <p className="text-body text-fg-muted mt-1">
            Bekijk welke rechten elke rol heeft binnen het systeem.
          </p>
        </div>

        {/* Role selector tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {ALL_ROLES.map((r) => {
            const def = ROLE_DEFINITIONS.find((d) => d.role === r);
            const active = r === selectedRole;
            return (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`
                  px-5 py-2.5 rounded-xl text-body-sm font-semibold transition-all
                  ${active
                    ? "bg-brand-600 text-white shadow-soft"
                    : "bg-raised border border-default text-fg-muted hover:text-fg hover:bg-sunken"
                  }
                `}
              >
                {def?.displayName ?? r}
              </button>
            );
          })}
        </div>

        {/* Role description */}
        {roleDef && (
          <div className="bg-raised rounded-2xl border border-default p-6 mb-8 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h2 className="text-heading text-fg">{roleDef.displayName}</h2>
                <p className="text-body-sm text-fg-muted mt-1">{roleDef.description}</p>
                <p className="text-caption text-fg-subtle mt-3">
                  {rolePerms.length} {rolePerms.length === 1 ? "recht" : "rechten"} toegekend
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Permission matrix */}
        <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">
                    Module
                  </th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">
                    Rechten
                  </th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_CATEGORIES.map((cat) => (
                  <tr key={cat.label} className="border-b border-subtle last:border-0">
                    <td className="px-6 py-4 font-medium text-fg">{cat.label}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {cat.permissions.map((perm) => {
                          const has = rolePerms.includes(perm);
                          return (
                            <span
                              key={perm}
                              className={`
                                inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-caption font-medium
                                ${has
                                  ? "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300"
                                  : "bg-surface-100 dark:bg-surface-800 text-fg-subtle line-through opacity-50"
                                }
                              `}
                            >
                              {has ? (
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              )}
                              {permissionLabel(perm)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-subtle bg-sunken">
            <p className="text-caption text-fg-subtle">
              Rollen worden momenteel centraal beheerd. In een toekomstige versie kunnen beheerders aangepaste rollen aanmaken.
            </p>
          </div>
        </div>

        {/* Role comparison */}
        <div className="mt-8">
          <h2 className="text-heading text-fg mb-4">Rollenvergelijking</h2>
          <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-default">
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold sticky left-0 bg-raised">
                      Module
                    </th>
                    {ALL_ROLES.map((r) => {
                      const def = ROLE_DEFINITIONS.find((d) => d.role === r);
                      return (
                        <th
                          key={r}
                          className="text-center px-4 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold min-w-[120px]"
                        >
                          {def?.displayName ?? r}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_CATEGORIES.map((cat) => (
                    <tr key={cat.label} className="border-b border-subtle last:border-0">
                      <td className="px-6 py-3 font-medium text-fg sticky left-0 bg-raised">{cat.label}</td>
                      {ALL_ROLES.map((r) => {
                        const perms = ROLE_PERMISSIONS[r];
                        const hasAll = cat.permissions.every((p) => perms.includes(p));
                        const hasSome = cat.permissions.some((p) => perms.includes(p));
                        return (
                          <td key={r} className="text-center px-4 py-3">
                            {hasAll ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40">
                                <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </span>
                            ) : hasSome ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40">
                                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-100 dark:bg-surface-800">
                                <svg className="w-4 h-4 text-fg-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-subtle flex items-center gap-6">
              <span className="flex items-center gap-2 text-caption text-fg-subtle">
                <span className="w-4 h-4 rounded-full bg-brand-100 dark:bg-brand-900/40 inline-flex items-center justify-center">
                  <svg className="w-3 h-3 text-brand-600 dark:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                Volledige toegang
              </span>
              <span className="flex items-center gap-2 text-caption text-fg-subtle">
                <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/40 inline-flex items-center justify-center">
                  <svg className="w-3 h-3 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </span>
                Gedeeltelijke toegang
              </span>
              <span className="flex items-center gap-2 text-caption text-fg-subtle">
                <span className="w-4 h-4 rounded-full bg-surface-100 dark:bg-surface-800 inline-flex items-center justify-center">
                  <svg className="w-3 h-3 text-fg-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </span>
                Geen toegang
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
