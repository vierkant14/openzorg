"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CodelijstPicker } from "../../../../components/CodelijstPicker";
import { PractitionerPicker } from "../../../../components/PractitionerPicker";
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

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  medicationCodeableConcept?: { text?: string };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
  }>;
  requester?: { display?: string; reference?: string };
  authoredOn?: string;
  extension?: Array<{ url?: string; valueString?: string }>;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function frequentiePeriodLabel(unit?: string): string {
  switch (unit) {
    case "d":
      return "dag";
    case "wk":
      return "week";
    case "mo":
      return "maand";
    case "h":
      return "uur";
    default:
      return "dag";
  }
}

function medicatieStatusLabel(status?: string): string {
  switch (status) {
    case "active":
      return "Actief";
    case "stopped":
      return "Gestopt";
    case "completed":
      return "Afgerond";
    case "on-hold":
      return "Gepauzeerd";
    case "cancelled":
      return "Geannuleerd";
    default:
      return status ?? "Onbekend";
  }
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

export default function MedicatiePage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirMedicationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [medCodelijst, setMedCodelijst] = useState<Array<{ code: string; display: string }>>([]);
  const [editingMed, setEditingMed] = useState<FhirMedicationRequest | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  // Load medicatie codelijst (voorschrijvers komen via PractitionerPicker in het form)
  useEffect(() => {
    ecdFetch<{ items: Array<{ code: string; display: string }> }>("/api/admin/codelijsten/medicatie")
      .then(({ data }) => { if (data?.items) setMedCodelijst(data.items); });
  }, []);

  const load = useCallback(() => {
    if (!clientId) return;
    setLoading(true);
    ecdFetch<FhirBundle<FhirMedicationRequest>>(
      `/api/clients/${clientId}/medicatie`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setItems(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStop(medId: string) {
    if (!confirm("Weet u zeker dat u deze medicatie wilt stoppen?")) return;
    setStoppingId(medId);
    await ecdFetch(`/api/clients/${clientId}/medicatie/${medId}`, { method: "DELETE" });
    setStoppingId(null);
    load();
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Medicatieoverzicht</h2>
        <button
          onClick={() => { setShowForm((v) => !v); setEditingMed(null); }}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press"
        >
          {showForm ? "Annuleren" : "Medicatie toevoegen"}
        </button>
      </div>

      {showForm && !editingMed && (
        <MedicatieForm
          clientId={clientId}
          medCodelijst={medCodelijst}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {editingMed && (
        <MedicatieForm
          clientId={clientId}
          medCodelijst={medCodelijst}
          editItem={editingMed}
          onSaved={() => {
            setEditingMed(null);
            load();
          }}
          onCancel={() => setEditingMed(null)}
        />
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">
          Geen medicatie gevonden.
        </p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-default bg-raised shadow-sm">
          <table className="min-w-full divide-y divide-default text-sm">
            <thead className="bg-page">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Medicatie</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Dosering</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Frequentie</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Voorschrijver</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Startdatum</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Einddatum</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Status</th>
                <th className="px-4 py-3 text-right font-medium text-fg-muted">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {items.map((med, i) => {
                const naam = med.medicationCodeableConcept?.text ?? "-";
                const dosering = med.dosageInstruction?.[0]?.text ?? "-";
                const timing = med.dosageInstruction?.[0]?.timing?.repeat;
                const frequentie = timing
                  ? `${timing.frequency ?? 1}x per ${timing.period ?? 1} ${frequentiePeriodLabel(timing.periodUnit)}`
                  : "-";
                const voorschrijver = med.requester?.display ?? "-";
                const startdatum = med.authoredOn ? formatDate(med.authoredOn) : "-";
                const einddatum = med.extension?.find(
                  (e) => e.url === "https://openzorg.nl/extensions/medicatie-einddatum",
                )?.valueString;
                const statusLabel = medicatieStatusLabel(med.status);
                const isActive = med.status === "active";
                const RISICOVOL = ["insuline", "morfine", "fentanyl", "oxycodon", "acenocoumarol", "fenprocoumon", "methotrexaat", "lithium"];
                const isHighRisk = RISICOVOL.some((r) => naam.toLowerCase().includes(r));
                const controleExt = med.extension?.find((e) => e.url === "https://openzorg.nl/extensions/dubbele-controle");
                const isGecontroleerd = !!controleExt;

                return (
                  <tr key={med.id ?? i} className={!isActive ? "opacity-60" : ""}>
                    <td className="px-4 py-3 font-medium text-fg">
                      <div className="flex items-center gap-2">
                        {naam}
                        {isHighRisk && (
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${isGecontroleerd ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300" : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300"}`}>
                            {isGecontroleerd ? "✓ Gecontroleerd" : "⚠ Risicovol"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{dosering}</td>
                    <td className="px-4 py-3 text-fg-muted">{frequentie}</td>
                    <td className="px-4 py-3 text-fg-muted">{voorschrijver}</td>
                    <td className="px-4 py-3 text-fg-muted">{startdatum}</td>
                    <td className="px-4 py-3 text-fg-muted">{einddatum ? formatDate(einddatum) : "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-surface-100 dark:bg-surface-800 text-fg-muted"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {isHighRisk && isActive && !isGecontroleerd && (
                          <button
                            onClick={async () => {
                              const controleur = prompt("Naam controleur (tweede medewerker):");
                              if (!controleur) return;
                              await ecdFetch(`/api/medicatie/${med.id}/controle`, {
                                method: "POST",
                                body: JSON.stringify({ controleur, akkoord: true }),
                              });
                              load();
                            }}
                            className="text-sm text-amber-600 hover:text-amber-800 font-medium btn-press-sm"
                          >
                            Controleren
                          </button>
                        )}
                        <button onClick={() => { setEditingMed(med); setShowForm(false); }} className="text-sm text-brand-600 hover:text-brand-800 btn-press-sm">
                          Bewerken
                        </button>
                        {isActive && (
                          <button onClick={() => med.id && handleStop(med.id)} disabled={stoppingId === med.id} className="text-sm text-coral-600 hover:text-coral-800 btn-press-sm disabled:opacity-50">
                            {stoppingId === med.id ? "..." : "Stoppen"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MedicatieForm({
  clientId,
  onSaved,
  onCancel,
  medCodelijst: _medCodelijst = [],
  editItem,
}: {
  clientId: string;
  onSaved: () => void;
  onCancel?: () => void;
  medCodelijst?: Array<{ code: string; display: string }>;
  editItem?: FhirMedicationRequest;
}) {
  const [naam, setNaam] = useState(editItem?.medicationCodeableConcept?.text ?? "");
  const [dosering, setDosering] = useState(editItem?.dosageInstruction?.[0]?.text ?? "");
  const [frequentie, setFrequentie] = useState(String(editItem?.dosageInstruction?.[0]?.timing?.repeat?.frequency ?? "1"));
  const [periodUnit, setPeriodUnit] = useState(editItem?.dosageInstruction?.[0]?.timing?.repeat?.periodUnit ?? "d");
  const [voorschrijver, setVoorschrijver] = useState(editItem?.requester?.display ?? "");
  const [startdatum, setStartdatum] = useState(editItem?.authoredOn?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [einddatum, setEinddatum] = useState(
    editItem?.extension?.find((e) => e.url === "https://openzorg.nl/extensions/medicatie-einddatum")?.valueString ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      medicationCodeableConcept: { text: naam },
      dosageInstruction: [
        {
          text: dosering,
          timing: {
            repeat: {
              frequency: parseInt(frequentie, 10) || 1,
              period: 1,
              periodUnit,
            },
          },
        },
      ],
      authoredOn: startdatum || new Date().toISOString().slice(0, 10),
      status: editItem?.status ?? "active",
      intent: "order",
    };

    if (voorschrijver.trim()) {
      body["requester"] = { display: voorschrijver.trim() };
    }

    if (einddatum) {
      body["extension"] = [
        {
          url: "https://openzorg.nl/extensions/medicatie-einddatum",
          valueString: einddatum,
        },
      ];
    }

    const url = editItem?.id
      ? `/api/clients/${clientId}/medicatie/${editItem.id}`
      : `/api/clients/${clientId}/medicatie`;
    const method = editItem?.id ? "PUT" : "POST";

    const { error: err } = await ecdFetch(url, {
      method,
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      onSaved();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-lg border border-default bg-raised p-5 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">
            Medicatienaam <span className="text-coral-500">*</span>
          </label>
          <CodelijstPicker
            type="medicatie"
            value={naam}
            onChange={(display) => setNaam(display)}
            required
            placeholder="Zoek medicatie (SNOMED)…"
          />
          <p className="mt-1 text-xs text-fg-subtle">
            Zoekt eerst in de tenant-codelijst, daarna in SNOMED CT. Vrije tekst mag als laatste optie.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Dosering</label>
          <input
            type="text"
            value={dosering}
            onChange={(e) => setDosering(e.target.value)}
            placeholder="bijv. 1 tablet"
            className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Frequentie</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={frequentie}
              onChange={(e) => setFrequentie(e.target.value)}
              className="w-20 rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <select
              value={periodUnit}
              onChange={(e) => setPeriodUnit(e.target.value)}
              className="rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="d">per dag</option>
              <option value="wk">per week</option>
              <option value="mo">per maand</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Voorschrijver</label>
          <PractitionerPicker
            value={voorschrijver}
            onChange={(_id, displayName) => setVoorschrijver(displayName)}
            placeholder="Zoek een voorschrijver..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Startdatum</label>
          <input
            type="date"
            value={startdatum}
            onChange={(e) => setStartdatum(e.target.value)}
            className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg-muted">Einddatum</label>
          <input
            type="date"
            value={einddatum}
            onChange={(e) => setEinddatum(e.target.value)}
            className="w-full rounded-md border border-default px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-coral-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-default px-4 py-2 text-sm font-medium text-fg-muted hover:bg-page btn-press"
          >
            Annuleren
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-700 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-50"
        >
          {saving ? "Opslaan..." : editItem ? "Wijzigingen opslaan" : "Medicatie opslaan"}
        </button>
      </div>
    </form>
  );
}
