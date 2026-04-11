"use client";

import { useEffect, useState, type FormEvent } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { facturatieFetch } from "../../../lib/facturatie-api";

/* ---------- Types ---------- */

interface Prestatie {
  id: string;
  clientId: string;
  medewerkerNaam: string;
  datum: string;
  productCode: string;
  productOmschrijving: string;
  financieringstype: string;
  eenheid: string;
  aantal: number;
  tariefPerEenheid: number;
  totaal: number;
  status: string;
}

interface Declaratie {
  id: string;
  nummer: string;
  financieringstype: string;
  periodeVan: string;
  periodeTot: string;
  status: string;
  totaalBedrag: number;
  aantalPrestaties: number;
  ingediendOp: string | null;
  createdAt: string;
}

interface Stats {
  totaalOpen: number;
  totaalBetaald: number;
  concept: number;
  ingediend: number;
  geaccepteerd: number;
  afgewezen: number;
  betaald: number;
}

interface Product {
  code: string;
  omschrijving: string;
  tarief: number;
  eenheid?: string;
}

interface Client {
  id: string;
  naam: string;
}

type TabKey = "overzicht" | "prestaties" | "declaraties" | "nieuw";

const FINANCIERINGSTYPEN = ["wlz", "wmo", "zvw", "jeugdwet"] as const;

