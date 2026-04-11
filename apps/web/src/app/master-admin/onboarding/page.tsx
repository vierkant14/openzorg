"use client";

import { useState, type FormEvent } from "react";

import { masterFetch } from "../../../lib/master-api";

const SECTORS = [
  { value: "vvt", label: "VVT — Verpleging, Verzorging & Thuiszorg" },
  { value: "ggz", label: "GGZ — Geestelijke Gezondheidszorg" },
  { value: "ghz", label: "GHZ — Gehandicaptenzorg" },
  { value: "ziekenhuis", label: "Ziekenhuis" },
  { value: "jeugdzorg", label: "Jeugdzorg" },
  { value: "huisartsenzorg", label: "Huisartsenzorg" },
  { value: "revalidatie", label: "Revalidatie" },
] as const;

const KERN_MODULES = [
  { id: "clientregistratie", label: "Clientregistratie", required: true },
  { id: "medewerkers", label: "Medewerkers", required: true },
  { id: "organisatie", label: "Organisatie", required: true },
  { id: "rapportage", label: "Rapportage", required: true },
  { id: "planning", label: "Planning", required: true },
  { id: "configuratie", label: "Configuratie", required: true },
  { id: "toegangsbeheer", label: "Toegangsbeheer", required: true },
  { id: "berichten", label: "Berichten", required: true },
];

const VVT_MODULES = [
  { id: "zorgplan", label: "Zorgplan" },
  { id: "mic-meldingen", label: "MIC-meldingen" },
  { id: "medicatie", label: "Medicatie" },
  { id: "wachtlijst", label: "Wachtlijst" },
  { id: "dagplanning", label: "Dagplanning" },
  { id: "facturatie", label: "Facturatie (gepland)" },
];

type Step = 0 | 1 | 2 | 3 | 4;

