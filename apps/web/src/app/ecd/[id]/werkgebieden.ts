/**
 * Cliëntdossier-informatie-architectuur: de 21 platte tabs gegroepeerd in
 * 5 werkgebieden (IA-doc: docs/design/informatie-architectuur.md). De
 * onderliggende tab-routes blijven 1:1 bestaan; alleen de navigatie groepeert.
 */

export interface DossierTab {
  /** URL-segment onder /ecd/[id]/. Lege string = de basis-route /ecd/[id]. */
  slug: string;
  label: string;
}

export interface Werkgebied {
  slug: string;
  label: string;
  tabs: DossierTab[];
}

export const WERKGEBIEDEN: Werkgebied[] = [
  {
    slug: "overzicht",
    label: "Overzicht",
    tabs: [{ slug: "", label: "Overzicht" }],
  },
  {
    slug: "rapportage",
    label: "Rapportage",
    tabs: [{ slug: "rapportages", label: "Rapportages" }],
  },
  {
    slug: "gezondheid",
    label: "Gezondheid",
    tabs: [
      { slug: "medicatie", label: "Medicatie" },
      { slug: "medicatie-overzicht", label: "Medicatieoverzicht" },
      { slug: "toediening", label: "Toediening" },
      { slug: "allergieen", label: "Allergieën" },
      { slug: "vaccinaties", label: "Vaccinaties" },
      { slug: "diagnoses", label: "Diagnoses" },
      { slug: "risicoscreening", label: "Risicoscreening" },
      { slug: "vragenlijsten", label: "Vragenlijsten" },
      { slug: "signaleringen", label: "Signaleringen" },
      { slug: "mic-meldingen", label: "MIC-meldingen" },
      { slug: "vbm", label: "VBM" },
    ],
  },
  {
    slug: "zorgplan",
    label: "Zorgplan",
    tabs: [
      { slug: "zorgplan", label: "Zorgplan" },
      { slug: "indicaties", label: "Indicaties" },
      { slug: "mdo", label: "MDO" },
    ],
  },
  {
    slug: "administratie",
    label: "Administratie",
    tabs: [
      { slug: "contactpersonen", label: "Contactpersonen" },
      { slug: "wilsverklaringen", label: "Wilsverklaringen" },
      { slug: "documenten", label: "Documenten" },
      { slug: "verzekering", label: "Verzekering" },
      { slug: "extra-velden", label: "Extra velden" },
    ],
  },
];

/** Platte lijst van alle echte tab-routes (zonder de basis-Overzicht). Voor breadcrumb-labels. */
export const TABS: DossierTab[] = WERKGEBIEDEN.flatMap((w) => w.tabs).filter((t) => t.slug !== "");

/** Bouwt de route voor een tab-slug ("" = basis-route). */
export function tabHref(clientId: string, slug: string): string {
  return slug ? `/ecd/${clientId}/${slug}` : `/ecd/${clientId}`;
}

/** Vindt het werkgebied dat bij het huidige pad hoort (fallback: Overzicht). */
export function werkgebiedVoorPad(pathname: string, clientId: string): Werkgebied {
  const base = `/ecd/${clientId}`;
  if (pathname === base || pathname === `${base}/`) return WERKGEBIEDEN[0]!;
  const seg = pathname.split("/").filter(Boolean).pop() ?? "";
  return WERKGEBIEDEN.find((w) => w.tabs.some((t) => t.slug === seg)) ?? WERKGEBIEDEN[0]!;
}
