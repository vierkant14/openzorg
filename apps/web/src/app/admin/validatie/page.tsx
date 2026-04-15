"use client";

import { VALIDATABLE_FIELDS, RESOURCE_TYPES } from "@openzorg/shared-config";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

interface ValidationRule {
  id?: string;
  resourceType: string;
  fieldPath: string;
  operator: "required" | "min" | "max" | "range" | "pattern" | "in" | "minLength" | "maxLength";
  value: string | number | boolean | string[] | [number, number];
  errorMessage: string;
  active?: boolean;
}

const OPERATORS: Array<{ slug: ValidationRule["operator"]; label: string; valueType: "none" | "number" | "string" | "array" | "range" }> = [
  { slug: "required", label: "Verplicht", valueType: "none" },
  { slug: "min", label: "Minimaal", valueType: "number" },
  { slug: "max", label: "Maximaal", valueType: "number" },
  { slug: "range", label: "Bereik", valueType: "range" },
  { slug: "minLength", label: "Min. lengte", valueType: "number" },
  { slug: "maxLength", label: "Max. lengte", valueType: "number" },
  { slug: "pattern", label: "Regex", valueType: "string" },
  { slug: "in", label: "Toegestaan", valueType: "array" },
];

function formatValue(rule: ValidationRule): string {
  if (rule.operator === "required") return "—";
  if (Array.isArray(rule.value)) return rule.value.join(", ");
  return String(rule.value);
}

/**
 * Voorbeeld-resources per type. Verwacht door de UI als startwaarde
 * voor het 'Test deze regel'-venster, zodat de gebruiker direct iets
 * zinnigs heeft om tegen te testen. Wisselt mee bij veld-selectie.
 */
const EXAMPLE_RESOURCES: Record<string, Record<string, unknown>> = {
  Patient: {
    resourceType: "Patient",
    name: [{ family: "Jansen", given: ["Jan"] }],
    birthDate: "1940-05-12",
    gender: "male",
    telecom: [{ system: "phone", value: "06-12345678" }],
    address: [{ line: ["Kerkstraat 1"], postalCode: "1234 AB", city: "Amsterdam" }],
  },
  Observation: {
    resourceType: "Observation",
    status: "final",
    code: { text: "Gewicht" },
    valueQuantity: { value: 75, unit: "kg" },
    effectiveDateTime: "2026-04-15T10:00:00Z",
  },
  MedicationRequest: {
    resourceType: "MedicationRequest",
    status: "active",
    medicationCodeableConcept: { text: "Paracetamol 500mg" },
    dosageInstruction: [{ text: "3x per dag 1 tablet" }],
    authoredOn: "2026-04-15",
  },
  Condition: {
    resourceType: "Condition",
    code: { text: "Diabetes type 2" },
    onsetDateTime: "2020-03-15",
    clinicalStatus: { coding: [{ code: "active" }] },
    severity: { coding: [{ display: "moderate" }] },
  },
  AllergyIntolerance: {
    resourceType: "AllergyIntolerance",
    code: { text: "Penicilline" },
    criticality: "high",
    category: ["medication"],
  },
  Flag: {
    resourceType: "Flag",
    status: "active",
    code: { text: "Valrisico hoog" },
    category: [{ coding: [{ code: "valrisico" }] }],
    extension: [{ url: "https://openzorg.nl/extensions/signalering-ernst", valueString: "hoog" }],
  },
  Practitioner: {
    resourceType: "Practitioner",
    active: true,
    name: [{ family: "de Vries", given: ["Jan"] }],
    qualification: [{ code: { text: "Wijkverpleegkundige" } }],
  },
};