const STEP_LABELS = ["Organisatie", "Contact", "Modules", "Beheerder", "Bevestiging"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0: Organisatie
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sector, setSector] = useState("vvt");
  const [sectors, setSectors] = useState<string[]>(["vvt"]);

  // Step 1: Contact
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Step 2: Modules
  const [selectedModules, setSelectedModules] = useState<string[]>(
    [...KERN_MODULES.map((m) => m.id), ...VVT_MODULES.filter((m) => m.id !== "facturatie").map((m) => m.id)],
  );

  // Step 3: Beheerder account
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Step 4: Resultaat
  const [result, setResult] = useState<{
    tenantId: string;
    tenantName: string;
    adminEmail: string;
    medplumProjectId: string;
  } | null>(null);

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Step 1: Create tenant in DB
    const { data: tenantData, error: tenantError } = await masterFetch<{
      id: string;
      name: string;
      slug: string;
    }>("/api/master/tenants", {
      method: "POST",
      body: JSON.stringify({
        name,
        slug,
        sector: sectors[0] ?? "vvt",
        sectors,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        enabledModules: selectedModules,
      }),
    });

    if (tenantError || !tenantData) {
      setLoading(false);
      setError(tenantError ?? "Tenant aanmaken mislukt");
      return;
    }

    // Step 2: Provision Medplum project + admin user
    const { data: provisionData, error: provisionError } = await masterFetch<{
      success: boolean;
      medplumProjectId: string;
      adminEmail: string;
    }>(`/api/master/tenants/${tenantData.id}/provision`, {
      method: "POST",
      body: JSON.stringify({
        adminEmail,
        adminPassword,
        adminFirstName,
        adminLastName,
      }),
    });

    setLoading(false);

    if (provisionError) {
      setError(`Tenant aangemaakt, maar provisioning mislukt: ${provisionError}`);
      return;
    }

    setResult({
      tenantId: tenantData.id,
      tenantName: tenantData.name,
      adminEmail: provisionData?.adminEmail ?? adminEmail,
      medplumProjectId: provisionData?.medplumProjectId ?? "",
    });
    setStep(4);
  }

  const inputCls = "w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none";

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <a href="/master-admin" className="text-navy-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </a>
            <div>
              <h1 className="font-display text-heading font-bold tracking-tight">Nieuwe omgeving</h1>
              <p className="text-body-sm text-navy-300">Onboarding wizard</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-10">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-brand-500" : "bg-surface-200 dark:bg-surface-700"}`} />
              <p className={`text-caption mt-2 ${i <= step ? "text-brand-600 dark:text-brand-400 font-medium" : "text-fg-subtle"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Step 0: Organisatie */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-display-md text-fg font-display mb-2">Over de organisatie</h2>
              <p className="text-body-sm text-fg-muted">Basisgegevens van de zorginstelling.</p>
            </div>

            <div className="bg-raised rounded-2xl border border-default p-6 space-y-5">
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">
                  Naam organisatie <span className="text-coral-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug || slug === generateSlug(name)) {
                      setSlug(generateSlug(e.target.value));
                    }
                  }}
                  placeholder="bijv. Zorggroep Horizon"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">
                  URL-slug <span className="text-coral-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-fg-subtle">openzorg.nl/</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                    placeholder="zorggroep-horizon"
                    className={`flex-1 ${inputCls} font-mono`}
                  />
                </div>
                <p className="text-caption text-fg-subtle mt-1.5">Alleen kleine letters, cijfers en streepjes.</p>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Zorgsectoren</label>
                <p className="text-caption text-fg-subtle mb-3">Selecteer alle sectoren die deze organisatie levert.</p>
                <div className="space-y-2">
                  {SECTORS.map((s) => {
                    const checked = sectors.includes(s.value);
                    return (
                      <label
                        key={s.value}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                          checked ? "bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800" : "bg-raised border border-default hover:bg-sunken"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? sectors.filter((x) => x !== s.value)
                              : [...sectors, s.value];
                            setSectors(next.length > 0 ? next : [s.value]);
                            if (!checked || next.length === 0) setSector(next[0] ?? s.value);
                            else if (sector === s.value) setSector(next[0] ?? "vvt");
                          }}
                          className="w-4 h-4 rounded text-brand-600 accent-brand-600"
                        />
                        <span className="text-body-sm text-fg">{s.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => { if (name && slug) setStep(1); }}
                disabled={!name || !slug}
                className="px-6 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 transition-colors"
              >
                Volgende
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Contact */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-display-md text-fg font-display mb-2">Contactpersoon</h2>
              <p className="text-body-sm text-fg-muted">Wie is het aanspreekpunt voor deze omgeving?</p>
            </div>

            <div className="bg-raised rounded-2xl border border-default p-6 space-y-5">
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Naam contactpersoon</label>
                <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jan de Vries" className={inputCls} />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">E-mailadres</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="admin@zorginstelling.nl" className={inputCls} />
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="px-6 py-3 text-body-sm font-medium text-fg-muted hover:text-fg transition-colors">Terug</button>
              <button onClick={() => setStep(2)} className="px-6 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors">Volgende</button>
            </div>
          </div>
        )}

        {/* Step 2: Modules */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-display-md text-fg font-display mb-2">Modules selecteren</h2>
              <p className="text-body-sm text-fg-muted">Kies welke modules actief moeten zijn. Kernmodules zijn altijd ingeschakeld.</p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-subheading text-fg mb-3">Kernmodules (verplicht)</h3>
                <div className="bg-raised rounded-2xl border border-default p-4 space-y-2">
                  {KERN_MODULES.map((mod) => (
                    <label key={mod.id} className="flex items-center gap-3 px-3 py-2 rounded-xl">
                      <input type="checkbox" checked disabled className="w-4 h-4 rounded text-brand-600 accent-brand-600" />
                      <span className="text-body-sm text-fg">{mod.label}</span>
                      <span className="text-caption text-fg-subtle ml-auto">Verplicht</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-subheading text-fg mb-3">Sectormodules ({SECTORS.find((s) => s.value === sector)?.label.split("—")[0]?.trim()})</h3>
                <div className="bg-raised rounded-2xl border border-default p-4 space-y-2">
                  {VVT_MODULES.map((mod) => {
                    const isSelected = selectedModules.includes(mod.id);
                    const isPlanned = mod.id === "facturatie";
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                          isSelected && !isPlanned ? "bg-brand-50 dark:bg-brand-950/20" : "hover:bg-sunken"
                        } ${isPlanned ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isPlanned}
                          onChange={() => { if (!isPlanned) toggleModule(mod.id); }}
                          className="w-4 h-4 rounded text-brand-600 accent-brand-600"
                        />
                        <span className="text-body-sm text-fg">{mod.label}</span>
                        {isPlanned && <span className="text-caption text-fg-subtle ml-auto">Binnenkort beschikbaar</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-3 text-body-sm font-medium text-fg-muted hover:text-fg transition-colors">Terug</button>
              <button onClick={() => setStep(3)} className="px-6 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors">Volgende</button>
            </div>
          </div>
        )}

        {/* Step 3: Beheerder account */}
        {step === 3 && !result && (
          <div className="space-y-6">
            <div>
              <h2 className="text-display-md text-fg font-display mb-2">Eerste beheerder</h2>
              <p className="text-body-sm text-fg-muted">Dit wordt de admin van de organisatie. Zij kunnen zelf extra gebruikers aanmaken.</p>
            </div>

            <div className="bg-raised rounded-2xl border border-default p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-body-sm font-medium text-fg mb-1.5">
                    Voornaam <span className="text-coral-500">*</span>
                  </label>
                  <input type="text" required value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} placeholder="Jan" className={inputCls} />
                </div>
                <div>
                  <label className="block text-body-sm font-medium text-fg mb-1.5">
                    Achternaam <span className="text-coral-500">*</span>
                  </label>
                  <input type="text" required value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} placeholder="de Vries" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">
                  E-mailadres <span className="text-coral-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="beheerder@zorginstelling.nl"
                  className={inputCls}
                />
                <p className="text-caption text-fg-subtle mt-1.5">Dit wordt het login-adres voor de beheerder.</p>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">
                  Wachtwoord <span className="text-coral-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={12}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Minimaal 12 tekens"
                  className={inputCls}
                />
                <p className="text-caption text-fg-subtle mt-1.5">Minimaal 12 tekens, mix van hoofdletters, cijfers en symbolen.</p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-4 text-body-sm text-coral-700 dark:text-coral-300">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => { setStep(2); setError(null); }} className="px-6 py-3 text-body-sm font-medium text-fg-muted hover:text-fg transition-colors">Terug</button>
              <button
                onClick={(e) => handleSubmit(e as unknown as FormEvent)}
                disabled={loading || !adminEmail || !adminPassword || !adminFirstName || !adminLastName || adminPassword.length < 12}
                className="px-8 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-soft"
              >
                {loading ? "Omgeving aanmaken..." : "Omgeving aanmaken"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && result && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-50 dark:bg-brand-950/30 mb-6">
              <svg className="w-10 h-10 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="text-display-md text-fg font-display mb-2">Omgeving is live!</h2>
            <p className="text-body text-fg-muted max-w-md mx-auto mb-8">
              <strong>{result.tenantName}</strong> is volledig ingericht en klaar voor gebruik.
            </p>

            <div className="bg-raised rounded-2xl border border-default p-6 max-w-lg mx-auto mb-8 text-left space-y-4">
              <h3 className="text-subheading text-fg">Inloggegevens beheerder</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-subtle">
                  <span className="text-body-sm text-fg-muted">E-mail</span>
                  <code className="text-body-sm text-fg font-mono bg-sunken px-2 py-0.5 rounded">{result.adminEmail}</code>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-subtle">
                  <span className="text-body-sm text-fg-muted">Wachtwoord</span>
                  <span className="text-body-sm text-fg-subtle italic">Zoals zojuist ingevoerd</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-subtle">
                  <span className="text-body-sm text-fg-muted">Project ID</span>
                  <code className="text-body-sm text-fg font-mono bg-sunken px-2 py-0.5 rounded text-xs">{result.medplumProjectId || "—"}</code>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-body-sm text-fg-muted">Login URL</span>
                  <code className="text-body-sm text-brand-600 dark:text-brand-400 font-mono">/login</code>
                </div>
              </div>

              <div className="bg-brand-50 dark:bg-brand-950/20 rounded-xl p-4 mt-4">
                <p className="text-body-sm text-brand-700 dark:text-brand-300">
                  Deel deze gegevens met de beheerder van {result.tenantName}. Zij kunnen daarna zelf medewerkers uitnodigen via het admin panel.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <a
                href="/master-admin"
                className="px-6 py-3 text-body-sm font-medium text-fg-muted border border-default rounded-xl hover:bg-sunken transition-colors"
              >
                Terug naar overzicht
              </a>
              <a
                href={`/master-admin/tenants/${result.tenantId}`}
                className="px-6 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
              >
                Naar tenant details
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
