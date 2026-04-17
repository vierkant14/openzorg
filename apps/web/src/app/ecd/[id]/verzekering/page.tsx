"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ecdFetch } from "../../../../lib/api";
import { TabNav } from "../TabNav";

const inputClass =
  "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
const selectClass = inputClass;

const FINANCIERING_OPTIONS = [
  { code: "wlz", label: "WLZ" },
  { code: "wmo", label: "WMO" },
  { code: "zvw", label: "ZVW" },
  { code: "jeugdwet", label: "Jeugdwet" },
];

const ZZP_KLASSEN = [
  { code: "VV-01", label: "VV-01 — Beschut wonen met begeleiding" },
  { code: "VV-02", label: "VV-02 — Beschut wonen met begeleiding en verzorging" },
  { code: "VV-03", label: "VV-03 — Beschut wonen met intensieve verzorging" },
  { code: "VV-04", label: "VV-04 — Beschut wonen met intensieve begeleiding en uitgebreide verzorging" },
  { code: "VV-05", label: "VV-05 — Beschermd wonen met intensieve dementiezorg" },
  { code: "VV-06", label: "VV-06 — Beschermd wonen met intensieve verzorging en verpleging" },
  { code: "VV-07", label: "VV-07 — Beschermd wonen met zeer intensieve zorg" },
  { code: "VV-08", label: "VV-08 — Beschermd wonen met zeer intensieve zorg vanwege specifieke aandoeningen" },
  { code: "VV-09", label: "VV-09 — Herstelgerichte behandeling met verpleging en verzorging" },
  { code: "VV-10", label: "VV-10 — Beschermd verblijf met intensieve palliatief-terminale zorg" },
];

interface FhirExtension {
  url: string;
  valueString?: string;
}

interface FhirCoverageClass {
  type?: { coding?: Array<{ code?: string }> };
  value?: string;
}

interface FhirCoverage {
  id: string;
  resourceType: "Coverage";
  status: string;
  payor?: Array<{ display?: string }>;
  class?: FhirCoverageClass[];
  period?: { start?: string; end?: string };
  extension?: FhirExtension[];
}

function getExtension(resource: FhirCoverage, url: string): string {
  return resource.extension?.find((e) => e.url === url)?.valueString ?? "";
}

