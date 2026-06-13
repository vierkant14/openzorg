import type { OpenZorgRole } from "@openzorg/shared-domain";

import type { FeatureFlagSlug } from "../lib/features";

/**
 * Icoon-sleutels voor werkruimte-nav-items. Het AppShell mapt deze naar de
 * bestaande inline-SVG-iconen, zodat dit databestand vrij blijft van React.
 */
export type WerkruimteIcoon =
  | "vandaag"
  | "clienten"
  | "berichten"
  | "rooster"
  | "dagplanning"
  | "wachtlijst"
  | "medewerkers"
  | "overzicht"
  | "mic"
  | "signaleringen"
  | "processen"
  | "formulieren"
  | "regels"
  | "organisatie"
  | "rollen"
  | "state-machines"
  | "modules"
  | "ai"
  | "tenants"
  | "onboarding"
  | "wiki";

export interface WerkruimteNavItem {
  href: string;
  label: string;
  icon: WerkruimteIcoon;
  /** Feature-flag vereist — flag uit = item verdwijnt */
  featureFlag?: FeatureFlagSlug;
}

export interface Werkruimte {
  slug: string;
  label: string;
  startRoute: string;
  items: WerkruimteNavItem[];
}

/**
 * Taak-gerichte werkruimtes per rol (IA-doc: docs/design/informatie-architectuur.md).
 * Max 5 items per werkruimte. Bestaande URL's blijven geldig; routes die hier
 * niet staan blijven bereikbaar via directe URL en sneltoetsen.
 */
export const WERKRUIMTES: Record<string, Werkruimte> = {
  vandaag: {
    slug: "vandaag",
    label: "Vandaag",
    startRoute: "/vandaag",
    items: [
      { href: "/vandaag", label: "Vandaag", icon: "vandaag" },
      { href: "/ecd", label: "Cliënten", icon: "clienten" },
      { href: "/berichten", label: "Berichten", icon: "berichten" },
    ],
  },
  rooster: {
    slug: "rooster",
    label: "Rooster",
    startRoute: "/planning/rooster",
    items: [
      { href: "/planning/rooster", label: "Rooster", icon: "rooster" },
      { href: "/planning/dagplanning", label: "Dagplanning", icon: "dagplanning" },
      { href: "/planning/wachtlijst", label: "Wachtlijst", icon: "wachtlijst" },
      { href: "/admin/medewerkers", label: "Medewerkers", icon: "medewerkers" },
      { href: "/berichten", label: "Berichten", icon: "berichten" },
    ],
  },
  team: {
    slug: "team",
    label: "Team",
    startRoute: "/dashboard",
    items: [
      { href: "/dashboard", label: "Overzicht", icon: "overzicht" },
      { href: "/ecd", label: "Cliënten", icon: "clienten" },
      { href: "/mic-meldingen", label: "MIC-meldingen", icon: "mic" },
      { href: "/signaleringen", label: "Signaleringen", icon: "signaleringen" },
      { href: "/berichten", label: "Berichten", icon: "berichten" },
    ],
  },
  bouwen: {
    slug: "bouwen",
    label: "Bouwen",
    startRoute: "/admin/configuratie",
    items: [
      { href: "/admin/configuratie", label: "Overzicht", icon: "overzicht" },
      { href: "/admin/workflows", label: "Processen", icon: "processen", featureFlag: "workflow-engine" },
      { href: "/admin/vragenlijsten", label: "Formulieren & velden", icon: "formulieren" },
      { href: "/admin/validatie", label: "Regels & lijsten", icon: "regels" },
      { href: "/admin/organisatie", label: "Organisatie", icon: "organisatie" },
    ],
  },
  systeem: {
    slug: "systeem",
    label: "Systeem",
    startRoute: "/admin/rollen",
    items: [
      { href: "/admin/rollen", label: "Rollen", icon: "rollen" },
      { href: "/admin/state-machines", label: "State-machines", icon: "state-machines" },
      { href: "/admin/modules", label: "Modules", icon: "modules" },
      { href: "/admin/ai-instellingen", label: "AI", icon: "ai" },
    ],
  },
  platform: {
    slug: "platform",
    label: "Platform",
    startRoute: "/master-admin",
    items: [
      { href: "/master-admin", label: "Tenants", icon: "tenants" },
      { href: "/master-admin/onboarding", label: "Onboarding", icon: "onboarding" },
      { href: "/master-admin/wiki", label: "Wiki", icon: "wiki" },
    ],
  },
};

const ROL_WERKRUIMTES: Record<OpenZorgRole, string[]> = {
  zorgmedewerker: ["vandaag"],
  planner: ["rooster"],
  teamleider: ["team"],
  beheerder: ["bouwen"],
  "tenant-admin": ["systeem", "bouwen"],
};

/** Werkruimtes die deze gebruiker mag zien, op volgorde (eerste = standaard). */
export function werkruimtesVoorGebruiker(role: OpenZorgRole, masterAdmin: boolean): Werkruimte[] {
  const slugs = [...(ROL_WERKRUIMTES[role] ?? ["vandaag"])];
  if (masterAdmin) slugs.push("platform");
  return slugs.map((s) => WERKRUIMTES[s]).filter((w): w is Werkruimte => Boolean(w));
}

/** Startroute waarnaar een gebruiker na inloggen gaat. */
export function startRouteVoorGebruiker(role: OpenZorgRole, masterAdmin: boolean): string {
  return werkruimtesVoorGebruiker(role, masterAdmin)[0]?.startRoute ?? "/dashboard";
}