function formatBedrag(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/* ---------- Component ---------- */

export default function FacturatiePage() {
  const [tab, setTab] = useState<TabKey>("overzicht");

  // Data
  const [prestaties, setPrestaties] = useState<Prestatie[]>([]);
  const [declaraties, setDeclaraties] = useState<Declaratie[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [producten, setProducten] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New prestatie form
  const [newClientId, setNewClientId] = useState("");
  const [newDatum, setNewDatum] = useState(new Date().toISOString().slice(0, 10));
  const [newFinType, setNewFinType] = useState<string>("wlz");
  const [newProductCode, setNewProductCode] = useState("");
  const [newAantal, setNewAantal] = useState(1);
  const [newOpmerking, setNewOpmerking] = useState("");
  const [saving, setSaving] = useState(false);

  // Declaratie creation
  const [decFinType, setDecFinType] = useState<string>("wlz");
  const [decVan, setDecVan] = useState("");
  const [decTot, setDecTot] = useState("");
  const [creatingDec, setCreatingDec] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    facturatieFetch<{ producten: Product[] }>(`/api/prestaties/producten?type=${newFinType}`)
      .then(({ data }) => {
        setProducten(data?.producten ?? []);
        setNewProductCode("");
      });
  }, [newFinType]);

  async function loadAll() {
    setLoading(true);
    const [prestRes, decRes, clientRes] = await Promise.allSettled([
      facturatieFetch<{ prestaties: Prestatie[] }>("/api/prestaties"),
      facturatieFetch<{ declaraties: Declaratie[]; stats: Stats }>("/api/declaraties"),
      ecdFetch<{ resourceType: string; entry?: Array<{ resource: { id?: string; name?: Array<{ family?: string; given?: string[] }> } }> }>("/api/clients?_count=200"),
    ]);

    if (prestRes.status === "fulfilled" && prestRes.value.data) {
      setPrestaties(prestRes.value.data.prestaties ?? []);
    }
    if (decRes.status === "fulfilled" && decRes.value.data) {
      setDeclaraties(decRes.value.data.declaraties ?? []);
      setStats(decRes.value.data.stats ?? null);
    }
    if (clientRes.status === "fulfilled" && clientRes.value.data) {
      const items: Client[] = (clientRes.value.data.entry ?? []).map((e) => {
        const n = e.resource.name?.[0];
        return { id: e.resource.id ?? "", naam: [n?.given?.[0], n?.family].filter(Boolean).join(" ") || "Onbekend" };
      }).filter((c) => c.id);
      setClients(items);
    }
    setLoading(false);
  }

  async function handleAddPrestatie(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: err } = await facturatieFetch("/api/prestaties", {
      method: "POST",
      body: JSON.stringify({
        clientId: newClientId,
        datum: newDatum,
        productCode: newProductCode,
        financieringstype: newFinType,
        aantal: newAantal,
        opmerking: newOpmerking || undefined,
      }),
    });

    setSaving(false);
    if (err) { setError(err); return; }

    setNewClientId("");
    setNewOpmerking("");
    setNewAantal(1);
    loadAll();
    setTab("prestaties");
  }

  async function handleValideer(id: string) {
    const { error: err } = await facturatieFetch(`/api/prestaties/${id}/valideer`, { method: "PUT" });
    if (err) { setError(err); return; }
    loadAll();
  }

  async function handleCreateDeclaratie(e: FormEvent) {
    e.preventDefault();
    setCreatingDec(true);
    setError(null);

    const { error: err } = await facturatieFetch("/api/declaraties", {
      method: "POST",
      body: JSON.stringify({
        financieringstype: decFinType,
        periodeVan: decVan,
        periodeTot: decTot,
      }),
    });

    setCreatingDec(false);
    if (err) { setError(err); return; }
    loadAll();
    setTab("declaraties");
  }

  async function handleIndienen(id: string) {
    const { error: err } = await facturatieFetch(`/api/declaraties/${id}/indienen`, { method: "PUT" });
    if (err) { setError(err); return; }
    loadAll();
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overzicht", label: "Overzicht" },
    { key: "prestaties", label: `Prestaties (${prestaties.length})` },
    { key: "declaraties", label: `Declaraties (${declaraties.length})` },
    { key: "nieuw", label: "+ Nieuwe prestatie" },
  ];

  const inputClass = "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-display-lg text-fg">Facturatie</h1>
          <p className="text-body text-fg-muted mt-1">Zorgprestaties registreren, declaraties aanmaken en indienen.</p>
        </div>

        {error && (
          <div className="bg-coral-50 border border-coral-200 text-coral-600 rounded-lg p-4 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Sluiten</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-subtle">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
          </div>
        ) : (
          <>
            {/* Overzicht tab */}
            {tab === "overzicht" && stats && (
              <div className="space-y-6">
                {/* Stats cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Open bedrag" value={formatBedrag(stats.totaalOpen)} />
                  <StatCard label="Betaald" value={formatBedrag(stats.totaalBetaald)} />
                  <StatCard label="Concept" value={String(stats.concept)} />
                  <StatCard label="Ingediend" value={String(stats.ingediend)} />
                </div>

                {/* Status verdeling */}
                <div className="bg-raised rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-fg mb-4">Declaratiestatus</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[
                      { label: "Concept", count: stats.concept, color: "bg-surface-200" },
                      { label: "Ingediend", count: stats.ingediend, color: "bg-blue-200" },
                      { label: "Geaccepteerd", count: stats.geaccepteerd, color: "bg-brand-200" },
                      { label: "Afgewezen", count: stats.afgewezen, color: "bg-coral-200" },
                      { label: "Betaald", count: stats.betaald, color: "bg-green-200" },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <div className={`w-12 h-12 rounded-full ${s.color} mx-auto flex items-center justify-center text-lg font-bold text-fg`}>
                          {s.count}
                        </div>
                        <p className="text-xs text-fg-muted mt-2">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick: create declaration */}
                <div className="bg-raised rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-fg mb-4">Nieuwe declaratie aanmaken</h3>
                  <form onSubmit={handleCreateDeclaratie} className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1">Financieringstype</label>
                      <select value={decFinType} onChange={(e) => setDecFinType(e.target.value)} className={inputClass}>
                        {FINANCIERINGSTYPEN.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1">Periode van</label>
                      <input type="date" required value={decVan} onChange={(e) => setDecVan(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-fg-muted mb-1">Periode tot</label>
                      <input type="date" required value={decTot} onChange={(e) => setDecTot(e.target.value)} className={inputClass} />
                    </div>
                    <button type="submit" disabled={creatingDec} className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50">
                      {creatingDec ? "Aanmaken..." : "Declaratie aanmaken"}
                    </button>
                  </form>
                  <p className="text-xs text-fg-subtle mt-2">
                    Alleen gevalideerde prestaties worden opgenomen in de declaratie.
                  </p>
                </div>
              </div>
            )}

            {/* Overzicht when no stats yet */}
            {tab === "overzicht" && !stats && (
              <div className="bg-raised rounded-lg border p-12 text-center">
                <p className="text-fg-subtle text-sm">Nog geen facturatiegegevens. Begin met het registreren van prestaties.</p>
              </div>
            )}

            {/* Prestaties tab */}
            {tab === "prestaties" && (
              <div className="bg-raised rounded-lg border overflow-hidden">
                {prestaties.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-fg-subtle text-sm">Nog geen prestaties geregistreerd.</p>
                    <button onClick={() => setTab("nieuw")} className="mt-3 text-brand-600 text-sm font-medium hover:text-brand-800">
                      + Eerste prestatie registreren
                    </button>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-default text-sm">
                    <thead className="bg-page">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Datum</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-fg-subtle uppercase">Bedrag</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {prestaties.map((p) => {
                        const clientNaam = clients.find((c) => c.id === p.clientId)?.naam ?? p.clientId.slice(0, 8);
                        return (
                          <tr key={p.id} className="hover:bg-sunken">
                            <td className="px-4 py-3 text-fg">{p.datum}</td>
                            <td className="px-4 py-3 text-fg">{clientNaam}</td>
                            <td className="px-4 py-3 text-fg-muted">{p.productOmschrijving}</td>
                            <td className="px-4 py-3">
                              <span className="inline-block rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-fg-muted uppercase">
                                {p.financieringstype}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-fg">{formatBedrag(p.totaal)}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={p.status} />
                            </td>
                            <td className="px-4 py-3">
                              {p.status === "concept" && (
                                <button onClick={() => handleValideer(p.id)} className="text-brand-600 hover:text-brand-800 text-sm font-medium">
                                  Valideren
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Declaraties tab */}
            {tab === "declaraties" && (
              <div className="bg-raised rounded-lg border overflow-hidden">
                {declaraties.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-fg-subtle text-sm">Nog geen declaraties. Maak eerst prestaties aan en valideer ze.</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-default text-sm">
                    <thead className="bg-page">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Nummer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Periode</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-fg-subtle uppercase">Bedrag</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Prestaties</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-default">
                      {declaraties.map((d) => (
                        <tr key={d.id} className="hover:bg-sunken">
                          <td className="px-4 py-3 font-mono text-sm text-fg">{d.nummer}</td>
                          <td className="px-4 py-3">
                            <span className="inline-block rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-fg-muted uppercase">
                              {d.financieringstype}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-fg-muted">{d.periodeVan} — {d.periodeTot}</td>
                          <td className="px-4 py-3 text-right font-medium text-fg">{formatBedrag(d.totaalBedrag)}</td>
                          <td className="px-4 py-3 text-fg-muted">{d.aantalPrestaties}</td>
                          <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                          <td className="px-4 py-3">
                            {d.status === "concept" && (
                              <button onClick={() => handleIndienen(d.id)} className="text-brand-600 hover:text-brand-800 text-sm font-medium">
                                Indienen
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* New prestatie tab */}
            {tab === "nieuw" && (
              <form onSubmit={handleAddPrestatie} className="bg-raised rounded-lg border p-6 space-y-4 max-w-2xl">
                <h3 className="text-lg font-semibold text-fg">Nieuwe prestatie registreren</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Client</label>
                    <select required value={newClientId} onChange={(e) => setNewClientId(e.target.value)} className={inputClass}>
                      <option value="">Selecteer client...</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.naam}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Datum</label>
                    <input type="date" required value={newDatum} onChange={(e) => setNewDatum(e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Financieringstype</label>
                    <select value={newFinType} onChange={(e) => setNewFinType(e.target.value)} className={inputClass}>
                      {FINANCIERINGSTYPEN.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Product</label>
                    <select required value={newProductCode} onChange={(e) => setNewProductCode(e.target.value)} className={inputClass}>
                      <option value="">Selecteer product...</option>
                      {producten.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} — {p.omschrijving} ({formatBedrag(p.tarief)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Aantal</label>
                    <input type="number" min={0.5} step={0.5} value={newAantal} onChange={(e) => setNewAantal(Number(e.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Opmerking (optioneel)</label>
                    <input type="text" value={newOpmerking} onChange={(e) => setNewOpmerking(e.target.value)} placeholder="bijv. Extra hulp gevraagd" className={inputClass} />
                  </div>
                </div>

                {newProductCode && (
                  <div className="bg-sunken rounded-lg p-3 text-sm">
                    <span className="text-fg-muted">Verwacht bedrag: </span>
                    <span className="font-semibold text-fg">
                      {formatBedrag((producten.find((p) => p.code === newProductCode)?.tarief ?? 0) * newAantal)}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || !newClientId || !newProductCode}
                  className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Opslaan..." : "Prestatie registreren"}
                </button>
              </form>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

/* ---------- Sub-components ---------- */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-raised rounded-xl p-5 border border-subtle">
      <p className="text-overline text-fg-subtle uppercase tracking-wider text-xs">{label}</p>
      <p className="text-display-md text-fg mt-1 font-display">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    concept: "bg-surface-100 text-fg-muted",
    geregistreerd: "bg-surface-100 text-fg-muted",
    gevalideerd: "bg-blue-100 text-blue-800",
    gedeclareerd: "bg-purple-100 text-purple-800",
    ingediend: "bg-blue-100 text-blue-800",
    geaccepteerd: "bg-brand-50 text-brand-700",
    afgewezen: "bg-coral-50 text-coral-600",
    betaald: "bg-green-100 text-green-800",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-surface-100 text-fg-muted"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
