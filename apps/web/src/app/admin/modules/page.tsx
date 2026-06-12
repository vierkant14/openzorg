"use client";

import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { refreshFeatureFlags } from "../../../lib/features";

interface FeatureFlag {
  enabled: boolean;
  rolloutDate?: string;
  notes?: string;
}

interface ModuleDefinition {
  slug: string;
  naam: string;
  beschrijving: string;
}

const MODULES: ModuleDefinition[] = [
  {
    slug: "workflow-engine",
    naam: "Workflow Engine",
    beschrijving: "BPMN procesontwerp, werkbak, taken",
  },
  {
    slug: "facturatie-module",
    naam: "Facturatie",
    beschrijving: "Prestaties, declaraties, WLZ producten",
  },
  {
    slug: "dmn-editor",
    naam: "DMN Editor",
    beschrijving: "Beslistabellen voor workflow gateways (b\u00E8ta)",
  },
  {
    slug: "planning-intramuraal",
    naam: "Planning Intramuraal",
    beschrijving: "Bezettingsrooster, dienst-configuratie, competenties",
  },
  {
    slug: "mic-meldingen",
    naam: "MIC Meldingen",
    beschrijving: "Incidentmeldingen registreren en afhandelen",
  },
  {
    slug: "rapportages-ai",
    naam: "AI Rapportages",
    beschrijving: "AI-ondersteunde rapportage en samenvattingen",
  },
];

export default function ModulesPage() {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await ecdFetch<{ featureFlags: Record<string, FeatureFlag> }>(
        "/api/admin/feature-flags",
      );
      if (data?.featureFlags) {
        setFlags(data.featureFlags);
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function toggle(slug: string, enabled: boolean) {
    setSavingSlug(slug);
    setSaveStatus(null);

    // Optimistic update
    setFlags((prev) => ({
      ...prev,
      [slug]: { ...(prev[slug] ?? { enabled: true }), enabled },
    }));

    const { error } = await ecdFetch("/api/admin/feature-flags", {
      method: "PUT",
      body: JSON.stringify({
        featureFlags: { [slug]: { enabled } },
      }),
    });

    if (error) {
      // Revert optimistic update
      setFlags((prev) => ({
        ...prev,
        [slug]: { ...(prev[slug] ?? { enabled: true }), enabled: !enabled },
      }));
      setSaveStatus({ ok: false, text: `Opslaan mislukt: ${error}` });
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      // Refresh feature flags in localStorage so nav updates immediately
      void refreshFeatureFlags();
      setSaveStatus({ ok: true, text: `${slug} ${enabled ? "ingeschakeld" : "uitgeschakeld"}` });
      setTimeout(() => setSaveStatus(null), 3000);
    }

    setSavingSlug(null);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">Modules &amp; Features</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Schakel modules in of uit voor uw organisatie.
          </p>
        </div>

        {saveStatus && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              saveStatus.ok
                ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-300"
                : "border-coral-200 bg-coral-50 text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300"
            }`}
          >
            {saveStatus.text}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-fg-muted">Laden...</div>
        ) : (
          <div className="space-y-3">
            {MODULES.map((mod) => {
              const flag = flags[mod.slug];
              const enabled = flag?.enabled ?? true;
              const isSaving = savingSlug === mod.slug;

              return (
                <div
                  key={mod.slug}
                  className="flex items-center justify-between rounded-xl border border-default bg-raised px-5 py-4"
                >
                  <div className="min-w-0 mr-4">
                    <h3 className="text-sm font-semibold text-fg">{mod.naam}</h3>
                    <p className="mt-0.5 text-xs text-fg-muted">{mod.beschrijving}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled={isSaving}
                    onClick={() => void toggle(mod.slug, !enabled)}
                    className={`
                      relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                      border-2 border-transparent transition-colors duration-200 ease-in-out
                      focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${enabled ? "bg-brand-600" : "bg-surface-300 dark:bg-surface-600"}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
                        ring-0 transition-transform duration-200 ease-in-out
                        ${enabled ? "translate-x-5" : "translate-x-0"}
                      `}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
