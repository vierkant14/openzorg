"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { masterFetch } from "../../../../../lib/master-api";

interface FeatureFlag {
  enabled: boolean;
  rolloutDate?: string;
  notes?: string;
}

interface PlatformSettings {
  featureFlags: Record<string, FeatureFlag>;
  session: {
    accessTokenLifetime: string;
    refreshTokenLifetime: string;
    idleTimeoutMinutes: number;
  };
  branding: {
    logoUrl: string;
    primaryColor: string;
    organizationNameOverride: string;
  };
}

interface SettingsResponse {
  settings: PlatformSettings;
  availableFlags: string[];
}

const FLAG_LABELS: Record<string, string> = {
  "workflow-engine": "Workflow-engine",
  "bpmn-canvas": "BPMN Visual Canvas",
  "dmn-editor": "DMN Decision Tables",
  "facturatie-module": "Facturatie-module",
  "planning-module": "Planning-module",
  "mic-meldingen": "MIC-meldingen",
  "rapportages-ai": "AI Rapportage-hulp",
  "sales-canvas": "Sales Canvas (demo)",
};

const FLAG_DESCRIPTIONS: Record<string, string> = {
  "workflow-engine": "Flowable BPMN process-engine. Werkbak, canvas, processen. Uitzetten = geen workflows.",
  "bpmn-canvas": "Visuele editor voor BPMN-processen in /admin/workflows/canvas.",
  "dmn-editor": "DMN decision tables voor beslisregels (nog niet geïmplementeerd).",
  "facturatie-module": "Declaraties, prestaties, ZZP/VPT/MPT. Uitzetten = /admin/facturatie niet zichtbaar.",
  "planning-module": "Rooster, dagplanning, herhalingen, wachtlijst.",
  "mic-meldingen": "Melding Incident Cliëntenzorg — incidentenregistratie.",
  "rapportages-ai": "AI-assistentie bij rapportages schrijven (experimenteel).",
  "sales-canvas": "Speciale sales/demo-modus met vooraf-ingeladen templates.",
};

type Tab = "features" | "session" | "branding";

