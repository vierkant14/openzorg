"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

/* ---------- Types ---------- */

interface ValidationRule {
  id: string;
  resourceType: string;
  fieldPath: string;
  operator: string;
  value: string | number | boolean | string[];
  errorMessage: string;
  layer: string;
}

/* ---------- Constants ---------- */

const RESOURCE_TYPES = [
  { value: "Patient", label: "Client" },
  { value: "RelatedPerson", label: "Contactpersoon" },
  { value: "MedicationRequest", label: "Medicatie" },
  { value: "Immunization", label: "Vaccinatie" },
  { value: "Condition", label: "Diagnose" },
  { value: "CarePlan", label: "Zorgplan" },
  { value: "Observation", label: "Rapportage" },
  { value: "Appointment", label: "Afspraak" },
];

const FIELD_PATHS: Record<string, Array<{ value: string; label: string }>> = {
  Patient: [
    { value: "name[0].family", label: "Achternaam" },
    { value: "name[0].given[0]", label: "Voornaam" },
    { value: "birthDate", label: "Geboortedatum" },
    { value: "gender", label: "Geslacht" },
    { value: "telecom[0].value", label: "Telefoon" },
    { value: "address[0].postalCode", label: "Postcode" },
    { value: "address[0].city", label: "Woonplaats" },
  ],
  RelatedPerson: [
    { value: "name[0].family", label: "Achternaam" },
    { value: "name[0].given[0]", label: "Voornaam" },
    { value: "telecom[0].value", label: "Telefoon" },
  ],
  MedicationRequest: [
    { value: "medicationCodeableConcept.text", label: "Medicatienaam" },
    { value: "dosageInstruction[0].text", label: "Dosering" },
  ],
  Immunization: [
    { value: "vaccineCode.text", label: "Vaccin" },
    { value: "occurrenceDateTime", label: "Datum" },
  ],
  Condition: [
    { value: "code.text", label: "Diagnose" },
  ],
  CarePlan: [
    { value: "title", label: "Titel" },
  ],
  Observation: [
    { value: "valueString", label: "Tekst" },
  ],
  Appointment: [
    { value: "start", label: "Starttijd" },
    { value: "end", label: "Eindtijd" },
  ],
};

const OPERATORS = [
  { value: "required", label: "Verplicht", needsValue: false },
  { value: "minLength", label: "Minimum lengte", needsValue: true },
  { value: "maxLength", label: "Maximum lengte", needsValue: true },
  { value: "pattern", label: "Patroon (regex)", needsValue: true },
];

/* ---------- Page ---------- */

