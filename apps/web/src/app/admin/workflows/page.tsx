"use client";

import { ErrorState, LoadingSkeleton, PageHeader } from "@openzorg/shared-ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "../../../components/AppShell";
import { useFeatureFlag } from "../../../lib/features";
import { workflowFetch } from "../../../lib/workflow-api";

import { GeavanceerdPaneel } from "./components/GeavanceerdPaneel";
import { LopendeZorgpaden } from "./components/LopendeZorgpaden";
import { ProcessenActief } from "./components/ProcessenActief";
import { SjablonenGalerij } from "./components/SjablonenGalerij";
import type { CatalogusProces, InstantieTaak, ProcesDefinitie, ProcesInstantie } from "./components/types";

/**
 * Processen-hub (W1-4, spec §4.2): procesbeheer in domeintaal.
 *
 * Vier tabs — Actieve zorgpaden, Sjablonen ("Activeren" i.p.v. "Deployen"),
 * Lopend (voortgang per cliënt) en Geavanceerd (canvas/beslisregels/engine-
 * details). De oude "Taakwerkbak"-debugsectie is verwijderd: taken horen in
 * de werkbak.
 */

type HubTab = "actief" | "sjablonen" | "lopend" | "geavanceerd";

const TABS: Array<{ id: HubTab; label: string }> = [
  { id: "actief", label: "Actieve zorgpaden" },
  { id: "sjablonen", label: "Sjablonen" },
  { id: "lopend", label: "Lopend" },
  { id: "geavanceerd", label: "Geavanceerd" },
];

export default function ProcessenHubPage() {
  return (
    <Suspense fallback={null}>
      <ProcessenHub />
    </Suspense>
  );
}

function ProcessenHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dmnBeschikbaar = useFeatureFlag("dmn-editor");

  const tabParam = searchParams.get("tab") as HubTab | null;
  const tab: HubTab = TABS.some((t) => t.id === tabParam) ? (tabParam as HubTab) : "actief";

  const [catalogus, setCatalogus] = useState<CatalogusProces[]>([]);
  const [definities, setDefinities] = useState<ProcesDefinitie[]>([]);
  const [instanties, setInstanties] = useState<ProcesInstantie[]>([]);
  const [taken, setTaken] = useState<InstantieTaak[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const herlaad = useCallback(async () => {
    setLaden(true);
    setFout(null);

    const [catalogusRes, definitiesRes, instantiesRes, takenRes] = await Promise.all([
      workflowFetch<{ processen: CatalogusProces[] }>("/api/catalogus"),
      workflowFetch<{ data: ProcesDefinitie[] }>("/api/processen"),
      workflowFetch<{ data: ProcesInstantie[] }>("/api/processen/instances"),
      // Eén tenant-brede taken-call; per instantie gegroepeerd voor "Lopend"
      workflowFetch<{ data: InstantieTaak[] }>("/api/taken?scope=alle"),
    ]);

    if (definitiesRes.error) {
      setFout(definitiesRes.error);
      setLaden(false);
      return;
    }

    setCatalogus(catalogusRes.data?.processen ?? []);
    setDefinities(definitiesRes.data?.data ?? []);
    setInstanties(instantiesRes.data?.data ?? []);
    setTaken(takenRes.data?.data ?? []);
    setLaden(false);
  }, []);

  useEffect(() => {
    void herlaad();
  }, [herlaad]);

  const takenPerInstantie = useMemo(() => {
    const map = new Map<string, InstantieTaak[]>();
    for (const taak of taken) {
      if (!taak.processInstanceId) continue;
      const lijst = map.get(taak.processInstanceId) ?? [];
      lijst.push(taak);
      map.set(taak.processInstanceId, lijst);
    }
    return map;
  }, [taken]);

  function gaNaarTab(volgende: HubTab) {
    router.replace(`/admin/workflows?tab=${volgende}`, { scroll: false });
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <PageHeader
          titel="Processen"
          omschrijving="Zorgpaden van jouw organisatie: activeren, volgen en ontwerpen."
        />

        <div role="tablist" aria-label="Processen-onderdelen" className="mb-6 mt-6 flex flex-wrap gap-1 rounded-xl border border-default bg-raised p-1">
          {TABS.map(({ id, label }) => {
            const actief = tab === id;
            const badge =
              id === "actief" ? definities.length : id === "lopend" ? instanties.length : null;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={actief}
                onClick={() => gaNaarTab(id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                  actief ? "bg-brand-600 text-white shadow-sm" : "text-fg-muted hover:bg-sunken"
                }`}
              >
                {label}
                {!laden && typeof badge === "number" && badge > 0 && (
                  <span
                    className={`ml-2 inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      actief ? "bg-white/20 text-white" : "bg-sunken text-fg-subtle"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {laden ? (
          <LoadingSkeleton regels={7} />
        ) : fout ? (
          <ErrorState melding={fout} onOpnieuw={() => void herlaad()} />
        ) : (
          <>
            {tab === "actief" && (
              <ProcessenActief
                catalogus={catalogus}
                definities={definities}
                instanties={instanties}
                onGestart={() => void herlaad()}
                naarSjablonen={() => gaNaarTab("sjablonen")}
              />
            )}
            {tab === "sjablonen" && (
              <SjablonenGalerij
                catalogus={catalogus}
                definities={definities}
                onGeactiveerd={() => void herlaad()}
              />
            )}
            {tab === "lopend" && (
              <LopendeZorgpaden
                catalogus={catalogus}
                instanties={instanties}
                takenPerInstantie={takenPerInstantie}
                onGewijzigd={() => void herlaad()}
              />
            )}
            {tab === "geavanceerd" && (
              <GeavanceerdPaneel definities={definities} dmnBeschikbaar={dmnBeschikbaar} />
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
