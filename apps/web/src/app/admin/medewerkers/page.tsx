"use client";

import { useEffect, useState, type FormEvent } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

/* ---------- Types ---------- */

interface FhirIdentifier {
  system?: string;
  value?: string;
}

interface FhirName {
  family?: string;
  given?: string[];
}

interface FhirTelecom {
  system?: string;
  value?: string;
  use?: string;
}

interface FhirQualification {
  code?: { text?: string };
}

interface Practitioner {
  id: string;
  resourceType: "Practitioner";
  active?: boolean;
  name?: FhirName[];
  identifier?: FhirIdentifier[];
  telecom?: FhirTelecom[];
  qualification?: FhirQualification[];
}

interface PractitionerBundle {
  entry?: Array<{ resource: Practitioner }>;
}

const FUNCTIES = [
  "wijkverpleegkundige",
  "verzorgende",
  "verpleegkundige",
  "fysiotherapeut",
  "ergotherapeut",
  "arts",
  "teamleider",
  "planner",
] as const;

const AGB_SYSTEM = "http://fhir.nl/fhir/NamingSystem/agb";

/** Standard AGB beroepsgroep prefixes (first 2 digits of 8-digit AGB code) */
const AGB_BEROEPSGROEPEN: Array<{ code: string; label: string }> = [
  { code: "01", label: "01 — Huisarts" },
  { code: "02", label: "02 — Apotheek" },
  { code: "03", label: "03 — Verloskundige" },
  { code: "04", label: "04 — Fysiotherapeut" },
  { code: "05", label: "05 — Logopedist" },
  { code: "06", label: "06 — Oefentherapeut" },
  { code: "08", label: "08 — Ergotherapeut" },
  { code: "14", label: "14 — Psycholoog" },
  { code: "16", label: "16 — Verpleegkundige" },
  { code: "17", label: "17 — Verzorgende" },
  { code: "25", label: "25 — Tandarts" },
  { code: "30", label: "30 — Specialist (medisch)" },
  { code: "83", label: "83 — GGZ instelling" },
  { code: "84", label: "84 — Thuiszorginstelling" },
  { code: "85", label: "85 — Verpleeghuis / Verzorgingshuis" },
  { code: "87", label: "87 — Gehandicaptenzorginstelling" },
];

/* ---------- Helpers ---------- */

function getNaam(p: Practitioner): string {
  const name = p.name?.[0];
  if (!name) return "(onbekend)";
  const given = name.given?.join(" ") ?? "";
  return `${given} ${name.family ?? ""}`.trim() || "(onbekend)";
}

function getAgb(p: Practitioner): string {
  return p.identifier?.find((i) => i.system === AGB_SYSTEM)?.value ?? "";
}

function getEmail(p: Practitioner): string {
  return p.telecom?.find((t) => t.system === "email")?.value ?? "";
}

function getTelefoon(p: Practitioner): string {
  return p.telecom?.find((t) => t.system === "phone")?.value ?? "";
}

function getFunctie(p: Practitioner): string {
  return p.qualification?.[0]?.code?.text ?? "";
}

/* ---------- Page ---------- */

