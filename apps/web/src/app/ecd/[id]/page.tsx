"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ecdFetch } from "../../../lib/api";
import { loadWidgetConfig } from "../../../lib/widget-config";

/* -------------------------------------------------------------------------- */
/*  FHIR type helpers                                                         */
/* -------------------------------------------------------------------------- */

interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  code: { text: string };
  valueString?: string;
  effectiveDateTime?: string;
  extension?: Array<{ url: string; valueString: string }>;
}

interface FhirRelatedPerson {
  resourceType: "RelatedPerson";
  id?: string;
  name?: Array<{ family?: string; given?: string[] }>;
  telecom?: Array<{ system?: string; value?: string }>;
  relationship?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string }> }>;
}

interface FhirCarePlan {
  resourceType: "CarePlan";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: { start?: string; end?: string };
}

interface ClientResource {
  resourceType: "Patient";
  id?: string;
  name?: Array<{ family?: string; given?: string[]; text?: string }>;
  identifier?: Array<{ system?: string; value?: string }>;
  birthDate?: string;
  gender?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{ line?: string[]; postalCode?: string; city?: string }>;
  maritalStatus?: { coding?: Array<{ code?: string }> };
  active?: boolean;
  generalPractitioner?: Array<{ display?: string; reference?: string }>;
  managingOrganization?: { reference?: string; display?: string };
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
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

function clientNaam(client: ClientResource): string {
  const n = client.name?.[0];
  if (n?.text) return n.text;
  const given = n?.given?.join(" ") ?? "";
  const family = n?.family ?? "";
  return `${given} ${family}`.trim() || "Onbekend";
}

function clientBsn(client: ClientResource): string {
  const bsn = client.identifier?.find(
    (i) => i.system === "http://fhir.nl/fhir/NamingSystem/bsn",
  );
  return bsn?.value ?? client.identifier?.[0]?.value ?? "-";
}

function geslachtLabel(gender?: string): string {
  switch (gender) {
    case "male":
      return "Man";
    case "female":
      return "Vrouw";
    case "other":
      return "Anders";
    default:
      return "Onbekend";
  }
}

/* -------------------------------------------------------------------------- */
/*  Main page component                                                       */
/* -------------------------------------------------------------------------- */

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [client, setClient] = useState<ClientResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const loadClient = useCallback(() => {
    setLoading(true);
    ecdFetch<ClientResource>(`/api/clients/${id}`).then(({ data, error: err }) => {
      if (err) setError(err);
      else setClient(data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 rounded-full border-4 border-brand-300 border-t-brand-700" style={{ animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-coral-600">{error ?? "Kan de gegevens niet laden."}</p>
        <button
          onClick={() => router.push("/ecd")}
          className="mt-4 text-sm text-brand-700 underline"
        >
          Terug naar overzicht
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-fg-subtle" aria-label="Breadcrumb">
          <a href="/ecd" className="text-brand-700 hover:text-brand-900 btn-press">Clienten</a>
          <span>/</span>
          <span className="text-fg font-medium">{clientNaam(client)}</span>
        </nav>

        {/* Profile header */}
        <div className="rounded-lg border border-default bg-raised p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Client photo */}
              <div className="relative shrink-0">
                {(client as ClientResource & { photo?: Array<{ data?: string; contentType?: string }> }).photo?.[0]?.data ? (
                  <img
                    src={`data:${(client as ClientResource & { photo?: Array<{ data?: string; contentType?: string }> }).photo![0]!.contentType ?? "image/jpeg"};base64,${(client as ClientResource & { photo?: Array<{ data?: string; contentType?: string }> }).photo![0]!.data}`}
                    alt={clientNaam(client)}
                    className="h-16 w-16 rounded-full object-cover border-2 border-default"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 text-lg font-bold text-white border-2 border-default">
                    {(client.name?.[0]?.given?.[0]?.[0] ?? "").toUpperCase()}
                    {(client.name?.[0]?.family?.[0] ?? "").toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64 = (reader.result as string).split(",")[1];
                        const { error: err } = await ecdFetch(`/api/clients/${id}/foto`, {
                          method: "POST",
                          body: JSON.stringify({ data: base64, contentType: file.type }),
                        });
                        if (err) alert(err);
                        else window.location.reload();
                      };
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-raised border border-default shadow-sm hover:bg-page transition-colors"
                  title="Foto uploaden"
                >
                  <svg className="h-3.5 w-3.5 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-fg">{clientNaam(client)}</h1>
                {client.identifier?.find((id) => id.system === "https://openzorg.nl/NamingSystem/clientnummer") && (
                  <p className="text-body-sm font-mono text-brand-600 dark:text-brand-400 mt-0.5">
                    {client.identifier.find((id) => id.system === "https://openzorg.nl/NamingSystem/clientnummer")?.value}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {client.active === false && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-caption font-medium bg-coral-50 dark:bg-coral-950/20 text-coral-600">
                  Inactief
                </span>
              )}
              <button
                onClick={() => setEditing(!editing)}
                className="text-caption font-medium px-3 py-1.5 rounded-lg border border-default text-fg-muted hover:bg-sunken btn-press"
              >
                {editing ? "Annuleren" : "Bewerken"}
              </button>
              <button
                onClick={async () => {
                  if (!confirm(client.active === false
                    ? "Weet je zeker dat je deze client wilt heractiveren?"
                    : "Weet je zeker dat je deze client inactief wilt maken?"))
                    return;
                  const { error: err } = client.active === false
                    ? await ecdFetch(`/api/clients/${client.id}`, { method: "PUT", body: JSON.stringify({ ...client, active: true }) })
                    : await ecdFetch(`/api/clients/${client.id}`, { method: "DELETE" });
                  if (err) { alert(err); return; }
                  loadClient();
                }}
                className={`text-caption font-medium px-3 py-1.5 rounded-lg border btn-press ${
                  client.active === false
                    ? "text-brand-600 border-brand-200 hover:bg-brand-50"
                    : "text-coral-600 border-coral-200 hover:bg-coral-50"
                }`}
              >
                {client.active === false ? "Heractiveren" : "Inactief maken"}
              </button>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="font-medium text-fg-subtle">BSN</dt>
              <dd className="text-fg">{clientBsn(client)}</dd>
            </div>
            <div>
              <dt className="font-medium text-fg-subtle">Geboortedatum</dt>
              <dd className="text-fg">{formatDate(client.birthDate)}</dd>
            </div>
            <div>
              <dt className="font-medium text-fg-subtle">Geslacht</dt>
              <dd className="text-fg">{geslachtLabel(client.gender)}</dd>
            </div>
            {client.telecom?.find((t) => t.system === "phone") && (
              <div>
                <dt className="font-medium text-fg-subtle">Telefoon</dt>
                <dd className="text-fg">{client.telecom.find((t) => t.system === "phone")?.value}</dd>
              </div>
            )}
            {client.address?.[0] && (
              <div className="sm:col-span-2">
                <dt className="font-medium text-fg-subtle">Adres</dt>
                <dd className="text-fg">
                  {[client.address[0].line?.[0], [client.address[0].postalCode, client.address[0].city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                </dd>
              </div>
            )}
            {client.generalPractitioner?.[0] && (
              <div>
                <dt className="font-medium text-fg-subtle">Huisarts</dt>
                <dd className="text-fg">{client.generalPractitioner[0].display ?? "-"}</dd>
              </div>
            )}
            {(() => {
              const indicatie = client.extension?.find((e) => e.url === "https://openzorg.nl/extensions/indicatie");
              if (!indicatie) return null;
              const type = indicatie.extension?.find((e) => e.url === "type")?.valueString;
              const profiel = indicatie.extension?.find((e) => e.url === "zorgprofiel")?.valueString;
              const financiering = indicatie.extension?.find((e) => e.url === "financiering")?.valueString;
              const einddatum = indicatie.extension?.find((e) => e.url === "einddatum")?.valueString;
              const isVerlopen = einddatum && new Date(einddatum) < new Date();
              return (
                <>
                  <div>
                    <dt className="font-medium text-fg-subtle">Indicatie</dt>
                    <dd className="text-fg">
                      {[type?.toUpperCase(), profiel].filter(Boolean).join(" - ") || "-"}
                      {financiering && (
                        <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300">
                          {financiering.toUpperCase()}
                        </span>
                      )}
                    </dd>
                  </div>
                  {einddatum && (
                    <div>
                      <dt className="font-medium text-fg-subtle">Indicatie geldig tot</dt>
                      <dd className={isVerlopen ? "text-coral-600 font-medium" : "text-fg"}>
                        {formatDate(einddatum)}
                        {isVerlopen && " (verlopen)"}
                      </dd>
                    </div>
                  )}
                </>
              );
            })()}
          </dl>

          {/* Edit form */}
          {editing && (
            <ClientEditForm client={client} onSaved={() => { setEditing(false); loadClient(); }} onCancel={() => setEditing(false)} />
          )}
        </div>

        {/* Signaleringen banner */}
        <SignaleringenBanner clientId={id} />

        {/* Dashboard content — tab-navigatie komt uit de layout (TabNav),
            overige tabs hebben sinds Plan 2A hun eigen route */}
      <div className="mt-6">
        <DashboardTab clientId={id} client={client} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Signaleringen banner                                                      */
/* -------------------------------------------------------------------------- */

interface FhirFlag {
  id?: string;
  status?: string;
  category?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
  code?: { text?: string };
  extension?: Array<{ url?: string; valueString?: string }>;
}

const SIGNALERING_ICONS: Record<string, string> = {
  valrisico: "🚨",
  allergie: "⚠️",
  mrsa: "🦠",
  infectie: "🦠",
  agressie: "⚡",
  dieet: "🍽️",
  anders: "📌",
};

function SignaleringenBanner({ clientId }: { clientId: string }) {
  const [flags, setFlags] = useState<FhirFlag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [categorie, setCategorie] = useState("anders");
  const [ernst, setErnst] = useState("midden");
  const [toelichting, setToelichting] = useState("");

  const load = useCallback(() => {
    ecdFetch<{ entry?: Array<{ resource: FhirFlag }> }>(`/api/clients/${clientId}/signaleringen`).then(({ data }) => {
      setFlags(data?.entry?.map((e) => e.resource).filter((f) => f.status === "active") ?? []);
    });
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/signaleringen`, {
      method: "POST",
      body: JSON.stringify({ code: code.trim(), categorie, ernst, toelichting: toelichting.trim() || undefined }),
    });
    setSaving(false);
    setShowForm(false);
    setCode("");
    setToelichting("");
    load();
  }

  async function handleRemove(flagId: string) {
    if (!confirm("Signalering verwijderen?")) return;
    await ecdFetch(`/api/signaleringen/${flagId}`, { method: "DELETE" });
    load();
  }

  if (flags.length === 0 && !showForm) {
    return (
      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => setShowForm(true)} className="text-xs font-medium text-fg-subtle hover:text-brand-600 btn-press">
          + Signalering toevoegen
        </button>
      </div>
    );
  }

  const ernstCls = (e?: string) => {
    switch (e) {
      case "hoog": return "bg-coral-50 dark:bg-coral-950/20 border-coral-200 dark:border-coral-800 text-coral-700 dark:text-coral-300";
      case "midden": return "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300";
      default: return "bg-brand-50 dark:bg-brand-950/20 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300";
    }
  };

  const inputCls = "rounded-lg border border-default bg-raised px-3 py-1.5 text-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-[border-color,box-shadow] duration-200 ease-out";

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {flags.map((flag) => {
          const cat = flag.category?.[0]?.coding?.[0]?.code ?? "anders";
          const ernstVal = flag.extension?.find((e) => e.url === "https://openzorg.nl/extensions/signalering-ernst")?.valueString;
          const tooltip = flag.extension?.find((e) => e.url === "https://openzorg.nl/extensions/signalering-toelichting")?.valueString;
          return (
            <span
              key={flag.id}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${ernstCls(ernstVal)}`}
              title={tooltip ?? flag.code?.text}
            >
              {SIGNALERING_ICONS[cat] ?? "📌"} {flag.code?.text}
              <button onClick={() => handleRemove(flag.id!)} className="ml-1 opacity-50 hover:opacity-100">×</button>
            </span>
          );
        })}
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-fg-subtle hover:text-brand-600 btn-press">
          + Toevoegen
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-default bg-sunken p-3 animate-[fade-in_200ms_ease-out]">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Omschrijving</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="bijv. Verhoogd valrisico" className={inputCls} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Categorie</label>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={inputCls}>
              <option value="valrisico">🚨 Valrisico</option>
              <option value="allergie">⚠️ Allergie</option>
              <option value="mrsa">🦠 MRSA</option>
              <option value="infectie">🦠 Infectie</option>
              <option value="agressie">⚡ Agressie</option>
              <option value="dieet">🍽️ Dieet</option>
              <option value="anders">📌 Anders</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Ernst</label>
            <select value={ernst} onChange={(e) => setErnst(e.target.value)} className={inputCls}>
              <option value="hoog">Hoog</option>
              <option value="midden">Midden</option>
              <option value="laag">Laag</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 btn-press">
            {saving ? "..." : "Toevoegen"}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="text-sm text-fg-muted hover:text-fg btn-press">Annuleren</button>
        </form>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Client edit form                                                          */
/* -------------------------------------------------------------------------- */

function ClientEditForm({
  client,
  onSaved,
  onCancel,
}: {
  client: ClientResource;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [voornaam, setVoornaam] = useState(client.name?.[0]?.given?.[0] ?? "");
  const [achternaam, setAchternaam] = useState(client.name?.[0]?.family ?? "");
  const [geboortedatum, setGeboortedatum] = useState(client.birthDate ?? "");
  const [geslacht, setGeslacht] = useState(client.gender ?? "unknown");
  const [telefoon, setTelefoon] = useState(client.telecom?.find((t) => t.system === "phone")?.value ?? "");
  const [email, setEmail] = useState(client.telecom?.find((t) => t.system === "email")?.value ?? "");
  const [straat, setStraat] = useState(client.address?.[0]?.line?.[0] ?? "");
  const [postcode, setPostcode] = useState(client.address?.[0]?.postalCode ?? "");
  const [woonplaats, setWoonplaats] = useState(client.address?.[0]?.city ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const inputCls = "w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-[border-color,box-shadow] duration-200 ease-out";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const telecom: Array<{ system: string; value: string; use?: string }> = [];
    if (telefoon.trim()) telecom.push({ system: "phone", value: telefoon.trim(), use: "mobile" });
    if (email.trim()) telecom.push({ system: "email", value: email.trim() });
    // Preserve other telecom entries
    client.telecom?.forEach((t) => {
      if (t.system !== "phone" && t.system !== "email") telecom.push(t as { system: string; value: string });
    });

    const updated: ClientResource = {
      ...client,
      name: [{ given: [voornaam.trim()], family: achternaam.trim() }],
      birthDate: geboortedatum || undefined,
      gender: geslacht as ClientResource["gender"],
      telecom: telecom.length > 0 ? telecom : undefined,
      address: straat.trim() || postcode.trim() || woonplaats.trim()
        ? [{ line: straat.trim() ? [straat.trim()] : undefined, postalCode: postcode.trim() || undefined, city: woonplaats.trim() || undefined }]
        : client.address,
    };

    const { error: err } = await ecdFetch(`/api/clients/${client.id}`, {
      method: "PUT",
      body: JSON.stringify(updated),
    });

    if (err) {
      setFormError(err);
      setSaving(false);
    } else {
      onSaved();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t border-default pt-4 animate-[fade-in_300ms_cubic-bezier(0.16,1,0.3,1)]">
      {formError && (
        <div className="mb-3 rounded-lg bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 px-3 py-2 text-sm text-coral-700 dark:text-coral-300">
          {formError}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Voornaam</label>
          <input type="text" value={voornaam} onChange={(e) => setVoornaam(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Achternaam</label>
          <input type="text" value={achternaam} onChange={(e) => setAchternaam(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Geboortedatum</label>
          <input type="date" value={geboortedatum} onChange={(e) => setGeboortedatum(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Geslacht</label>
          <select value={geslacht} onChange={(e) => setGeslacht(e.target.value)} className={inputCls}>
            <option value="male">Man</option>
            <option value="female">Vrouw</option>
            <option value="other">Anders</option>
            <option value="unknown">Onbekend</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Telefoon</label>
          <input type="tel" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="06-12345678" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@voorbeeld.nl" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Straat + huisnummer</label>
          <input type="text" value={straat} onChange={(e) => setStraat(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Postcode</label>
          <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="1234 AB" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Woonplaats</label>
          <input type="text" value={woonplaats} onChange={(e) => setWoonplaats(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !voornaam.trim() || !achternaam.trim()}
          className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press"
        >
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-fg-muted hover:text-fg btn-press"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard / overview tab                                                  */
/* -------------------------------------------------------------------------- */

interface DashboardTabProps {
  clientId: string;
  client: ClientResource;
}

function DashboardTab({ clientId, client }: DashboardTabProps) {
  const router = useRouter();
  const [widgetCfg] = useState(() => loadWidgetConfig());
  const enabledWidgets = widgetCfg.filter((w) => w.enabled);
  const go = (slug: string) => () => router.push(`/ecd/${clientId}/${slug}`);

  return (
    <div className="grid gap-4 sm:grid-cols-2 stagger">
      {enabledWidgets.map((widget) => {
        switch (widget.id) {
          case "persoonlijke-gegevens":
            return <PersoonlijkeGegevensWidget key={widget.id} client={client} />;
          case "zorgplan-samenvatting":
            return <ZorgplanWidget key={widget.id} clientId={clientId} onNavigate={go("zorgplan")} />;
          case "laatste-rapportages":
            return <RapportagesWidget key={widget.id} clientId={clientId} onNavigate={go("rapportages")} />;
          case "medicatie":
            return <MedicatieWidget key={widget.id} clientId={clientId} onNavigate={go("medicatie")} />;
          case "allergieen":
            return <AllergieenWidget key={widget.id} clientId={clientId} onNavigate={go("allergieen")} />;
          case "vaccinaties":
            return <VaccinatiesWidget key={widget.id} clientId={clientId} onNavigate={go("vaccinaties")} />;
          case "contactpersonen":
            return <ContactpersonenWidget key={widget.id} clientId={clientId} onNavigate={go("contactpersonen")} />;
          case "afspraken":
            return <AfsprakenWidget key={widget.id} clientId={clientId} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

/* ── Dashboard widget wrapper ── */

function WidgetCard({
  title,
  onViewAll,
  children,
}: {
  title: string;
  onViewAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-default bg-raised p-4 transition-shadow duration-200 ease-out hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-brand-600 hover:text-brand-800 hover:translate-x-0.5 transition-[color,transform] duration-200 ease-out"
          >
            Bekijk alles &rarr;
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Persoonlijke gegevens widget ── */

function PersoonlijkeGegevensWidget({ client }: { client: ClientResource }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "BSN", value: clientBsn(client) },
    { label: "Geboortedatum", value: formatDate(client.birthDate) },
    { label: "Geslacht", value: geslachtLabel(client.gender) },
  ];

  const phone = client.telecom?.find((t) => t.system === "phone")?.value;
  if (phone) rows.push({ label: "Telefoon", value: phone });

  const addr = client.address?.[0];
  if (addr) {
    const line = [addr.line?.[0], [addr.postalCode, addr.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    if (line) rows.push({ label: "Adres", value: line });
  }

  return (
    <WidgetCard title="Persoonlijke gegevens">
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline gap-2 text-sm">
            <dt className="w-28 shrink-0 text-fg-subtle">{r.label}</dt>
            <dd className="text-fg">{r.value}</dd>
          </div>
        ))}
      </dl>
    </WidgetCard>
  );
}

/* ── Zorgplan widget ── */

function ZorgplanWidget({ clientId, onNavigate }: { clientId: string; onNavigate: () => void }) {
  const [plans, setPlans] = useState<FhirCarePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecdFetch<FhirBundle<FhirCarePlan>>(`/api/clients/${clientId}/zorgplan`).then(({ data }) => {
      setPlans(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  return (
    <WidgetCard title="Zorgplan samenvatting" onViewAll={onNavigate}>
      {loading ? (
        <p className="text-sm text-fg-subtle">Laden...</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-fg-subtle">Geen zorgplannen gevonden</p>
      ) : (
        <ul className="space-y-2">
          {plans.slice(0, 2).map((plan) => (
            <li key={plan.id} className="text-sm">
              <p className="font-medium text-fg">{plan.title || "Zorgplan"}</p>
              <p className="text-fg-subtle">
                {plan.status === "active" ? "Actief" : plan.status ?? "-"}
                {plan.period?.start ? ` \u00b7 Vanaf ${formatDate(plan.period.start)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

/* ── Rapportages widget (3 most recent) ── */

function RapportagesWidget({ clientId, onNavigate }: { clientId: string; onNavigate: () => void }) {
  const [items, setItems] = useState<FhirObservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecdFetch<FhirBundle<FhirObservation>>(`/api/clients/${clientId}/rapportages`).then(({ data }) => {
      const all = data?.entry?.map((e) => e.resource) ?? [];
      all.sort((a, b) => (b.effectiveDateTime ?? "").localeCompare(a.effectiveDateTime ?? ""));
      setItems(all.slice(0, 3));
      setLoading(false);
    });
  }, [clientId]);

  return (
    <WidgetCard title="Laatste rapportages" onViewAll={onNavigate}>
      {loading ? (
        <p className="text-sm text-fg-subtle">Laden...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-subtle">Geen rapportages gevonden</p>
      ) : (
        <ul className="space-y-2">
          {items.map((obs) => (
            <li key={obs.id} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-fg">{obs.code?.text || "Rapportage"}</span>
                <span className="shrink-0 text-xs text-fg-subtle">{formatDate(obs.effectiveDateTime)}</span>
              </div>
              {obs.valueString && (
                <p className="mt-0.5 text-fg-muted line-clamp-2">{obs.valueString}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

/* ── Medicatie widget ── */

function MedicatieWidget({ clientId, onNavigate }: { clientId: string; onNavigate: () => void }) {
  const [items, setItems] = useState<FhirMedicationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecdFetch<FhirBundle<FhirMedicationRequest>>(`/api/clients/${clientId}/medicatie`).then(({ data }) => {
      setItems((data?.entry?.map((e) => e.resource) ?? []).slice(0, 4));
      setLoading(false);
    });
  }, [clientId]);

  return (
    <WidgetCard title="Medicatie" onViewAll={onNavigate}>
      {loading ? (
        <p className="text-sm text-fg-subtle">Laden...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-subtle">Geen medicatie gevonden</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((med) => (
            <li key={med.id} className="text-sm">
              <span className="font-medium text-fg">{med.medicationCodeableConcept?.text || "-"}</span>
              {med.dosageInstruction?.[0]?.text && (
                <span className="ml-2 text-fg-subtle">{med.dosageInstruction[0].text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

/* ── Allergieen widget ── */

interface WidgetAllergyIntolerance {
  id?: string;
  code?: { text?: string; coding?: Array<{ display?: string }> };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  criticality?: string;
}

function AllergieenWidget({ clientId, onNavigate }: { clientId: string; onNavigate: () => void }) {
  const [items, setItems] = useState<WidgetAllergyIntolerance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecdFetch<FhirBundle<WidgetAllergyIntolerance>>(`/api/clients/${clientId}/allergieen`).then(({ data }) => {
      setItems(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  const critLabel = (c?: string) => {
    switch (c) {
      case "high": return "Hoog";
      case "low": return "Laag";
      default: return null;
    }
  };

  return (
    <WidgetCard title="Allergie\u00ebn" onViewAll={onNavigate}>
      {loading ? (
        <p className="text-sm text-fg-subtle">Laden...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-subtle">Geen allergie\u00ebn gevonden</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => {
            const name = a.code?.text || a.code?.coding?.[0]?.display || "-";
            const crit = critLabel(a.criticality);
            return (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-fg">{name}</span>
                {crit && (
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    a.criticality === "high"
                      ? "bg-coral-50 text-coral-700 dark:bg-coral-950/30 dark:text-coral-400"
                      : "bg-surface-100 text-fg-muted dark:bg-surface-800"
                  }`}>
                    {crit}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

/* ── Vaccinaties widget ── */

interface WidgetImmunization {
  id?: string;
  vaccineCode?: { text?: string; coding?: Array<{ display?: string }> };
  occurrenceDateTime?: string;
  status?: string;
}

function VaccinatiesWidget({ clientId, onNavigate }: { clientId: string; onNavigate: () => void }) {
  const [items, setItems] = useState<WidgetImmunization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecdFetch<FhirBundle<WidgetImmunization>>(`/api/clients/${clientId}/vaccinaties`).then(({ data }) => {
      setItems((data?.entry?.map((e) => e.resource) ?? []).slice(0, 4));
      setLoading(false);
    });
  }, [clientId]);

  return (
    <WidgetCard title="Vaccinaties" onViewAll={onNavigate}>
      {loading ? (
        <p className="text-sm text-fg-subtle">Laden...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-subtle">Geen vaccinaties gevonden</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((v) => (
            <li key={v.id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-fg">
                {v.vaccineCode?.text || v.vaccineCode?.coding?.[0]?.display || "-"}
              </span>
              <span className="shrink-0 text-xs text-fg-subtle">{formatDate(v.occurrenceDateTime)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

/* ── Contactpersonen widget ── */

function ContactpersonenWidget({ clientId, onNavigate }: { clientId: string; onNavigate: () => void }) {
  const [items, setItems] = useState<FhirRelatedPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecdFetch<FhirBundle<FhirRelatedPerson>>(`/api/clients/${clientId}/contactpersonen`).then(({ data }) => {
      setItems((data?.entry?.map((e) => e.resource) ?? []).slice(0, 3));
      setLoading(false);
    });
  }, [clientId]);

  return (
    <WidgetCard title="Contactpersonen" onViewAll={onNavigate}>
      {loading ? (
        <p className="text-sm text-fg-subtle">Laden...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-subtle">Geen contactpersonen gevonden</p>
      ) : (
        <ul className="space-y-2">
          {items.map((cp) => {
            const name = [cp.name?.[0]?.given?.join(" "), cp.name?.[0]?.family].filter(Boolean).join(" ") || "-";
            const rel = cp.relationship?.[0]?.coding?.[0]?.display;
            const phone = cp.telecom?.find((t) => t.system === "phone")?.value;
            return (
              <li key={cp.id} className="text-sm">
                <span className="font-medium text-fg">{name}</span>
                {rel && <span className="ml-2 text-fg-subtle">({rel})</span>}
                {phone && <p className="text-fg-muted">{phone}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

/* ── Afspraken widget ── */

interface WidgetAppointment {
  id?: string;
  status?: string;
  start?: string;
  end?: string;
  description?: string;
  serviceType?: Array<{ text?: string }>;
}

function AfsprakenWidget({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<WidgetAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecdFetch<FhirBundle<WidgetAppointment>>(`/api/afspraken?patient=${clientId}`).then(({ data }) => {
      const all = data?.entry?.map((e) => e.resource) ?? [];
      // Show upcoming appointments
      const now = new Date().toISOString();
      const upcoming = all.filter((a) => (a.start ?? "") >= now).slice(0, 3);
      setItems(upcoming.length > 0 ? upcoming : all.slice(0, 3));
      setLoading(false);
    });
  }, [clientId]);

  return (
    <WidgetCard title="Afspraken">
      {loading ? (
        <p className="text-sm text-fg-subtle">Laden...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-subtle">Geen afspraken gevonden</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-fg">
                  {a.serviceType?.[0]?.text || a.description || "Afspraak"}
                </span>
                <span className="shrink-0 text-xs text-fg-subtle">{formatDateTime(a.start)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