export default function ValidatiePage() {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [resourceType, setResourceType] = useState("Patient");
  const [fieldPath, setFieldPath] = useState("");
  const [operator, setOperator] = useState("required");
  const [ruleValue, setRuleValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadRules = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<{ validationRules: ValidationRule[] }>(
      "/api/admin/validation-rules",
    );
    if (err) setError(err);
    else setRules(data?.validationRules ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const selectedField = FIELD_PATHS[resourceType]?.find((f) => f.value === fieldPath);
    const selectedOp = OPERATORS.find((o) => o.value === operator);
    const defaultMsg = operator === "required"
      ? `${selectedField?.label || fieldPath} is verplicht`
      : `${selectedField?.label || fieldPath}: ${selectedOp?.label || operator} ${ruleValue}`;

    const { error: err } = await ecdFetch("/api/admin/validation-rules", {
      method: "POST",
      body: JSON.stringify({
        resourceType,
        fieldPath,
        operator,
        value: selectedOp?.needsValue ? ruleValue : true,
        errorMessage: errorMessage.trim() || defaultMsg,
      }),
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setShowForm(false);
      setFieldPath("");
      setOperator("required");
      setRuleValue("");
      setErrorMessage("");
      loadRules();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet je zeker dat je deze validatieregel wilt verwijderen?")) return;
    setDeletingId(id);
    const { error: err } = await ecdFetch(`/api/admin/validation-rules/${id}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (err) setError(err);
    else loadRules();
  }

  const inputCls = "w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-[border-color,box-shadow] duration-200 ease-out";
  const availableFields = FIELD_PATHS[resourceType] ?? [];
  const selectedOp = OPERATORS.find((o) => o.value === operator);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-fg">Validatieregels</h1>
            <p className="mt-1 text-sm text-fg-muted">
              Configureer welke velden verplicht zijn per resource type. Deze regels gelden voor alle medewerkers.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 btn-press"
          >
            {showForm ? "Annuleren" : "Regel toevoegen"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 px-4 py-3 text-sm text-coral-700 dark:text-coral-300">
            {error}
          </div>
        )}

        {/* Add rule form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-default bg-raised p-5 animate-[fade-in_300ms_cubic-bezier(0.16,1,0.3,1)]">
            <h3 className="text-base font-semibold text-fg mb-4">Nieuwe validatieregel</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Resource type</label>
                <select
                  value={resourceType}
                  onChange={(e) => { setResourceType(e.target.value); setFieldPath(""); }}
                  className={inputCls}
                >
                  {RESOURCE_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Veld</label>
                <select
                  value={fieldPath}
                  onChange={(e) => setFieldPath(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">Selecteer een veld...</option>
                  {availableFields.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Regel</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className={inputCls}
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
              {selectedOp?.needsValue && (
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Waarde</label>
                  <input
                    type="text"
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                    placeholder={operator === "pattern" ? "bijv. ^[0-9]{4}\\s?[A-Z]{2}$" : "bijv. 3"}
                    className={inputCls}
                    required
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Foutmelding <span className="text-fg-subtle">(optioneel)</span>
                </label>
                <input
                  type="text"
                  value={errorMessage}
                  onChange={(e) => setErrorMessage(e.target.value)}
                  placeholder="Automatisch gegenereerd als leeg"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                disabled={saving || !fieldPath}
                className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50 btn-press"
              >
                {saving ? "Opslaan..." : "Regel opslaan"}
              </button>
            </div>
          </form>
        )}

        {/* Rules list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-4 border-brand-300 border-t-brand-700" style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-default bg-raised p-10 text-center">
            <p className="text-fg-muted">Geen validatieregels geconfigureerd.</p>
            <p className="mt-1 text-sm text-fg-subtle">
              Voeg regels toe om velden verplicht te maken voor je medewerkers.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-default bg-raised">
            <table className="min-w-full divide-y divide-default text-sm">
              <thead className="bg-page">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-fg-muted">Resource</th>
                  <th className="px-4 py-3 text-left font-medium text-fg-muted">Veld</th>
                  <th className="px-4 py-3 text-left font-medium text-fg-muted">Regel</th>
                  <th className="px-4 py-3 text-left font-medium text-fg-muted">Foutmelding</th>
                  <th className="px-4 py-3 text-left font-medium text-fg-muted">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {rules.map((rule) => {
                  const rtLabel = RESOURCE_TYPES.find((rt) => rt.value === rule.resourceType)?.label ?? rule.resourceType;
                  const fieldLabel = FIELD_PATHS[rule.resourceType]?.find((f) => f.value === rule.fieldPath)?.label ?? rule.fieldPath;
                  const opLabel = OPERATORS.find((op) => op.value === rule.operator)?.label ?? rule.operator;
                  return (
                    <tr key={rule.id}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-lg bg-brand-50 dark:bg-brand-950/20 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
                          {rtLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-fg">{fieldLabel}</td>
                      <td className="px-4 py-3 text-fg-muted">
                        {opLabel}
                        {rule.operator !== "required" && ` (${rule.value})`}
                      </td>
                      <td className="px-4 py-3 text-fg-muted text-xs">{rule.errorMessage}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          disabled={deletingId === rule.id}
                          className="text-coral-600 hover:text-coral-800 text-xs font-medium btn-press disabled:opacity-50"
                        >
                          {deletingId === rule.id ? "..." : "Verwijderen"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Help text */}
        <div className="mt-6 rounded-xl border border-default bg-sunken p-4">
          <h3 className="text-sm font-semibold text-fg mb-2">Hoe werkt het?</h3>
          <ul className="text-sm text-fg-muted space-y-1">
            <li>Validatieregels worden gecontroleerd bij het aanmaken en bewerken van gegevens.</li>
            <li>De <strong>verplicht</strong> regel controleert of een veld is ingevuld.</li>
            <li><strong>Minimum/maximum lengte</strong> controleert de tekstlengte.</li>
            <li><strong>Patroon</strong> controleert of de invoer overeenkomt met een regex-patroon.</li>
            <li>Regels gelden voor alle medewerkers binnen deze organisatie.</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
