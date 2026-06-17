"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WERKGEBIEDEN, tabHref, werkgebiedVoorPad } from "./werkgebieden";

// Her-export zodat bestaande imports (layout breadcrumb) blijven werken.
export { TABS } from "./werkgebieden";

interface TabNavProps {
  clientId: string;
}

/**
 * Twee-niveau dossier-navigatie: bovenaan de 5 werkgebieden (Overzicht /
 * Rapportage / Gezondheid / Zorgplan / Administratie), daaronder de sub-tabs
 * van het actieve werkgebied. Het actieve werkgebied volgt het pad; klikken op
 * een werkgebied gaat naar zijn eerste sub-tab. Alle onderliggende routes
 * blijven bestaan.
 */
export function TabNav({ clientId }: TabNavProps) {
  const pathname = usePathname() ?? "";
  const actief = werkgebiedVoorPad(pathname, clientId);

  return (
    <div className="mt-6">
      {/* Niveau 1 — werkgebieden */}
      <nav
        role="tablist"
        aria-label="Cliënt-werkgebieden"
        className="flex flex-wrap gap-2 border-b border-default"
      >
        {WERKGEBIEDEN.map((wg) => {
          const active = wg.slug === actief.slug;
          return (
            <Link
              key={wg.slug}
              href={tabHref(clientId, wg.tabs[0]!.slug)}
              role="tab"
              aria-selected={active}
              className={
                active
                  ? "border-b-2 border-brand-700 px-3 py-2 text-sm font-semibold text-brand-700"
                  : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-fg-subtle hover:border-default hover:text-fg-muted"
              }
            >
              {wg.label}
            </Link>
          );
        })}
      </nav>

      {/* Niveau 2 — sub-tabs van het actieve werkgebied (alleen bij meerdere) */}
      {actief.tabs.length > 1 && (
        <nav
          role="tablist"
          aria-label={`${actief.label}: onderdelen`}
          className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5"
        >
          {actief.tabs.map((tab) => {
            const href = tabHref(clientId, tab.slug);
            const active = pathname === href || pathname.endsWith(`/${tab.slug}`);
            return (
              <Link
                key={tab.slug}
                href={href}
                role="tab"
                aria-selected={active}
                className={
                  active
                    ? "rounded-md bg-brand-50 px-2.5 py-1 text-sm font-medium text-brand-700 dark:bg-brand-950/20 dark:text-brand-300"
                    : "rounded-md px-2.5 py-1 text-sm font-medium text-fg-subtle hover:bg-sunken hover:text-fg-muted"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
