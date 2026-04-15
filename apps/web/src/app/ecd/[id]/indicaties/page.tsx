"use client";

import { useEffect, useState } from "react";

import AppShell from "../../../../components/AppShell";
import { ecdFetch } from "../../../../lib/api";
import { TabNav } from "../TabNav";

interface ReferentieData {
  financiering: Array<{ code: string; display: string }>;
  zzpKlassen: Array<{ code: string; label: string; urenPerWeek: number }>;
  leveringsvormen: Array<{ code: string; display: string }>;
}

interface FhirCoverage {
  id?: string;
  status?: string;
  type?: { coding?: Array<{ code?: string; display?: string }> };
  period?: { start?: string; end?: string };
  class?: Array<{
    type?: { coding?: Array<{ code?: string; display?: string; system?: string }> };
    value?: string;
    name?: string;
  }>;
  extension?: Array<{ url?: string; valueString?: string; valueInteger?: number }>;
}

interface Bundle {
  entry?: Array<{ resource: FhirCoverage }>;
}

function formatDatum(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function getExt(cov: FhirCoverage, urlSuffix: string): string | number | undefined {
  const ext = cov.extension?.find((e) => e.url?.endsWith(urlSuffix));
  return ext?.valueString ?? ext?.valueInteger;
}

function getClassValue(cov: FhirCoverage, systemSuffix: string): string | undefined {
  for (const cls of cov.class ?? []) {
    const coding = cls.type?.coding?.find((c) => c.system?.endsWith(systemSuffix));
    if (coding?.code) return coding.code;
  }
  return undefined;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: "Actief", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" },
  cancelled: { label: "Ingetrokken", cls: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300" },
  draft: { label: "Concept", cls: "bg-surface-200 text-fg-muted dark:bg-surface-800" },
};

export default function IndicatiesPage({ params }: { params: Promise<{ id: string }> }) {
  const [clientId, setClientId] = useState<string>("");
  const [coverages, setCoverages] = useState<FhirCoverage[]>([]);
  const [ref, setRef] = useState<ReferentieData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Form state
  const [financiering, setFinanciering] = useState("wlz");
  const [zzpKlasse, setZzpKlasse] = useState("");
  const [leveringsvorm, setLeveringsvorm] = useState("zin");
  const [startdatum, setStartdatum] = useState(new Date().toISOString().slice(0, 10));
  const [einddatum, setEinddatum] = useState("");
  const [indicatienummer, setIndicatienummer] = useState("");
  const [toelichting, setToelichting] = useState("");

  useEffect(() => {
    params.then((p) => setClientId(p.id));
  }, [params]);

  useEffect(() => {
    ecdFetch<ReferentieData>("/api/indicaties/referentie").then(({ data }) => {
      if (data) setRef(data);
    });
  }, []);

  async function load() {
    if (!clientId) return;
    setLoading(true);
    const { data } = await ecdFetch<Bundle>(`/api/clients/${clientId}/indicaties`);
    setCoverages(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (clientId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const { error } = await ecdFetch(`/api/clients/${clientId}/indicaties`, {
      method: "POST",
      body: JSON.stringify({
        financiering,
        zzpKlasse: financiering === "wlz" && zzpKlasse ? zzpKlasse : undefined,
        leveringsvorm: financiering === "wlz" ? leveringsvorm : undefined,
        startdatum,
        einddatum: einddatum || undefined,
        indicatienummer: indicatienummer || undefined,
        toelichting: toelichting || undefined,
      }),
    });
    setSaving(false);
    if (error) {
      setStatus({ ok: false, text: error });
    } else {
      setStatus({ ok: true, text: "Indicatie toegevoegd" });
      setShowForm(false);
      setZzpKlasse("");
      setIndicatienummer("");
      setToelichting("");
      await load();
    }
  }

  async function intrekken(id?: string) {
    if (!id) return;
    if (!confirm("Weet je zeker dat je deze indicatie wilt intrekken?")) return;
    const { error } = await ecdFetch(`/api/indicaties/${id}`, { method: "DELETE" });
    if (error) {
      setStatus({ ok: false, text: error });
    } else {
      setStatus({ ok: true, text: "Indicatie ingetrokken" });
      await load();
    }
  }

  const inputCls =
    "w-full rounded-md border border-default bg-raised px-3 py-2 text-sm text-fg shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <TabNav clientId={clientId} />
        <div className="mt-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-fg">Indicaties</h1>
              <p className="text-sm text-fg-muted mt-1">
                CIZ-indicaties en andere financieringsgrondslagen (Wlz / Zvw / Wmo / Jeugdwet / Wfz).
                De ZZP-klasse bepaalt de bandbreedte aan uren die in het zorgplan gedeclareerd mag worden.
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 btn-press"
            >
              {showForm ? "Annuleren" : "+ Nieuwe indicatie"}
            </button>
          </div>

          {status && (
            <div
              className={`mb-4 rounded-lg border p-3 text-sm ${
                status.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "border-coral-200 bg-coral-50 text-coral-800 dark:bg-coral-950/20 dark:text-coral-300"
              }`}
            >
              {status.text}
            </div>
          )}

          {showForm && ref && (
            <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-default bg-raised p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-fg-muted">Financiering *</label>
                  <select value={financiering} onChange={(e) => setFinanciering(e.target.value)} className={inputCls}>
                    {ref.financiering.map((f) => (
                      <option key={f.code} value={f.code}>{f.display}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-fg-muted">Indicatienummer (CIZ)</label>
                  <input
                    type="text"
                    value={indicatienummer}
                    onChange={(e) => setIndicatienummer(e.target.value)}
                    placeholder="bv. CIZ2026-12345678"
                    className={inputCls}
                  />
                </div>
                {financiering === "wlz" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">ZZP-klasse</label>
                      <select value={zzpKlasse} onChange={(e) => setZzpKlasse(e.target.value)} className={inputCls}>
                        <option value="">— kies —</option>
                        {ref.zzpKlassen.map((z) => (
                          <option key={z.code} value={z.code}>
                            {z.label} · {z.urenPerWeek}u/wk
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Leveringsvorm</label>
                      <select value={leveringsvorm} onChange={(e) => setLeveringsvorm(e.target.value)} className={inputCls}>
                        {ref.leveringsvormen.map((l) => (
                          <option key={l.code} value={l.code}>{l.display}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-fg-muted">Startdatum *</label>
                  <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-fg-muted">Einddatum (optioneel)</label>
                  <input type="date" value={einddatum} onChange={(e) => setEinddatum(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">Toelichting</label>
                <textarea
                  value={toelichting}
                  onChange={(e) => setToelichting(e.target.value)}
                  rows={2}
                  placeholder="Onderbouwing / context voor deze indicatie"
                  className={inputCls}
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
                  {saving ? "Opslaan…" : "Indicatie toevoegen"}
                </button>
              </div>
            </form>
          )}

          {loading && <p className="text-fg-muted">Laden…</p>}

          {!loading && coverages.length === 0 && (
            <div className="rounded-xl border border-default bg-raised p-8 text-center">
              <p className="text-fg-muted">Geen indicaties geregistreerd.</p>
              <p className="mt-1 text-xs text-fg-subtle">Voor Wlz-zorg is een CIZ-indicatie verplicht.</p>
            </div>
          )}

          {!loading && coverages.length > 0 && (
            <div className="space-y-3">
              {coverages.map((cov) => {
                const finType = cov.type?.coding?.[0];
                const zzp = getClassValue(cov, "zzp-klasse");
                const zzpInfo = ref?.zzpKlassen.find((z) => z.code === zzp);
                const lv = getClassValue(cov, "leveringsvorm");
                const lvInfo = ref?.leveringsvormen.find((l) => l.code === lv);
                const indNr = getExt(cov, "indicatienummer");
                const urenPw = getExt(cov, "zzp-uren-per-week");
                const tl = getExt(cov, "indicatie-toelichting");
                const st = cov.status ?? "active";
                const stInfo = STATUS_BADGE[st] ?? STATUS_BADGE.draft!;
                return (
                  <div key={cov.id} className="rounded-xl border border-default bg-raised p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stInfo.cls}`}>{stInfo.label}</span>
                          <span className="text-sm font-semibold text-fg">{finType?.display ?? "—"}</span>
                          {zzpInfo && (
                            <span className="rounded bg-brand-50 text-brand-700 px-2 py-0.5 text-xs font-medium dark:bg-brand-950/20 dark:text-brand-300">
                              {zzp} · {zzpInfo.urenPerWeek}u/wk
                            </span>
                          )}
                          {lvInfo && (
                            <span className="rounded bg-navy-50 text-navy-700 px-2 py-0.5 text-xs dark:bg-navy-950/20 dark:text-navy-300">
                              {lvInfo.display}
                            </span>
                          )}
                        </div>
                        {zzpInfo && <div className="text-sm text-fg-muted">{zzpInfo.label}</div>}
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <div className="text-fg-subtle">Periode</div>
                            <div className="text-fg">
                              {formatDatum(cov.period?.start)} → {formatDatum(cov.period?.end)}
                            </div>
                          </div>
                          {indNr && (
                            <div>
                              <div className="text-fg-subtle">Indicatienummer</div>
                              <div className="text-fg font-mono">{indNr}</div>
                            </div>
                          )}
                          {urenPw !== undefined && (
                            <div>
                              <div className="text-fg-subtle">Bandbreedte</div>
                              <div className="text-fg">{urenPw} uur/week</div>
                            </div>
                          )}
                        </div>
                        {tl && <div className="mt-3 text-sm text-fg-muted italic">"{tl}"</div>}
                      </div>
                      {st === "active" && (
                        <button
                          onClick={() => intrekken(cov.id)}
                          className="rounded-md border border-coral-200 bg-coral-50 px-3 py-1 text-xs text-coral-700 hover:bg-coral-100 dark:bg-coral-950/20 dark:text-coral-400 dark:border-coral-800"
                        >
                          Intrekken
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50/30 dark:bg-brand-950/10 p-4 text-xs text-fg-muted">
            💡 <strong className="text-fg">Compliance tip:</strong> Voor Wlz-gefinancierde zorg moet de totale interventie-uren in het
            zorgplan passen binnen de bandbreedte van de ZZP-klasse. De validatie-engine zal in een
            volgende versie dit automatisch controleren en bij overschrijding een waarschuwing geven.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
