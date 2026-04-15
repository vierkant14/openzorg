"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoLockup, LogoMark } from "../components/LogoMark";
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
          <LogoMark size={48} />
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
          <div className="flex items-center gap-3">
            <LogoLockup size={34} />
            <span className="ml-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium dark:bg-emerald-950/30 dark:text-emerald-300">
              Open source
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="#visie" className="text-fg-muted hover:text-fg">Visie</a>
            <a href="#markt" className="text-fg-muted hover:text-fg">Markt</a>
            <a href="#scope" className="text-fg-muted hover:text-fg">Scope</a>
            <a href="#features" className="text-fg-muted hover:text-fg">Functies</a>
            <a href="#backlog" className="text-fg-muted hover:text-fg">Backlog</a>
            <Link href="/visie" className="text-fg-muted hover:text-fg">Meer</Link>
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
          De hele Nederlandse zorg<br />
          <span className="text-brand-600">open source</span>.
        </h1>
        <p className="mt-6 text-xl text-fg-muted max-w-3xl mx-auto">
          Eén gedeelde, open-source infrastructuur voor Wlz, Zvw en Jeugdwet —
          van VVT tot ziekenhuis, van GGZ tot gehandicaptenzorg. Eigendom van
          Stichting OpenZorg onder EUPL 1.2. Geen vendor lock-in. Geen jaarlijkse
          licentiekosten. Transparante hosting-kosten.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
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
          <Link
            href="/visie"
            className="rounded-xl border border-default px-8 py-4 text-base font-semibold text-fg hover:bg-sunken btn-press"
          >
            Lees de visie
          </Link>
        </div>
        <div className="mt-6 text-xs text-fg-subtle">
          Demo-account: <code className="rounded bg-raised px-2 py-0.5 font-mono">jan@horizon.nl</code> / <code className="rounded bg-raised px-2 py-0.5 font-mono">Hz!J4n#2026pKw8</code>
        </div>
      </section>

      {/* ── Visie ── */}
      <section id="visie" className="border-y border-default bg-raised py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-10">
            <div className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-2">Onze visie</div>
            <h2 className="text-4xl font-bold">De zorg is publiek. De software zou dat ook moeten zijn.</h2>
          </div>
          <div className="space-y-6 text-lg text-fg-muted leading-relaxed">
            <p>
              Nederland geeft meer dan <strong className="text-fg">€100 miljard per jaar</strong> uit aan zorg.
              Een aanzienlijk deel daarvan gaat naar ICT die draait op propriëtaire systemen
              van een handvol commerciële leveranciers. Zorginstellingen betalen jaarlijks
              licentiekosten, zitten vast aan één vendor, en kunnen hun eigen data niet
              zonder toestemming exporteren.
            </p>
            <p>
              <strong className="text-fg">Dat is geen technisch probleem — het is een politiek probleem.</strong>
              {" "}Publiek gefinancierde zorg zou moeten draaien op publiek gefinancierde,
              transparante infrastructuur. Net zoals de BRP, DigiD en MijnOverheid.
            </p>
            <p>
              <strong className="text-fg">Wij willen de hele zorg disrupten</strong> door een
              volwaardig alternatief te bouwen, in de open lucht, samen met zorgverleners.
              Stichting OpenZorg (non-profit) bezit de code onder EUPL 1.2. Een
              commerciële B.V. mag hosting, consulting en support verkopen — maar de software
              blijft altijd vrij beschikbaar voor iedereen die 'm zelf wil draaien.
            </p>
            <p>
              <strong className="text-fg">Transparante kosten</strong>. Geen verborgen
              licentiemodellen. Hosting bij ons: een voorspelbare maandprijs per tenant
              die open op de site staat. Zelf hosten: alle code op GitHub, documentatie
              meegeleverd. De vraag wordt: betaal je voor service die je kunt zien, of voor
              een licentie die je in een contract hebt verstopt?
            </p>
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/visie"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 btn-press"
            >
              Lees het hele verhaal →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Markt context ── */}
      <section id="markt" className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-12">
          <div className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-2">De markt vandaag</div>
          <h2 className="text-4xl font-bold">Een sector met heel weinig keuze</h2>
          <p className="mt-4 text-lg text-fg-muted max-w-2xl mx-auto">
            De Nederlandse zorg-ICT is geconcentreerd bij een klein aantal leveranciers.
            Zonder alternatief betekent dat hoge switchkosten, trage innovatie en
            data die niet verplaatsbaar is.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <MarketCard
            sector="Ziekenhuizen (EPD)"
            stat="72%"
            desc="De grootste EPD-leverancier heeft 72% van alle Nederlandse ziekenhuizen. Per 2026 blijven er slechts 3 aanbieders over op de markt."
            source="M&I/Partners 2025"
          />
          <MarketCard
            sector="VVT (ouderenzorg)"
            stat="~58%"
            desc="De marktleider heeft 67 van de 115 grote VVT-instellingen (≈58%). Diens aandeel groeide de afgelopen 5 jaar met ruim 20%."
            source="ECD-inventarisatie 2025"
          />
          <MarketCard
            sector="Gehandicaptenzorg"
            stat="~56%"
            desc="Eén leverancier heeft 55 van de 98 GHZ-instellingen (≈56%). De top 3 samen domineren het volledige grote-instellingen segment."
            source="ECD-inventarisatie 2025"
          />
        </div>
        <div className="mt-8 rounded-xl border border-brand-200 bg-brand-50/30 dark:bg-brand-950/10 p-6 text-center">
          <p className="text-fg">
            <strong className="text-brand-700 dark:text-brand-400">Concentratie ≠ keuze.</strong>
            {" "}Wanneer één vendor meer dan de helft van een sector bedient, is er geen
            echte markt meer. Migratie kost jaren en miljoenen. Data-ownership wordt
            een onderhandelbaar privilege in plaats van een recht.
          </p>
        </div>
      </section>

      {/* ── Scope / bigger picture ── */}
      <section id="scope" className="bg-raised border-y border-default py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <div className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-2">Het grotere plaatje</div>
            <h2 className="text-4xl font-bold">VVT is het begin. Niet het eindpunt.</h2>
            <p className="mt-4 text-lg text-fg-muted max-w-2xl mx-auto">
              OpenZorg start met VVT omdat daar de urgentie het hoogst is en de
              complexiteit werkbaar. Maar de architectuur — FHIR-native, modulair,
              multi-tenant — is bewust generiek gehouden voor de hele Nederlandse zorg.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ScopeCard sector="VVT" status="nu" items={["Thuiszorg", "Verpleeghuis", "Hospice", "Dagbesteding"]} />
            <ScopeCard sector="Gehandicaptenzorg (GHZ)" status="2026" items={["Dagbesteding", "Wonen", "Jeugd-GHZ", "Ambulante begeleiding"]} />
            <ScopeCard sector="GGZ" status="2026" items={["Ambulant", "Beschermd wonen", "Crisisdienst", "Jeugd-GGZ"]} />
            <ScopeCard sector="Ziekenhuis (EPD)" status="2027" items={["Poliklinisch", "Klinisch", "SEH", "Afsprakensysteem"]} />
            <ScopeCard sector="Jeugdzorg" status="2027" items={["Jeugdbescherming", "Gezinshuizen", "Pleegzorg"]} />
            <ScopeCard sector="Revalidatie / GRZ" status="2027" items={["Medische specialistische revalidatie", "GRZ", "Eerstelijnsverblijf"]} />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Wat zit er nu al in</h2>
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

      {/* ── Backlog transparantie ── */}
      <section id="backlog" className="bg-raised border-y border-default py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-12">
            <div className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-2">Radicaal transparant</div>
            <h2 className="text-4xl font-bold">Dit is onze backlog. Letterlijk.</h2>
            <p className="mt-4 text-lg text-fg-muted max-w-2xl mx-auto">
              Geen marketingbeloftes, geen "coming soon"-lijstjes. Wat we bouwen en
              waarom staat in een publieke backlog. Wat af is zie je hier, wat op de
              planning staat ook. Je mag altijd meekijken.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <BacklogColumn
              title="✅ Recent afgerond"
              color="emerald"
              items={[
                "Routing-bug: lege medewerkers/organisatie/rooster lijsten gefixed",
                "Contracten endpoint werkt weer (Medplum chain-search vervangen)",
                "Validatieregels blijven nu hangen (duplicate routes verwijderd)",
                "8 extra default state-machines (Appointment, CarePlan, Task, ...)",
                "Workflow canvas: auto-select start-event na load",
                "PractitionerPicker werkt in zorgplan / MDO / medicatie",
                "Publieke landingspage (deze pagina)",
              ]}
            />
            <BacklogColumn
              title="🚧 In ontwikkeling"
              color="amber"
              items={[
                "CIZ-indicatie koppeling + ZZP-bandbreedte validatie",
                "Drag-and-drop rooster planning grid",
                "Vecozo declaratie-export voor Wlz",
                "SMART-goal validator (Layer 2 validatie-engine)",
                "6-maandelijkse evaluatie-scheduler",
                "Cloudflare Tunnel naar eigen domein",
              ]}
            />
            <BacklogColumn
              title="📥 Op de backlog"
              color="blue"
              items={[
                "Nictiz LSP-koppeling (landelijke uitwisseling)",
                "eOverdracht + ontslagmanagement",
                "Mobile companion app",
                "AI-samenvattingen van rapportages",
                "GGZ en GHZ sector-modules",
                "Jeugdzorg module",
                "Ziekenhuis EPD-tier",
                "Marketplace voor 3rd-party plugins",
              ]}
            />
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm text-fg-muted mb-4">
              De volledige, actuele backlog (met prioriteiten, sprint-planning en commit-referenties) staat op Notion.
            </p>
            <a
              href="https://www.notion.so/e9f47053acdf445487daece2e8c6ace0"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-default bg-page px-6 py-3 text-sm font-semibold text-fg hover:bg-sunken btn-press"
            >
              Open volledige backlog op Notion →
            </a>
          </div>
        </div>
      </section>

      {/* ── Compliance strip ── */}
      <section id="compliance" className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-4">Gebouwd op Nederlandse standaarden</h2>
          <p className="text-fg-muted max-w-2xl mx-auto">
            Geen afgeleide van internationale systemen — OpenZorg is vanaf de eerste regel code
            ontworpen voor Wlz, Zvw en Jeugdwet.
          </p>
        </div>
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
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-default bg-raised py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-fg-muted">
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <div>
              <div className="font-semibold text-fg">Stichting OpenZorg</div>
              <div>Non-profit · EUPL 1.2 · Nederland</div>
            </div>
          </div>
          <div className="flex gap-6">
            <Link href="/visie" className="hover:text-fg">Visie</Link>
            <a href="https://github.com/vierkant14/openzorg" target="_blank" rel="noreferrer" className="hover:text-fg">GitHub</a>
            <a href="https://www.notion.so/e9f47053acdf445487daece2e8c6ace0" target="_blank" rel="noreferrer" className="hover:text-fg">Backlog</a>
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

