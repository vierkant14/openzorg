"use client";

import { useEffect, useState, type FormEvent } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

/* ---------- Types ---------- */

interface CustomField {
  id: string;
  resourceType: string;
  fieldName: string;
  fieldType: string;
  options?: string[];
  active?: boolean;
  required?: boolean;
}

interface ValidationRule {
  id: string;
  resourceType: string;
  fieldPath: string;
  operator: string;
  value: string;
  errorMessage: string;
}

const RESOURCE_TYPES = ["Patient", "Practitioner", "Organization", "Observation"];
const FIELD_TYPES = ["string", "number", "boolean", "date", "codeable-concept", "dropdown", "multi-select", "textarea"];
const OPERATORS = ["required", "min", "max", "pattern", "minLength", "maxLength", "in"];

const FIELD_PATHS: Record<string, string[]> = {
  Patient: [
    "name[0].family",
    "name[0].given[0]",
    "birthDate",
    "gender",
    "identifier[0].value",
    "telecom[0].value",
    "telecom[1].value",
    "address[0].line[0]",
    "address[0].city",
    "address[0].postalCode",
    "address[0].country",
    "maritalStatus.coding[0].code",
    "communication[0].language.coding[0].code",
    "generalPractitioner[0].reference",
    "contact[0].name.text",
    "contact[0].telecom[0].value",
    "active",
  ],
  Practitioner: [
    "name[0].family",
    "name[0].given[0]",
    "identifier[0].value",
    "telecom[0].value",
    "telecom[1].value",
    "address[0].line[0]",
    "address[0].city",
    "address[0].postalCode",
    "qualification[0].code.coding[0].code",
    "qualification[0].code.text",
    "active",
  ],
  Organization: [
    "name",
    "identifier[0].value",
    "type[0].coding[0].code",
    "telecom[0].value",
    "telecom[1].value",
    "address[0].line[0]",
    "address[0].city",
    "address[0].postalCode",
    "active",
  ],
  Observation: [
    "code.coding[0].code",
    "code.text",
    "status",
    "valueString",
    "valueQuantity.value",
    "valueQuantity.unit",
    "effectiveDateTime",
    "category[0].coding[0].code",
    "interpretation[0].coding[0].code",
    "note[0].text",
  ],
};

/* ---------- Page ---------- */

