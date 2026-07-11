"use client";

import { useId, useState } from "react";

import type { TaakVeld, WerkbakTaak } from "./useWerkbak";

const inputCls =
  "w-full rounded-lg border border-default bg-raised px-3 py-2 text-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 outline-none transition-[border-color,box-shadow] duration-200 ease-out";

interface TaakFormulierProps {
  taak: WerkbakTaak;
  bezig: boolean;
  onVoltooi: (waarden: Record<string, string>) => Promise<boolean>;
  onAnnuleer: () => void;
}

/**
 * Afrond-formulier van één taak. De velden komen uit de proces-catalogus
 * (Laag 1 ⊕ tenant-overrides) — nooit meer hardcoded veldnamen in de UI.
 */
export function TaakFormulier({ taak, bezig, onVoltooi, onAnnuleer }: TaakFormulierProps) {
  const formId = useId();
  const [waarden, setWaarden] = useState<Record<string, string>>({});
  const [validatieFout, setValidatieFout] = useState<string | null>(null);

  function zetWaarde(naam: string, waarde: string) {
    setValidatieFout(null);
    setWaarden((prev) => ({ ...prev, [naam]: waarde }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ontbrekend = taak.velden.filter(
      (veld) => veld.verplicht && !(waarden[veld.name] ?? "").trim(),
    );
    if (ontbrekend.length > 0) {
      setValidatieFout(
        `Vul eerst in: ${ontbrekend.map((v) => v.label).join(", ")}`,
      );
      return;
    }
    const gelukt = await onVoltooi(waarden);
    if (gelukt) setWaarden({});
  }

  function veldInput(veld: TaakVeld) {
    const veldId = `${formId}-${veld.name}`;
    const waarde = waarden[veld.name] ?? "";

    if (veld.type === "boolean") {
      return (
        <div className="flex gap-2" role="group" aria-labelledby={`${veldId}-label`}>
          <button
            type="button"
            onClick={() => zetWaarde(veld.name, "true")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border btn-press ${
              waarde === "true"
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-raised text-fg-muted border-default hover:bg-sunken"
            }`}
          >
            Ja
          </button>
          <button
            type="button"
            onClick={() => zetWaarde(veld.name, "false")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border btn-press ${
              waarde === "false"
                ? "bg-coral-600 text-white border-coral-600"
                : "bg-raised text-fg-muted border-default hover:bg-sunken"
            }`}
          >
            Nee
          </button>
        </div>
      );
    }

    if (veld.type === "select") {
      return (
        <select
          id={veldId}
          value={waarde}
          onChange={(e) => zetWaarde(veld.name, e.target.value)}
          className={inputCls}
        >
          <option value="">Selecteer…</option>
          {veld.options?.map((optie) => (
            <option key={optie.value} value={optie.value}>
              {optie.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        id={veldId}
        type={veld.type === "number" ? "number" : "text"}
        value={waarde}
        onChange={(e) => zetWaarde(veld.name, e.target.value)}
        className={inputCls}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 border-t border-default pt-4 animate-[fade-in_300ms_cubic-bezier(0.16,1,0.3,1)]"
    >
      <h4 className="mb-3 text-sm font-semibold text-fg">Taak afronden</h4>

      <div className="grid gap-3 sm:grid-cols-2">
        {taak.velden.map((veld) => (
          <div key={veld.name}>
            <label
              id={`${formId}-${veld.name}-label`}
              htmlFor={`${formId}-${veld.name}`}
              className="mb-1 block text-xs font-medium text-fg-muted"
            >
              {veld.label}
              {veld.verplicht && <span className="text-coral-600"> *</span>}
            </label>
            {veldInput(veld)}
          </div>
        ))}
      </div>

      {validatieFout && (
        <p role="alert" className="mt-3 text-sm text-coral-700 dark:text-coral-300">
          {validatieFout}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={bezig}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 btn-press"
        >
          {bezig ? "Afronden…" : "Afronden"}
        </button>
        <button
          type="button"
          onClick={onAnnuleer}
          className="rounded-lg border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-sunken btn-press"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
