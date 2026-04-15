"use client";

import Link from "next/link";

import AppShell from "../../../components/AppShell";

interface ConfigTile {
  href: string;
  label: string;
  description: string;
  samenhang: string;
  icon: string;
  status?: "stable" | "beta" | "experimental";
}

const TILES: ConfigTile[] = [
  {
    href: "/admin/configuratie/custom-fields",
    label: "Custom velden",
    description:
      "Voeg tenant-specifieke velden toe aan FHIR-resources (Patient, Observation, ...). Velden worden opgeslagen als FHIR extensions onder https://openzorg.nl/extensions.",
    samenhang:
      "Wordt gebruikt door alle cliënt-formulieren. Laag 2 (Uitbreiding) van het drie-laagsmodel.",
    icon: "📝",
    status: "stable",
  },
  {
    href: "/admin/validatie",
    label: "Validatieregels",
    description:
      "Stel extra validatieregels in die worden uitgevoerd bij opslaan van een resource. Bijvoorbeeld: 'geslacht is verplicht', 'geboortedatum niet in de toekomst'.",
    samenhang:
      "Laag 2 (Uitbreiding). Kern-regels (BSN elfproef, AGB) staan altijd aan en zijn niet uitschakelbaar.",
    icon: "✅",
    status: "stable",
  },
  {
    href: "/admin/state-machines",
    label: "State-machines",
    description:
      "Definieer welke statussen een resource kan hebben en welke overgangen toegestaan zijn. Voorbeelden: Patient (Aangemeld → In zorg → Uitgeschreven), Task (Open → In behandeling → Afgerond).",
    samenhang:
      "10 default machines geleverd (Patient, Practitioner, Appointment, CarePlan, Task, MedicationRequest, ServiceRequest, Encounter, Consent, RiskAssessment). Transitions kunnen een role-guard hebben (bv. alleen teamleider mag 'In zorg' zetten).",
    icon: "🔄",
    status: "stable",
  },
  {
    href: "/admin/codelijsten",
    label: "Codelijsten",
    description:
      "Lokale codelijsten op basis van SNOMED CT / ICD-10 / G-standaard. Voor diagnose, allergie, medicatie, vaccinatie en interventie.",
    samenhang:
      "Gebruikt door de dropdown-velden in cliëntdossier. Zonder codelijst vallen velden terug op vrije tekst.",
    icon: "📋",
    status: "stable",
  },
  {
    href: "/admin/rollen",
    label: "Rollen & rechten",
    description:
      "Definieer welke rollen er zijn in jouw organisatie (zorgmedewerker, teamleider, planner, controller, ...) en welke permissies ze krijgen.",
    samenhang:
      "Systeem-rollen zijn locked (beheerder, teamleider, planner, zorgmedewerker). Daarnaast kun je eigen rollen toevoegen. Wordt gekoppeld aan RBAC-middleware en state-machine transitions.",
    icon: "🛡️",
    status: "stable",
  },
  {
    href: "/admin/workflows",
    label: "Workflows (BPMN)",
    description:
      "Visuele proces-editor voor bedrijfsprocessen: intake, herindicatie, ontslagmanagement. Gebaseerd op Flowable BPMN 2.0 engine.",
    samenhang:
      "Gekoppeld aan Task-resource (werkbak), Start-triggers (API/form/timer/event), en role-guards. Zie ook: DMN tabellen voor beslissingslogica binnen een proces.",
    icon: "⚙️",
    status: "stable",
  },
  {
    href: "/admin/task-form-options",
    label: "Taak-formulieren",
    description:
      "Dropdown-opties voor taken in de werkbak (prioriteit, status, categorie). Wordt gebruikt door Task-resources die via BPMN-processen worden aangemaakt.",
    samenhang: "Optioneel — alleen relevant als je BPMN workflows gebruikt.",
    icon: "📑",
    status: "stable",
  },
  {
    href: "/admin/client-dashboard-config",
    label: "Cliënt-dashboard widgets",
    description:
      "Kies welke widgets op het cliënt-detail dashboard verschijnen (signaleringen, recente rapportages, medicatie-samenvatting, openstaande taken).",
    samenhang:
      "Tenant-scoped; gebruikers zien hetzelfde dashboard binnen één tenant.",
    icon: "📊",
    status: "stable",
  },
  {
    href: "/admin/workflows/dmn",
    label: "DMN tabellen",
    description:
      "Decision Model & Notation — beslissingstabellen. Voorbeeld: indicatie-klasse → ZZP-categorie. Kan worden aangeroepen vanuit een BPMN-proces.",
    samenhang:
      "⚠️ Bèta. Nog niet geïntegreerd met workflows. Zie backlog-item 'DMN: integratie + uitleg'.",
    icon: "📐",
    status: "beta",
  },
];

const STATUS_BADGE: Record<NonNullable<ConfigTile["status"]>, string> = {
  stable: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  beta: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  experimental: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
};

export default function ConfiguratieOverzichtPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-fg">Configuratie</h1>
          <p className="mt-2 text-fg-muted max-w-2xl">
            Alle tenant-instellingen op één plek. Elke module hieronder is onafhankelijk configureerbaar
            en hoort bij het <strong className="text-fg">drie-laagsmodel</strong>: Laag 1 (Kern) is
            altijd aan, Laag 2 (Uitbreiding) configureer je hier, Laag 3 (Plugin) is gereserveerd voor
            toekomstige custom plug-ins.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TILES.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="group rounded-xl border border-default bg-raised p-5 hover:border-brand-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="text-3xl">{tile.icon}</div>
                {tile.status && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[tile.status]}`}>
                    {tile.status === "stable" ? "Stabiel" : tile.status === "beta" ? "Bèta" : "Experimenteel"}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-fg mb-2 group-hover:text-brand-700">
                {tile.label}
              </h2>
              <p className="text-sm text-fg-muted leading-relaxed mb-3">{tile.description}</p>
              <div className="pt-3 border-t border-default">
                <div className="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-1">Samenhang</div>
                <p className="text-xs text-fg-muted leading-relaxed">{tile.samenhang}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-brand-200 bg-brand-50/30 dark:bg-brand-950/10 p-6">
          <h3 className="text-lg font-semibold text-fg mb-2">💡 Drie-laagsmodel in het kort</h3>
          <ul className="space-y-2 text-sm text-fg-muted">
            <li>
              <strong className="text-fg">Laag 1 — Kern:</strong> hardcoded en wettelijk verplicht. BSN elfproef,
              AGB-check, verplichte Zib-velden. Niet uit te schakelen.
            </li>
            <li>
              <strong className="text-fg">Laag 2 — Uitbreiding:</strong> tenant-configureerbaar. Custom velden,
              extra validatieregels, state-machines, rollen. Configureer je op deze pagina.
            </li>
            <li>
              <strong className="text-fg">Laag 3 — Plugin:</strong> gereserveerd voor toekomstige plug-ins van
              derden (bv. AI-modules, sector-specifieke uitbreidingen, custom declaratie-engines).
            </li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
