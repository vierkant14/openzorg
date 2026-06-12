"use client";

import Link from "next/link";

import AppShell from "../../../../components/AppShell";

/* ── Data ── */

const TRIGGER_TYPES = [
  {
    title: "API trigger",
    uitleg: "Start een proces via een REST API call. Gebruik voor automatisering vanuit externe systemen.",
    voorbeeld: (
      <div className="mt-3 rounded-lg bg-sunken p-3">
        <p className="text-xs font-medium text-fg-muted mb-1">Voorbeeld cURL</p>
        <code className="block text-xs font-mono text-fg-muted whitespace-pre-wrap break-all">
          {`curl -X POST /api/processen/{key}/start \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"variabelen": {"clientId": "123", "type": "intake"}}'`}
        </code>
      </div>
    ),
  },
  {
    title: "Formulier trigger",
    uitleg: "Start een proces wanneer een gebruiker een formulier invult. De form-key koppelt aan een taak-formulier.",
    voorbeeld: (
      <div className="mt-3 space-y-2">
        <p className="text-xs text-fg-muted">
          De <span className="font-mono bg-sunken px-1 rounded">formKey</span> van een
          user-task bepaalt welk formulier wordt getoond. Configureer beschikbare formulieren via:
        </p>
        <Link
          href="/admin/task-form-options"
          className="inline-block text-sm text-brand-600 hover:text-brand-800 font-medium"
        >
          Taak-formulieren beheren &rarr;
        </Link>
      </div>
    ),
  },
  {
    title: "Timer trigger",
    uitleg: "Start een proces op een vast tijdstip of interval. Gebruik voor periodieke taken.",
    voorbeeld: (
      <div className="mt-3 rounded-lg bg-sunken p-3">
        <p className="text-xs text-fg-muted">
          <span className="font-semibold">Voorbeeld:</span> Elke maandag om 08:00 een evaluatie-herinnering versturen.
          Gebruik een BPMN Timer Start Event met een cron-expressie:
        </p>
        <code className="block mt-1 text-xs font-mono text-fg-muted">0 0 8 ? * MON *</code>
      </div>
    ),
  },
  {
    title: "Event trigger",
    uitleg: "Start een proces als reactie op een gebeurtenis in het systeem.",
    voorbeeld: (
      <div className="mt-3 rounded-lg bg-sunken p-3">
        <p className="text-xs text-fg-muted">
          <span className="font-semibold">Voorbeeld:</span> Bij opname van een nieuwe client wordt automatisch
          het intake-proces gestart. Events worden via de workflow-trigger-engine afgevuurd.
        </p>
      </div>
    ),
  },
];

const TEMPLATES = [
  {
    key: "intake-proces",
    naam: "Intake-proces",
    beschrijving: "Automatische workflow bij opname nieuwe client. Omvat aanmelding, screening, toewijzing zorgmedewerker en opstellen eerste zorgplan.",
  },
  {
    key: "zorgplan-evaluatie",
    naam: "Zorgplan-evaluatie",
    beschrijving: "Periodieke evaluatie van het zorgplan. Bevat doelen-review, MDO-bespreking en eventuele bijstelling van zorginzet.",
  },
  {
    key: "herindicatie",
    naam: "Herindicatie",
    beschrijving: "CIZ herindicatie aanvraag proces. Bewaakt termijnen, verzamelt benodigde documenten en volgt de aanvraag tot beschikking.",
  },
  {
    key: "mic-afhandeling",
    naam: "MIC-afhandeling",
    beschrijving: "Afhandeling van een MIC-melding met verbetermaatregelen. Omvat analyse, oorzaakbepaling, maatregelen en evaluatie.",
  },
];

/* ── Component ── */

export default function WorkflowVoorbeeldenPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-display-lg text-fg">Workflow Voorbeelden &amp; Uitleg</h1>
            <p className="text-body text-fg-muted mt-1">
              Begrijp hoe triggers, condities en templates werken in de workflow-engine.
            </p>
          </div>
          <Link
            href="/admin/workflows/canvas"
            className="shrink-0 bg-brand-600 text-white px-5 py-2.5 rounded-lg hover:bg-brand-700 text-sm font-medium"
          >
            Naar canvas
          </Link>
        </div>

        {/* Section 1: Trigger Types */}
        <section>
          <h2 className="text-xl font-bold text-fg mb-4">Trigger types</h2>
          <p className="text-sm text-fg-muted mb-6">
            Een workflow start altijd met een trigger. Hieronder de vier beschikbare trigger-types met uitleg en voorbeelden.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {TRIGGER_TYPES.map((trigger) => (
              <div key={trigger.title} className="rounded-xl border border-default bg-raised p-5">
                <h3 className="text-base font-bold text-fg">{trigger.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{trigger.uitleg}</p>
                {trigger.voorbeeld}
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Conditie-builder uitleg */}
        <section>
          <h2 className="text-xl font-bold text-fg mb-4">Conditie-builder</h2>
          <div className="rounded-xl border border-default bg-raised p-6 space-y-4">
            <p className="text-sm text-fg-muted">
              Bij een <span className="font-semibold text-fg">Beslissing (gateway)</span> kun je condities instellen
              met de visuele conditie-builder. De builder genereert automatisch de juiste expressies voor Flowable.
            </p>
            <div className="rounded-lg bg-sunken p-4 space-y-2">
              <p className="text-xs font-medium text-fg-muted">Voorbeeld conditie</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="rounded bg-page border border-default px-2 py-1 text-xs font-mono text-fg">
                  {"${goedgekeurd == true}"}
                </code>
                <span className="text-xs text-fg-subtle">&rarr;</span>
                <span className="rounded-full bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300 px-2 py-0.5 text-xs font-medium">
                  &quot;Ja&quot; tak
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="rounded bg-page border border-default px-2 py-1 text-xs font-mono text-fg">
                  {"${goedgekeurd == false}"}
                </code>
                <span className="text-xs text-fg-subtle">&rarr;</span>
                <span className="rounded-full bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300 px-2 py-0.5 text-xs font-medium">
                  &quot;Nee&quot; tak
                </span>
              </div>
            </div>
            <p className="text-sm text-fg-muted">
              Je kunt variabelen vergelijken met waarden, andere variabelen of lijsten.
              De conditie-builder ondersteunt AND/OR logica.
            </p>
            <Link
              href="/admin/workflows/canvas"
              className="inline-block text-sm text-brand-600 hover:text-brand-800 font-medium"
            >
              Probeer het in de canvas &rarr;
            </Link>
          </div>
        </section>

        {/* Section 3: Beschikbare templates */}
        <section>
          <h2 className="text-xl font-bold text-fg mb-4">Beschikbare templates</h2>
          <p className="text-sm text-fg-muted mb-6">
            Deze vier ingebouwde templates kun je direct deployen vanuit het{" "}
            <Link href="/admin/workflows" className="text-brand-600 hover:text-brand-800 font-medium">
              workflow-beheer
            </Link>.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <div key={t.key} className="rounded-xl border border-default bg-raised p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded bg-brand-100 dark:bg-brand-900 px-2 py-0.5 text-xs font-mono text-brand-700 dark:text-brand-300">
                    {t.key}
                  </span>
                </div>
                <h3 className="text-base font-bold text-fg">{t.naam}</h3>
                <p className="mt-1 text-sm text-fg-muted">{t.beschrijving}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
