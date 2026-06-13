"use client";

import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, Section } from "@openzorg/shared-ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../components/AppShell";
import { getUserRole } from "../../lib/api";
import { planningFetch } from "../../lib/planning-api";
import { workflowFetch } from "../../lib/workflow-api";

interface FhirBundle<T> {
  entry?: Array<{ resource: T }>;
}

interface FhirAppointment {
  id?: string;
  start?: string;
  end?: string;
  description?: string;
  status?: string;
  participant?: Array<{ actor?: { reference?: string; display?: string } }>;
}

interface WorkflowTaak {
  id: string;
  name?: string;
  dueDate?: string | null;
}

interface TakenResponse {
  data: WorkflowTaak[];
  total: number;
}

function tijd(iso?: string): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function vandaagIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function datumLabel(): string {
  return new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

function begroeting(): string {
  const uur = new Date().getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

export default function VandaagPage() {
  return (
    <AppShell>
      <VandaagInhoud />
    </AppShell>
  );
}

function VandaagInhoud() {
  // Welke medewerker ben ik? Tot er een /api/me-koppeling is (account → Practitioner)
  // lezen we een eventueel eerder gezette id uit localStorage. Geen medewerker-lijst
  // ophalen: een zorgmedewerker mag /api/medewerkers niet lezen (403 → /geen-toegang).
  const [practitionerId] = useState<string>(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("openzorg_practitioner_id") ?? "",
  );
  const [afspraken, setAfspraken] = useState<FhirAppointment[]>([]);
  const [taken, setTaken] = useState<WorkflowTaak[]>([]);
  const [ladenRoute, setLadenRoute] = useState(true);
  const [ladenTaken, setLadenTaken] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laadRoute = useCallback(() => {
    setLadenRoute(true);
    setFout(null);
    if (!practitionerId) {
      setAfspraken([]);
      setLadenRoute(false);
      return;
    }
    planningFetch<FhirBundle<FhirAppointment>>(
      `/api/dagplanning/medewerker/${practitionerId}?datum=${vandaagIso()}`,
    ).then(({ data, error }) => {
      if (error) {
        setFout(error);
      } else {
        setAfspraken(
          (data?.entry?.map((e) => e.resource) ?? []).sort((a, b) =>
            (a.start ?? "").localeCompare(b.start ?? ""),
          ),
        );
      }
      setLadenRoute(false);
    });
  }, [practitionerId]);

  const laadTaken = useCallback(() => {
    setLadenTaken(true);
    const rol = typeof window === "undefined" ? "zorgmedewerker" : getUserRole();
    // Tolerant: de workflow-module kan uitstaan — dan tonen we simpelweg geen taken.
    workflowFetch<TakenResponse>(`/api/taken?userId=${encodeURIComponent(rol)}`).then(({ data }) => {
      setTaken((data?.data ?? []).slice(0, 5));
      setLadenTaken(false);
    });
  }, []);

  useEffect(() => {
    laadRoute();
  }, [laadRoute]);

  useEffect(() => {
    laadTaken();
  }, [laadTaken]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader titel={begroeting()} omschrijving={datumLabel()} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section
          titel="Mijn route vandaag"
          actie={
            <Link
              href="/planning/dagplanning"
              className="text-xs font-medium text-brand-600 hover:text-brand-800"
            >
              Volledige dagplanning
            </Link>
          }
        >
          {fout ? (
            <ErrorState melding={fout} onOpnieuw={laadRoute} />
          ) : ladenRoute ? (
            <LoadingSkeleton regels={5} />
          ) : !practitionerId ? (
            <EmptyState
              titel="Je rooster verschijnt hier binnenkort"
              uitleg="Zodra je account aan je medewerkerprofiel is gekoppeld, zie je hier je route en afspraken van vandaag."
            />
          ) : afspraken.length === 0 ? (
            <EmptyState
              titel="Geen afspraken vandaag"
              uitleg="Je dag is leeg — check de dagplanning of je berichten."
            />
          ) : (
            <ol className="divide-y divide-surface-100 dark:divide-surface-800">
              {afspraken.map((a) => {
                const client = a.participant?.find((p) =>
                  p.actor?.reference?.startsWith("Patient/"),
                );
                const clientId = client?.actor?.reference?.split("/")[1];
                return (
                  <li key={a.id} className="flex items-center gap-4 py-2.5">
                    <span className="w-24 shrink-0 font-mono text-sm text-fg-muted">
                      {tijd(a.start)}–{tijd(a.end)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">
                        {client?.actor?.display ?? a.description ?? "Afspraak"}
                      </p>
                      {a.description && client?.actor?.display && (
                        <p className="truncate text-xs text-fg-muted">{a.description}</p>
                      )}
                    </div>
                    {clientId && (
                      <Link
                        href={`/ecd/${clientId}`}
                        className="shrink-0 rounded-md border border-default px-3 py-1 text-xs font-medium text-fg-muted hover:bg-sunken"
                      >
                        Dossier
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        <div className="space-y-4">
          <Section
            titel="Open taken"
            actie={
              <Link href="/werkbak" className="text-xs font-medium text-brand-600 hover:text-brand-800">
                Werkbak
              </Link>
            }
          >
            {ladenTaken ? (
              <LoadingSkeleton regels={3} />
            ) : taken.length === 0 ? (
              <EmptyState titel="Geen open taken" uitleg="Alles is opgepakt. Lekker bezig." />
            ) : (
              <ul className="space-y-2">
                {taken.map((t) => (
                  <li key={t.id} className="text-sm">
                    <Link href="/werkbak" className="font-medium text-fg hover:text-brand-700">
                      {t.name ?? "Taak"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            titel="Overdracht"
            actie={
              <Link href="/overdracht" className="text-xs font-medium text-brand-600 hover:text-brand-800">
                Openen
              </Link>
            }
          >
            <p className="text-sm text-fg-muted">
              Lees de overdracht van de vorige dienst voordat je begint.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
