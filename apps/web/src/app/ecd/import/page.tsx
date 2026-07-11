"use client";

import { EmptyState, ErrorState, PageHeader } from "@openzorg/shared-ui";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import AppShell from "../../../components/AppShell";
import { ecdFetch } from "../../../lib/api";

/**
 * CSV-cliëntimport (W3-1): één vast formaat, een voorbeeldbestand en een
 * foutenrapport dat per rij zegt wat er mis is. Gemaakt voor het
 * pilotprofiel: ~80 cliënten opvoeren in minuten, niet in dagen.
 */

interface ImportFout {
  rij: number;
  veld?: string;
  melding: string;
}

interface ImportResultaat {
  totaal: number;
  aangemaakt: number;
  fouten: ImportFout[];
}

const KOLOMMEN = "achternaam;voornaam;geboortedatum;bsn;straat;huisnummer;postcode;plaats;locatie";

export default function ClientImportPage() {
  const bestandId = useId();
  const bestandRef = useRef<HTMLInputElement>(null);
  const [bestandsnaam, setBestandsnaam] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [resultaat, setResultaat] = useState<ImportResultaat | null>(null);

  async function handleImport() {
    const bestand = bestandRef.current?.files?.[0];
    if (!bestand) {
      setFout("Kies eerst een CSV-bestand.");
      return;
    }

    setFout(null);
    setResultaat(null);
    setBezig(true);

    const inhoud = await bestand.text();
    const { data, error } = await ecdFetch<ImportResultaat>("/api/clients/import", {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: inhoud,
    });

    setBezig(false);
    if (error && !data?.fouten) {
      setFout(error);
      return;
    }
    if (data) setResultaat(data);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          titel="Cliënten importeren"
          omschrijving="Voer in één keer een lijst cliënten op vanuit een CSV-bestand — bijvoorbeeld een export uit je vorige systeem of een ingevuld voorbeeldbestand."
        />

        {/* Formaat-uitleg */}
        <div className="mt-6 rounded-xl border border-default bg-raised p-5">
          <h2 className="text-sm font-semibold text-fg">Het formaat</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Eén cliënt per regel, met deze kolommen in de eerste regel (volgorde vrij, scheiding met{" "}
            <code className="rounded bg-sunken px-1">;</code> of <code className="rounded bg-sunken px-1">,</code>):
          </p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-sunken px-3 py-2 text-xs text-fg">
            {KOLOMMEN}
          </code>
          <ul className="mt-3 space-y-1 text-sm text-fg-muted">
            <li>· <span className="font-medium text-fg">achternaam</span> en <span className="font-medium text-fg">geboortedatum</span> (JJJJ-MM-DD) zijn verplicht</li>
            <li>· <span className="font-medium text-fg">bsn</span> is optioneel en wordt gecontroleerd (elfproef + al-bestaand)</li>
            <li>· <span className="font-medium text-fg">locatie</span> moet de naam van een bestaande locatie zijn (zie Organisatie)</li>
          </ul>
          <a
            href="/voorbeelden/clienten-import-voorbeeld.csv"
            download
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-800 hover:underline"
          >
            Download het voorbeeldbestand
          </a>
        </div>

        {/* Upload */}
        <div className="mt-4 rounded-xl border border-default bg-raised p-5">
          <label htmlFor={bestandId} className="block text-sm font-semibold text-fg">
            CSV-bestand
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id={bestandId}
              ref={bestandRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setBestandsnaam(e.target.files?.[0]?.name ?? null)}
              className="text-sm text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-950/30 dark:file:text-brand-300"
            />
            <button
              onClick={() => void handleImport()}
              disabled={bezig || !bestandsnaam}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 btn-press"
            >
              {bezig ? "Importeren…" : "Importeren"}
            </button>
          </div>
        </div>

        {fout && (
          <div className="mt-4">
            <ErrorState melding={fout} />
          </div>
        )}

        {/* Resultaat */}
        {resultaat && (
          <div className="mt-6">
            <div className="grid grid-cols-3 gap-3">
              <ResultaatKaart label="Rijen in bestand" waarde={resultaat.totaal} />
              <ResultaatKaart label="Aangemaakt" waarde={resultaat.aangemaakt} accent="goed" />
              <ResultaatKaart label="Fouten" waarde={resultaat.fouten.length} accent={resultaat.fouten.length > 0 ? "fout" : undefined} />
            </div>

            {resultaat.fouten.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  titel="Alles gelukt"
                  uitleg={`${resultaat.aangemaakt} cliënten zijn aangemaakt met een eigen cliëntnummer.`}
                  actieLabel="Naar de cliëntenlijst"
                  onActie={() => {
                    window.location.href = "/ecd";
                  }}
                />
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-default bg-raised">
                <table className="min-w-full divide-y divide-default">
                  <thead className="bg-page">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-subtle">Rij</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-subtle">Veld</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-fg-subtle">Probleem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default">
                    {resultaat.fouten.map((f, i) => (
                      <tr key={i} className="hover:bg-sunken">
                        <td className="px-4 py-3 text-sm text-fg">{f.rij}</td>
                        <td className="px-4 py-3 text-sm text-fg-muted">{f.veld ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-fg-muted">{f.melding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {resultaat.aangemaakt > 0 && resultaat.fouten.length > 0 && (
              <p className="mt-3 text-sm text-fg-muted">
                De {resultaat.aangemaakt} geslaagde rijen staan al in de{" "}
                <Link href="/ecd" className="font-medium text-brand-600 hover:underline">
                  cliëntenlijst
                </Link>
                . Corrigeer de foutrijen in je bestand en importeer alleen die opnieuw.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ResultaatKaart({ label, waarde, accent }: { label: string; waarde: number; accent?: "goed" | "fout" }) {
  const kleur =
    accent === "goed"
      ? "text-emerald-700 dark:text-emerald-300"
      : accent === "fout"
        ? "text-coral-700 dark:text-coral-300"
        : "text-fg";
  return (
    <div className="rounded-xl border border-default bg-raised p-4">
      <p className="text-xs font-medium uppercase text-fg-subtle">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${kleur}`}>{waarde}</p>
    </div>
  );
}
