"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

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
  relationship?: Array<{ coding?: Array<{ display?: string }> }>;
}

interface FhirCarePlan {
  resourceType: "CarePlan";
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: { start?: string; end?: string };
}

interface FhirDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  date?: string;
  content?: Array<{
    attachment?: { title?: string; contentType?: string; url?: string };
  }>;
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

interface FhirGoal {
  resourceType: "Goal";
  id?: string;
  lifecycleStatus?: string;
  description?: { text?: string };
  target?: Array<{ dueDate?: string }>;
  addresses?: Array<{ reference?: string }>;
}

interface FhirServiceRequest {
  resourceType: "ServiceRequest";
  id?: string;
  status?: string;
  intent?: string;
  code?: { text?: string; coding?: Array<{ display?: string }> };
  basedOn?: Array<{ reference?: string }>;
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                      */
/* -------------------------------------------------------------------------- */

interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
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

type TabKey = "rapportages" | "zorgplan" | "contactpersonen" | "medicatie" | "allergieen" | "diagnoses" | "risicoscreenings" | "documenten" | "extra";

const TABS: { key: TabKey; label: string }[] = [
  { key: "rapportages", label: "Rapportages" },
  { key: "zorgplan", label: "Zorgplan" },
  { key: "contactpersonen", label: "Contactpersonen" },
  { key: "medicatie", label: "Medicatie" },
  { key: "allergieen", label: "Allergieën" },
  { key: "diagnoses", label: "Diagnoses" },
  { key: "risicoscreenings", label: "Screenings" },
  { key: "documenten", label: "Documenten" },
  { key: "extra", label: "Extra velden" },
];

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
  const [activeTab, setActiveTab] = useState<TabKey>("rapportages");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ecdFetch<ClientResource>(`/api/clients/${id}`).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err);
      else setClient(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
        </div>
      </PageShell>
    );
  }

  if (error || !client) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-coral-600">{error ?? "Kan de gegevens niet laden."}</p>
          <button
            onClick={() => router.push("/ecd")}
            className="mt-4 text-sm text-brand-700 underline"
          >
            Terug naar overzicht
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back link */}
        <button
          onClick={() => router.push("/ecd")}
          className="mb-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:text-brand-900"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Terug naar overzicht
        </button>

        {/* Profile header */}
        <div className="rounded-lg border border-default bg-raised p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-fg">{clientNaam(client)}</h1>
              {client.identifier?.find((id) => id.system === "https://openzorg.nl/NamingSystem/clientnummer") && (
                <p className="text-body-sm font-mono text-brand-600 dark:text-brand-400 mt-0.5">
                  {client.identifier.find((id) => id.system === "https://openzorg.nl/NamingSystem/clientnummer")?.value}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {client.active === false && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-caption font-medium bg-coral-50 dark:bg-coral-950/20 text-coral-600">
                  Inactief
                </span>
              )}
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
                  window.location.reload();
                }}
                className={`text-caption font-medium px-3 py-1.5 rounded-lg border transition-colors ${
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
              return (
                <div>
                  <dt className="font-medium text-fg-subtle">Indicatie</dt>
                  <dd className="text-fg">{[type?.toUpperCase(), profiel].filter(Boolean).join(" - ") || "-"}</dd>
                </div>
              );
            })()}
          </dl>
        </div>

        {/* Tabs */}
        <div className="mt-6 border-b border-default">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "border-brand-700 text-brand-700"
                    : "border-transparent text-fg-subtle hover:border-default hover:text-fg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {activeTab === "rapportages" && <RapportagesTab clientId={id} />}
          {activeTab === "zorgplan" && <ZorgplanTab clientId={id} />}
          {activeTab === "contactpersonen" && <ContactpersonenTab clientId={id} />}
          {activeTab === "medicatie" && <MedicatieTab clientId={id} />}
          {activeTab === "allergieen" && <AllergieenTab clientId={id} />}
          {activeTab === "diagnoses" && <DiagnosesTab clientId={id} />}
          {activeTab === "risicoscreenings" && <RisicoscreeningsTab clientId={id} />}
          {activeTab === "documenten" && <DocumentenTab clientId={id} />}
          {activeTab === "extra" && <ExtraVeldenTab clientId={id} client={client} />}
        </div>
      </div>
    </PageShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page shell with nav bar                                                   */
/* -------------------------------------------------------------------------- */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rapportages tab                                                           */
/* -------------------------------------------------------------------------- */

function RapportagesTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirObservation>>(`/api/clients/${clientId}/rapportages`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setItems(data?.entry?.map((e) => e.resource) ?? []);
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Rapportages</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800"
        >
          {showForm ? "Annuleren" : "Nieuwe rapportage"}
        </button>
      </div>

      {showForm && (
        <RapportageForm
          clientId={clientId}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Nog geen rapportages.</p>
      )}

      <ul className="space-y-3">
        {items.map((obs, i) => {
          const type = obs.code?.text ?? "vrij";
          const isSoep = type.toLowerCase() === "soep";
          return (
            <li key={obs.id ?? i} className="rounded-lg border border-default bg-raised p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xs font-medium text-fg-subtle">
                  {formatDateTime(obs.effectiveDateTime)}
                </span>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isSoep
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-fg-muted"
                  }`}
                >
                  {isSoep ? "SOEP" : "Vrij"}
                </span>
              </div>
              {isSoep ? (
                <dl className="grid gap-1 text-sm">
                  {(["Subjectief", "Objectief", "Evaluatie", "Plan"] as const).map(
                    (label, idx) => {
                      const val = obs.extension?.[idx]?.valueString;
                      if (!val) return null;
                      return (
                        <div key={label} className="flex gap-2">
                          <dt className="w-20 shrink-0 font-medium text-fg-muted">
                            {label[0]}
                          </dt>
                          <dd className="text-fg">{val}</dd>
                        </div>
                      );
                    },
                  )}
                </dl>
              ) : (
                <p className="text-sm text-fg">{obs.valueString ?? "-"}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rapportage form                                                           */
/* -------------------------------------------------------------------------- */

function RapportageForm({
  clientId,
  onSaved,
}: {
  clientId: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"soep" | "vrij">("soep");
  const [subjectief, setSubjectief] = useState("");
  const [objectief, setObjectief] = useState("");
  const [evaluatie, setEvaluatie] = useState("");
  const [plan, setPlan] = useState("");
  const [tekst, setTekst] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body =
      type === "soep"
        ? { type: "soep", subjectief, objectief, evaluatie, plan }
        : { type: "vrij", tekst };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/rapportages`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      onSaved();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
    >
      {/* Type toggle */}
      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-medium text-fg-muted">Type rapportage</legend>
        <div className="flex gap-4">
          {(["soep", "vrij"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rapportageType"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="accent-brand-700"
              />
              {t === "soep" ? "SOEP" : "Vrij"}
            </label>
          ))}
        </div>
      </fieldset>

      {type === "soep" ? (
        <div className="grid gap-3">
          {[
            { label: "Subjectief", value: subjectief, set: setSubjectief },
            { label: "Objectief", value: objectief, set: setObjectief },
            { label: "Evaluatie", value: evaluatie, set: setEvaluatie },
            { label: "Plan", value: plan, set: setPlan },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="mb-1 block text-sm font-medium text-fg-muted">{label}</label>
              <textarea
                rows={2}
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ))}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Tekst</label>
          <textarea
            rows={4}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-coral-600">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
        >
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Zorgplan tab                                                              */
/* -------------------------------------------------------------------------- */

const LEEFGEBIEDEN = [
  "Lichamelijk welbevinden",
  "Psychisch welbevinden",
  "Sociaal functioneren",
  "Dagbesteding en activiteiten",
  "Wonen en huishouden",
  "Financien en administratie",
  "Veiligheid",
  "Mobiliteit",
  "Voeding",
  "Persoonlijke verzorging",
  "Communicatie",
  "Overig",
];

function ZorgplanTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirCarePlan[]>([]);
  const [goals, setGoals] = useState<FhirGoal[]>([]);
  const [interventies, setInterventies] = useState<FhirServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  // New zorgplan form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState("");
  const [verantwoordelijke, setVerantwoordelijke] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState<string | null>(null);
  const [goalLeefgebied, setGoalLeefgebied] = useState(LEEFGEBIEDEN[0]);
  const [goalDescription, setGoalDescription] = useState("");
  const [goalDueDate, setGoalDueDate] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  // Interventie form
  const [showInterventieForm, setShowInterventieForm] = useState<string | null>(null);
  const [interventieCode, setInterventieCode] = useState("");
  const [interventieFrequentie, setInterventieFrequentie] = useState("");
  const [interventieSaving, setInterventieSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirCarePlan>>(`/api/clients/${clientId}/zorgplan`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setItems(data?.entry?.map((e) => e.resource) ?? []);
        setLoading(false);
      },
    );
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  function loadPlanDetails(planId: string) {
    setExpandedPlan(expandedPlan === planId ? null : planId);
    if (expandedPlan === planId) return;

    // Load goals and interventions for this plan
    ecdFetch<FhirBundle<FhirGoal>>(`/api/clients/${clientId}/zorgplan`)
      .then(({ data }) => {
        // Goals are linked via addresses reference
        setGoals(data?.entry?.map((e) => e.resource).filter((r): r is FhirGoal => r.resourceType === "Goal") ?? []);
      });
    ecdFetch<FhirBundle<FhirServiceRequest>>(`/api/clients/${clientId}/zorgplan`)
      .then(({ data }) => {
        setInterventies(data?.entry?.map((e) => e.resource).filter((r): r is FhirServiceRequest => r.resourceType === "ServiceRequest") ?? []);
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const body = {
      title,
      description,
      period: {
        start: periodStart,
        ...(periodEnd ? { end: periodEnd } : {}),
      },
      ...(verantwoordelijke ? { author: [{ display: verantwoordelijke }] } : {}),
    };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/zorgplan`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setFormError(err);
    } else {
      setShowForm(false);
      setTitle("");
      setDescription("");
      setVerantwoordelijke("");
      load();
    }
  }

  async function handleAddGoal(planId: string) {
    setGoalSaving(true);
    const body = {
      description: `[${goalLeefgebied}] ${goalDescription}`,
      ...(goalDueDate ? { target: [{ dueDate: goalDueDate }] } : {}),
    };

    const { error: err } = await ecdFetch(`/api/zorgplan/${planId}/doelen`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setGoalSaving(false);
    if (!err) {
      setShowGoalForm(null);
      setGoalDescription("");
      setGoalDueDate("");
      loadPlanDetails(planId);
    }
  }

  async function handleAddInterventie(planId: string) {
    setInterventieSaving(true);
    const codeText = interventieFrequentie
      ? `${interventieCode} (${interventieFrequentie})`
      : interventieCode;

    const { error: err } = await ecdFetch(`/api/zorgplan/${planId}/interventies`, {
      method: "POST",
      body: JSON.stringify({ code: { text: codeText } }),
    });

    setInterventieSaving(false);
    if (!err) {
      setShowInterventieForm(null);
      setInterventieCode("");
      setInterventieFrequentie("");
      loadPlanDetails(planId);
    }
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Zorgplan</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800"
        >
          {showForm ? "Annuleren" : "Nieuw zorgplan"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
        >
          <h3 className="mb-3 text-sm font-semibold text-fg">Nieuw zorgplan</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Titel</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="bijv. Individueel zorgplan 2026" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Beschrijving / Samenvatting</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Korte samenvatting van de zorgvraag en aandachtspunten" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Startdatum</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Einddatum (optioneel)</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-fg-muted">Verantwoordelijk behandelaar</label>
              <input type="text" value={verantwoordelijke} onChange={(e) => setVerantwoordelijke(e.target.value)} placeholder="Naam verantwoordelijke zorgverlener" className={inputCls} />
            </div>
          </div>
          {formError && <p className="mt-2 text-sm text-coral-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50">
              {saving ? "Opslaan..." : "Zorgplan aanmaken"}
            </button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Geen zorgplannen gevonden.</p>
      )}

      <ul className="space-y-4">
        {items.map((cp, i) => {
          const isActive = cp.status === "active";
          const isExpanded = expandedPlan === cp.id;
          return (
            <li key={cp.id ?? i} className="rounded-lg border border-default bg-raised shadow-sm">
              <div
                className="flex cursor-pointer items-center justify-between p-4"
                onClick={() => cp.id && loadPlanDetails(cp.id)}
              >
                <div>
                  <div className="mb-1 flex items-center gap-3">
                    <h3 className="font-semibold text-fg">{cp.title ?? "Zorgplan"}</h3>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-fg-muted"}`}>
                      {isActive ? "Actief" : cp.status ?? "-"}
                    </span>
                  </div>
                  {cp.description && <p className="text-sm text-fg-muted">{cp.description}</p>}
                  <p className="text-xs text-fg-subtle">
                    Periode: {formatDate(cp.period?.start)} &ndash; {formatDate(cp.period?.end)}
                  </p>
                </div>
                <svg className={`h-5 w-5 text-fg-subtle transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isExpanded && cp.id && (
                <div className="border-t px-4 py-4 space-y-4">
                  {/* Doelen section */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-fg">Doelen per leefgebied</h4>
                      <button
                        onClick={() => setShowGoalForm(showGoalForm === cp.id ? null : cp.id!)}
                        className="text-xs font-medium text-brand-700 hover:text-brand-900"
                      >
                        {showGoalForm === cp.id ? "Annuleren" : "+ Doel toevoegen"}
                      </button>
                    </div>

                    {showGoalForm === cp.id && (
                      <div className="mb-3 rounded border border-brand-100 bg-brand-50 p-3 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Leefgebied</label>
                            <select value={goalLeefgebied} onChange={(e) => setGoalLeefgebied(e.target.value)} className={inputCls}>
                              {LEEFGEBIEDEN.map((lg) => <option key={lg} value={lg}>{lg}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Streefdatum</label>
                            <input type="date" value={goalDueDate} onChange={(e) => setGoalDueDate(e.target.value)} className={inputCls} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-fg-muted mb-1">Doelomschrijving</label>
                          <textarea rows={2} value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} placeholder="Wat wil de client bereiken?" className={inputCls} />
                        </div>
                        <button onClick={() => handleAddGoal(cp.id!)} disabled={goalSaving || !goalDescription} className="rounded bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50">
                          {goalSaving ? "Opslaan..." : "Doel opslaan"}
                        </button>
                      </div>
                    )}

                    {goals.length === 0 ? (
                      <p className="text-xs text-fg-subtle">Nog geen doelen toegevoegd.</p>
                    ) : (
                      <ul className="space-y-2">
                        {goals.map((g, gi) => (
                          <li key={g.id ?? gi} className="flex items-start gap-2 rounded border border-gray-100 bg-page p-2 text-sm">
                            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
                            <div>
                              <p className="text-fg">{g.description?.text ?? "-"}</p>
                              {g.target?.[0]?.dueDate && (
                                <p className="text-xs text-fg-subtle">Streefdatum: {formatDate(g.target[0].dueDate)}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Interventies section */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-fg">Interventies</h4>
                      <button
                        onClick={() => setShowInterventieForm(showInterventieForm === cp.id ? null : cp.id!)}
                        className="text-xs font-medium text-brand-700 hover:text-brand-900"
                      >
                        {showInterventieForm === cp.id ? "Annuleren" : "+ Interventie toevoegen"}
                      </button>
                    </div>

                    {showInterventieForm === cp.id && (
                      <div className="mb-3 rounded border border-brand-100 bg-brand-50 p-3 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Interventie / handeling</label>
                            <input type="text" value={interventieCode} onChange={(e) => setInterventieCode(e.target.value)} placeholder="bijv. Hulp bij wassen en aankleden" className={inputCls} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-fg-muted mb-1">Frequentie</label>
                            <input type="text" value={interventieFrequentie} onChange={(e) => setInterventieFrequentie(e.target.value)} placeholder="bijv. 2x per dag, 3x per week" className={inputCls} />
                          </div>
                        </div>
                        <button onClick={() => handleAddInterventie(cp.id!)} disabled={interventieSaving || !interventieCode} className="rounded bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50">
                          {interventieSaving ? "Opslaan..." : "Interventie opslaan"}
                        </button>
                      </div>
                    )}

                    {interventies.length === 0 ? (
                      <p className="text-xs text-fg-subtle">Nog geen interventies toegevoegd.</p>
                    ) : (
                      <ul className="space-y-2">
                        {interventies.map((sr, si) => (
                          <li key={sr.id ?? si} className="flex items-start gap-2 rounded border border-gray-100 bg-page p-2 text-sm">
                            <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            <p className="text-fg">{sr.code?.text ?? sr.code?.coding?.[0]?.display ?? "-"}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Contactpersonen tab                                                       */
/* -------------------------------------------------------------------------- */

const RELATIE_TYPES = [
  { code: "FAMMEMB", display: "Familielid" },
  { code: "SPS", display: "Partner/echtgeno(o)t(e)" },
  { code: "CHILD", display: "Kind" },
  { code: "PRN", display: "Ouder" },
  { code: "SIBLING", display: "Broer/zus" },
  { code: "GUARD", display: "Wettelijk vertegenwoordiger" },
  { code: "POWATT", display: "Gemachtigde" },
  { code: "FRND", display: "Vriend(in)" },
  { code: "NBOR", display: "Buur" },
  { code: "O", display: "Overig" },
];

function ContactpersonenTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirRelatedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [family, setFamily] = useState("");
  const [given, setGiven] = useState("");
  const [phone, setPhone] = useState("");
  const [relatie, setRelatie] = useState("FAMMEMB");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirRelatedPerson>>(
      `/api/clients/${clientId}/contactpersonen`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setItems(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const relatieInfo = RELATIE_TYPES.find((r) => r.code === relatie);
    const body = {
      name: [{ family, given: [given] }],
      telecom: [
        ...(phone ? [{ system: "phone", value: phone }] : []),
        ...(contactEmail ? [{ system: "email", value: contactEmail }] : []),
      ],
      relationship: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              code: relatie,
              display: relatieInfo?.display ?? relatie,
            },
          ],
        },
      ],
    };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/contactpersonen`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setFormError(err);
    } else {
      setShowForm(false);
      setFamily("");
      setGiven("");
      setPhone("");
      setContactEmail("");
      setRelatie("FAMMEMB");
      load();
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Contactpersonen</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800"
        >
          {showForm ? "Annuleren" : "Toevoegen"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Voornaam</label>
              <input type="text" value={given} onChange={(e) => setGiven(e.target.value)} required className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Achternaam</label>
              <input type="text" value={family} onChange={(e) => setFamily(e.target.value)} required className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Relatie</label>
              <select value={relatie} onChange={(e) => setRelatie(e.target.value)} className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                {RELATIE_TYPES.map((r) => (
                  <option key={r.code} value={r.code}>{r.display}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">Telefoon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fg-muted">E-mail</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>
          {formError && <p className="mt-2 text-sm text-coral-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        </form>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">
          Geen contactpersonen gevonden.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-default bg-raised shadow-sm">
        <table className="min-w-full divide-y divide-default text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Naam</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Relatie</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Telefoon</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">E-mail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {items.map((rp, i) => {
              const naam = [rp.name?.[0]?.given?.[0], rp.name?.[0]?.family]
                .filter(Boolean)
                .join(" ");
              const telefoon = rp.telecom?.find((t) => t.system === "phone")?.value;
              const email = rp.telecom?.find((t) => t.system === "email")?.value;
              return (
                <tr key={rp.id ?? i}>
                  <td className="px-4 py-3 text-fg">{naam || "-"}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {rp.relationship?.[0]?.coding?.[0]?.display ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{telefoon ?? "-"}</td>
                  <td className="px-4 py-3 text-fg-muted">{email ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Medicatie tab                                                             */
/* -------------------------------------------------------------------------- */

function MedicatieTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirMedicationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [medCodelijst, setMedCodelijst] = useState<Array<{ code: string; display: string }>>([]);
  const [practitioners, setPractitioners] = useState<Array<{ id: string; name: string }>>([]);

  // Load medicatie codelijst + practitioners
  useEffect(() => {
    ecdFetch<{ items: Array<{ code: string; display: string }> }>("/api/admin/codelijsten/medicatie")
      .then(({ data }) => { if (data?.items) setMedCodelijst(data.items); });
    ecdFetch<{ entry?: Array<{ resource: { id: string; name?: Array<{ family?: string; given?: string[] }> } }> }>("/api/medewerkers")
      .then(({ data }) => {
        const list = data?.entry?.map((e) => ({
          id: e.resource.id,
          name: [...(e.resource.name?.[0]?.given ?? []), e.resource.name?.[0]?.family ?? ""].filter(Boolean).join(" ") || e.resource.id,
        })) ?? [];
        setPractitioners(list);
      });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirMedicationRequest>>(
      `/api/clients/${clientId}/medicatie`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setItems(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Medicatieoverzicht</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800"
        >
          {showForm ? "Annuleren" : "Medicatie toevoegen"}
        </button>
      </div>

      {showForm && (
        <MedicatieForm
          clientId={clientId}
          medCodelijst={medCodelijst}
          practitioners={practitioners}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">
          Geen medicatie gevonden.
        </p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-default bg-raised shadow-sm">
          <table className="min-w-full divide-y divide-default text-sm">
            <thead className="bg-page">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Medicatie</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Dosering</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Frequentie</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Voorschrijver</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Startdatum</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Einddatum</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {items.map((med, i) => {
                const naam = med.medicationCodeableConcept?.text ?? "-";
                const dosering = med.dosageInstruction?.[0]?.text ?? "-";
                const timing = med.dosageInstruction?.[0]?.timing?.repeat;
                const frequentie = timing
                  ? `${timing.frequency ?? 1}x per ${timing.period ?? 1} ${frequentiePeriodLabel(timing.periodUnit)}`
                  : "-";
                const voorschrijver = med.requester?.display ?? "-";
                const startdatum = med.authoredOn ? formatDate(med.authoredOn) : "-";
                const einddatum = med.extension?.find(
                  (e) => e.url === "https://openzorg.nl/extensions/medicatie-einddatum",
                )?.valueString;
                const statusLabel = medicatieStatusLabel(med.status);
                const isActive = med.status === "active";

                return (
                  <tr key={med.id ?? i} className={!isActive ? "opacity-60" : ""}>
                    <td className="px-4 py-3 font-medium text-fg">{naam}</td>
                    <td className="px-4 py-3 text-fg-muted">{dosering}</td>
                    <td className="px-4 py-3 text-fg-muted">{frequentie}</td>
                    <td className="px-4 py-3 text-fg-muted">{voorschrijver}</td>
                    <td className="px-4 py-3 text-fg-muted">{startdatum}</td>
                    <td className="px-4 py-3 text-fg-muted">{einddatum ? formatDate(einddatum) : "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-fg-muted"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function frequentiePeriodLabel(unit?: string): string {
  switch (unit) {
    case "d":
      return "dag";
    case "wk":
      return "week";
    case "mo":
      return "maand";
    case "h":
      return "uur";
    default:
      return "dag";
  }
}

function medicatieStatusLabel(status?: string): string {
  switch (status) {
    case "active":
      return "Actief";
    case "stopped":
      return "Gestopt";
    case "completed":
      return "Afgerond";
    case "on-hold":
      return "Gepauzeerd";
    case "cancelled":
      return "Geannuleerd";
    default:
      return status ?? "Onbekend";
  }
}

/* -------------------------------------------------------------------------- */
/*  Medicatie form                                                            */
/* -------------------------------------------------------------------------- */

function MedicatieForm({
  clientId,
  onSaved,
  medCodelijst = [],
  practitioners = [],
}: {
  clientId: string;
  onSaved: () => void;
  medCodelijst?: Array<{ code: string; display: string }>;
  practitioners?: Array<{ id: string; name: string }>;
}) {
  const [naam, setNaam] = useState("");
  const [dosering, setDosering] = useState("");
  const [frequentie, setFrequentie] = useState("1");
  const [periodUnit, setPeriodUnit] = useState("d");
  const [voorschrijver, setVoorschrijver] = useState("");
  const [startdatum, setStartdatum] = useState(new Date().toISOString().slice(0, 10));
  const [einddatum, setEinddatum] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      medicationCodeableConcept: { text: naam },
      dosageInstruction: [
        {
          text: dosering,
          timing: {
            repeat: {
              frequency: parseInt(frequentie, 10) || 1,
              period: 1,
              periodUnit,
            },
          },
        },
      ],
      authoredOn: startdatum || new Date().toISOString().slice(0, 10),
      status: "active",
      intent: "order",
    };

    if (voorschrijver.trim()) {
      body["requester"] = { display: voorschrijver.trim() };
    }

    if (einddatum) {
      body["extension"] = [
        {
          url: "https://openzorg.nl/extensions/medicatie-einddatum",
          valueString: einddatum,
        },
      ];
    }

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/medicatie`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      onSaved();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">
            Medicatienaam <span className="text-coral-500">*</span>
          </label>
          {medCodelijst.length > 0 ? (
            <select
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              required
              className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Selecteer medicatie</option>
              {medCodelijst.map((m) => <option key={m.code} value={m.display}>{m.display}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              required
              placeholder="bijv. Paracetamol 500mg"
              className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Dosering</label>
          <input
            type="text"
            value={dosering}
            onChange={(e) => setDosering(e.target.value)}
            placeholder="bijv. 1 tablet"
            className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Frequentie</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={frequentie}
              onChange={(e) => setFrequentie(e.target.value)}
              className="w-20 rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <select
              value={periodUnit}
              onChange={(e) => setPeriodUnit(e.target.value)}
              className="rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="d">per dag</option>
              <option value="wk">per week</option>
              <option value="mo">per maand</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Voorschrijver</label>
          {practitioners.length > 0 ? (
            <select
              value={voorschrijver}
              onChange={(e) => setVoorschrijver(e.target.value)}
              className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Selecteer voorschrijver</option>
              {practitioners.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={voorschrijver}
              onChange={(e) => setVoorschrijver(e.target.value)}
              placeholder="bijv. Dr. Jansen"
              className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Startdatum</label>
          <input
            type="date"
            value={startdatum}
            onChange={(e) => setStartdatum(e.target.value)}
            className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Einddatum</label>
          <input
            type="date"
            value={einddatum}
            onChange={(e) => setEinddatum(e.target.value)}
            className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-coral-600">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
        >
          {saving ? "Opslaan..." : "Medicatie opslaan"}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Documenten tab                                                            */
/* -------------------------------------------------------------------------- */

function DocumentenTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirDocumentReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirDocumentReference>>(
      `/api/clients/${clientId}/documenten`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setItems(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/documenten`, {
      method: "POST",
      body: formData,
    });

    setUploading(false);
    if (err) {
      setUploadError(err);
    } else {
      load();
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Documenten</h2>
        <label className="cursor-pointer rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800">
          {uploading ? "Uploaden..." : "Bestand uploaden"}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {uploadError && <ErrorMsg msg={uploadError} />}
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Geen documenten gevonden.</p>
      )}

      <div className="overflow-hidden rounded-lg border border-default bg-raised shadow-sm">
        <table className="min-w-full divide-y divide-default text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Naam</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Type</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Datum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {items.map((doc, i) => {
              const att = doc.content?.[0]?.attachment;
              return (
                <tr key={doc.id ?? i}>
                  <td className="px-4 py-3 text-fg">{att?.title ?? "-"}</td>
                  <td className="px-4 py-3 text-fg-muted">{att?.contentType ?? "-"}</td>
                  <td className="px-4 py-3 text-fg-muted">{formatDate(doc.date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Extra velden tab (dynamic custom fields from tenant config)               */
/* -------------------------------------------------------------------------- */

function ExtraVeldenTab({ clientId, client }: { clientId: string; client: ClientResource }) {
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    ecdFetch<{ customFields: CustomFieldDef[] }>(
      "/api/admin/custom-fields?resourceType=Patient",
    ).then(({ data, error: err }) => {
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
      const defs = data?.customFields ?? [];
      setFieldDefs(defs);

      // Read current values from client extensions
      const currentValues: Record<string, string> = {};
      for (const def of defs) {
        const ext = client.extension?.find((e) => e.url === def.extensionUrl);
        if (ext?.valueString) {
          currentValues[def.id] = ext.valueString;
        }
      }
      setValues(currentValues);
      setLoading(false);
    });
  }, [client.extension]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Build extensions array from current values
    const customExtensions = fieldDefs
      .filter((def) => values[def.id])
      .map((def) => ({
        url: def.extensionUrl,
        valueString: values[def.id],
      }));

    // Merge with existing non-custom extensions
    const customUrls = new Set(fieldDefs.map((d) => d.extensionUrl));
    const existingExtensions = (client.extension ?? []).filter(
      (e) => !customUrls.has(e.url ?? ""),
    );

    const patchBody = {
      resourceType: "Patient",
      extension: [...existingExtensions, ...customExtensions],
    };

    const { error: err } = await ecdFetch(`/api/clients/${clientId}`, {
      method: "PUT",
      body: JSON.stringify(patchBody),
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setSuccess("Extra velden opgeslagen");
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  if (loading) return <Spinner />;

  if (fieldDefs.length === 0) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-semibold text-fg">Extra velden</h2>
        <div className="rounded-lg border border-default bg-raised p-6 text-center">
          <p className="text-sm text-fg-subtle">
            Er zijn nog geen extra velden geconfigureerd voor dit resourcetype.
          </p>
          <a
            href="/admin/configuratie"
            className="mt-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-900"
          >
            Ga naar Configuratie om custom velden toe te voegen
          </a>
        </div>
      </section>
    );
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Extra velden</h2>
        <span className="text-xs text-fg-subtle">{fieldDefs.length} veld(en) geconfigureerd</span>
      </div>

      {error && <ErrorMsg msg={error} />}
      {success && <p className="mb-3 text-sm text-green-600">{success}</p>}

      <div className="rounded-lg border border-default bg-raised p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          {fieldDefs.map((def) => (
            <div key={def.id}>
              <label className="mb-1 block text-sm font-medium text-fg-muted">
                {def.fieldName}
                {def.required && <span className="ml-0.5 text-coral-500">*</span>}
                <span className="ml-2 text-xs text-fg-subtle">({def.fieldType})</span>
              </label>
              {def.fieldType === "boolean" ? (
                <select
                  value={values[def.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [def.id]: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Niet ingevuld</option>
                  <option value="true">Ja</option>
                  <option value="false">Nee</option>
                </select>
              ) : (
                <input
                  type={def.fieldType === "date" ? "date" : def.fieldType === "number" ? "number" : "text"}
                  value={values[def.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [def.id]: e.target.value }))}
                  required={def.required}
                  className={inputCls}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
          >
            {saving ? "Opslaan..." : "Extra velden opslaan"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared small components                                                   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Allergieën Tab                                                            */
/* -------------------------------------------------------------------------- */

interface FhirAllergyIntolerance {
  id?: string;
  code?: { text?: string; coding?: Array<{ display?: string }> };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  category?: string[];
  criticality?: string;
  recordedDate?: string;
  note?: Array<{ text?: string }>;
}

const ALLERGIE_CATEGORIEEN = ["food", "medication", "environment", "biologic"];
const CRITICALITY_LABELS: Record<string, string> = { low: "Laag", high: "Hoog", "unable-to-assess": "Onbekend" };

function AllergieenTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirAllergyIntolerance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [naam, setNaam] = useState("");
  const [codelijst, setCodelijst] = useState<Array<{ code: string; display: string }>>([]);

  // Load org codelijst for allergies
  useEffect(() => {
    ecdFetch<{ items: Array<{ code: string; display: string }> }>("/api/admin/codelijsten/allergieen")
      .then(({ data }) => { if (data?.items) setCodelijst(data.items); });
  }, []);
  const [categorie, setCategorie] = useState("medication");
  const [ernst, setErnst] = useState("low");
  const [notitie, setNotitie] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<FhirBundle<FhirAllergyIntolerance>>(`/api/clients/${clientId}/allergieen`);
    if (err) setError(err);
    else setItems(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!naam.trim()) return;
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/allergieen`, {
      method: "POST",
      body: JSON.stringify({
        code: { text: naam },
        category: [categorie],
        criticality: ernst,
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
        ...(notitie ? { note: [{ text: notitie }] } : {}),
      }),
    });
    setSaving(false);
    setShowForm(false);
    setNaam(""); setNotitie("");
    load();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-fg">Allergieën & Intoleranties</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {showForm ? "Annuleren" : "+ Toevoegen"}
        </button>
      </div>

      {showForm && (
        <div className="bg-raised rounded-xl border border-default p-4 mb-4 space-y-3">
          {codelijst.length > 0 ? (
            <select value={naam} onChange={(e) => setNaam(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
              <option value="">Selecteer allergie/intolerantie</option>
              {codelijst.map((c) => <option key={c.code} value={c.display}>{c.display}</option>)}
            </select>
          ) : (
            <input placeholder="Naam allergie/intolerantie" value={naam} onChange={(e) => setNaam(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          )}
          <div className="grid grid-cols-2 gap-3">
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
              className="border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
              <option value="food">Voedsel</option>
              <option value="medication">Medicatie</option>
              <option value="environment">Omgeving</option>
              <option value="biologic">Biologisch</option>
            </select>
            <select value={ernst} onChange={(e) => setErnst(e.target.value)}
              className="border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
              <option value="low">Laag risico</option>
              <option value="high">Hoog risico</option>
              <option value="unable-to-assess">Onbekend</option>
            </select>
          </div>
          <textarea placeholder="Notitie (optioneel)" value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={2}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <button onClick={handleAdd} disabled={saving || !naam.trim()}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle py-4">Geen allergieën of intoleranties geregistreerd.</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="bg-raised rounded-xl border border-default p-4 flex items-start justify-between">
              <div>
                <p className="font-medium text-fg">{a.code?.text ?? a.code?.coding?.[0]?.display ?? "Onbekend"}</p>
                <div className="flex gap-3 mt-1 text-caption text-fg-subtle">
                  <span>{a.category?.[0] === "food" ? "Voedsel" : a.category?.[0] === "medication" ? "Medicatie" : a.category?.[0] ?? "—"}</span>
                  <span>Ernst: {CRITICALITY_LABELS[a.criticality ?? ""] ?? a.criticality ?? "—"}</span>
                </div>
                {a.note?.[0]?.text && <p className="text-sm text-fg-muted mt-1">{a.note[0].text}</p>}
              </div>
              {a.criticality === "high" && (
                <span className="shrink-0 px-2 py-0.5 rounded text-caption font-medium bg-coral-50 text-coral-600">Hoog risico</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Diagnoses Tab                                                             */
/* -------------------------------------------------------------------------- */

interface FhirCondition {
  id?: string;
  code?: { text?: string; coding?: Array<{ display?: string; code?: string }> };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  verificationStatus?: { coding?: Array<{ code?: string }> };
  onsetDateTime?: string;
  note?: Array<{ text?: string }>;
}

function DiagnosesTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [naam, setNaam] = useState("");
  const [codelijst, setCodelijst] = useState<Array<{ code: string; display: string }>>([]);

  useEffect(() => {
    ecdFetch<{ items: Array<{ code: string; display: string }> }>("/api/admin/codelijsten/diagnoses")
      .then(({ data }) => { if (data?.items) setCodelijst(data.items); });
  }, []);
  const [startdatum, setStartdatum] = useState("");
  const [notitie, setNotitie] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<FhirBundle<FhirCondition>>(`/api/clients/${clientId}/diagnoses`);
    if (err) setError(err);
    else setItems(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!naam.trim()) return;
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/diagnoses`, {
      method: "POST",
      body: JSON.stringify({
        code: { text: naam },
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] },
        ...(startdatum ? { onsetDateTime: startdatum } : {}),
        ...(notitie ? { note: [{ text: notitie }] } : {}),
      }),
    });
    setSaving(false);
    setShowForm(false);
    setNaam(""); setStartdatum(""); setNotitie("");
    load();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-fg">Diagnoses & Aandoeningen</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {showForm ? "Annuleren" : "+ Toevoegen"}
        </button>
      </div>

      {showForm && (
        <div className="bg-raised rounded-xl border border-default p-4 mb-4 space-y-3">
          {codelijst.length > 0 ? (
            <select value={naam} onChange={(e) => setNaam(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
              <option value="">Selecteer diagnose / aandoening</option>
              {codelijst.map((c) => <option key={c.code} value={c.display}>{c.display}</option>)}
            </select>
          ) : (
            <input placeholder="Naam diagnose / aandoening" value={naam} onChange={(e) => setNaam(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          )}
          <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)}
            className="border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <textarea placeholder="Notitie (optioneel)" value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={2}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <button onClick={handleAdd} disabled={saving || !naam.trim()}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Opslaan..." : "Opslaan"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle py-4">Geen diagnoses of aandoeningen geregistreerd.</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <div key={d.id} className="bg-raised rounded-xl border border-default p-4">
              <div className="flex items-start justify-between">
                <p className="font-medium text-fg">{d.code?.text ?? d.code?.coding?.[0]?.display ?? "Onbekend"}</p>
                <span className={`text-caption font-medium px-2 py-0.5 rounded ${
                  d.clinicalStatus?.coding?.[0]?.code === "active" ? "bg-brand-50 text-brand-700" : "bg-surface-100 text-fg-subtle"
                }`}>
                  {d.clinicalStatus?.coding?.[0]?.code === "active" ? "Actief" : d.clinicalStatus?.coding?.[0]?.code ?? "—"}
                </span>
              </div>
              {d.onsetDateTime && <p className="text-caption text-fg-subtle mt-1">Sinds {new Date(d.onsetDateTime).toLocaleDateString("nl-NL")}</p>}
              {d.note?.[0]?.text && <p className="text-sm text-fg-muted mt-1">{d.note[0].text}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Risicoscreenings Tab                                                      */
/* -------------------------------------------------------------------------- */

interface FhirRiskAssessment {
  id?: string;
  code?: { text?: string };
  status?: string;
  occurrenceDateTime?: string;
  prediction?: Array<{ outcome?: { text?: string }; qualitativeRisk?: { text?: string }; relativeRisk?: number }>;
  note?: Array<{ text?: string }>;
}

const SCREENING_TYPES = [
  { value: "Valrisico (Morse Fall Scale)", label: "Valrisico" },
  { value: "Decubitus (Braden)", label: "Decubitus" },
  { value: "Ondervoeding (SNAQ/MUST)", label: "Ondervoeding" },
  { value: "Depressie (GDS-15)", label: "Depressie" },
  { value: "Pijn (NRS/VAS)", label: "Pijn" },
  { value: "Delier (DOS/DOSS)", label: "Delier" },
];

function RisicoscreeningsTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<FhirRiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [screeningType, setScreeningType] = useState(SCREENING_TYPES[0]?.value ?? "");
  const [risico, setRisico] = useState("laag");
  const [notitie, setNotitie] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<FhirBundle<FhirRiskAssessment>>(`/api/clients/${clientId}/risicoscreenings`);
    if (err) setError(err);
    else setItems(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/risicoscreenings`, {
      method: "POST",
      body: JSON.stringify({
        code: { text: screeningType },
        occurrenceDateTime: new Date().toISOString(),
        prediction: [{ qualitativeRisk: { text: risico } }],
        ...(notitie ? { note: [{ text: notitie }] } : {}),
      }),
    });
    setSaving(false);
    setShowForm(false);
    setNotitie("");
    load();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-fg">Risicoscreenings</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {showForm ? "Annuleren" : "+ Screening"}
        </button>
      </div>

      {showForm && (
        <div className="bg-raised rounded-xl border border-default p-4 mb-4 space-y-3">
          <select value={screeningType} onChange={(e) => setScreeningType(e.target.value)}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
            {SCREENING_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.value}</option>)}
          </select>
          <select value={risico} onChange={(e) => setRisico(e.target.value)}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg">
            <option value="laag">Laag risico</option>
            <option value="matig">Matig risico</option>
            <option value="hoog">Hoog risico</option>
            <option value="zeer hoog">Zeer hoog risico</option>
          </select>
          <textarea placeholder="Toelichting (optioneel)" value={notitie} onChange={(e) => setNotitie(e.target.value)} rows={2}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg" />
          <button onClick={handleAdd} disabled={saving}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Opslaan..." : "Screening opslaan"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle py-4">Geen risicoscreenings uitgevoerd.</p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const risicoNiveau = r.prediction?.[0]?.qualitativeRisk?.text ?? "onbekend";
            const isHoog = risicoNiveau === "hoog" || risicoNiveau === "zeer hoog";
            return (
              <div key={r.id} className="bg-raised rounded-xl border border-default p-4">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-fg">{r.code?.text ?? "Screening"}</p>
                  <span className={`text-caption font-medium px-2 py-0.5 rounded ${
                    isHoog ? "bg-coral-50 text-coral-600" : "bg-brand-50 text-brand-700"
                  }`}>
                    {risicoNiveau}
                  </span>
                </div>
                {r.occurrenceDateTime && (
                  <p className="text-caption text-fg-subtle mt-1">
                    Uitgevoerd op {new Date(r.occurrenceDateTime).toLocaleDateString("nl-NL")}
                  </p>
                )}
                {r.note?.[0]?.text && <p className="text-sm text-fg-muted mt-1">{r.note[0].text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="my-2 text-sm text-coral-600">{msg}</p>;
}
