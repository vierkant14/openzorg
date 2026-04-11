"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";
import { planningFetch } from "../../../lib/planning-api";

const APPOINTMENT_TYPES = [
  "Huisbezoek",
  "Telefonisch",
  "Kantoor",
  "Groepssessie",
];

interface LookupItem {
  id: string;
  label: string;
}

export default function NieuweAfspraakPage() {
  const router = useRouter();

  const [clienten, setClienten] = useState<LookupItem[]>([]);
  const [medewerkers, setMedewerkers] = useState<LookupItem[]>([]);

  const [client, setClient] = useState("");
  const [medewerker, setMedewerker] = useState("");
  const [datum, setDatum] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [startTijd, setStartTijd] = useState("09:00");
  const [eindTijd, setEindTijd] = useState("09:30");
  const [type, setType] = useState("Huisbezoek");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load lookups
  useEffect(() => {
    ecdFetch<{ entry?: Array<{ resource: { id: string; name?: Array<{ family?: string; given?: string[] }> } }> }>("/api/clients")
      .then(({ data }) => {
        const list = data?.entry?.map((e) => ({
          id: e.resource.id,
          label: [
            ...(e.resource.name?.[0]?.given ?? []),
            e.resource.name?.[0]?.family ?? "",
          ].filter(Boolean).join(" ") || e.resource.id,
        })) ?? [];
        setClienten(list);
      })
      .catch(() => { /* ignore */ });

    ecdFetch<{ entry?: Array<{ resource: { id: string; name?: Array<{ family?: string; given?: string[] }> } }> }>("/api/medewerkers")
      .then(({ data }) => {
        const list = data?.entry?.map((e) => ({
          id: e.resource.id,
          label: [
            ...(e.resource.name?.[0]?.given ?? []),
            e.resource.name?.[0]?.family ?? "",
          ].filter(Boolean).join(" ") || e.resource.id,
        })) ?? [];
        setMedewerkers(list);
      })
      .catch(() => { /* ignore */ });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startIso = `${datum}T${startTijd}:00Z`;
    const endIso = `${datum}T${eindTijd}:00Z`;

    if (startIso >= endIso) {
      setError("Starttijd moet voor de eindtijd liggen.");
      return;
    }

    if (!client || !medewerker) {
      setError("Client en medewerker zijn verplicht.");
      return;
    }

    setSubmitting(true);

    const clientItem = clienten.find((c) => c.id === client);
    const medItem = medewerkers.find((m) => m.id === medewerker);

    const body = {
      resourceType: "Appointment",
      status: "booked",
      start: startIso,
      end: endIso,
      participant: [
        { actor: { reference: `Patient/${client}`, display: clientItem?.label }, status: "accepted" },
        { actor: { reference: `Practitioner/${medewerker}`, display: medItem?.label }, status: "accepted" },
      ],
      appointmentType: { text: type },
    };

    const res = await planningFetch("/api/afspraken", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (res.error) {
      setError(res.error);
      setSubmitting(false);
    } else {
      router.push("/planning");
    }
  }

  return (
    <AppShell>
      <main className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-fg mb-6">
          Nieuwe afspraak aanmaken
        </h2>

        {error && (
          <div className="rounded-xl bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 p-4 mb-4 text-body-sm text-coral-700 dark:text-coral-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-raised rounded-2xl border border-default p-6 space-y-5 shadow-soft">
          <div>
            <label htmlFor="client" className="block text-body-sm font-medium text-fg mb-1.5">
              Client
            </label>
            <select
              id="client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            >
              <option value="">Selecteer een client</option>
              {clienten.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {clienten.length === 0 && (
              <p className="mt-1 text-caption text-fg-subtle">Geen clienten gevonden. Voeg eerst clienten toe.</p>
            )}
          </div>

          <div>
            <label htmlFor="medewerker" className="block text-body-sm font-medium text-fg mb-1.5">
              Medewerker
            </label>
            <select
              id="medewerker"
              value={medewerker}
              onChange={(e) => setMedewerker(e.target.value)}
              required
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            >
              <option value="">Selecteer een medewerker</option>
              {medewerkers.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {medewerkers.length === 0 && (
              <p className="mt-1 text-caption text-fg-subtle">Geen medewerkers gevonden. Voeg eerst medewerkers toe via Beheer.</p>
            )}
          </div>

          <div>
            <label htmlFor="datum" className="block text-body-sm font-medium text-fg mb-1.5">
              Datum
            </label>
            <input
              id="datum"
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              required
              className="border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start" className="block text-body-sm font-medium text-fg mb-1.5">
                Starttijd
              </label>
              <input
                id="start"
                type="time"
                value={startTijd}
                onChange={(e) => setStartTijd(e.target.value)}
                required
                className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
              />
            </div>
            <div>
              <label htmlFor="eind" className="block text-body-sm font-medium text-fg mb-1.5">
                Eindtijd
              </label>
              <input
                id="eind"
                type="time"
                value={eindTijd}
                onChange={(e) => setEindTijd(e.target.value)}
                required
                className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="type" className="block text-body-sm font-medium text-fg mb-1.5">
              Type afspraak
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-default bg-raised rounded-xl px-4 py-3 text-body-sm text-fg focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            >
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-600 text-white px-6 py-3 rounded-xl text-body-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-soft"
            >
              {submitting ? "Opslaan..." : "Afspraak opslaan"}
            </button>
            <Link href="/planning" className="text-body-sm text-fg-subtle hover:text-fg-muted transition-colors">
              Annuleren
            </Link>
          </div>
        </form>
      </main>
    </AppShell>
  );
}
