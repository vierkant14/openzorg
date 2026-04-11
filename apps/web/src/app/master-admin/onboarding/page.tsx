"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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

type Step = 0 | 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
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

  // Step 3: Bevestiging + resultaat
  const [createdTenant, setCreatedTenant] = useState<{ id: string; name: string; slug: string } | null>(null);

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

    const { data, error: apiError } = await masterFetch<{ id: string; name: string; slug: string }>(
      "/api/master/tenants",
      {
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
      },
    );

    setLoading(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    if (data) {
      setCreatedTenant(data);
      setStep(3);
    }
  }

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
          {["Organisatie", "Contact", "Modules", "Bevestiging"].map((label, i) => (
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
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
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
                    className="flex-1 border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg font-mono placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                  />
                </div>
                <p className="text-caption text-fg-subtle mt-1.5">Alleen kleine letters, cijfers en streepjes.</p>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Zorgsectoren</label>
                <p className="text-caption text-fg-subtle mb-3">Selecteer alle sectoren die deze organisatie levert. Meerdere combinaties zijn mogelijk (bijv. VVT + GGZ).</p>
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
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Jan de Vries"
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">E-mailadres</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="admin@zorginstelling.nl"
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(0)}
                className="px-6 py-3 text-body-sm font-medium text-fg-muted hover:text-fg transition-colors"
              >
                Terug
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
              >
                Volgende
              </button>
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
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 text-body-sm font-medium text-fg-muted hover:text-fg transition-colors"
              >
                Terug
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
              >
                Bevestigen
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Bevestiging */}
        {step === 3 && !createdTenant && (
          <div className="space-y-6">
            <div>
              <h2 className="text-display-md text-fg font-display mb-2">Bevestig onboarding</h2>
              <p className="text-body-sm text-fg-muted">Controleer de gegevens en maak de omgeving aan.</p>
            </div>

            <div className="bg-raised rounded-2xl border border-default p-6 space-y-4">
              <SummaryRow label="Organisatie" value={name} />
              <SummaryRow label="Slug" value={slug} mono />
              <SummaryRow label="Sectoren" value={sectors.map((s) => SECTORS.find((x) => x.value === s)?.label.split("—")[0]?.trim() ?? s).join(", ")} />
              <SummaryRow label="Contactpersoon" value={contactName || "—"} />
              <SummaryRow label="E-mail" value={contactEmail || "—"} />
              <SummaryRow label="Modules" value={`${selectedModules.length} actief`} />
            </div>

            {error && (
              <div className="rounded-xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-4 text-body-sm text-coral-700 dark:text-coral-300">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => { setStep(2); setError(null); }}
                className="px-6 py-3 text-body-sm font-medium text-fg-muted hover:text-fg transition-colors"
              >
                Terug
              </button>
              <button
                onClick={(e) => handleSubmit(e as unknown as FormEvent)}
                disabled={loading}
                className="px-8 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-soft"
              >
                {loading ? "Omgeving aanmaken..." : "Omgeving aanmaken"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && createdTenant && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-50 dark:bg-brand-950/30 mb-6">
              <svg className="w-10 h-10 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="text-display-md text-fg font-display mb-2">Omgeving aangemaakt!</h2>
            <p className="text-body text-fg-muted max-w-md mx-auto mb-8">
              <strong>{createdTenant.name}</strong> is succesvol aangemaakt en klaar voor gebruik.
            </p>

            <div className="bg-raised rounded-2xl border border-default p-6 max-w-md mx-auto mb-8 text-left">
              <h3 className="text-subheading text-fg mb-3">Volgende stappen</h3>
              <ol className="space-y-2 text-body-sm text-fg-muted">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 text-caption font-bold flex items-center justify-center shrink-0">1</span>
                  Configureer de Medplum project koppeling
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 text-caption font-bold flex items-center justify-center shrink-0">2</span>
                  Maak de eerste beheerder aan
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 text-caption font-bold flex items-center justify-center shrink-0">3</span>
                  Deel de login-URL met de organisatie
                </li>
              </ol>
            </div>

            <div className="flex gap-3 justify-center">
              <a
                href="/master-admin"
                className="px-6 py-3 text-body-sm font-medium text-fg-muted border border-default rounded-xl hover:bg-sunken transition-colors"
              >
                Terug naar overzicht
              </a>
              <a
                href="/master-admin/onboarding"
                onClick={(e) => { e.preventDefault(); setCreatedTenant(null); setStep(0); setName(""); setSlug(""); setContactName(""); setContactEmail(""); }}
                className="px-6 py-3 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
              >
                Nog een omgeving aanmaken
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-subtle last:border-0">
      <span className="text-body-sm text-fg-muted">{label}</span>
      <span className={`text-body-sm text-fg font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