function MarketCard({ sector, stat, desc, source }: { sector: string; stat: string; desc: string; source: string }) {
  return (
    <div className="rounded-xl border border-default bg-raised p-6">
      <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">{sector}</div>
      <div className="text-5xl font-bold text-brand-600 mb-3">{stat}</div>
      <p className="text-sm text-fg-muted leading-relaxed mb-3">{desc}</p>
      <div className="text-xs text-fg-subtle italic">bron: {source}</div>
    </div>
  );
}

function ScopeCard({ sector, status, items }: { sector: string; status: string; items: string[] }) {
  const isNow = status === "nu";
  return (
    <div className={`rounded-xl border p-5 ${isNow ? "border-brand-400 bg-brand-50/30 dark:bg-brand-950/10" : "border-default bg-page"}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-fg">{sector}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isNow ? "bg-brand-600 text-white" : "bg-surface-200 text-fg-muted dark:bg-surface-800"}`}>
          {isNow ? "Live" : status}
        </span>
      </div>
      <ul className="space-y-1.5">
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

function BacklogColumn({ title, color, items }: { title: string; color: "emerald" | "amber" | "blue"; items: string[] }) {
  const colorCls = {
    emerald: "border-emerald-300 dark:border-emerald-700",
    amber: "border-amber-300 dark:border-amber-700",
    blue: "border-blue-300 dark:border-blue-700",
  }[color];
  return (
    <div className={`rounded-xl border-2 bg-page p-5 ${colorCls}`}>
      <h3 className="font-semibold text-fg mb-4">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-fg-muted">
            <span className="text-fg-subtle mt-0.5">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
