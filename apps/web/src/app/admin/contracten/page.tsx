"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface Contract {
  id: string;
  practitioner?: { reference?: string; display?: string };
  organization?: { reference?: string; display?: string };
  code?: Array<{ text?: string }>;
  period?: { start?: string; end?: string };
  active?: boolean;
  extension?: Array<{
    url: string;
    extension?: Array<{ url: string; valueString?: string; valueDecimal?: number }>;
  }>;
}

interface Medewerker {
  id: string;
  name: string;
}

interface Organisatie {
  id: string;
  name: string;
}

interface Samenvatting {
  totalFte: number;
  totalUren: number;
  totalContracten: number;
  perOrganisatie: Array<{ name: string; fte: number; uren: number; count: number }>;
}

const CONTRACT_TYPES = [
  { value: "vast", label: "Vast" },
  { value: "flex", label: "Flex" },
  { value: "oproep", label: "Oproep" },
  { value: "zzp", label: "ZZP" },
  { value: "stage", label: "Stage" },
  { value: "vrijwilliger", label: "Vrijwilliger" },
];

function getContractExt(contract: Contract) {
  const ext = contract.extension?.find((e) => e.url === "https://openzorg.nl/extensions/contract");
  return {
    type: ext?.extension?.find((e) => e.url === "type")?.valueString ?? "—",
    fte: ext?.extension?.find((e) => e.url === "fte")?.valueDecimal ?? 0,
    uren: ext?.extension?.find((e) => e.url === "urenPerWeek")?.valueDecimal ?? 0,
  };
}

