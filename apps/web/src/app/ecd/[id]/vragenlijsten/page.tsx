"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ecdFetch } from "../../../../lib/api";

/* -------------------------------------------------------------------------- */
/*  Gededupliceerd van monolith tijdens Plan 2A Task 4 migratie               */
/* -------------------------------------------------------------------------- */

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="my-2 text-sm text-coral-600">{msg}</p>;
}


function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
    </div>
  );
}


function VragenlijstForm({
  clientId,
  templates,
  selectedTemplate,
  setSelectedTemplate,
  onSaved,
}: {
  clientId: string;
  templates: FhirQuestionnaire[];
  selectedTemplate: FhirQuestionnaire | null;
  setSelectedTemplate: (t: FhirQuestionnaire | null) => void;
  onSaved: () => void;
}) {
  const [antwoorden, setAntwoorden] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullTemplate, setFullTemplate] = useState<{
    item?: Array<{ linkId: string; text?: string; type?: string }>;
  } | null>(null);

  useEffect(() => {
    if (!selectedTemplate?.id) { setFullTemplate(null); return; }
    ecdFetch<{ item?: Array<{ linkId: string; text?: string; type?: string }> }>(
      `/api/vragenlijsten/${selectedTemplate.id}`,
    ).then(({ data }) => setFullTemplate(data));
  }, [selectedTemplate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate?.id) return;
    setSaving(true);
    setError(null);
    const { error: err } = await ecdFetch(`/api/clients/${clientId}/vragenlijsten`, {
      method: "POST",
      body: JSON.stringify({
        questionnaireId: selectedTemplate.id,
        antwoorden: Object.entries(antwoorden).map(([linkId, answer]) => ({ linkId, answer })),
      }),
    });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }

  const inputCls = "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-page text-fg";

  return (
    <form onSubmit={handleSubmit} className="mb-5 rounded-lg border border-default bg-raised p-5 shadow-sm">
      <h3 className="mb-4 font-semibold text-fg">Vragenlijst invullen</h3>
      {error && <ErrorMsg msg={error} />}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-fg-muted">Vragenlijst *</label>
        <select
          value={selectedTemplate?.id ?? ""}
          onChange={(e) => {
            const t = templates.find((t) => t.id === e.target.value) ?? null;
            setSelectedTemplate(t);
            setAntwoorden({});
          }}
          className={inputCls}
          required
        >
          <option value="">— Kies een vragenlijst —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id ?? ""}>{t.title}</option>
          ))}
        </select>
      </div>

      {fullTemplate?.item && (
        <div className="grid gap-3">
          {fullTemplate.item.map((item) => (
            <div key={item.linkId}>
              <label className="mb-1 block text-sm font-medium text-fg-muted">{item.text ?? item.linkId}</label>
              <input
                type={item.type === "integer" || item.type === "decimal" ? "number" : "text"}
                value={antwoorden[item.linkId] ?? ""}
                onChange={(e) => setAntwoorden((v) => ({ ...v, [item.linkId]: e.target.value }))}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={saving || !selectedTemplate} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50">
          {saving ? "Opslaan..." : "Vragenlijst opslaan"}
        </button>
      </div>
    </form>
  );
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


interface FhirQuestionnaire {
  id?: string;
  title?: string;
  description?: string;
  code?: Array<{ code?: string }>;
  status?: string;
}

interface FhirQuestionnaireResponse {
  id?: string;
  questionnaire?: string;
  status?: string;
  authored?: string;
  item?: Array<{ linkId?: string; text?: string; answer?: Array<{ valueString?: string; valueDecimal?: number; valueBoolean?: boolean }> }>;
}

function VragenlijstenTab({ clientId }: { clientId: string }) {
  const [responses, setResponses] = useState<FhirQuestionnaireResponse[]>([]);
  const [templates, setTemplates] = useState<FhirQuestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FhirQuestionnaire | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<{ entry?: Array<{ resource: FhirQuestionnaireResponse }> }>(
      `/api/clients/${clientId}/vragenlijsten`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setResponses(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
    ecdFetch<{ entry?: Array<{ resource: FhirQuestionnaire }> }>("/api/vragenlijsten").then(
      ({ data }) => setTemplates(data?.entry?.map((e) => e.resource) ?? []),
    );
  }, [clientId, load]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Vragenlijsten</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Invullen"}
        </button>
      </div>

      {showForm && (
        <VragenlijstForm
          clientId={clientId}
          templates={templates}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          onSaved={() => { setShowForm(false); setSelectedTemplate(null); load(); }}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && responses.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Nog geen vragenlijsten ingevuld.</p>
      )}

      <ul className="space-y-3">
        {responses.map((r, i) => {
          const qId = r.questionnaire?.replace("Questionnaire/", "");
          const template = templates.find((t) => t.id === qId);
          return (
            <li key={r.id ?? i} className="rounded-lg border border-default bg-raised p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-fg">
                  {template?.title ?? r.questionnaire ?? "Vragenlijst"}
                </p>
                <span className="text-xs text-fg-subtle">{formatDateTime(r.authored)}</span>
              </div>
              {r.item && r.item.length > 0 && (
                <dl className="mt-2 grid gap-1 text-sm">
                  {r.item.slice(0, 3).map((item, j) => (
                    <div key={j} className="flex gap-2">
                      <dt className="text-fg-subtle shrink-0">{item.text ?? item.linkId}:</dt>
                      <dd className="text-fg">
                        {item.answer?.[0]?.valueString ??
                          String(item.answer?.[0]?.valueDecimal ?? item.answer?.[0]?.valueBoolean ?? "-")}
                      </dd>
                    </div>
                  ))}
                  {r.item.length > 3 && (
                    <p className="text-xs text-fg-subtle">+{r.item.length - 3} meer vragen</p>
                  )}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}


interface FhirQuestionnaireResponse {
  id?: string;
  questionnaire?: string;
  status?: string;
  authored?: string;
  item?: Array<{ linkId?: string; text?: string; answer?: Array<{ valueString?: string; valueDecimal?: number; valueBoolean?: boolean }> }>;
}

function VragenlijstenTab({ clientId }: { clientId: string }) {
  const [responses, setResponses] = useState<FhirQuestionnaireResponse[]>([]);
  const [templates, setTemplates] = useState<FhirQuestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FhirQuestionnaire | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<{ entry?: Array<{ resource: FhirQuestionnaireResponse }> }>(
      `/api/clients/${clientId}/vragenlijsten`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setResponses(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
    ecdFetch<{ entry?: Array<{ resource: FhirQuestionnaire }> }>("/api/vragenlijsten").then(
      ({ data }) => setTemplates(data?.entry?.map((e) => e.resource) ?? []),
    );
  }, [clientId, load]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Vragenlijsten</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Invullen"}
        </button>
      </div>

      {showForm && (
        <VragenlijstForm
          clientId={clientId}
          templates={templates}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          onSaved={() => { setShowForm(false); setSelectedTemplate(null); load(); }}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && responses.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Nog geen vragenlijsten ingevuld.</p>
      )}

      <ul className="space-y-3">
        {responses.map((r, i) => {
          const qId = r.questionnaire?.replace("Questionnaire/", "");
          const template = templates.find((t) => t.id === qId);
          return (
            <li key={r.id ?? i} className="rounded-lg border border-default bg-raised p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-fg">
                  {template?.title ?? r.questionnaire ?? "Vragenlijst"}
                </p>
                <span className="text-xs text-fg-subtle">{formatDateTime(r.authored)}</span>
              </div>
              {r.item && r.item.length > 0 && (
                <dl className="mt-2 grid gap-1 text-sm">
                  {r.item.slice(0, 3).map((item, j) => (
                    <div key={j} className="flex gap-2">
                      <dt className="text-fg-subtle shrink-0">{item.text ?? item.linkId}:</dt>
                      <dd className="text-fg">
                        {item.answer?.[0]?.valueString ??
                          String(item.answer?.[0]?.valueDecimal ?? item.answer?.[0]?.valueBoolean ?? "-")}
                      </dd>
                    </div>
                  ))}
                  {r.item.length > 3 && (
                    <p className="text-xs text-fg-subtle">+{r.item.length - 3} meer vragen</p>
                  )}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}


/* -------------------------------------------------------------------------- */
/*  Tab content                                                               */
/* -------------------------------------------------------------------------- */

function VragenlijstenTabInner({ clientId }: { clientId: string }) {
  const [responses, setResponses] = useState<FhirQuestionnaireResponse[]>([]);
  const [templates, setTemplates] = useState<FhirQuestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FhirQuestionnaire | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<{ entry?: Array<{ resource: FhirQuestionnaireResponse }> }>(
      `/api/clients/${clientId}/vragenlijsten`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setResponses(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
    ecdFetch<{ entry?: Array<{ resource: FhirQuestionnaire }> }>("/api/vragenlijsten").then(
      ({ data }) => setTemplates(data?.entry?.map((e) => e.resource) ?? []),
    );
  }, [clientId, load]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Vragenlijsten</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Invullen"}
        </button>
      </div>

      {showForm && (
        <VragenlijstForm
          clientId={clientId}
          templates={templates}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          onSaved={() => { setShowForm(false); setSelectedTemplate(null); load(); }}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && responses.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Nog geen vragenlijsten ingevuld.</p>
      )}

      <ul className="space-y-3">
        {responses.map((r, i) => {
          const qId = r.questionnaire?.replace("Questionnaire/", "");
          const template = templates.find((t) => t.id === qId);
          return (
            <li key={r.id ?? i} className="rounded-lg border border-default bg-raised p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-fg">
                  {template?.title ?? r.questionnaire ?? "Vragenlijst"}
                </p>
                <span className="text-xs text-fg-subtle">{formatDateTime(r.authored)}</span>
              </div>
              {r.item && r.item.length > 0 && (
                <dl className="mt-2 grid gap-1 text-sm">
                  {r.item.slice(0, 3).map((item, j) => (
                    <div key={j} className="flex gap-2">
                      <dt className="text-fg-subtle shrink-0">{item.text ?? item.linkId}:</dt>
                      <dd className="text-fg">
                        {item.answer?.[0]?.valueString ??
                          String(item.answer?.[0]?.valueDecimal ?? item.answer?.[0]?.valueBoolean ?? "-")}
                      </dd>
                    </div>
                  ))}
                  {r.item.length > 3 && (
                    <p className="text-xs text-fg-subtle">+{r.item.length - 3} meer vragen</p>
                  )}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}


export default function VragenlijstenPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";
  return <VragenlijstenTabInner clientId={clientId} />;
}

