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
  const [agbCode, setAgbCode] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [functie, setFunctie] = useState<string>(FUNCTIES[0]);
  const [saving, setSaving] = useState(false);

  async function loadMedewerkers() {
    setLoading(true);
    const { data, error: err } = await ecdFetch<PractitionerBundle>(
      "/api/medewerkers?_count=100&_sort=-_lastUpdated",
    );
    setPractitioners(
      data?.entry?.map((e) => e.resource) ?? [],
    );
    setError(err);
    setLoading(false);
  }

  useEffect(() => {
    loadMedewerkers();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: err } = await ecdFetch("/api/medewerkers", {
      method: "POST",
      body: JSON.stringify({
        voornaam,
        achternaam,
        agbCode: agbCode || undefined,
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
    setAgbCode("");
    setEmail("");
    setTelefoon("");
    setFunctie(FUNCTIES[0]);
    await loadMedewerkers();
  }

  const inputClass =
    "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
  const btnPrimary =
    "px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50";

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
                  </tr>
                </thead>
                <tbody>
                  {practitioners.map((p) => {
                    const isActive = p.active !== false;
                    return (
                      <tr
                        key={p.id}
                        className={`border-b last:border-0 ${!isActive ? "opacity-50" : ""}`}
                      >
                        <td className="py-2 pr-4 font-medium">{getNaam(p)}</td>
                        <td className="py-2 pr-4">{getFunctie(p) || <span className="text-gray-300">&mdash;</span>}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {getAgb(p) || <span className="text-gray-300">&mdash;</span>}
                        </td>
                        <td className="py-2 pr-4">{getEmail(p) || <span className="text-gray-300">&mdash;</span>}</td>
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
                <input
                  type="text"
                  value={agbCode}
                  onChange={(e) => setAgbCode(e.target.value)}
                  placeholder="12345678"
                  maxLength={8}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-fg-subtle">8 cijfers</p>
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
                className={btnPrimary}
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
