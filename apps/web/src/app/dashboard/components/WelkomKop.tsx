"use client";

import { useEffect, useState } from "react";

import { haalMe } from "../../../lib/api";

/** Dagdeel-groet: bewust drie dagdelen (ochtend telt vanaf middernacht). */
function begroeting(): string {
  const uur = new Date().getHours();
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

/** Volledige datum in het Nederlands, met hoofdletter voorop. */
function datumLabel(): string {
  const tekst = new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/**
 * Welkomstkop van de werkruimte-start. Toont de dagdeel-groet met de naam van
 * de ingelogde gebruiker (server-identiteit via haalMe, met localStorage als
 * terugval) en de datum van vandaag. Deze kop vervangt de PageHeader.
 */
export function WelkomKop() {
  const [naam, setNaam] = useState("");

  useEffect(() => {
    const opgeslagen = localStorage.getItem("openzorg_user_name") ?? "";
    if (opgeslagen) setNaam(opgeslagen);

    let actief = true;
    haalMe().then((me) => {
      if (actief && me?.naam) setNaam(me.naam);
    });
    return () => {
      actief = false;
    };
  }, []);

  return (
    <header>
      <h1 className="font-display text-3xl font-bold text-fg">
        {begroeting()}
        {naam ? `, ${naam}` : ""}
      </h1>
      <p className="mt-1 text-sm text-fg-muted">{datumLabel()}</p>
    </header>
  );
}
