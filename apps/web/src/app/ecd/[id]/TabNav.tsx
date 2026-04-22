"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const TABS = [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "indicaties", label: "Indicaties" },
  { slug: "rapportages", label: "Rapportages" },
  { slug: "zorgplan", label: "Zorgplan" },
  { slug: "contactpersonen", label: "Contactpersonen" },
  { slug: "medicatie", label: "Medicatie" },
  { slug: "medicatie-overzicht", label: "Medicatieoverzicht" },
  { slug: "toediening", label: "Toediening" },
  { slug: "allergieen", label: "Allergieën" },
  { slug: "vaccinaties", label: "Vaccinaties" },
  { slug: "diagnoses", label: "Diagnoses" },
  { slug: "risicoscreening", label: "Risicoscreening" },
  { slug: "mdo", label: "MDO" },
  { slug: "signaleringen", label: "Signaleringen" },
  { slug: "mic-meldingen", label: "MIC-meldingen" },
  { slug: "vragenlijsten", label: "Vragenlijsten" },
  { slug: "wilsverklaringen", label: "Wilsverklaringen" },
  { slug: "vbm", label: "VBM" },
  { slug: "documenten", label: "Documenten" },
  { slug: "verzekering", label: "Verzekering" },
  { slug: "extra-velden", label: "Extra velden" },
] as const;

interface TabNavProps {
  clientId: string;
}

export function TabNav({ clientId }: TabNavProps) {
  const pathname = usePathname();
  return (
    <nav
      role="tablist"
      aria-label="Cliënt-secties"
      className="mt-6 flex flex-wrap gap-2 border-b border-default"
    >
      {TABS.map((tab) => {
        const href = `/ecd/${clientId}/${tab.slug}`;
        const active = pathname?.endsWith(`/${tab.slug}`) ?? false;
        return (
          <Link
            key={tab.slug}
            href={href}
            role="tab"
            aria-selected={active}
            className={
              active
                ? "border-b-2 border-brand-700 px-3 py-2 text-sm font-medium text-brand-700"
                : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-fg-subtle hover:border-default hover:text-fg-muted"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
