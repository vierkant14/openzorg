"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { masterFetch } from "../../../../lib/master-api";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  medplum_project_id: string;
  enabled_modules: string[];
  sector: string | null;
  contact_email: string | null;
  contact_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  timestamp: string;
  details: { role?: string; path?: string; method?: string; statusCode?: number; durationMs?: number } | null;
}

const _ACTION_LABELS: Record<string, string> = {
  read: "Gelezen",
  create: "Aangemaakt",
  update: "Bijgewerkt",
  delete: "Verwijderd",
};

const SECTOR_LABELS: Record<string, string> = {
  vvt: "VVT — Verpleging, Verzorging & Thuiszorg",
  ggz: "GGZ — Geestelijke Gezondheidszorg",
  ghz: "GHZ — Gehandicaptenzorg",
  ziekenhuis: "Ziekenhuis",
  jeugdzorg: "Jeugdzorg",
  huisartsenzorg: "Huisartsenzorg",
  revalidatie: "Revalidatie",
};

const MODULE_LABELS: Record<string, string> = {
  clientregistratie: "Clientregistratie",
  medewerkers: "Medewerkers",
  organisatie: "Organisatie",
  rapportage: "Rapportage",
  planning: "Planning",
  configuratie: "Configuratie",
  toegangsbeheer: "Toegangsbeheer",
  berichten: "Berichten",
  zorgplan: "Zorgplan",
  "mic-meldingen": "MIC-meldingen",
  medicatie: "Medicatie",
  wachtlijst: "Wachtlijst",
  dagplanning: "Dagplanning",
  facturatie: "Facturatie",
};

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [_auditLog, _setAuditLog] = useState<AuditEntry[]>([]);
  const [_auditTotal, _setAuditTotal] = useState(0);
  const [_auditLoading, _setAuditLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: err } = await masterFetch<Tenant>(`/api/master/tenants/${tenantId}`);
      if (err) setError(err);
      else setTenant(data);
      setLoading(false);
    }
    load();
  }, [tenantId]);

  async function toggleStatus() {
    if (!tenant) return;
    setSaving(true);
    const newStatus = tenant.status === "active" ? "inactive" : "active";
    const { data, error: err } = await masterFetch<Tenant>(`/api/master/tenants/${tenantId}`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    });
    if (data) {
      setTenant(data);
      setSaveMessage(`Omgeving ${newStatus === "active" ? "geactiveerd" : "gedeactiveerd"}`);
    }
    if (err) setSaveMessage(`Fout: ${err}`);
    setSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-page">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="rounded-2xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-6">
            <h2 className="text-heading text-coral-800 dark:text-coral-200">Fout</h2>
            <p className="text-body-sm text-coral-700 dark:text-coral-300 mt-1">{error ?? "Tenant niet gevonden"}</p>
          </div>
          <a href="/master-admin" className="inline-flex items-center gap-2 mt-4 text-body-sm text-brand-600 hover:text-brand-700">
            &larr; Terug naar overzicht
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {/* Header */}
      <header className="bg-navy-900 text-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-6">
          <div className="flex items-center gap-4">
            <a href="/master-admin" className="text-navy-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </a>
            <div className="flex-1">
              <h1 className="font-display text-heading font-bold tracking-tight">{tenant.name}</h1>
              <p className="text-body-sm text-navy-300">{tenant.slug} &middot; {SECTOR_LABELS[tenant.sector ?? ""] ?? tenant.sector}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-medium ${
              tenant.status === "active"
                ? "bg-brand-500/20 text-brand-200"
                : "bg-surface-500/20 text-surface-300"
            }`}>
              <span className={`w-2 h-2 rounded-full ${tenant.status === "active" ? "bg-brand-400" : "bg-surface-400"}`} />
              {tenant.status === "active" ? "Actief" : "Inactief"}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-8 space-y-8">
        {/* Save message */}
        {saveMessage && (
          <div className="rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800 px-4 py-3 text-body-sm text-brand-700 dark:text-brand-300">
            {saveMessage}
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Organisatie */}
          <div className="bg-raised rounded-2xl border border-default p-6">
            <h2 className="text-subheading text-fg mb-4">Organisatie</h2>
            <dl className="space-y-3">
              <InfoRow label="Naam" value={tenant.name} />
              <InfoRow label="Slug" value={tenant.slug} mono />
              <InfoRow label="Sector" value={SECTOR_LABELS[tenant.sector ?? ""] ?? tenant.sector ?? "—"} />
              <InfoRow label="Medplum Project" value={tenant.medplum_project_id} mono />
              <InfoRow label="Aangemaakt" value={new Date(tenant.created_at).toLocaleString("nl-NL")} />
              <InfoRow label="Laatst bijgewerkt" value={new Date(tenant.updated_at).toLocaleString("nl-NL")} />
            </dl>
          </div>

          {/* Contact */}
          <div className="bg-raised rounded-2xl border border-default p-6">
            <h2 className="text-subheading text-fg mb-4">Contactpersoon</h2>
            <dl className="space-y-3">
              <InfoRow label="Naam" value={tenant.contact_name ?? "—"} />
              <InfoRow label="E-mail" value={tenant.contact_email ?? "—"} />
            </dl>

            <h2 className="text-subheading text-fg mt-8 mb-4">Acties</h2>
            <div className="space-y-3">
              <button
                onClick={toggleStatus}
                disabled={saving}
                className={`w-full px-4 py-3 rounded-xl text-body-sm font-semibold transition-colors ${
                  tenant.status === "active"
                    ? "bg-coral-50 dark:bg-coral-950/20 text-coral-700 dark:text-coral-300 border border-coral-200 dark:border-coral-800 hover:bg-coral-100"
                    : "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 hover:bg-brand-100"
                }`}
              >
                {saving ? "Bezig..." : tenant.status === "active" ? "Omgeving deactiveren" : "Omgeving activeren"}
              </button>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="bg-raised rounded-2xl border border-default p-6">
          <h2 className="text-subheading text-fg mb-4">
            Actieve modules ({tenant.enabled_modules.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tenant.enabled_modules.map((mod) => (
              <div key={mod} className="flex items-center gap-2 px-4 py-3 bg-brand-50 dark:bg-brand-950/20 rounded-xl">
                <svg className="w-4 h-4 text-brand-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-body-sm text-fg font-medium">{MODULE_LABELS[mod] ?? mod}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Login info */}
        <div className="bg-raised rounded-2xl border border-default p-6">
          <h2 className="text-subheading text-fg mb-4">Inloggen als deze omgeving</h2>
          <p className="text-body-sm text-fg-muted mb-3">
            Gebruik de inloggegevens van deze tenant om in te loggen op de web app.
            De tenant ID wordt meegegeven via het Medplum project.
          </p>
          <div className="bg-sunken rounded-xl p-4 font-mono text-caption text-fg-muted">
            <p>Medplum Project ID: {tenant.medplum_project_id}</p>
            <p>Tenant Database ID: {tenant.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-body-sm text-fg-muted shrink-0">{label}</dt>
      <dd className={`text-body-sm text-fg text-right ${mono ? "font-mono text-caption" : ""}`}>{value}</dd>
    </div>
  );
}
