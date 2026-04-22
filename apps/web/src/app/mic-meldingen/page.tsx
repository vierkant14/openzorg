"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* ── Types ── */

interface AuditEventAgent {
  who?: { reference?: string; display?: string };
  requestor?: boolean;
}

interface AuditEventEntity {
  what?: { reference?: string; display?: string };
}

interface FhirAuditEvent {
  id?: string;
  recorded?: string;
  outcome?: string;
  outcomeDesc?: string;
  agent?: AuditEventAgent[];
  entity?: AuditEventEntity[];
  extension?: Array<{ url?: string; valueString?: string }>;
  purposeOfEvent?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
}

interface AuditEventBundle {
  resourceType?: string;
  total?: number;
  entry?: Array<{ resource: FhirAuditEvent }>;
}

interface FhirPatient {
  id?: string;
  name?: Array<{ text?: string; given?: string[]; family?: string }>;
}

interface PatientBundle {
  entry?: Array<{ resource: FhirPatient }>;
}

/* ── Helpers ── */

const ERNST_CLASSES: Record<string, string> = {
  laag: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  middel: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  midden: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  hoog: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300",
};

function formatDatum(iso?: string): string {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getExtValue(ev: FhirAuditEvent, key: string): string | undefined {
  return ev.extension?.find((e) => e.url?.endsWith(key))?.valueString;
}

function getClientRef(ev: FhirAuditEvent): string | undefined {
  return ev.entity?.[0]?.what?.reference;
}

function getClientDisplay(ev: FhirAuditEvent): string {
  const entity = ev.entity?.[0];
  if (entity?.what?.display) return entity.what.display;
  if (entity?.what?.reference) return entity.what.reference.replace("Patient/", "");
  return "\u2014";
}

function getClientId(ev: FhirAuditEvent): string | undefined {
  const ref = getClientRef(ev);
  if (!ref) return undefined;
  return ref.replace("Patient/", "");
}

function getMelderDisplay(ev: FhirAuditEvent): string {
  const agent = ev.agent?.[0];
  if (agent?.who?.display) return agent.who.display;
  if (agent?.who?.reference) return agent.who.reference.replace("Practitioner/", "");
  return "\u2014";
}

function toYearMonth(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function patientName(p: FhirPatient): string {
  if (p.name?.[0]?.text) return p.name[0].text;
  const given = p.name?.[0]?.given?.join(" ") ?? "";
  const family = p.name?.[0]?.family ?? "";
  return `${given} ${family}`.trim() || p.id || "Onbekend";
}

/* ── Component ── */

export default function MicMeldingenOverzichtPage() {
  const [meldingen, setMeldingen] = useState<FhirAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterVan, setFilterVan] = useState("");
  const [filterTot, setFilterTot] = useState("");
  const [filterErnst, setFilterErnst] = useState("alle");
  const [filterStatus, setFilterStatus] = useState("alle");

  // New melding form
  const [formOpen, setFormOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formErnst, setFormErnst] = useState("midden");
  const [formSoort, setFormSoort] = useState("val");
  const [formBeschrijving, setFormBeschrijving] = useState("");
  const [formClient, setFormClient] = useState<{ id: string; name: string } | null>(null);

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<FhirPatient[]>([]);
  const [clientSearching, setClientSearching] = useState(false);

  // Load all MIC meldingen
  const loadMeldingen = useCallback(() => {
    setLoading(true);
    ecdFetch<AuditEventBundle>("/api/mic-meldingen?_count=200").then(({ data }) => {
      setMeldingen(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadMeldingen();
  }, [loadMeldingen]);

  // Client search with debounce
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setClientSearching(true);
      ecdFetch<PatientBundle>(`/api/clients?name=${encodeURIComponent(clientSearch)}&_count=8`).then(({ data }) => {
        setClientResults(data?.entry?.map((e) => e.resource) ?? []);
        setClientSearching(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  /* Filtered list */
  const filtered = useMemo(() => {
    return meldingen.filter((m) => {
      if (filterVan && m.recorded && m.recorded < filterVan) return false;
      if (filterTot && m.recorded && m.recorded > filterTot + "T23:59:59") return false;
      if (filterErnst !== "alle") {
        const ernst = getExtValue(m, "mic-ernst") ?? "midden";
        if (ernst !== filterErnst) return false;
      }
      if (filterStatus !== "alle") {
        const isOpen = m.outcome === "0" || !m.outcome;
        if (filterStatus === "open" && !isOpen) return false;
        if (filterStatus === "afgehandeld" && isOpen) return false;
      }
      return true;
    });
  }, [meldingen, filterVan, filterTot, filterErnst, filterStatus]);

  /* Stats */
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const totaal = meldingen.length;
  const dezeMaand = meldingen.filter((m) => toYearMonth(m.recorded) === currentMonth).length;
  const hoogRisico = meldingen.filter((m) => getExtValue(m, "mic-ernst") === "hoog").length;
  const openMeldingen = meldingen.filter((m) => m.outcome === "0" || !m.outcome).length;

  /* Submit new melding */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formClient) {
      setFormError("Selecteer een client");
      return;
    }
    setFormSubmitting(true);
    setFormError("");

    const medewerkerRef = typeof window !== "undefined"
      ? localStorage.getItem("openzorg_practitioner_id") || "unknown"
      : "unknown";

    const { error } = await ecdFetch("/api/mic-meldingen", {
      method: "POST",
      body: JSON.stringify({
        datum: new Date().toISOString(),
        ernst: formErnst,
        beschrijving: `[${formSoort}] ${formBeschrijving}`,
        betrokkenClient: formClient.id,
        betrokkenMedewerker: medewerkerRef,
      }),
    });

    setFormSubmitting(false);
    if (error) {
      setFormError(error);
    } else {
      // Reset form and reload
      setFormOpen(false);
      setFormErnst("midden");
      setFormSoort("val");
      setFormBeschrijving("");
      setFormClient(null);
      setClientSearch("");
      loadMeldingen();
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-fg">MIC-meldingen overzicht</h1>
            <p className="mt-1 text-sm text-fg-muted">Alle incidentmeldingen binnen de organisatie</p>
          </div>
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors btn-press"
          >
            + Nieuwe melding
          </button>
        </div>

        {/* New melding form */}
        {formOpen && (
          <div className="mb-8 rounded-xl border border-default bg-raised p-6">
            <h2 className="text-lg font-semibold text-fg mb-4">Nieuwe MIC-melding</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Client picker */}
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Client <span className="text-coral-500">*</span>
                </label>
                {formClient ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg">
                      {formClient.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setFormClient(null); setClientSearch(""); }}
                      className="text-xs text-fg-muted hover:text-coral-600"
                    >
                      Wijzig
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Zoek op naam..."
                      className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                    />
                    {clientSearching && (
                      <div className="absolute right-3 top-2.5 text-xs text-fg-muted">Zoeken...</div>
                    )}
                    {clientResults.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full rounded-lg border border-default bg-raised shadow-lg max-h-48 overflow-y-auto">
                        {clientResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setFormClient({ id: p.id ?? "", name: patientName(p) });
                                setClientSearch("");
                                setClientResults([]);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-fg hover:bg-sunken"
                            >
                              {patientName(p)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ernst */}
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Ernst</label>
                  <select
                    value={formErnst}
                    onChange={(e) => setFormErnst(e.target.value)}
                    className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="laag">Laag</option>
                    <option value="midden">Midden</option>
                    <option value="hoog">Hoog</option>
                  </select>
                </div>

                {/* Soort */}
                <div>
                  <label className="block text-sm font-medium text-fg mb-1">Soort</label>
                  <select
                    value={formSoort}
                    onChange={(e) => setFormSoort(e.target.value)}
                    className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="val">Val</option>
                    <option value="medicatiefout">Medicatiefout</option>
                    <option value="agressie">Agressie</option>
                    <option value="overig">Overig</option>
                  </select>
                </div>
              </div>

              {/* Beschrijving */}
              <div>
                <label className="block text-sm font-medium text-fg mb-1">
                  Beschrijving <span className="text-coral-500">*</span>
                </label>
                <textarea
                  value={formBeschrijving}
                  onChange={(e) => setFormBeschrijving(e.target.value)}
                  rows={3}
                  required
                  placeholder="Beschrijf het incident..."
                  className="w-full rounded-lg border border-default bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-coral-600 dark:text-coral-400">{formError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 btn-press"
                >
                  {formSubmitting ? "Opslaan..." : "Melding opslaan"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-default bg-raised px-4 py-2 text-sm font-medium text-fg hover:bg-sunken transition-colors btn-press"
                >
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Totaal meldingen" value={totaal} />
          <StatCard label="Deze maand" value={dezeMaand} />
          <StatCard label="Hoog-risico" value={hoogRisico} accent />
          <StatCard label="Open (niet afgehandeld)" value={openMeldingen} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Van</label>
            <input
              type="date"
              value={filterVan}
              onChange={(e) => setFilterVan(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Tot</label>
            <input
              type="date"
              value={filterTot}
              onChange={(e) => setFilterTot(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Ernst</label>
            <select
              value={filterErnst}
              onChange={(e) => setFilterErnst(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="alle">Alle</option>
              <option value="hoog">Hoog</option>
              <option value="midden">Midden</option>
              <option value="laag">Laag</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-subtle mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-default bg-page px-3 py-1.5 text-sm text-fg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
              <option value="alle">Alle</option>
              <option value="open">Open</option>
              <option value="afgehandeld">Afgehandeld</option>
            </select>
          </div>
          {(filterVan || filterTot || filterErnst !== "alle" || filterStatus !== "alle") && (
            <button
              onClick={() => { setFilterVan(""); setFilterTot(""); setFilterErnst("alle"); setFilterStatus("alle"); }}
              className="text-xs text-fg-muted hover:text-fg transition-colors"
            >
              Filters wissen
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && <p className="text-fg-muted">Laden...</p>}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-default bg-raised p-8 text-center">
            <p className="text-fg-muted">Geen MIC-meldingen gevonden.</p>
            <p className="mt-2 text-xs text-fg-subtle">
              Pas de filters aan of maak een nieuwe melding aan.
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="rounded-xl border border-default bg-raised overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-page">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Ernst</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Soort</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Toelichting</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Melder</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-fg-subtle uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {filtered.map((m) => {
                    const ernst = getExtValue(m, "mic-ernst") ?? "midden";
                    const soort = getExtValue(m, "mic-soort") ?? m.purposeOfEvent?.[0]?.text ?? "Incident";
                    const toelichting = getExtValue(m, "mic-toelichting") ?? m.outcomeDesc ?? "\u2014";
                    const isOpen = m.outcome === "0" || !m.outcome;
                    const cId = getClientId(m);
                    return (
                      <tr key={m.id} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg whitespace-nowrap">{formatDatum(m.recorded)}</td>
                        <td className="px-4 py-3 text-sm text-fg">
                          {cId ? (
                            <Link href={`/ecd/${cId}/mic-meldingen`} className="text-brand-600 hover:underline dark:text-brand-400">
                              {getClientDisplay(m)}
                            </Link>
                          ) : (
                            getClientDisplay(m)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ERNST_CLASSES[ernst] ?? ERNST_CLASSES.midden}`}>
                            {ernst.charAt(0).toUpperCase() + ernst.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-fg-muted">{soort}</td>
                        <td className="px-4 py-3 text-sm text-fg max-w-xs truncate">{toelichting}</td>
                        <td className="px-4 py-3 text-sm text-fg-muted whitespace-nowrap">{getMelderDisplay(m)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${isOpen ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" : "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300"}`}>
                            {isOpen ? "Open" : "Afgehandeld"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* ── StatCard ── */

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-default bg-raised p-5">
      <p className="text-xs font-medium text-fg-subtle uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-coral-600 dark:text-coral-400" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}
