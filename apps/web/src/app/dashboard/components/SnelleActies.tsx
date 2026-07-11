"use client";

import Link from "next/link";

import { getUserRole } from "../../../lib/api";

interface Actie {
  label: string;
  href: string;
}

const BEHEER_ACTIES: Actie[] = [
  { label: "Processen", href: "/admin/workflows" },
  { label: "Cliënten importeren", href: "/ecd/import" },
  { label: "Werkbak", href: "/werkbak" },
];

/** Actieknoppen per rol — de eerstvolgende zinvolle handeling vanaf de start. */
const ACTIES_PER_ROL: Record<string, Actie[]> = {
  zorgmedewerker: [
    { label: "Nieuwe rapportage", href: "/rapportages" },
    { label: "Cliënten", href: "/ecd" },
    { label: "Werkbak", href: "/werkbak" },
  ],
  teamleider: [
    { label: "MIC-meldingen", href: "/mic-meldingen" },
    { label: "Signaleringen", href: "/signaleringen" },
    { label: "Werkbak", href: "/werkbak" },
  ],
  beheerder: BEHEER_ACTIES,
  "tenant-admin": BEHEER_ACTIES,
  planner: [
    { label: "Rooster", href: "/planning/rooster" },
    { label: "Dagplanning", href: "/planning/dagplanning" },
    { label: "Werkbak", href: "/werkbak" },
  ],
};

/** Snelle acties: 3 knoppen afgestemd op de rol van de ingelogde gebruiker. */
export function SnelleActies() {
  const rol = getUserRole();
  const acties = ACTIES_PER_ROL[rol] ?? ACTIES_PER_ROL["zorgmedewerker"] ?? [];

  return (
    <nav aria-label="Snelle acties" className="flex flex-wrap gap-2">
      {acties.map((actie) => (
        <Link
          key={actie.href}
          href={actie.href}
          className="inline-flex items-center rounded-lg border border-default bg-raised px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:bg-sunken"
        >
          {actie.label}
        </Link>
      ))}
    </nav>
  );
}
