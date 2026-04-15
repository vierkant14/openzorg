"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { isLoggedIn } from "../lib/api";

export default function HomePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      window.location.href = "/dashboard";
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
          <p className="text-body-sm text-fg-muted">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-fg">
      {/* ── Top nav ── */}
      <header className="border-b border-default bg-raised/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="text-lg font-bold">OpenZorg</span>
            <span className="ml-2 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium dark:bg-emerald-950/30 dark:text-emerald-300">
              Open source
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="text-fg-muted hover:text-fg">Functies</a>
            <a href="#compliance" className="text-fg-muted hover:text-fg">Compliance</a>
            <a href="#roadmap" className="text-fg-muted hover:text-fg">Roadmap</a>
            <a
              href="https://github.com/vierkant14/openzorg"
              target="_blank"
              rel="noreferrer"
              className="text-fg-muted hover:text-fg"
            >
              GitHub
            </a>
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 btn-press"
            >
              Inloggen
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:bg-brand-950/30 dark:text-brand-300 mb-6">
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          OpenZorg 0.1 — eerste pilots draaien
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
          Het open-source <span className="text-brand-600">ECD</span><br />
          voor Nederlandse zorg.
        </h1>
        <p className="mt-6 text-xl text-fg-muted max-w-2xl mx-auto">
          Modulair, FHIR-native en gebouwd op Nederlandse standaarden (Zib, AGB, BSN,
          NEN 7513). Eigendom van Stichting OpenZorg onder EUPL 1.2 — geen vendor lock-in,
          geen jaarlijkse licentiekosten.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-brand-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 btn-press"
          >
            Probeer de demo →
          </Link>
          <a
            href="https://github.com/vierkant14/openzorg"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-default px-8 py-4 text-base font-semibold text-fg hover:bg-sunken btn-press"
          >
            Bekijk de broncode
          </a>
        </div>
        <div className="mt-6 text-xs text-fg-subtle">
          Demo-account: <code className="rounded bg-raised px-2 py-0.5 font-mono">jan@horizon.nl</code> / <code className="rounded bg-raised px-2 py-0.5 font-mono">Hz!J4n#2026pKw8</code>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Wat zit erin</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon="📋"
            title="Cliëntdossier (ECD)"
            desc="Volledig FHIR R4: Patient, CarePlan, Goal, Observation, MedicationRequest. Zib-compatibel en gekoppeld aan BSN."
          />
          <FeatureCard
            icon="💊"
            title="Medicatie + toediening"
            desc="Voorschrift, toedieningsregistratie en medicatie-overzicht. Dubbele-controle flow voor risicovolle medicatie."
          />
          <FeatureCard
            icon="📅"
            title="Planning + rooster"
            desc="Werkbak, dagplanning, herhalingen, wachtlijst. Per-locatie capaciteitsoverzicht."
          />
          <FeatureCard
            icon="⚙️"
            title="Workflow engine (BPMN)"
            desc="Visuele proces-editor met Flowable onder de motorkap. Intake-proces, zorgplan-evaluatie, herindicatie."
          />
          <FeatureCard
            icon="📊"
            title="Facturatie + declaraties"
            desc="Wlz (ZZP/VPT/MPT) en Zvw. Prestatie-registratie en declaratie-export naar Vecozo-formaat."
          />
          <FeatureCard
            icon="🏢"
            title="Multi-tenant platform"
            desc="Per-tenant configuratie, rollen, branding en feature-flags. PostgreSQL RLS + Medplum Projects."
          />
          <FeatureCard
            icon="✅"
            title="Drie-laags validatie"
            desc="Kern (BSN/AGB/Zib), Uitbreiding (tenant-regels) en Plugin-laag. Configuratie altijd data, nooit code."
          />
          <FeatureCard
            icon="📢"
            title="MIC-meldingen + kwaliteit"
            desc="Incident-registratie, afhandeling-workflow, trend-analyse. NEN 7513 audit-logging out-of-the-box."
          />
          <FeatureCard
            icon="🔌"
            title="Koppelvlakken"
            desc="FHIR-REST voor externe systemen, webhooks, API-keys. Klaar voor LSP/Nictiz/Vecozo-integraties."
          />
        </div>
      </section>

      {/* ── Compliance strip ── */}
      <section id="compliance" className="bg-raised border-y border-default py-16">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Gebouwd op Nederlandse standaarden</h2>
          <p className="text-fg-muted mb-10 max-w-2xl mx-auto">
            Geen afgeleide van internationale systemen — OpenZorg is vanaf de eerste regel code
            ontworpen voor Wlz, Zvw en Jeugdwet.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 text-sm">
            <ComplianceBadge label="BSN elfproef" sub="11-test verplicht bij Patient" />
            <ComplianceBadge label="AGB-register" sub="Practitioner identificatie" />
            <ComplianceBadge label="Zib-profielen" sub="Dutch FHIR extensies" />
            <ComplianceBadge label="NEN 7513" sub="Audit-logging compliant" />
            <ComplianceBadge label="EUPL 1.2" sub="Europese open-source licentie" />
            <ComplianceBadge label="FHIR R4" sub="HL7 internationale standaard" />
            <ComplianceBadge label="Flowable BPMN 2.0" sub="Workflow engine" />
            <ComplianceBadge label="PostgreSQL RLS" sub="Tenant-isolatie" />
          </div>
        </div>
      </section>

      {/* ── Roadmap ── */}
      <section id="roadmap" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Roadmap</h2>
        <div className="space-y-4">
          <RoadmapItem
            phase="Nu (Q2 2026)"
            status="done"
            items={["Cliënt-CRUD + Zorgplan + Medicatie", "Multi-tenant platform", "NEN 7513 audit-logging", "BPMN workflow engine", "Drie-laags validatie-engine"]}
          />
          <RoadmapItem
            phase="Volgend (Q3 2026)"
            status="active"
            items={["CIZ-indicatie koppeling + ZZP-bandbreedte", "Drag-and-drop rooster grid", "Vecozo declaratie-export", "SMART-goal validator", "6-maandelijkse evaluatie-scheduler"]}
          />
          <RoadmapItem
            phase="Later"
            status="planned"
            items={["Nictiz LSP-koppeling", "eOverdracht / ontslagmanagement", "Mobile companion app", "AI-samenvattingen van rapportages", "GGZ en GHZ sector-modules"]}
          />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-default bg-raised py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-fg-muted">
          <div>
            <div className="font-semibold text-fg">Stichting OpenZorg</div>
            <div>Non-profit · EUPL 1.2 · Nederland</div>
          </div>
          <div className="flex gap-6">
            <a href="https://github.com/vierkant14/openzorg" target="_blank" rel="noreferrer" className="hover:text-fg">GitHub</a>
            <Link href="/login" className="hover:text-fg">Demo login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-default bg-raised p-6 hover:border-brand-300 transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-fg mb-2">{title}</h3>
      <p className="text-sm text-fg-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function ComplianceBadge({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="rounded-lg border border-default bg-page p-4">
      <div className="font-semibold text-fg">{label}</div>
      <div className="text-xs text-fg-subtle mt-1">{sub}</div>
    </div>
  );
}

function RoadmapItem({
  phase,
  status,
  items,
}: {
  phase: string;
  status: "done" | "active" | "planned";
  items: string[];
}) {
  const badgeCls =
    status === "done"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
      : status === "active"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        : "bg-surface-200 text-fg-muted dark:bg-surface-800";
  const badgeText = status === "done" ? "✓ Gereed" : status === "active" ? "In ontwikkeling" : "Gepland";
  return (
    <div className="rounded-xl border border-default bg-raised p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-fg">{phase}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeCls}`}>{badgeText}</span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-fg-muted">
            <span className="text-brand-500 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