export default function TenantSettingsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [availableFlags, setAvailableFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("features");
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await masterFetch<SettingsResponse>(`/api/master/tenants/${id}/settings`);
    if (error) {
      setSaveResult({ ok: false, message: error });
    } else if (data) {
      setSettings(data.settings);
      setAvailableFlags(data.availableFlags);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveSection(section: Partial<PlatformSettings>) {
    if (!id) return;
    setSaving(true);
    setSaveResult(null);
    const { data, error } = await masterFetch<{ settings: PlatformSettings }>(
      `/api/master/tenants/${id}/settings`,
      {
        method: "PATCH",
        body: JSON.stringify(section),
      },
    );
    setSaving(false);
    if (error) {
      setSaveResult({ ok: false, message: `Opslaan mislukt: ${error}` });
    } else if (data) {
      setSettings(data.settings);
      setSaveResult({ ok: true, message: "Opgeslagen" });
      setTimeout(() => setSaveResult(null), 2500);
    }
  }

  function toggleFlag(slug: string) {
    if (!settings) return;
    const flag = settings.featureFlags[slug] ?? { enabled: false };
    const next = { ...settings.featureFlags, [slug]: { ...flag, enabled: !flag.enabled } };
    setSettings({ ...settings, featureFlags: next });
  }

  function updateFlagNotes(slug: string, notes: string) {
    if (!settings) return;
    const flag = settings.featureFlags[slug] ?? { enabled: false };
    const next = { ...settings.featureFlags, [slug]: { ...flag, notes } };
    setSettings({ ...settings, featureFlags: next });
  }

  function updateSessionField<K extends keyof PlatformSettings["session"]>(
    key: K,
    value: PlatformSettings["session"][K],
  ) {
    if (!settings) return;
    setSettings({ ...settings, session: { ...settings.session, [key]: value } });
  }

  function updateBrandingField<K extends keyof PlatformSettings["branding"]>(
    key: K,
    value: PlatformSettings["branding"][K],
  ) {
    if (!settings) return;
    setSettings({ ...settings, branding: { ...settings.branding, [key]: value } });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-fg-muted">Laden...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-xl font-bold text-fg">Instellingen niet gevonden</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Kon de platform-instellingen voor deze tenant niet laden. Check de master-admin toegang.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <a href={`/master-admin/tenants/${id}`} className="text-xs text-brand-600 hover:underline">
          ← Terug naar tenant-overzicht
        </a>
        <h1 className="mt-2 text-2xl font-bold text-fg">Platform instellingen</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Per-tenant feature-flags, sessie-configuratie en branding. Wijzigingen worden direct actief en in audit-log bewaard.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-default">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {(
            [
              ["features", "Features"],
              ["session", "Sessie"],
              ["branding", "Branding"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-brand-700 text-brand-700"
                  : "border-transparent text-fg-subtle hover:border-default hover:text-fg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {saveResult && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            saveResult.ok
              ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-300"
              : "border-coral-200 bg-coral-50 text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300"
          }`}
        >
          {saveResult.message}
        </div>
      )}

      {/* FEATURES TAB */}
      {tab === "features" && (
        <div>
          <div className="space-y-3">
            {availableFlags.map((slug) => {
              const flag = settings.featureFlags[slug] ?? { enabled: false };
              return (
                <div
                  key={slug}
                  className="rounded-xl border border-default bg-raised p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-fg">{FLAG_LABELS[slug] ?? slug}</h3>
                        <code className="text-xs text-fg-subtle">{slug}</code>
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">{FLAG_DESCRIPTIONS[slug] ?? ""}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={flag.enabled}
                      onClick={() => toggleFlag(slug)}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                        flag.enabled ? "bg-brand-600" : "bg-surface-200 dark:bg-surface-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                          flag.enabled ? "translate-x-5" : "translate-x-0.5"
                        } mt-0.5`}
                      />
                    </button>
                  </div>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={flag.notes ?? ""}
                      onChange={(e) => updateFlagNotes(slug, e.target.value)}
                      placeholder="Notitie (bv. pilot-tenant, uitgerold op 2026-05-01)"
                      className="w-full rounded-lg border border-default bg-page px-3 py-1.5 text-xs text-fg"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => saveSection({ featureFlags: settings.featureFlags })}
              disabled={saving}
              className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Features opslaan"}
            </button>
          </div>
        </div>
      )}

      {/* SESSION TAB */}
      {tab === "session" && (
        <div className="space-y-5 rounded-xl border border-default bg-raised p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Access-token lifetime</label>
            <select
              value={settings.session.accessTokenLifetime}
              onChange={(e) => updateSessionField("accessTokenLifetime", e.target.value)}
              className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            >
              <option value="1h">1 uur (productie-default)</option>
              <option value="8h">8 uur</option>
              <option value="1d">1 dag</option>
              <option value="7d">7 dagen</option>
              <option value="30d">30 dagen</option>
            </select>
            <p className="mt-1 text-xs text-fg-subtle">
              Hoe lang een JWT access-token geldig is. Korter = veiliger, langer = minder vaak opnieuw inloggen.
              Wijziging vereist Medplum-restart + nieuwe login om effect te hebben.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Refresh-token lifetime</label>
            <select
              value={settings.session.refreshTokenLifetime}
              onChange={(e) => updateSessionField("refreshTokenLifetime", e.target.value)}
              className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            >
              <option value="1d">1 dag</option>
              <option value="7d">7 dagen</option>
              <option value="30d">30 dagen</option>
              <option value="90d">90 dagen</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Idle-timeout (minuten)</label>
            <input
              type="number"
              min={5}
              max={240}
              value={settings.session.idleTimeoutMinutes}
              onChange={(e) => updateSessionField("idleTimeoutMinutes", parseInt(e.target.value, 10) || 60)}
              className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            />
            <p className="mt-1 text-xs text-fg-subtle">
              Na hoeveel minuten inactiviteit wordt een gebruiker uitgelogd (informatief voor nu, niet afgedwongen).
            </p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => saveSection({ session: settings.session })}
              disabled={saving}
              className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Sessie opslaan"}
            </button>
          </div>
        </div>
      )}

      {/* BRANDING TAB */}
      {tab === "branding" && (
        <div className="space-y-5 rounded-xl border border-default bg-raised p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Organisatienaam (override)</label>
            <input
              type="text"
              value={settings.branding.organizationNameOverride}
              onChange={(e) => updateBrandingField("organizationNameOverride", e.target.value)}
              placeholder="Laat leeg voor default tenant-naam"
              className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Logo URL</label>
            <input
              type="text"
              value={settings.branding.logoUrl}
              onChange={(e) => updateBrandingField("logoUrl", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
            />
            {settings.branding.logoUrl && (
              <div
                className="mt-2 h-16 w-24 rounded border border-default bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${JSON.stringify(settings.branding.logoUrl)})` }}
                aria-label="Logo preview"
                role="img"
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Primary color (hex)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.branding.primaryColor || "#0ea5e9"}
                onChange={(e) => updateBrandingField("primaryColor", e.target.value)}
                className="h-10 w-20 cursor-pointer rounded border border-default bg-page"
              />
              <input
                type="text"
                value={settings.branding.primaryColor}
                onChange={(e) => updateBrandingField("primaryColor", e.target.value)}
                placeholder="#0ea5e9"
                className="flex-1 rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => saveSection({ branding: settings.branding })}
              disabled={saving}
              className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Branding opslaan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
