import type { Context } from "hono";

import type { AppEnv } from "../app.js";

import { medplumFetch } from "./medplum-client.js";

export const CLIENTNUMMER_SYSTEM = "https://openzorg.nl/NamingSystem/clientnummer";

/**
 * Hoogste bestaande clientnummer van de tenant (0 als er nog geen is).
 * Geëxtraheerd uit de clients-route (W3-1) zodat de CSV-import dezelfde
 * nummering kan voortzetten zonder per rij een query te doen.
 */
export async function hoogsteClientnummer(c: Context<AppEnv>): Promise<number> {
  const res = await medplumFetch(
    c,
    `/fhir/R4/Patient?identifier=${encodeURIComponent(CLIENTNUMMER_SYSTEM)}|&_count=1&_sort=-_lastUpdated&_elements=identifier`,
  );

  if (!res.ok) return 0;

  const bundle = (await res.json()) as {
    entry?: Array<{
      resource: { identifier?: Array<{ system?: string; value?: string }> };
    }>;
  };

  const bestaande =
    bundle.entry
      ?.flatMap((e) => e.resource.identifier ?? [])
      .filter((id) => id.system === CLIENTNUMMER_SYSTEM)
      .map((id) => {
        const match = id.value?.match(/^C-(\d+)$/);
        return match ? parseInt(match[1] ?? "0", 10) : 0;
      }) ?? [];

  return Math.max(0, ...bestaande);
}

export function formatteerClientnummer(nummer: number): string {
  return `C-${String(nummer).padStart(5, "0")}`;
}

/** Volgende vrije clientnummer (bestaand gedrag van de clients-route). */
export async function volgendClientnummer(c: Context<AppEnv>): Promise<string> {
  const hoogste = await hoogsteClientnummer(c);
  return formatteerClientnummer(hoogste + 1);
}
