"use client";

import { useEffect, useState } from "react";

import AppShell from "../../../../components/AppShell";
import { ecdFetch } from "../../../../lib/api";
import { TabNav } from "../TabNav";

interface FhirFlag {
  id?: string;
  status?: string;
  category?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  code?: { text?: string; coding?: Array<{ display?: string }> };
  period?: { start?: string };
  extension?: Array<{ url?: string; valueString?: string }>;
}

interface FlagBundle {
  resourceType?: string;
  entry?: Array<{ resource: FhirFlag }>;
}

const ERNST_LABEL: Record<string, { label: string; cls: string }> = {
  laag: { label: "Laag", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300" },
  midden: { label: "Midden", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" },
  hoog: { label: "Hoog", cls: "bg-coral-100 text-coral-800 dark:bg-coral-950/30 dark:text-coral-300" },
};

function getErnst(f: FhirFlag): string {
  return (
    f.extension?.find((e) => e.url === "https://openzorg.nl/extensions/signalering-ernst")?.valueString ?? "midden"
  );
}

function getToelichting(f: FhirFlag): string | undefined {
  return f.extension?.find((e) => e.url === "https://openzorg.nl/extensions/signalering-toelichting")?.valueString;
}

function formatDatum(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function SignaleringenPage({ params }: { params: Promise<{ id: string }> }) {
  const [clientId, setClientId] = useState<string>("");
  const [flags, setFlags] = useState<FhirFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setClientId(p.id));
  }, [params]);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    ecdFetch<FlagBundle>(`/api/clients/${clientId}/signaleringen`).then(({ data }) => {
      setFlags(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <TabNav clientId={clientId} />
        <div className="mt-8">
          <h1 className="text-2xl font-bold text-fg mb-2">Signaleringen</h1>
          <p className="text-sm text-fg-muted mb-6">
            Actieve waarschuwingen (Flag) voor deze cliënt: valrisico, allergieën, MRSA, gedragsaandachtspunten.
          </p>

          {loading && <p className="text-fg-muted">Laden…</p>}

          {!loading && flags.length === 0 && (
            <div className="rounded-xl border border-default bg-raised p-8 text-center">
              <p className="text-fg-muted">Geen actieve signaleringen voor deze cliënt.</p>
            </div>
          )}

          {!loading && flags.length > 0 && (
            <div className="space-y-3">
              {flags.map((flag) => {
                const ernst = getErnst(flag);
                const ernstInfo = ERNST_LABEL[ernst] ?? ERNST_LABEL.midden!;
                const cat = flag.category?.[0]?.text ?? flag.category?.[0]?.coding?.[0]?.display ?? "—";
                const code = flag.code?.text ?? flag.code?.coding?.[0]?.display ?? "—";
                const toelichting = getToelichting(flag);
                return (
                  <div key={flag.id} className="rounded-xl border border-default bg-raised p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ernstInfo.cls}`}>
                            {ernstInfo.label}
                          </span>
                          <span className="text-xs text-fg-subtle">{cat}</span>
                        </div>
                        <div className="font-medium text-fg">{code}</div>
                        {toelichting && <div className="mt-1 text-sm text-fg-muted">{toelichting}</div>}
                      </div>
                      <div className="text-xs text-fg-subtle whitespace-nowrap">
                        Sinds {formatDatum(flag.period?.start)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-6 text-xs text-fg-subtle">
            Nieuwe signaleringen toevoegen of bestaande afsluiten kan via de <strong>Dashboard</strong>-sectie van de cliënt.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