export default function ConfiguratiePage() {
  /* ---- Custom velden state ---- */
  const [fields, setFields] = useState<CustomField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const [newFieldResource, setNewFieldResource] = useState("Patient");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("string");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [fieldSaving, setFieldSaving] = useState(false);

  /* ---- Validatieregels state ---- */
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [newRuleResource, setNewRuleResource] = useState("Patient");
  const [newRuleFieldPath, setNewRuleFieldPath] = useState("");
  const [newRuleOperator, setNewRuleOperator] = useState("required");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [newRuleErrorMsg, setNewRuleErrorMsg] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);

  /* ---- Load data ---- */

  async function loadFields() {
    setFieldsLoading(true);
    const { data, error } = await ecdFetch<{ customFields: CustomField[] }>("/api/admin/custom-fields");
    setFields(data?.customFields ?? []);
    setFieldsError(error);
    setFieldsLoading(false);
  }

  async function loadRules() {
    setRulesLoading(true);
    const { data, error } = await ecdFetch<{ validationRules: ValidationRule[] }>("/api/admin/validation-rules");
    setRules(data?.validationRules ?? []);
    setRulesError(error);
    setRulesLoading(false);
  }

  useEffect(() => {
    loadFields();
    loadRules();
  }, []);

  /* ---- Actions ---- */

  async function handleAddField(e: FormEvent) {
    e.preventDefault();
    setFieldsError(null);
    setFieldSaving(true);

    const options =
      (newFieldType === "dropdown" || newFieldType === "multi-select") && newFieldOptions.trim()
        ? newFieldOptions.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined;

    const { error } = await ecdFetch<CustomField>("/api/admin/custom-fields", {
      method: "POST",
      body: JSON.stringify({
        resourceType: newFieldResource,
        fieldName: newFieldName,
        fieldType: newFieldType,
        required: newFieldRequired,
        options,
      }),
    });

    setFieldSaving(false);
    if (error) {
      setFieldsError(error);
      return;
    }

    setNewFieldName("");
    setNewFieldOptions("");
    setNewFieldRequired(false);
    await loadFields();
  }

  async function handleToggleField(id: string, currentActive: boolean) {
    const { error } = await ecdFetch(`/api/admin/custom-fields/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !currentActive }),
    });
    if (error) {
      setFieldsError(error);
      return;
    }
    await loadFields();
  }

  async function handleDeleteField(id: string) {
    const { error } = await ecdFetch(`/api/admin/custom-fields/${id}`, {
      method: "DELETE",
    });
    if (error) {
      setFieldsError(error);
      return;
    }
    await loadFields();
  }

  async function handleAddRule(e: FormEvent) {
    e.preventDefault();
    setRulesError(null);
    setRuleSaving(true);

    const { error } = await ecdFetch<ValidationRule>("/api/admin/validation-rules", {
      method: "POST",
      body: JSON.stringify({
        resourceType: newRuleResource,
        fieldPath: newRuleFieldPath,
        operator: newRuleOperator,
        value: newRuleValue,
        errorMessage: newRuleErrorMsg,
      }),
    });

    setRuleSaving(false);
    if (error) {
      setRulesError(error);
      return;
    }

    setNewRuleFieldPath("");
    setNewRuleValue("");
    setNewRuleErrorMsg("");
    await loadRules();
  }

  async function handleDeleteRule(id: string) {
    const { error } = await ecdFetch(`/api/admin/validation-rules/${id}`, {
      method: "DELETE",
    });
    if (error) {
      setRulesError(error);
      return;
    }
    await loadRules();
  }

  /* ---- Shared styles ---- */

  const inputClass =
    "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
  const selectClass = inputClass;
  const btnPrimary =
    "px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50";
  const btnDelete =
    "text-sm text-coral-600 hover:text-red-800 font-medium";

  /* ---- Render ---- */

  return (
    <AppShell>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        <a
          href="/dashboard"
          className="inline-flex items-center text-sm text-brand-700 hover:text-brand-900"
        >
          &larr; Terug
        </a>

        <h2 className="text-2xl font-bold text-fg">Configuratie</h2>

        {/* ============ CUSTOM VELDEN ============ */}
        <section className="bg-raised rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            Custom velden
          </h3>

          {fieldsError && (
            <div className="mb-4 p-3 bg-coral-50 border border-coral-200 rounded text-coral-600 text-sm">
              {fieldsError}
            </div>
          )}

          {/* Existing fields */}
          {fieldsLoading ? (
            <p className="text-sm text-fg-subtle mb-4">Laden...</p>
          ) : fields.length === 0 ? (
            <p className="text-sm text-fg-subtle mb-4">
              Nog geen custom velden aangemaakt.
            </p>
          ) : (
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-fg-subtle">
                    <th className="pb-2 pr-4 font-medium">Resource</th>
                    <th className="pb-2 pr-4 font-medium">Veldnaam</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Opties</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f) => {
                    const isActive = f.active !== false;
                    return (
                      <tr
                        key={f.id}
                        className={`border-b last:border-0 ${!isActive ? "opacity-50" : ""}`}
                      >
                        <td className="py-2 pr-4">{f.resourceType}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {f.fieldName}
                        </td>
                        <td className="py-2 pr-4">{f.fieldType}</td>
                        <td className="py-2 pr-4 text-xs text-fg-subtle">
                          {f.options && f.options.length > 0
                            ? f.options.join(", ")
                            : (<span className="text-gray-300">&mdash;</span>)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              isActive
                                ? "bg-brand-50 text-brand-700"
                                : "bg-gray-100 text-fg-subtle"
                            }`}
                          >
                            {isActive ? "Actief" : "Inactief"}
                          </span>
                        </td>
                        <td className="py-2 text-right space-x-3">
                          <button
                            onClick={() => handleToggleField(f.id, isActive)}
                            className="text-sm text-brand-700 hover:text-brand-900 font-medium"
                          >
                            {isActive ? "Uitzetten" : "Aanzetten"}
                          </button>
                          <button
                            onClick={() => handleDeleteField(f.id)}
                            className={btnDelete}
                          >
                            Verwijderen
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add form */}
          <form onSubmit={handleAddField} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Resourcetype
                </label>
                <select
                  value={newFieldResource}
                  onChange={(e) => setNewFieldResource(e.target.value)}
                  className={selectClass}
                >
                  {RESOURCE_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Veldnaam
                </label>
                <input
                  type="text"
                  required
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="bijv. bloedgroep"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Veldtype
                </label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  className={selectClass}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-fg-muted pb-2">
                  <input
                    type="checkbox"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                    className="rounded border-default"
                  />
                  Verplicht
                </label>
              </div>
            </div>

            {/* Options row — only visible for dropdown / multi-select */}
            {(newFieldType === "dropdown" || newFieldType === "multi-select") && (
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Opties (kommagescheiden)
                </label>
                <input
                  type="text"
                  required
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder="bijv. Klein, Middel, Groot"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-fg-subtle">
                  Voer de beschikbare keuzes in, gescheiden door komma&apos;s.
                </p>
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={fieldSaving}
                className={btnPrimary}
              >
                {fieldSaving ? "Toevoegen..." : "Veld toevoegen"}
              </button>
            </div>
          </form>
        </section>

        {/* ============ VALIDATIEREGELS ============ */}
        <section className="bg-raised rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            Validatieregels
          </h3>

          {rulesError && (
            <div className="mb-4 p-3 bg-coral-50 border border-coral-200 rounded text-coral-600 text-sm">
              {rulesError}
            </div>
          )}

          {/* Existing rules */}
          {rulesLoading ? (
            <p className="text-sm text-fg-subtle mb-4">Laden...</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-fg-subtle mb-4">
              Nog geen validatieregels aangemaakt.
            </p>
          ) : (
            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-fg-subtle">
                    <th className="pb-2 pr-4 font-medium">Resource</th>
                    <th className="pb-2 pr-4 font-medium">Veldpad</th>
                    <th className="pb-2 pr-4 font-medium">Operator</th>
                    <th className="pb-2 pr-4 font-medium">Waarde</th>
                    <th className="pb-2 pr-4 font-medium">Foutmelding</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{r.resourceType}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {r.fieldPath}
                      </td>
                      <td className="py-2 pr-4">{r.operator}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {r.value}
                      </td>
                      <td className="py-2 pr-4 text-xs text-fg-subtle">
                        {r.errorMessage}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDeleteRule(r.id)}
                          className={btnDelete}
                        >
                          Verwijderen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add form */}
          <form onSubmit={handleAddRule} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Resourcetype
                </label>
                <select
                  value={newRuleResource}
                  onChange={(e) => {
                    setNewRuleResource(e.target.value);
                    setNewRuleFieldPath("");
                  }}
                  className={selectClass}
                >
                  {RESOURCE_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Veldpad
                </label>
                <select
                  required
                  value={newRuleFieldPath}
                  onChange={(e) => setNewRuleFieldPath(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecteer een veldpad...</option>
                  {(FIELD_PATHS[newRuleResource] ?? []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Operator
                </label>
                <select
                  value={newRuleOperator}
                  onChange={(e) => setNewRuleOperator(e.target.value)}
                  className={selectClass}
                >
                  {OPERATORS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Waarde
                </label>
                <input
                  type="text"
                  value={newRuleValue}
                  onChange={(e) => setNewRuleValue(e.target.value)}
                  placeholder="bijv. 9"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Foutmelding
                </label>
                <input
                  type="text"
                  required
                  value={newRuleErrorMsg}
                  onChange={(e) => setNewRuleErrorMsg(e.target.value)}
                  placeholder="bijv. BSN moet 9 cijfers bevatten"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={ruleSaving}
                className={btnPrimary}
              >
                {ruleSaving ? "Toevoegen..." : "Regel toevoegen"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </AppShell>
  );
}
