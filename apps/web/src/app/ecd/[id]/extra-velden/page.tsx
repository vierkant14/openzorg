"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ecdFetch } from "../../../../lib/api";

interface ClientResource {
  resourceType: "Patient";
  id?: string;
  extension?: Array<{ url?: string; valueString?: string; extension?: Array<{ url?: string; valueString?: string }> }>;
}

interface CustomFieldDef {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  extensionUrl: string;
  required?: boolean;
}

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

function ExtraVeldenInner({ clientId, client }: { clientId: string; client: ClientResource }) {
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

    const customExtensions = fieldDefs
      .filter((def) => values[def.id])
      .map((def) => ({
        url: def.extensionUrl,
        valueString: values[def.id],
      }));

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

export default function ExtraVeldenPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";
  const [client, setClient] = useState<ClientResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    ecdFetch<ClientResource>(`/api/clients/${clientId}`).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err);
      else setClient(data ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!client) return <ErrorMsg msg="Cliënt niet gevonden" />;
  return <ExtraVeldenInner clientId={clientId} client={client} />;
}
