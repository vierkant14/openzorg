"use client";

import { useEffect, useMemo, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";

/* ── Types ── */
interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: Array<{ family?: string; given?: string[] }>;
  birthDate?: string;
  gender?: string;
  identifier?: Array<{ system?: string; value?: string }>;
  active?: boolean;
  telecom?: Array<{ system?: string; value?: string }>;
  address?: Array<{ line?: string[]; city?: string; postalCode?: string }>;
  managingOrganization?: { display?: string; reference?: string };
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

interface FhirBundle {
  resourceType: "Bundle";
  type: string;
  entry?: Array<{ resource: FhirPatient }>;
}

/* ── Helpers ── */
function formatNaam(patient: FhirPatient): string {
  const name = patient.name?.[0];
  if (!name) return "Onbekend";
  const given = name.given?.join(" ") ?? "";
  const family = name.family ?? "";
  return `${given} ${family}`.trim() || "Onbekend";
}

function getInitials(patient: FhirPatient): string {
  const name = patient.name?.[0];
  const first = name?.given?.[0]?.[0] ?? "";
  const last = name?.family?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function getBsn(patient: FhirPatient): string {
  return patient.identifier?.find(
    (id) => id.system === "http://fhir.nl/fhir/NamingSystem/bsn",
  )?.value ?? "—";
}

function getClientnummer(patient: FhirPatient): string {
  return patient.identifier?.find(
    (id) => id.system === "https://openzorg.nl/NamingSystem/clientnummer",
  )?.value ?? "—";
}

function formatGeslacht(gender?: string): string {
  switch (gender) {
    case "male": return "Man";
    case "female": return "Vrouw";
    case "other": return "Anders";
    default: return "Onbekend";
  }
}

function formatDatum(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getLeeftijd(dateStr?: string): string {
  if (!dateStr) return "";
  const birth = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} jaar`;
}

function getWoonplaats(patient: FhirPatient): string {
  return patient.address?.[0]?.city ?? "";
}

function getLocatie(patient: FhirPatient): string {
  return patient.managingOrganization?.display ?? "";
}

function getIndicatie(patient: FhirPatient): string {
  const ext = patient.extension?.find((e) => e.url === "https://openzorg.nl/extensions/indicatie");
  if (!ext) return "";
  const type = ext.extension?.find((e) => e.url === "type")?.valueString ?? "";
  const profiel = ext.extension?.find((e) => e.url === "zorgprofiel")?.valueString ?? "";
  return [type.toUpperCase(), profiel].filter(Boolean).join(" - ");
}

function getTrajectStatus(patient: FhirPatient): string {
  return patient.extension?.find((e) => e.url === "https://openzorg.nl/extensions/trajectStatus")?.valueString ?? "";
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aangemeld: { label: "Aangemeld", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300" },
  "in-intake": { label: "In intake", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" },
  "in-zorg": { label: "In zorg", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" },
  overdracht: { label: "Overdracht", color: "bg-navy-100 text-navy-800 dark:bg-navy-950/30 dark:text-navy-300" },
  uitgeschreven: { label: "Uitgeschreven", color: "bg-surface-200 text-fg-muted dark:bg-surface-800" },
  overleden: { label: "Overleden", color: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300" },
};

/* ── Avatar color rotation based on name hash ── */
const AVATAR_COLORS = [
  ["bg-brand-100 dark:bg-brand-900/40", "text-brand-700 dark:text-brand-300"],
  ["bg-coral-100 dark:bg-coral-900/40", "text-coral-700 dark:text-coral-300"],
  ["bg-navy-100 dark:bg-navy-900/40", "text-navy-700 dark:text-navy-300"],
  ["bg-emerald-100 dark:bg-emerald-900/40", "text-emerald-700 dark:text-emerald-300"],
  ["bg-amber-100 dark:bg-amber-900/40", "text-amber-700 dark:text-amber-300"],
] as const;

function avatarColor(name: string): [string, string] {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  const entry = AVATAR_COLORS[idx] ?? AVATAR_COLORS[0]!;
  return [entry[0], entry[1]];
}

/* ── Page ── */
export default function EcdPage() {
  const [patients, setPatients] = useState<FhirPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoekterm, setZoekterm] = useState("");
  const [filterLocatie, setFilterLocatie] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showInactief, setShowInactief] = useState(false);
  const [sortKey, setSortKey] = useState<"naam" | "bsn" | "geboortedatum" | "locatie">("naam");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      setError(null);
      // Medplum accepteert geen comma-separated booleans; laat active-param
      // weg zodat zowel actieve als inactieve cliënten terugkomen. De
      // 'Toon inactief'-toggle filtert client-side.
      const { data, error: fetchError } = await ecdFetch<FhirBundle>("/api/clients?_count=200");
      if (fetchError) {
        setError(fetchError);
        setPatients([]);
      } else {
        setPatients(data?.entry?.map((e) => e.resource) ?? []);
      }
      setLoading(false);
    }
    fetchClients();
  }, []);

  const locaties = useMemo(() => {
    const set = new Set<string>();
    for (const p of patients) {
      const loc = getLocatie(p);
      if (loc) set.add(loc);
    }
    return [...set].sort();
  }, [patients]);

  const gefilterdeClienten = useMemo(() => {
    let result = patients;

    // Active-filter: standaard alleen actieve cliënten, toggle voor inactief
    if (!showInactief) {
      result = result.filter((p) => p.active !== false);
    }

    // Locatie filter
    if (filterLocatie) {
      result = result.filter((p) => getLocatie(p) === filterLocatie);
    }

    // Status filter
    if (filterStatus) {
      result = result.filter((p) => getTrajectStatus(p) === filterStatus);
    }

    // Text search
    if (zoekterm.trim()) {
      const term = zoekterm.toLowerCase();
      result = result.filter((p) => {
        const naam = formatNaam(p).toLowerCase();
        const bsn = getBsn(p).toLowerCase();
        const cnr = getClientnummer(p).toLowerCase();
        const stad = getWoonplaats(p).toLowerCase();
        const loc = getLocatie(p).toLowerCase();
        return naam.includes(term) || bsn.includes(term) || cnr.includes(term) || stad.includes(term) || loc.includes(term);
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let va = "";
      let vb = "";
      switch (sortKey) {
        case "naam": va = formatNaam(a); vb = formatNaam(b); break;
        case "bsn": va = getBsn(a); vb = getBsn(b); break;
        case "geboortedatum": va = a.birthDate ?? ""; vb = b.birthDate ?? ""; break;
        case "locatie": va = getLocatie(a); vb = getLocatie(b); break;
      }
      const cmp = va.localeCompare(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [patients, zoekterm, filterLocatie, filterStatus, showInactief, sortKey, sortDir]);

  return (
    <AppShell>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-display-lg text-fg">Clienten</h1>
            <p className="text-body text-fg-muted mt-1">
              {loading ? "Laden..." : `${patients.length} ${patients.length === 1 ? "client" : "clienten"} geregistreerd`}
            </p>
          </div>
          <a
            href="/ecd/nieuw"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-soft"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nieuwe client
          </a>
        </div>

        {/* ── Search + Filters ── */}
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Zoeken op naam, BSN, locatie..."
              value={zoekterm}
              onChange={(e) => setZoekterm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-raised border border-default rounded-xl text-body-sm text-fg placeholder:text-fg-subtle focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-[border-color,box-shadow] duration-200 ease-out outline-none"
            />
          </div>
          {locaties.length > 0 && (
            <select
              value={filterLocatie}
              onChange={(e) => setFilterLocatie(e.target.value)}
              className="rounded-xl border border-default bg-raised px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-[border-color,box-shadow] duration-200 ease-out outline-none"
            >
              <option value="">Alle locaties</option>
              {locaties.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          )}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-default bg-raised px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-[border-color,box-shadow] duration-200 ease-out outline-none"
          >
            <option value="">Alle statussen</option>
            {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-default bg-raised px-4 py-3 text-body-sm text-fg cursor-pointer hover:bg-sunken transition-colors">
            <input
              type="checkbox"
              checked={showInactief}
              onChange={(e) => setShowInactief(e.target.checked)}
              className="rounded"
            />
            <span>Toon inactief</span>
          </label>
        </div>

        {/* ── Content ── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-body-sm text-fg-muted">Clienten laden...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-coral-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div>
                <h3 className="text-subheading text-coral-800 dark:text-coral-200">Fout bij het laden</h3>
                <p className="text-body-sm text-coral-700 dark:text-coral-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && gefilterdeClienten.length === 0 && (
          <div className="text-center py-24">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/30 mb-4">
              <svg className="w-8 h-8 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h3 className="text-heading text-fg">
              {zoekterm ? "Geen resultaten" : "Nog geen clienten"}
            </h3>
            <p className="text-body-sm text-fg-muted mt-1 max-w-sm mx-auto">
              {zoekterm
                ? `Geen clienten gevonden voor "${zoekterm}". Probeer een andere zoekterm.`
                : "Registreer je eerste client om te beginnen met het opbouwen van dossiers."}
            </p>
            {!zoekterm && (
              <a
                href="/ecd/nieuw"
                className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-brand-600 text-white text-body-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
              >
                Eerste client registreren
              </a>
            )}
          </div>
        )}

        {!loading && !error && gefilterdeClienten.length > 0 && (
          <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-default">
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold cursor-pointer hover:text-fg-muted" onClick={() => { setSortKey("naam"); setSortDir(sortKey === "naam" && sortDir === "asc" ? "desc" : "asc"); }}>Client {sortKey === "naam" && (sortDir === "asc" ? "↑" : "↓")}</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Nr.</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden md:table-cell cursor-pointer hover:text-fg-muted" onClick={() => { setSortKey("bsn"); setSortDir(sortKey === "bsn" && sortDir === "asc" ? "desc" : "asc"); }}>BSN {sortKey === "bsn" && (sortDir === "asc" ? "↑" : "↓")}</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden md:table-cell cursor-pointer hover:text-fg-muted" onClick={() => { setSortKey("geboortedatum"); setSortDir(sortKey === "geboortedatum" && sortDir === "asc" ? "desc" : "asc"); }}>Leeftijd {sortKey === "geboortedatum" && (sortDir === "asc" ? "↑" : "↓")}</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden lg:table-cell cursor-pointer hover:text-fg-muted" onClick={() => { setSortKey("locatie"); setSortDir(sortKey === "locatie" && sortDir === "asc" ? "desc" : "asc"); }}>Locatie {sortKey === "locatie" && (sortDir === "asc" ? "↑" : "↓")}</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold hidden xl:table-cell">Indicatie</th>
                    <th className="text-left px-6 py-3.5 text-overline text-fg-subtle uppercase tracking-wider font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gefilterdeClienten.map((patient, i) => {
                    const naam = formatNaam(patient);
                    const initials = getInitials(patient);
                    const [bgColor, textColor] = avatarColor(naam);
                    return (
                      <tr
                        key={patient.id}
                        className="border-b border-subtle last:border-0 hover:bg-sunken transition-colors cursor-pointer group"
                        style={{ animationDelay: `${i * 30}ms` }}
                        onClick={() => { window.location.href = `/ecd/${patient.id}`; }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}>
                              <span className={`text-caption font-bold ${textColor}`}>{initials}</span>
                            </div>
                            <div>
                              <a
                                href={`/ecd/${patient.id}`}
                                className="font-semibold text-fg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {naam}
                              </a>
                              <p className="text-caption text-fg-subtle">
                                {formatGeslacht(patient.gender)} &middot; {formatDatum(patient.birthDate)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-caption text-brand-600 dark:text-brand-400 font-semibold">{getClientnummer(patient)}</td>
                        <td className="px-6 py-4 font-mono text-caption text-fg-muted hidden md:table-cell">{getBsn(patient)}</td>
                        <td className="px-6 py-4 text-fg-muted hidden md:table-cell">{getLeeftijd(patient.birthDate)}</td>
                        <td className="px-6 py-4 text-fg-muted hidden lg:table-cell">{getLocatie(patient) || getWoonplaats(patient) || "—"}</td>
                        <td className="px-6 py-4 text-fg-muted hidden xl:table-cell">
                          {getIndicatie(patient) ? (
                            <span className="inline-flex items-center rounded-lg bg-brand-50 dark:bg-brand-950/20 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">{getIndicatie(patient)}</span>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const status = getTrajectStatus(patient);
                            const cfg = STATUS_CONFIG[status];
                            if (cfg) {
                              return (
                                <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-caption font-semibold ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                              );
                            }
                            return patient.active !== false ? (
                              <span className="inline-flex items-center gap-1.5 text-caption font-medium text-brand-600 dark:text-brand-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                Actief
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-caption font-medium text-fg-subtle">
                                <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />
                                Inactief
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-subtle flex items-center justify-between">
              <p className="text-caption text-fg-subtle">
                {gefilterdeClienten.length} {gefilterdeClienten.length === 1 ? "client" : "clienten"}
                {zoekterm && ` gevonden voor "${zoekterm}"`}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