export default function ValidatiePage() {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Edit state (also used for new)
  const [editResourceType, setEditResourceType] = useState<string>("Patient");
  const [editFieldPath, setEditFieldPath] = useState<string>("");
  const [editOperator, setEditOperator] = useState<ValidationRule["operator"]>("required");
  const [editValue, setEditValue] = useState<string>("");
  const [editValueMin, setEditValueMin] = useState<string>("");
  const [editValueMax, setEditValueMax] = useState<string>("");
  const [editMessage, setEditMessage] = useState<string>("");
  const [editActive, setEditActive] = useState<boolean>(true);

  // Test runner
  const [testResourceJson, setTestResourceJson] = useState<string>(
    JSON.stringify(EXAMPLE_RESOURCES.Patient, null, 2),
  );
  const [testResourceDirty, setTestResourceDirty] = useState(false);
  const [testResult, setTestResult] = useState<{ pass: boolean; failMessage?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await ecdFetch<{ rules: ValidationRule[] }>("/api/admin/validation-rules");
    setRules(data?.rules ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = rules.find((r) => r.id === selectedRuleId) ?? null;
  const fieldsForType = VALIDATABLE_FIELDS[editResourceType] ?? [];
  const operatorDef = OPERATORS.find((op) => op.slug === editOperator);

  useEffect(() => {
    if (selected) {
      setEditResourceType(selected.resourceType);
      setEditFieldPath(selected.fieldPath);
      setEditOperator(selected.operator);
      setEditMessage(selected.errorMessage);
      setEditActive(selected.active ?? true);
      if (Array.isArray(selected.value) && selected.value.length === 2 && typeof selected.value[0] === "number") {
        setEditValueMin(String(selected.value[0]));
        setEditValueMax(String(selected.value[1]));
      } else if (Array.isArray(selected.value)) {
        setEditValue(selected.value.join(", "));
      } else {
        setEditValue(String(selected.value ?? ""));
      }
    }
  }, [selected]);

  /**
   * Wanneer resource-type of veld wijzigt, ververs de test-JSON met een
   * passend voorbeeld — tenzij de gebruiker het al handmatig heeft bewerkt.
   * Het voorbeeld krijgt ook de fieldPath-gerelateerde waarde gepopuleerd
   * zodat testen meteen werkt.
   */
  useEffect(() => {
    if (testResourceDirty) return;
    const example = EXAMPLE_RESOURCES[editResourceType];
    if (example) {
      setTestResourceJson(JSON.stringify(example, null, 2));
      setTestResult(null);
    }
  }, [editResourceType, testResourceDirty]);

  function buildValue(): ValidationRule["value"] {
    if (!operatorDef) return "";
    switch (operatorDef.valueType) {
      case "none": return true;
      case "number": return parseFloat(editValue) || 0;
      case "array": return editValue.split(",").map((s) => s.trim()).filter(Boolean);
      case "range": return [parseFloat(editValueMin) || 0, parseFloat(editValueMax) || 0];
      default: return editValue;
    }
  }

  function buildRule(): ValidationRule {
    return {
      resourceType: editResourceType,
      fieldPath: editFieldPath,
      operator: editOperator,
      value: buildValue(),
      errorMessage: editMessage,
      active: editActive,
    };
  }

  async function saveRule() {
    const rule = buildRule();
    const url = showNew ? "/api/admin/validation-rules" : `/api/admin/validation-rules/${selected?.id}`;
    const method = showNew ? "POST" : "PUT";
    const { error } = await ecdFetch(url, { method, body: JSON.stringify(rule) });
    if (error) {
      setStatus({ ok: false, text: `Opslaan mislukt: ${error}` });
    } else {
      setStatus({ ok: true, text: "Opgeslagen" });
      setShowNew(false);
      setTestResult(null);
      await load();
      setTimeout(() => setStatus(null), 2500);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Regel verwijderen?")) return;
    const { error } = await ecdFetch(`/api/admin/validation-rules/${id}`, { method: "DELETE" });
    if (error) {
      setStatus({ ok: false, text: error });
    } else {
      setSelectedRuleId(null);
      load();
    }
  }

  async function testRule() {
    let resource: Record<string, unknown>;
    try {
      resource = JSON.parse(testResourceJson);
    } catch {
      setStatus({ ok: false, text: "Ongeldige JSON in voorbeeld-resource" });
      return;
    }
    const { data, error } = await ecdFetch<{ pass: boolean; failMessage?: string }>(
      "/api/admin/validation-rules/test",
      {
        method: "POST",
        body: JSON.stringify({ rule: buildRule(), resource }),
      },
    );
    if (error) {
      setStatus({ ok: false, text: error });
    } else if (data) {
      setTestResult(data);
    }
  }

  function startNew() {
    setShowNew(true);
    setSelectedRuleId(null);
    setEditResourceType("Patient");
    setEditFieldPath("");
    setEditOperator("required");
    setEditValue("");
    setEditValueMin("");
    setEditValueMax("");
    setEditMessage("");
    setEditActive(true);
    setTestResult(null);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">Validatieregels</h1>
            <p className="mt-1 text-sm text-fg-muted">
              Laag 2 — definieer extra validaties die bovenop de kern-validatie draaien.
              Kern-velden (BSN, AGB) zijn gelocked.
            </p>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            + Nieuwe regel
          </button>
        </div>

        {status && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              status.ok
                ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-300"
                : "border-coral-200 bg-coral-50 text-coral-700 dark:border-coral-800 dark:bg-coral-950/20 dark:text-coral-300"
            }`}
          >
            {status.text}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-fg-muted">Laden...</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            {/* Rules list */}
            <aside className="rounded-xl border border-default bg-raised p-2">
              {rules.length === 0 ? (
                <p className="p-4 text-xs text-fg-subtle">Nog geen regels. Klik "+ Nieuwe regel" om te beginnen.</p>
              ) : (
                rules.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => { setSelectedRuleId(rule.id ?? null); setShowNew(false); }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedRuleId === rule.id && !showNew
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300"
                        : "text-fg-muted hover:bg-sunken"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{rule.resourceType}.{rule.fieldPath}</span>
                      {rule.active === false && (
                        <span className="text-xs text-fg-subtle">uit</span>
                      )}
                    </div>
                    <div className="text-xs text-fg-subtle">
                      {OPERATORS.find((op) => op.slug === rule.operator)?.label ?? rule.operator}
                      {" · "}
                      {formatValue(rule)}
                    </div>
                  </button>
                ))
              )}
            </aside>

            {/* Editor */}
            <div className="rounded-xl border border-default bg-raised p-6">
              {!selected && !showNew ? (
                <p className="text-sm text-fg-muted">Kies links een regel of klik "+ Nieuwe regel".</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <h2 className="text-lg font-semibold text-fg">
                      {showNew ? "Nieuwe regel" : "Regel bewerken"}
                    </h2>
                    {!showNew && selected?.id && (
                      <button
                        type="button"
                        onClick={() => deleteRule(selected.id!)}
                        className="text-sm text-coral-600 hover:text-coral-800"
                      >
                        Verwijderen
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Resource-type</label>
                      <select
                        value={editResourceType}
                        onChange={(e) => { setEditResourceType(e.target.value); setEditFieldPath(""); }}
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                      >
                        {RESOURCE_TYPES.map((rt) => (
                          <option key={rt} value={rt}>{rt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Veld</label>
                      <select
                        value={editFieldPath}
                        onChange={(e) => setEditFieldPath(e.target.value)}
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                      >
                        <option value="">— kies veld —</option>
                        {fieldsForType.filter((f) => !f.locked).map((f) => (
                          <option key={f.path} value={f.path}>{f.label}</option>
                        ))}
                      </select>
                      {fieldsForType.some((f) => f.locked) && (
                        <p className="mt-1 text-xs text-fg-subtle">
                          🔒 Kern-velden staan in kern-validatie en kun je niet overschrijven.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-fg-muted">Operator</label>
                    <select
                      value={editOperator}
                      onChange={(e) => setEditOperator(e.target.value as ValidationRule["operator"])}
                      className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.slug} value={op.slug}>{op.label}</option>
                      ))}
                    </select>
                  </div>

                  {operatorDef?.valueType === "number" && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Waarde (getal)</label>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                      />
                    </div>
                  )}

                  {operatorDef?.valueType === "string" && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Patroon (regex)</label>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="^[0-9]{4} [A-Z]{2}$"
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 font-mono text-xs text-fg"
                      />
                    </div>
                  )}

                  {operatorDef?.valueType === "array" && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-fg-muted">Toegestane waarden (comma-separated)</label>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="male, female, other"
                        className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                      />
                    </div>
                  )}

                  {operatorDef?.valueType === "range" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-fg-muted">Min</label>
                        <input
                          type="number"
                          value={editValueMin}
                          onChange={(e) => setEditValueMin(e.target.value)}
                          className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-fg-muted">Max</label>
                        <input
                          type="number"
                          value={editValueMax}
                          onChange={(e) => setEditValueMax(e.target.value)}
                          className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-fg-muted">Foutbericht</label>
                    <input
                      type="text"
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      placeholder="bv. Gewicht moet tussen 1 en 300 kg zijn"
                      className="w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm text-fg-muted">
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                      />
                      Regel is actief
                    </label>
                  </div>

                  {/* Test runner */}
                  <div className="rounded-lg border border-default bg-page p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-fg">Test deze regel</h3>
                      <div className="flex items-center gap-2 text-xs">
                        {testResourceDirty && (
                          <span className="text-fg-subtle">handmatig aangepast</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setTestResourceDirty(false);
                            const example = EXAMPLE_RESOURCES[editResourceType];
                            if (example) {
                              setTestResourceJson(JSON.stringify(example, null, 2));
                              setTestResult(null);
                            }
                          }}
                          className="text-brand-600 hover:underline"
                        >
                          🔄 Voorbeeld voor {editResourceType}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={testResourceJson}
                      onChange={(e) => {
                        setTestResourceJson(e.target.value);
                        setTestResourceDirty(true);
                      }}
                      rows={8}
                      className="w-full rounded-md border border-default bg-raised px-2 py-1 font-mono text-xs text-fg"
                    />
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={testRule}
                        className="rounded-lg border border-default px-3 py-1 text-xs font-medium text-fg-muted hover:bg-sunken"
                      >
                        ▶ Run test
                      </button>
                      {testResult && (
                        <span
                          className={`text-xs font-medium ${
                            testResult.pass ? "text-brand-600" : "text-coral-600"
                          }`}
                        >
                          {testResult.pass
                            ? "✅ Regel slaagt"
                            : `❌ Faalt: ${testResult.failMessage ?? "(geen bericht)"}`}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-fg-subtle">
                      Tip: test slaagt alleen als het veld in de resource daadwerkelijk bestaat.
                      Pas de JSON aan om verschillende scenario&apos;s door te spelen.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    {showNew && (
                      <button
                        type="button"
                        onClick={() => setShowNew(false)}
                        className="text-sm text-fg-muted hover:text-fg"
                      >
                        Annuleren
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveRule}
                      disabled={!editFieldPath || !editMessage}
                      className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
                    >
                      {showNew ? "Regel aanmaken" : "Wijzigingen opslaan"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
