"use client";

import { LoadingSkeleton, Section } from "@openzorg/shared-ui";
import Link from "next/link";
import { useEffect } from "react";

import { useWerkbak } from "../../werkbak/useWerkbak";

interface TakenTellerProps {
  /** Meldt aan de container of de sectie kon laden (voor de alles-faalt-staat). */
  onResultaat: (gelukt: boolean) => void;
}

/**
 * Kaart met de werkbak-aantallen ("X voor jou · Y beschikbaar"). Hergebruikt
 * de werkbak-hook; bij een fout verbergt de kaart zichzelf stil (neven-data).
 */
export function TakenTeller({ onResultaat }: TakenTellerProps) {
  const { aantallen, laden, fout } = useWerkbak();

  useEffect(() => {
    if (laden) return;
    onResultaat(fout === null);
  }, [laden, fout, onResultaat]);

  if (fout) return null;

  return (
    <Section
      titel="Taken"
      actie={
        <Link href="/werkbak" className="text-xs font-medium text-brand-600 hover:text-brand-800">
          Naar werkbak
        </Link>
      }
    >
      {laden ? (
        <LoadingSkeleton regels={2} />
      ) : (
        <p className="text-sm text-fg-muted">
          <span className="font-display text-2xl font-bold text-fg">{aantallen.mijn}</span> voor
          jou
          <span className="mx-2 text-fg-subtle" aria-hidden="true">
            ·
          </span>
          <span className="font-display text-2xl font-bold text-fg">{aantallen.beschikbaar}</span>{" "}
          beschikbaar
        </p>
      )}
    </Section>
  );
}