function getPolisnummer(resource: FhirCoverage): string {
  const policyClass = resource.class?.find(
    (cl) => cl.type?.coding?.some((c) => c.code === "policy"),
  );
  return policyClass?.value ?? "";
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function statusBadge(status: string, period?: { start?: string; end?: string }): { label: string; color: string } {
  if (status === "cancelled") return { label: "Geannuleerd", color: "bg-gray-100 text-gray-600" };
  if (status !== "active") return { label: status, color: "bg-gray-100 text-gray-600" };
  if (period?.end) {
    const end = new Date(period.end);
    const now = new Date();
    if (end < now) return { label: "Verlopen", color: "bg-amber-50 text-amber-700" };
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { label: `Actief (verloopt over ${daysLeft} dagen)`, color: "bg-emerald-50 text-emerald-700" };
  }
  return { label: "Actief", color: "bg-emerald-50 text-emerald-700" };
}

export default function VerzekeringPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [coverages, setCoverages] = useState<FhirCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [verzekeraar, setVerzekeraar] = useState("");
  const [polisnummer, setPolisnummer] = useState("");
  const [financieringstype, setFinancieringstype] = useState("wlz");
  const [zzpKlasse, setZzpKlasse] = useState("");
  const [toewijzingsnummer, setToewijzingsnummer] = useState("");
  const [indicatiebesluit, setIndicatiebesluit] = useState("");
  const [ingangsdatum, setIngangsdatum] = useState("");
  const [einddatum, setEinddatum] = useState("");

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadCoverages() {
    setLoading(true);
    const { data, error: apiError } = await ecdFetch<{
      entry?: Array<{ resource: FhirCoverage }>;
    }>(`/api/clients/${clientId}/verzekering`);
    setLoading(false);
    if (apiError) {
      setError(apiError);
      return;
    }
    setCoverages(data?.entry?.map((e) => e.resource) ?? []);
  }

  useEffect(() => {
    loadCoverages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function resetForm() {
    setVerzekeraar("");
    setPolisnummer("");
    setFinancieringstype("wlz");
    setZzpKlasse("");
    setToewijzingsnummer("");
    setIndicatiebesluit("");
    setIngangsdatum("");
    setEinddatum("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(cov: FhirCoverage) {
    setVerzekeraar(cov.payor?.[0]?.display ?? "");
    setPolisnummer(getPolisnummer(cov));
    setFinancieringstype(getExtension(cov, "https://openzorg.nl/extensions/financieringstype") || "wlz");
    setZzpKlasse(getExtension(cov, "https://openzorg.nl/extensions/zzp-klasse"));
    setToewijzingsnummer(getExtension(cov, "https://openzorg.nl/extensions/toewijzingsnummer"));
    setIndicatiebesluit(getExtension(cov, "https://openzorg.nl/extensions/indicatiebesluit"));
    setIngangsdatum(cov.period?.start ?? "");
    setEinddatum(cov.period?.end ?? "");
    setEditingId(cov.id);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const body = {
      verzekeraar,
      polisnummer,
      financieringstype,
      zzpKlasse: financieringstype === "wlz" ? zzpKlasse : undefined,
      toewijzingsnummer: financieringstype === "wlz" ? toewijzingsnummer : undefined,
      indicatiebesluit: financieringstype === "wlz" ? indicatiebesluit : undefined,
      ingangsdatum: ingangsdatum || undefined,
      einddatum: einddatum || undefined,
    };

    const url = editingId
      ? `/api/clients/${clientId}/verzekering/${editingId}`
      : `/api/clients/${clientId}/verzekering`;
    const method = editingId ? "PUT" : "POST";

    const { error: apiError } = await ecdFetch(url, {
      method,
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    setSuccess(editingId ? "Verzekering bijgewerkt" : "Verzekering aangemaakt");
    resetForm();
    await loadCoverages();
  }

  const activeCoverages = coverages.filter((c) => c.status === "active");
  const historicCoverages = coverages.filter((c) => c.status !== "active");

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <TabNav clientId={clientId} />

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-fg">Verzekeringsinformatie</h2>
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800"
            >
              Nieuwe verzekering
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-coral-50 border border-coral-200 rounded-lg text-coral-600 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
            {success}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-raised rounded-lg border border-default p-6 space-y-4 mb-6">
            <h3 className="text-sm font-semibold text-fg">
              {editingId ? "Verzekering bewerken" : "Nieuwe verzekering toevoegen"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Verzekeraar</label>
                <input
                  type="text"
                  value={verzekeraar}
                  onChange={(e) => setVerzekeraar(e.target.value)}
                  placeholder="Bijv. CZ, Menzis, Zilveren Kruis"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Polisnummer</label>
                <input type="text" value={polisnummer} onChange={(e) => setPolisnummer(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Financieringstype</label>
              <select value={financieringstype} onChange={(e) => setFinancieringstype(e.target.value)} className={selectClass}>
                {FINANCIERING_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
            </div>

            {financieringstype === "wlz" && (
              <div className="border-t border-default pt-4">
                <h4 className="text-sm font-medium text-fg-muted mb-3">WLZ-specifieke velden</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg-muted mb-1">ZZP-klasse</label>
                    <select value={zzpKlasse} onChange={(e) => setZzpKlasse(e.target.value)} className={selectClass}>
                      <option value="">Selecteer ZZP-klasse</option>
                      {ZZP_KLASSEN.map((z) => (
                        <option key={z.code} value={z.code}>{z.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-fg-muted mb-1">Toewijzingsnummer</label>
                    <input type="text" value={toewijzingsnummer} onChange={(e) => setToewijzingsnummer(e.target.value)} placeholder="TW-2026-000001" className={inputClass} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-fg-muted mb-1">Indicatiebesluit nummer</label>
                  <input type="text" value={indicatiebesluit} onChange={(e) => setIndicatiebesluit(e.target.value)} placeholder="IB-2026-123456" className={inputClass} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Ingangsdatum</label>
                <input type="date" value={ingangsdatum} onChange={(e) => setIngangsdatum(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Einddatum</label>
                <input type="date" value={einddatum} onChange={(e) => setEinddatum(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-fg-muted bg-raised border border-default rounded-md hover:bg-sunken"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50"
              >
                {saving ? "Opslaan..." : editingId ? "Bijwerken" : "Toevoegen"}
              </button>
            </div>
          </form>
        )}

        {/* Active coverages */}
        {loading ? (
          <p className="text-sm text-fg-muted">Laden...</p>
        ) : activeCoverages.length === 0 && !showForm ? (
          <div className="bg-raised rounded-lg border border-default p-8 text-center">
            <p className="text-fg-muted text-sm">Geen actieve verzekeringen gevonden.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-brand-700 hover:text-brand-900 font-medium"
            >
              Verzekering toevoegen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCoverages.map((cov) => {
              const badge = statusBadge(cov.status, cov.period);
              const ft = getExtension(cov, "https://openzorg.nl/extensions/financieringstype");
              const zzp = getExtension(cov, "https://openzorg.nl/extensions/zzp-klasse");
              return (
                <div key={cov.id} className="bg-raised rounded-lg border border-default p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-fg">{cov.payor?.[0]?.display ?? "Onbekend"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                        {ft && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{ft.toUpperCase()}</span>}
                      </div>
                      <div className="text-sm text-fg-muted space-y-0.5">
                        {getPolisnummer(cov) && <p>Polis: {getPolisnummer(cov)}</p>}
                        {zzp && <p>ZZP-klasse: {zzp}</p>}
                        <p>Periode: {formatDate(cov.period?.start)} — {formatDate(cov.period?.end)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(cov)}
                      className="text-sm text-brand-700 hover:text-brand-900"
                    >
                      Bewerken
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Historic coverages */}
        {historicCoverages.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-fg-muted mb-3">Verzekeringhistorie</h3>
            <div className="space-y-2">
              {historicCoverages.map((cov) => {
                const ft = getExtension(cov, "https://openzorg.nl/extensions/financieringstype");
                const zzp = getExtension(cov, "https://openzorg.nl/extensions/zzp-klasse");
                return (
                  <div key={cov.id} className="bg-sunken rounded-lg border border-default p-3 text-sm text-fg-muted">
                    <span>{formatDate(cov.period?.start)} — {formatDate(cov.period?.end)}</span>
                    {zzp && <span className="ml-2">ZZP {zzp}</span>}
                    <span className="ml-2">{cov.payor?.[0]?.display ?? ""}</span>
                    {ft && <span className="ml-2 text-xs uppercase">{ft}</span>}
                    <span className="ml-2 text-xs capitalize">{cov.status === "cancelled" ? "Geannuleerd" : cov.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
