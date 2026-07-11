"use client";

import { LoadingSkeleton, Section } from "@openzorg/shared-ui";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ecdFetch } from "../../../lib/api";

interface FhirFlag {
  resourceType?: string;
  id?: string;
  code?: { text?: string };
  category?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
  subject?: { reference?: string; display?: string };
  extension?: Array<{ url?: string; valueString?: string }>;
}

interface FhirBundle {
  entry?: Array<{ resource: FhirFlag }>;
}

interface SignaleringenCardProps {
  /** Meldt aan de container of de sectie kon laden (voor de alles-faalt-staat). */
  onResultaat: (gelukt: boolean) => void;
}

function ernstVan(flag: FhirFlag): string {
  return flag.extension?.find((e) => e.url?.endsWith("signalering-ernst"))?.valueString ?? "midden";
}

function categorieVan(flag: FhirFlag): string {
  return (
    flag.category?.[0]?.coding?.[0]?.display ?? flag.category?.[0]?.coding?.[0]?.code ?? "algemeen"
  );
}

function clientIdVan(flag: FhirFlag): string | undefined {
  return flag.subject?.reference?.replace("Patient/", "");
}

/**
 * Open signaleringen (actieve FHIR Flags, zelfde endpoint als de
 * signaleringen-pagina), maximaal 5. Bij een fout verbergt de kaart zichzelf.
 */
export function SignaleringenCard({ onResultaat }: SignaleringenCardProps) {
  const [flags, setFlags] = useState<FhirFlag[]>([]);
  const [laden, setLaden] = useState(true);
  const [verborgen, setVerborgen] = useState(false);

  useEffect(() => {
    let actief = true;
    ecdFetch<FhirBundle>("/api/signaleringen/overzicht?limit=5", { stil403: true }).then(
      ({ data, error, status }) => {
        if (!actief) return;
        if (error || !data) {
          setVerborgen(true);
          onResultaat(status === 403);
        } else {
          setFlags(
            (data.entry ?? [])
              .map((e) => e.resource)
              .filter((r) => r.resourceType === "Flag")
              .slice(0, 5),
          );
          onResultaat(true);
        }
        setLaden(false);
      },
    );
    return () => {
      actief = false;
    };
  }, [onResultaat]);

  if (verborgen) return null;

  return (
    <Section
      titel="Signaleringen"
      actie={
        <Link
          href="/signaleringen"
          className="text-xs font-medium text-brand-600 hover:text-brand-800"
        >
          Alle signaleringen
        </Link>
      }
    >
      {laden ? (
        <LoadingSkeleton regels={3} />
      ) : flags.length === 0 ? (
        <p className="text-sm text-fg-muted">Geen open signaleringen — een rustig beeld.</p>
      ) : (
        <ul className="divide-y divide-default">
          {flags.map((flag, index) => {
            const clientId = clientIdVan(flag);
            return (
              <li key={flag.id ?? String(index)}>
                <Link
                  href={clientId ? `/ecd/${clientId}/signaleringen` : "/signaleringen"}
                  className="-mx-1 flex items-center gap-3 rounded-md px-1 py-2 transition-colors hover:bg-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {flag.code?.text ?? categorieVan(flag)}
                    </p>
                    {flag.subject?.display && (
                      <p className="truncate text-xs text-fg-subtle">{flag.subject.display}</p>
                    )}
                  </div>
                  {ernstVan(flag) === "hoog" && (
                    <span className="shrink-0 rounded-full bg-coral-100 px-2 py-0.5 text-xs font-medium text-coral-800 dark:bg-coral-950/30 dark:text-coral-300">
                      Hoog
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
