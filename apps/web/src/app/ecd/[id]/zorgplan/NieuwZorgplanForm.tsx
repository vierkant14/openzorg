"use client";

import { useState } from "react";

import { PractitionerPicker } from "../../../../components/PractitionerPicker";

import { type UseZorgplanResult } from "./useZorgplan";

const inputCls =
  "w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface NieuwZorgplanFormProps {
  createZorgplan: UseZorgplanResult["createZorgplan"];
  onOpgeslagen: () => void;
}

/** Formulier om een nieuw zorgplan (CarePlan) aan te maken. */
export function NieuwZorgplanForm({ createZorgplan, onOpgeslagen }: NieuwZorgplanFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState("");
  const [verantwoordelijke, setVerantwoordelijke] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      ...(verantwoordelijke ? { author: { display: verantwoordelijke } } : {}),
    };

    const { error } = await createZorgplan(body);

    setSaving(false);
    if (error) {
      setFormError(error);
    } else {
      onOpgeslagen();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm">
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
          <PractitionerPicker
            value={verantwoordelijke}
            onChange={(_id, displayName) => setVerantwoordelijke(displayName)}
            placeholder="Zoek een medewerker..."
          />
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10 px-3 py-2">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <strong>Kwaliteitskader:</strong> Een voorlopig zorgplan moet binnen 48 uur na opname worden opgesteld. Het definitieve zorgplan binnen 6 weken.
        </p>
      </div>
      {formError && <p className="mt-2 text-sm text-coral-600">{formError}</p>}
      <div className="mt-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" className="accent-brand-700" id="concept-toggle" />
          Opslaan als voorlopig zorgplan (concept)
        </label>
        <button type="submit" disabled={saving} className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 btn-press">
          {saving ? "Opslaan..." : "Zorgplan aanmaken"}
        </button>
      </div>
    </form>
  );
}
