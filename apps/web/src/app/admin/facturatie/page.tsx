"use client";

import AppShell from "../../../components/AppShell";

export default function FacturatiePage() {
  return (
    <AppShell>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        <div className="mb-8">
          <h1 className="text-display-lg text-fg">Facturatie</h1>
          <p className="text-body text-fg-muted mt-1">Declaraties en zorgprestaties beheren</p>
        </div>

        <div className="bg-raised rounded-2xl border border-default p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-navy-50 dark:bg-navy-900/30 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-navy-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
              <path d="M8 7h8M8 11h8M8 15h5" />
            </svg>
          </div>
          <h2 className="text-heading text-fg font-semibold mb-2">Facturatie module in ontwikkeling</h2>
          <p className="text-body-sm text-fg-muted max-w-md mx-auto mb-6">
            De facturatiemodule wordt in Sprint 4 ontwikkeld. Dit omvat declaratiebeheer,
            zorgprestatie-registratie en integratie met WLZ-, WMO-, ZVW- en Jeugdwet-financiering.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mt-8">
            <FeatureCard title="Declaraties" description="Automatisch declaraties genereren vanuit geregistreerde zorgprestaties" />
            <FeatureCard title="Prestaties" description="Zorgactiviteiten registreren en koppelen aan financieringstypen" />
            <FeatureCard title="Rapportage" description="Overzicht van open, ingediende en betaalde declaraties" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-sunken rounded-xl p-4 text-left">
      <h3 className="text-body-sm font-semibold text-fg mb-1">{title}</h3>
      <p className="text-caption text-fg-subtle">{description}</p>
    </div>
  );
}