export default function ContractenPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [samenvatting, setSamenvatting] = useState<Samenvatting | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Lookups
  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
  const [organisaties, setOrganisaties] = useState<Organisatie[]>([]);

  // Form
  const [medewerkerId, setMedewerkerId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [contractType, setContractType] = useState("vast");
  const [fte, setFte] = useState("1.0");
  const [urenPerWeek, setUrenPerWeek] = useState("36");
  const [startdatum, setStartdatum] = useState(new Date().toISOString().slice(0, 10));
  const [einddatum, setEinddatum] = useState("");
  const [functie, setFunctie] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [contRes, samRes] = await Promise.all([
      ecdFetch<{ entry?: Array<{ resource: Contract }> }>("/api/contracten"),
      ecdFetch<Samenvatting>("/api/contracten/overzicht/samenvatting"),
    ]);
    setContracts(contRes.data?.entry?.map((e) => e.resource) ?? []);
    if (samRes.data) setSamenvatting(samRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Load lookups
    ecdFetch<{ entry?: Array<{ resource: { id: string; name?: Array<{ family?: string; given?: string[] }> } }> }>("/api/medewerkers")
      .then(({ data }) => {
        setMedewerkers(data?.entry?.map((e) => ({
          id: e.resource.id,
          name: [...(e.resource.name?.[0]?.given ?? []), e.resource.name?.[0]?.family ?? ""].filter(Boolean).join(" ") || e.resource.id,
        })) ?? []);
      });
    ecdFetch<{ entry?: Array<{ resource: { id: string; name?: string } }> }>("/api/organisatie")
      .then(({ data }) => {
        setOrganisaties(data?.entry?.map((e) => ({ id: e.resource.id, name: e.resource.name ?? e.resource.id })) ?? []);
      });
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!medewerkerId) { setError("Selecteer een medewerker"); return; }
    setSaving(true);
    setError(null);
    const { error: err } = await ecdFetch("/api/contracten", {
      method: "POST",
      body: JSON.stringify({
        practitionerId: medewerkerId,
        organizationId: orgId || undefined,
        contractType,
        fte: parseFloat(fte),
        urenPerWeek: parseFloat(urenPerWeek),
        startdatum,
        einddatum: einddatum || undefined,
        functie: functie || undefined,
      }),
    });
    setSaving(false);
    if (err) { setError(err); return; }
    setShowForm(false);
    setMedewerkerId(""); setFunctie("");
    load();
  }

  return (
    <AppShell>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-display-lg text-fg">Contracten</h1>
            <p className="text-body text-fg-muted mt-1">Beheer medewerkercontracten, FTE en uren.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors">
            {showForm ? "Annuleren" : "+ Nieuw contract"}
          </button>
        </div>

        {/* Stats */}
        {samenvatting && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Contracten" value={samenvatting.totalContracten} />
            <StatCard label="Totaal FTE" value={samenvatting.totalFte} accent />
            <StatCard label="Uren / week" value={samenvatting.totalUren} />
            <StatCard label="Locaties" value={samenvatting.perOrganisatie.length} />
          </div>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-raised rounded-2xl border border-default p-6 mb-8 shadow-soft space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Medewerker *</label>
                <select value={medewerkerId} onChange={(e) => setMedewerkerId(e.target.value)} required
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg outline-none">
                  <option value="">Selecteer medewerker</option>
                  {medewerkers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Locatie</label>
                <select value={orgId} onChange={(e) => setOrgId(e.target.value)}
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg outline-none">
                  <option value="">Alle locaties</option>
                  {organisaties.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Type *</label>
                <select value={contractType} onChange={(e) => setContractType(e.target.value)}
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg outline-none">
                  {CONTRACT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">FTE</label>
                <input type="number" step="0.1" min="0" max="1" value={fte} onChange={(e) => setFte(e.target.value)}
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg outline-none" />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Uren/week</label>
                <input type="number" min="0" max="60" value={urenPerWeek} onChange={(e) => setUrenPerWeek(e.target.value)}
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg outline-none" />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Functie</label>
                <select value={functie} onChange={(e) => setFunctie(e.target.value)}
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg outline-none">
                  <option value="">Selecteer functie</option>
                  <option value="Wijkverpleegkundige">Wijkverpleegkundige</option>
                  <option value="Verzorgende IG">Verzorgende IG</option>
                  <option value="Helpende">Helpende</option>
                  <option value="Verpleegkundige">Verpleegkundige</option>
                  <option value="Teamleider">Teamleider</option>
                  <option value="Planner">Planner</option>
                  <option value="Huishoudelijk medewerker">Huishoudelijk medewerker</option>
                  <option value="Activiteitenbegeleider">Activiteitenbegeleider</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Startdatum *</label>
                <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} required
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg outline-none" />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-fg mb-1.5">Einddatum</label>
                <input type="date" value={einddatum} onChange={(e) => setEinddatum(e.target.value)}
                  className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg outline-none" />
                <p className="text-caption text-fg-subtle mt-1">Leeg = onbepaalde tijd</p>
              </div>
            </div>
            {error && <p className="text-body-sm text-coral-600">{error}</p>}
            <button type="submit" disabled={saving}
              className="bg-brand-600 text-white px-6 py-3 rounded-xl text-body-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? "Opslaan..." : "Contract aanmaken"}
            </button>
          </form>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-16 bg-raised rounded-2xl border border-default">
            <h3 className="text-heading text-fg">Nog geen contracten</h3>
            <p className="text-body-sm text-fg-muted mt-1">Maak het eerste contract aan.</p>
          </div>
        ) : (
          <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Medewerker</th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Type</th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">FTE</th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Uren/wk</th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden md:table-cell">Functie</th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden lg:table-cell">Periode</th>
                  <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => {
                  const ext = getContractExt(contract);
                  return (
                    <tr key={contract.id} className="border-b border-subtle last:border-0 hover:bg-sunken transition-colors">
                      <td className="px-6 py-4 font-medium text-fg">{contract.practitioner?.display ?? "—"}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg text-caption font-medium bg-navy-50 dark:bg-navy-900/30 text-navy-700 dark:text-navy-300">
                          {CONTRACT_TYPES.find((t) => t.value === ext.type)?.label ?? ext.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-fg-muted">{ext.fte}</td>
                      <td className="px-6 py-4 text-fg-muted">{ext.uren}u</td>
                      <td className="px-6 py-4 text-fg-muted hidden md:table-cell">{contract.code?.[0]?.text ?? "—"}</td>
                      <td className="px-6 py-4 text-caption text-fg-subtle hidden lg:table-cell">
                        {contract.period?.start ? new Date(contract.period.start).toLocaleDateString("nl-NL") : "—"}
                        {contract.period?.end ? ` t/m ${new Date(contract.period.end).toLocaleDateString("nl-NL")}` : " — heden"}
                      </td>
                      <td className="px-6 py-4">
                        {contract.active !== false ? (
                          <span className="inline-flex items-center gap-1.5 text-caption font-medium text-brand-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Actief
                          </span>
                        ) : (
                          <span className="text-caption text-fg-subtle">Beeindigd</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-raised rounded-2xl p-5 border border-subtle">
      <p className="text-overline text-fg-subtle uppercase tracking-wider">{label}</p>
      <p className={`text-display-md mt-1 font-display ${accent ? "text-brand-600 dark:text-brand-400" : "text-fg"}`}>{value}</p>
    </div>
  );
}
