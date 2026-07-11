"use client";

import { useId, useState, type FormEvent } from "react";

import { ecdFetch } from "../../../../lib/api";

import { RESOURCE_TYPES, type CustomField } from "./types";

const FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "date",
  "codeable-concept",
  "dropdown",
  "multi-select",
  "textarea",
];

const inputClass =
  "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
const selectClass = inputClass;
const btnPrimary =
  "px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50";

interface VeldEditorProps {
  /** Wordt aangeroepen nadat een veld succesvol is opgeslagen. */
  onToegevoegd: () => void;
}

/**
 * Formulier voor het toevoegen van een custom veld, inclusief
 * type-specifieke opties (keuzelijst bij dropdown/multi-select).
 */
export function VeldEditor({ onToegevoegd }: VeldEditorProps) {
  const [resource, setResource] = useState("Patient");
  const [naam, setNaam] = useState("");
  const [veldType, setVeldType] = useState("string");
  const [opties, setOpties] = useState("");
  const [verplicht, setVerplicht] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const baseId = useId();
  const heeftOpties = veldType === "dropdown" || veldType === "multi-select";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);

    const options =
      heeftOpties && opties.trim()
        ? opties.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined;

    const { error } = await ecdFetch<CustomField>("/api/admin/custom-fields", {
      method: "POST",
      body: JSON.stringify({
        resourceType: resource,
        fieldName: naam,
        fieldType: veldType,
        required: verplicht,
        options,
      }),
    });

    setBezig(false);
    if (error) {
      setFout(error);
      return;
    }

    setNaam("");
    setOpties("");
    setVerplicht(false);
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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
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
            onChange={(e) => setResource(e.target.value)}
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
            htmlFor={`${baseId}-naam`}
            className="block text-xs font-medium text-fg-muted mb-1"
          >
            Veldnaam
          </label>
          <input
            id={`${baseId}-naam`}
            type="text"
            required
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="bijv. bloedgroep"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${baseId}-type`}
            className="block text-xs font-medium text-fg-muted mb-1"
          >
            Veldtype
          </label>
          <select
            id={`${baseId}-type`}
            value={veldType}
            onChange={(e) => setVeldType(e.target.value)}
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
              checked={verplicht}
              onChange={(e) => setVerplicht(e.target.checked)}
              className="rounded border-default"
            />
            Verplicht
          </label>
        </div>
      </div>

      {/* Optieregel — alleen zichtbaar voor dropdown / multi-select */}
      {heeftOpties && (
        <div>
          <label
            htmlFor={`${baseId}-opties`}
            className="block text-xs font-medium text-fg-muted mb-1"
          >
            Opties (kommagescheiden)
          </label>
          <input
            id={`${baseId}-opties`}
            type="text"
            required
            value={opties}
            onChange={(e) => setOpties(e.target.value)}
            placeholder="bijv. Klein, Middel, Groot"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-fg-subtle">
            Voer de beschikbare keuzes in, gescheiden door komma&apos;s.
          </p>
        </div>
      )}

      <div className="pt-1">
        <button type="submit" disabled={bezig} className={btnPrimary}>
          {bezig ? "Toevoegen..." : "Veld toevoegen"}
        </button>
      </div>
    </form>
  );
}
