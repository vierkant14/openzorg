"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ecdFetch } from "../../../../lib/api";

/* -------------------------------------------------------------------------- */
/*  FHIR types                                                                */
/* -------------------------------------------------------------------------- */

interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface FhirExtension {
  url: string;
  valueBoolean?: boolean;
  valueString?: string;
  valueDate?: string;
}

interface FhirImmunization {
  id?: string;
  status?: string;
  vaccineCode?: { text?: string; coding?: Array<{ code?: string; display?: string }> };
  occurrenceDateTime?: string;
  performer?: Array<{ actor?: { display?: string; reference?: string } }>;
  lotNumber?: string;
  site?: { text?: string };
  route?: { text?: string };
  note?: Array<{ text?: string }>;
  statusReason?: { text?: string };
  extension?: FhirExtension[];
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function getExtension(resource: FhirImmunization, name: string): FhirExtension | undefined {
  return resource.extension?.find((e) => e.url === `https://openzorg.nl/extensions/${name}`);
}

const FREQUENTIE_LABELS: Record<string, string> = {
  jaarlijks: "Jaarlijks",
  halfjaarlijks: "Halfjaarlijks",
  eenmalig: "Eenmalig",
};

const VEELGEBRUIKTE_VACCINS = [
  { code: "J07AL02", display: "Tetanus vaccin" },
  { code: "J07BB01", display: "Influenza vaccin" },
  { code: "J07BX03", display: "COVID-19 vaccin" },
  { code: "J07AH07", display: "Pneumokokken vaccin" },
  { code: "J07BK03", display: "Zona (gordelroos) vaccin" },
  { code: "J07BC01", display: "Hepatitis B vaccin" },
  { code: "J07AM01", display: "DTP (difterie-tetanus-polio) vaccin" },
];

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

export default function VaccinatiesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirImmunization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form fields
  const [vaccineCode, setVaccineCode] = useState("");
  const [vaccineDisplay, setVaccineDisplay] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [lotNummer, setLotNummer] = useState("");
  const [locatie, setLocatie] = useState("Linker bovenarm");
  const [opmerking, setOpmerking] = useState("");
  const [herhalend, setHerhalend] = useState(false);
  const [frequentie, setFrequentie] = useState("eenmalig");
  const [volgendeDatum, setVolgendeDatum] = useState("");
  const [geldigTot, setGeldigTot] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await ecdFetch<FhirBundle<FhirImmunization>>(`/api/clients/${clientId}/vaccinaties`);
    if (err) setError(err);
    else setItems(data?.entry?.map((e) => e.resource) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  function handleSelectVaccin(code: string) {
    setVaccineCode(code);
    const found = VEELGEBRUIKTE_VACCINS.find((v) => v.code === code);
    if (found) setVaccineDisplay(found.display);
  }

  async function handleAdd() {
    if (!vaccineDisplay.trim() || !datum) return;
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/vaccinaties`, {
      method: "POST",
      body: JSON.stringify({
        vaccineCode: vaccineCode || "unknown",
        vaccineDisplay: vaccineDisplay.trim(),
        datum: `${datum}T00:00:00Z`,
        lotNummer: lotNummer || undefined,
        locatie: locatie || undefined,
        opmerking: opmerking || undefined,
        herhalend,
        frequentie,
        volgendeDatum: volgendeDatum || undefined,
        geldigTot: geldigTot || undefined,
      }),
    });
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setVaccineCode(""); setVaccineDisplay(""); setLotNummer(""); setOpmerking("");
    setDatum(new Date().toISOString().slice(0, 10));
    setHerhalend(false); setFrequentie("eenmalig"); setVolgendeDatum(""); setGeldigTot("");
    load();
  }

  function startEdit(v: FhirImmunization) {
    setEditingId(v.id ?? null);
    setShowForm(true);
    const vaccName = v.vaccineCode?.text ?? v.vaccineCode?.coding?.[0]?.display ?? "";
    const vaccCode = v.vaccineCode?.coding?.[0]?.code ?? "";
    setVaccineCode(vaccCode);
    setVaccineDisplay(vaccName);
    setDatum(v.occurrenceDateTime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setLotNummer(v.lotNumber ?? "");
    setLocatie(v.site?.text ?? "Linker bovenarm");
    setOpmerking(v.note?.[0]?.text ?? "");
    const herhalendExt = getExtension(v, "herhalend");
    const freqExt = getExtension(v, "frequentie");
    const volgendeDatumExt = getExtension(v, "volgende-datum");
    const geldigTotExt = getExtension(v, "geldig-tot");
    setHerhalend(herhalendExt?.valueBoolean ?? false);
    setFrequentie(freqExt?.valueString ?? "eenmalig");
    setVolgendeDatum(volgendeDatumExt?.valueDate ?? "");
    setGeldigTot(geldigTotExt?.valueDate ?? "");
  }

  async function handleEditSave() {
    if (!editingId || !vaccineDisplay.trim() || !datum) return;
    setSaving(true);
    await ecdFetch(`/api/clients/${clientId}/vaccinaties/${editingId}`, {
      method: "PUT",
      body: JSON.stringify({
        vaccineCode: vaccineCode || "unknown",
        vaccineDisplay: vaccineDisplay.trim(),
        datum: `${datum}T00:00:00Z`,
        lotNummer: lotNummer || undefined,
        locatie: locatie || undefined,
        opmerking: opmerking || undefined,
        herhalend,
        frequentie,
        volgendeDatum: volgendeDatum || undefined,
        geldigTot: geldigTot || undefined,
      }),
    });
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setVaccineCode(""); setVaccineDisplay(""); setLotNummer(""); setOpmerking("");
    setDatum(new Date().toISOString().slice(0, 10));
    setHerhalend(false); setFrequentie("eenmalig"); setVolgendeDatum(""); setGeldigTot("");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet u zeker dat u deze vaccinatie wilt verwijderen?")) return;
    setDeletingId(id);
    await ecdFetch(`/api/clients/${clientId}/vaccinaties/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-fg">Vaccinaties</h2>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); }} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {showForm ? "Annuleren" : "+ Vaccinatie registreren"}
        </button>
      </div>

      {showForm && (
        <div className="bg-raised rounded-xl border border-default p-4 mb-4 space-y-3">
          <div>
            <label className="block text-caption font-medium text-fg-muted mb-1">Vaccin</label>
            <select
              value={vaccineCode}
              onChange={(e) => handleSelectVaccin(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
            >
              <option value="">Selecteer vaccin of typ handmatig</option>
              {VEELGEBRUIKTE_VACCINS.map((v) => (
                <option key={v.code} value={v.code}>{v.display}</option>
              ))}
            </select>
          </div>
          <input
            placeholder="Vaccin naam (vrij invoer)"
            value={vaccineDisplay}
            onChange={(e) => setVaccineDisplay(e.target.value)}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-caption font-medium text-fg-muted mb-1">Datum</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
              />
            </div>
            <div>
              <label className="block text-caption font-medium text-fg-muted mb-1">Lotnummer</label>
              <input
                placeholder="Bijv. AB1234"
                value={lotNummer}
                onChange={(e) => setLotNummer(e.target.value)}
                className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
              />
            </div>
          </div>
          <div>
            <label className="block text-caption font-medium text-fg-muted mb-1">Locatie</label>
            <select
              value={locatie}
              onChange={(e) => setLocatie(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
            >
              <option value="Linker bovenarm">Linker bovenarm</option>
              <option value="Rechter bovenarm">Rechter bovenarm</option>
              <option value="Linker bovenbeen">Linker bovenbeen</option>
              <option value="Rechter bovenbeen">Rechter bovenbeen</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={herhalend}
                onChange={(e) => setHerhalend(e.target.checked)}
                className="rounded border-default"
              />
              Herhalende vaccinatie
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-caption font-medium text-fg-muted mb-1">Frequentie</label>
              <select
                value={frequentie}
                onChange={(e) => setFrequentie(e.target.value)}
                className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
              >
                <option value="eenmalig">Eenmalig</option>
                <option value="jaarlijks">Jaarlijks</option>
                <option value="halfjaarlijks">Halfjaarlijks</option>
              </select>
            </div>
            {herhalend && (
              <div>
                <label className="block text-caption font-medium text-fg-muted mb-1">Volgende datum</label>
                <input
                  type="date"
                  value={volgendeDatum}
                  onChange={(e) => setVolgendeDatum(e.target.value)}
                  className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-caption font-medium text-fg-muted mb-1">Geldig tot (einddatum bescherming)</label>
            <input
              type="date"
              value={geldigTot}
              onChange={(e) => setGeldigTot(e.target.value)}
              className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
            />
            <p className="text-[10px] text-fg-subtle mt-1">Wanneer de vaccinatiebescherming verloopt (bijv. griepprik: 1 jaar, tetanus: 10 jaar)</p>
          </div>
          <textarea
            placeholder="Opmerking (optioneel)"
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            rows={2}
            className="w-full border border-default rounded-lg px-3 py-2 text-sm bg-raised text-fg"
          />
          <div className="flex gap-2">
            {editingId && (
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                type="button"
                className="border border-default text-fg-muted px-4 py-2 rounded-lg text-sm font-medium hover:bg-page btn-press"
              >
                Annuleren
              </button>
            )}
            <button
              onClick={editingId ? handleEditSave : handleAdd}
              disabled={saving || !vaccineDisplay.trim()}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 btn-press"
            >
              {saving ? "Opslaan..." : editingId ? "Wijzigingen opslaan" : "Vaccinatie opslaan"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle py-4">Geen vaccinaties geregistreerd.</p>
      ) : (
        <div className="space-y-2">
          {items.map((v) => {
            const freqExt = getExtension(v, "frequentie");
            const freqLabel = freqExt?.valueString ? (FREQUENTIE_LABELS[freqExt.valueString] ?? freqExt.valueString) : null;
            const herhalendExt = getExtension(v, "herhalend");
            const volgendeDatumExt = getExtension(v, "volgende-datum");
            const geldigTotExt = getExtension(v, "geldig-tot");
            return (
              <div key={v.id} className="bg-raised rounded-xl border border-default p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-fg">
                        {v.vaccineCode?.text ?? v.vaccineCode?.coding?.[0]?.display ?? "Onbekend vaccin"}
                      </p>
                      {freqLabel && (
                        <span className={`px-2 py-0.5 rounded text-caption font-medium ${
                          freqExt?.valueString === "eenmalig"
                            ? "bg-surface-100 text-fg-subtle"
                            : "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                        }`}>
                          {freqLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-caption text-fg-subtle">
                      {v.occurrenceDateTime && (
                        <span>{new Date(v.occurrenceDateTime).toLocaleDateString("nl-NL")}</span>
                      )}
                      {v.lotNumber && <span>Lot: {v.lotNumber}</span>}
                      {v.site?.text && <span>{v.site.text}</span>}
                      {v.performer?.[0]?.actor?.display && (
                        <span>Door: {v.performer[0].actor.display}</span>
                      )}
                    </div>
                    {herhalendExt?.valueBoolean && volgendeDatumExt?.valueDate && (
                      <p className="text-sm text-brand-600 mt-1">
                        Volgende vaccinatie: {new Date(volgendeDatumExt.valueDate).toLocaleDateString("nl-NL")}
                      </p>
                    )}
                    {geldigTotExt?.valueDate && (
                      <p className={`text-sm mt-1 ${
                        new Date(geldigTotExt.valueDate) < new Date()
                          ? "text-coral-600 font-medium"
                          : "text-fg-muted"
                      }`}>
                        Geldig tot: {new Date(geldigTotExt.valueDate).toLocaleDateString("nl-NL")}
                        {new Date(geldigTotExt.valueDate) < new Date() && " (verlopen)"}
                      </p>
                    )}
                    {v.note?.[0]?.text && <p className="text-sm text-fg-muted mt-1">{v.note[0].text}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-caption font-medium ${
                      v.status === "completed"
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : v.status === "not-done"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-surface-100 text-fg-subtle"
                    }`}>
                      {v.status === "completed" ? "Gegeven" : v.status === "not-done" ? "Niet gegeven" : v.status ?? "---"}
                    </span>
                    <button onClick={() => startEdit(v)} className="text-sm text-brand-600 hover:text-brand-800 btn-press-sm">
                      Bewerken
                    </button>
                    <button onClick={() => v.id && handleDelete(v.id)} disabled={deletingId === v.id} className="text-sm text-coral-600 hover:text-coral-800 btn-press-sm disabled:opacity-50">
                      {deletingId === v.id ? "..." : "Verwijderen"}
                    </button>
                  </div>
                </div>
                {v.status === "not-done" && v.statusReason?.text && (
                  <p className="text-sm text-amber-600 mt-2">Reden: {v.statusReason.text}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
