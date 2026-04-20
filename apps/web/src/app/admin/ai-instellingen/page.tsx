"use client";

import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface AiSettings {
  enabled: boolean;
  ollamaUrl: string;
  model: string;
  tenantPrompt: string;
}

interface TestResult {
  ok?: boolean;
  healthy?: boolean;
  models?: string[];
  error?: string;
}

export default function AiInstellingenPage() {
  const [settings, setSettings] = useState<AiSettings>({
    enabled: false,
    ollamaUrl: "",
    model: "",
    tenantPrompt: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await ecdFetch<AiSettings>("/api/admin/ai-settings");
      if (data) {
        setSettings(data);
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const { data, error } = await ecdFetch<TestResult>("/api/admin/ai-settings/test", {
      method: "POST",
      body: JSON.stringify({ ollamaUrl: settings.ollamaUrl }),
    });
    if (error ?? !data) {
      setTestResult({ ok: false, error: error ?? "Onbekende fout" });
    } else {
      setTestResult(data);
      if ((data.ok || data.healthy) && data.models && data.models.length > 0 && !settings.model) {
        setSettings((prev) => ({ ...prev, model: data.models![0] ?? "" }));
      }
    }
    setTesting(false);
  }

  async function save() {
    setSaving(true);
    setSaveStatus(null);
    const { error } = await ecdFetch("/api/admin/ai-settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    if (error) {
      setSaveStatus({ ok: false, text: `Opslaan mislukt: ${error}` });
    } else {
      setSaveStatus({ ok: true, text: "Instellingen opgeslagen" });
      setTimeout(() => setSaveStatus(null), 3000);
    }
    setSaving(false);
  }

  const modelsAvailable = testResult?.ok || testResult?.healthy && testResult.models && testResult.models.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">AI Instellingen</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Configureer de lokale AI-integratie via Ollama voor deze organisatie.
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
          <div className="rounded-xl border border-default bg-raised p-6 space-y-6">
            {/* AI inschakelen */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-default"
                />
                <div>
                  <span className="text-sm font-medium text-fg">AI inschakelen</span>
                  <p className="text-xs text-fg-subtle">Schakel AI-functies in voor deze organisatie</p>
                </div>
              </label>
            </div>

            <hr className="border-default" />

            {/* Ollama URL */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg-muted">
                Ollama URL
              </label>
              <input
                type="text"
                value={settings.ollamaUrl}
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, ollamaUrl: e.target.value }));
                  setTestResult(null);
                }}
                placeholder="http://192.168.1.20:11434"
                className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="mt-1 text-xs text-fg-subtle">
                Het adres van de Ollama-instantie binnen uw netwerk.
              </p>
            </div>

            {/* Verbinding testen */}
            <div>
              <button
                type="button"
                onClick={() => void testConnection()}
                disabled={testing || !settings.ollamaUrl}
                className="rounded-lg border border-default bg-sunken px-4 py-2 text-sm font-medium text-fg hover:bg-page disabled:opacity-50 transition-colors"
              >
                {testing ? "Verbinding testen..." : "Verbinding testen"}
              </button>

              {testResult && (
                <div className={`mt-2 text-sm ${testResult.ok ? "text-emerald-600" : "text-coral-600"}`}>
                  {testResult.ok ? (
                    <>
                      Verbinding geslaagd &mdash;{" "}
                      {testResult.models && testResult.models.length > 0
                        ? `${testResult.models.length} model${testResult.models.length !== 1 ? "s" : ""} beschikbaar`
                        : "geen modellen gevonden"}
                    </>
                  ) : (
                    <>Verbinding mislukt: {testResult.error}</>
                  )}
                </div>
              )}
            </div>

            {/* Model */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg-muted">
                Model
              </label>
              {modelsAvailable ? (
                <select
                  value={settings.model}
                  onChange={(e) => setSettings((prev) => ({ ...prev, model: e.target.value }))}
                  className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {testResult.models!.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => setSettings((prev) => ({ ...prev, model: e.target.value }))}
                  placeholder="gemma3:4b"
                  className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}
              <p className="mt-1 text-xs text-fg-subtle">
                Test de verbinding om beschikbare modellen op te halen, of voer handmatig een modelnaam in.
              </p>
            </div>

            {/* Organisatie-context */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg-muted">
                Organisatie-context
              </label>
              <textarea
                value={settings.tenantPrompt}
                onChange={(e) => setSettings((prev) => ({ ...prev, tenantPrompt: e.target.value }))}
                rows={5}
                placeholder="Beschrijf uw organisatie, het type zorg dat u levert en eventuele specifieke richtlijnen of terminologie die de AI moet kennen."
                className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
              />
              <p className="mt-1 text-xs text-fg-subtle">
                Deze tekst wordt als systeemcontext meegegeven aan de AI, zodat antwoorden aansluiten bij uw organisatie.
              </p>
            </div>

            {/* Opslaan */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
