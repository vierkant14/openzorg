"use client";

import { useId, useState, type FormEvent } from "react";

import { ecdFetch } from "../../../../lib/api";

import { RESOURCE_TYPES, type ValidationRule } from "./types";

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

const inputClass =
  "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
const selectClass = inputClass;
const btnPrimary =
  "px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50";

interface RegelEditorProps {
  /** Wordt aangeroepen nadat een regel succesvol is opgeslagen. */
  onToegevoegd: () => void;
}

/** Formulier voor het toevoegen van een validatieregel per resourcetype. */
export function RegelEditor({ onToegevoegd }: RegelEditorProps) {
  const [resource, setResource] = useState("Patient");
  const [veldpad, setVeldpad] = useState("");
  const [operator, setOperator] = useState("required");
  const [waarde, setWaarde] = useState("");
  const [foutmelding, setFoutmelding] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const baseId = useId();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);

    const { error } = await ecdFetch<ValidationRule>("/api/admin/validation-rules", {
      method: "POST",
      body: JSON.stringify({
        resourceType: resource,
        fieldPath: veldpad,
        operator,
        value: waarde,
        errorMessage: foutmelding,
      }),
    });

    setBezig(false);
    if (error) {
      setFout(error);
      return;
    }

    setVeldpad("");
    setWaarde("");
    setFoutmelding("");
    onToegevoegd();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fout && (
        <div
          role="alert"
          className="p-3 bg-coral-50 border border-coral-200 rounded text-coral-600 text-sm"
        >
          {fout}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label
            htmlFor={`${baseId}-resource`}
            className="block text-xs font-medium text-fg-muted mb-1"
          >
            Resourcetype
          </label>
          <select
            id={`${baseId}-resource`}
            value={resource}
            onChange={(e) => {
              setResource(e.target.value);
              setVeldpad("");
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
          <label
            htmlFor={`${baseId}-veldpad`}
            className="block text-xs font-medium text-fg-muted mb-1"
          >
            Veldpad
          </label>
          <select
            id={`${baseId}-veldpad`}
            required
            value={veldpad}
            onChange={(e) => setVeldpad(e.target.value)}
            className={selectClass}
          >
            <option value="">Selecteer een veldpad...</option>
            {(FIELD_PATHS[resource] ?? []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${baseId}-operator`}
            className="block text-xs font-medium text-fg-muted mb-1"
          >
            Operator
          </label>
          <select
            id={`${baseId}-operator`}
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
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
          <label
            htmlFor={`${baseId}-waarde`}
            className="block text-xs font-medium text-fg-muted mb-1"
          >
            Waarde
          </label>
          <input
            id={`${baseId}-waarde`}
            type="text"
            value={waarde}
            onChange={(e) => setWaarde(e.target.value)}
            placeholder="bijv. 9"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${baseId}-foutmelding`}
            className="block text-xs font-medium text-fg-muted mb-1"
          >
            Foutmelding
          </label>
          <input
            id={`${baseId}-foutmelding`}
            type="text"
            required
            value={foutmelding}
            onChange={(e) => setFoutmelding(e.target.value)}
            placeholder="bijv. BSN moet 9 cijfers bevatten"
            className={inputClass}
          />
        </div>
      </div>

      <div className="pt-2">
        <button type="submit" disabled={bezig} className={btnPrimary}>
          {bezig ? "Toevoegen..." : "Regel toevoegen"}
        </button>
      </div>
    </form>
  );
}