export default function MedewerkersPage() {
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [agbPrefix, setAgbPrefix] = useState("");
  const [agbCode, setAgbCode] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [functie, setFunctie] = useState<string>(FUNCTIES[0]);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVoornaam, setEditVoornaam] = useState("");
  const [editAchternaam, setEditAchternaam] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefoon, setEditTelefoon] = useState("");
  const [editFunctie, setEditFunctie] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadMedewerkers() {
    setLoading(true);
    const { data, error: err, status } = await ecdFetch<PractitionerBundle>(
      "/api/medewerkers?_count=100&_sort=-_lastUpdated",
    );
    setPractitioners(
      data?.entry?.map((e) => e.resource) ?? [],
    );
    setError(status === 0 ? err : null);
    setLoading(false);
  }

  useEffect(() => {
    loadMedewerkers();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const fullAgb = agbPrefix && agbCode ? `${agbPrefix}${agbCode}` : undefined;

    const { error: err } = await ecdFetch("/api/medewerkers", {
      method: "POST",
      body: JSON.stringify({
        voornaam,
        achternaam,
        agbCode: fullAgb,
        email: email || undefined,
        telefoon: telefoon || undefined,
        functie,
      }),
    });

    setSaving(false);
    if (err) {
      setError(err);
      return;
    }

    setVoornaam("");
    setAchternaam("");
    setAgbPrefix("");
    setAgbCode("");
    setEmail("");
    setTelefoon("");
    setFunctie(FUNCTIES[0]);
    await loadMedewerkers();
  }

  function startEdit(p: Practitioner) {
    setEditingId(p.id);
    setEditVoornaam(p.name?.[0]?.given?.join(" ") ?? "");
    setEditAchternaam(p.name?.[0]?.family ?? "");
    setEditEmail(getEmail(p));
    setEditTelefoon(getTelefoon(p));
    setEditFunctie(getFunctie(p));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(p: Practitioner) {
    setEditSaving(true);
    setError(null);

    const telecom: Array<{ system: string; value: string; use?: string }> = [];
    if (editEmail) {
      telecom.push({ system: "email", value: editEmail, use: "work" });
    }
    if (editTelefoon) {
      telecom.push({ system: "phone", value: editTelefoon, use: "work" });
    }

    const qualification: Array<{ code: { text: string } }> = [];
    if (editFunctie) {
      qualification.push({ code: { text: editFunctie } });
    }

    const updatedResource: Record<string, unknown> = {
      resourceType: "Practitioner",
      id: p.id,
      active: p.active,
      name: [
        {
          family: editAchternaam,
          given: editVoornaam.split(" ").filter(Boolean),
        },
      ],
      ...(p.identifier ? { identifier: p.identifier } : {}),
      ...(telecom.length > 0 ? { telecom } : {}),
      ...(qualification.length > 0 ? { qualification } : {}),
    };

    const { error: err } = await ecdFetch(`/api/medewerkers/${p.id}`, {
      method: "PUT",
      body: JSON.stringify(updatedResource),
    });

    setEditSaving(false);

    if (err) {
      setError(err);
      return;
    }

    setEditingId(null);
    await loadMedewerkers();
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error: err } = await ecdFetch(`/api/medewerkers/${id}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (err) {
      setError(err);
      return;
    }
    await loadMedewerkers();
  }

  const inputClass =
    "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
  const btnPrimary =
    "rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 btn-press";

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <a
          href="/dashboard"
          className="inline-flex items-center text-sm text-brand-700 hover:text-brand-900"
        >
          &larr; Terug
        </a>

        <h2 className="text-2xl font-bold text-fg">Medewerkers</h2>

        {error && (
          <div className="p-3 bg-coral-50 border border-coral-200 rounded text-coral-600 text-sm">
            {error}
          </div>
        )}

        {/* ============ LIJST ============ */}
        <section className="bg-raised rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            Overzicht medewerkers
          </h3>

          {loading ? (
            <p className="text-sm text-fg-subtle">Laden...</p>
          ) : practitioners.length === 0 ? (
            <p className="text-sm text-fg-subtle">
              Nog geen medewerkers gevonden.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-fg-subtle">
                    <th className="pb-2 pr-4 font-medium">Naam</th>
                    <th className="pb-2 pr-4 font-medium">Functie</th>
                    <th className="pb-2 pr-4 font-medium">AGB-code</th>
                    <th className="pb-2 pr-4 font-medium">E-mail</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {practitioners.map((p) => {
                    const isActive = p.active !== false;
                    const isEditing = editingId === p.id;
                    const isDeleting = deletingId === p.id;

                    if (isEditing) {
                      return (
                        <tr key={p.id} className="border-b last:border-0 bg-surface-50 dark:bg-surface-900">
                          <td className="py-2 pr-4">
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={editVoornaam}
                                onChange={(e) => setEditVoornaam(e.target.value)}
                                placeholder="Voornaam"
                                className={`${inputClass} w-24`}
                              />
                              <input
                                type="text"
                                value={editAchternaam}
                                onChange={(e) => setEditAchternaam(e.target.value)}
                                placeholder="Achternaam"
                                className={`${inputClass} w-24`}
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <select
                              value={editFunctie}
                              onChange={(e) => setEditFunctie(e.target.value)}
                              className={`${inputClass} w-36`}
                            >
                              <option value="">Geen</option>
                              {FUNCTIES.map((f) => (
                                <option key={f} value={f}>
                                  {f.charAt(0).toUpperCase() + f.slice(1)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {getAgb(p) || <span className="text-fg-subtle">&mdash;</span>}
                          </td>
                          <td className="py-2 pr-4">
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="E-mail"
                              className={`${inputClass} w-40`}
                            />
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                isActive
                                  ? "bg-brand-50 text-brand-700"
                                  : "bg-surface-100 dark:bg-surface-800 text-fg-subtle"
                              }`}
                            >
                              {isActive ? "Actief" : "Inactief"}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveEdit(p)}
                                disabled={editSaving}
                                className="text-brand-700 hover:text-brand-900 text-xs font-medium btn-press-sm"
                              >
                                {editSaving ? "Opslaan..." : "Opslaan"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-fg-muted hover:text-fg text-xs font-medium btn-press-sm"
                              >
                                Annuleren
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={p.id}
                        className={`border-b last:border-0 ${!isActive ? "opacity-50" : ""}`}
                      >
                        <td className="py-2 pr-4 font-medium">{getNaam(p)}</td>
                        <td className="py-2 pr-4">{getFunctie(p) || <span className="text-fg-subtle">&mdash;</span>}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {getAgb(p) || <span className="text-fg-subtle">&mdash;</span>}
                        </td>
                        <td className="py-2 pr-4">{getEmail(p) || <span className="text-fg-subtle">&mdash;</span>}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              isActive
                                ? "bg-brand-50 text-brand-700"
                                : "bg-surface-100 dark:bg-surface-800 text-fg-subtle"
                            }`}
                          >
                            {isActive ? "Actief" : "Inactief"}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          {isDeleting ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-fg-muted">Verwijderen?</span>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="text-coral-600 hover:text-coral-800 text-xs font-medium btn-press-sm"
                              >
                                Ja
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="text-fg-muted hover:text-fg text-xs font-medium btn-press-sm"
                              >
                                Nee
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEdit(p)}
                                className="text-brand-700 hover:text-brand-900 text-xs font-medium btn-press-sm"
                              >
                                Bewerken
                              </button>
                              <button
                                onClick={() => setDeletingId(p.id)}
                                className="text-coral-600 hover:text-coral-800 text-xs font-medium btn-press-sm"
                              >
                                Verwijderen
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ============ FORMULIER ============ */}
        <section className="bg-raised rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-fg mb-4">
            Medewerker toevoegen
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Voornaam
                </label>
                <input
                  type="text"
                  required
                  value={voornaam}
                  onChange={(e) => setVoornaam(e.target.value)}
                  placeholder="Jan"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Achternaam
                </label>
                <input
                  type="text"
                  required
                  value={achternaam}
                  onChange={(e) => setAchternaam(e.target.value)}
                  placeholder="Jansen"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  AGB-code
                </label>
                <div className="flex gap-2">
                  <select
                    value={agbPrefix}
                    onChange={(e) => setAgbPrefix(e.target.value)}
                    className={`${inputClass} w-[55%]`}
                  >
                    <option value="">Beroepsgroep...</option>
                    {AGB_BEROEPSGROEPEN.map((bg) => (
                      <option key={bg.code} value={bg.code}>
                        {bg.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={agbCode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      setAgbCode(v);
                    }}
                    placeholder="123456"
                    maxLength={6}
                    className={`${inputClass} w-[45%] font-mono`}
                  />
                </div>
                <p className="mt-1 text-xs text-fg-subtle">
                  Selecteer beroepsgroep + 6 cijfers = 8-cijferige AGB-code
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="j.jansen@voorbeeld.nl"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">
                  Telefoon
                </label>
                <input
                  type="tel"
                  value={telefoon}
                  onChange={(e) => setTelefoon(e.target.value)}
                  placeholder="06-12345678"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="max-w-xs">
              <label className="block text-xs font-medium text-fg-muted mb-1">
                Functie
              </label>
              <select
                value={functie}
                onChange={(e) => setFunctie(e.target.value)}
                className={inputClass}
              >
                {FUNCTIES.map((f) => (
                  <option key={f} value={f}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className={`${btnPrimary} disabled:opacity-50`}
              >
                {saving ? "Opslaan..." : "Medewerker toevoegen"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </AppShell>
  );
}
