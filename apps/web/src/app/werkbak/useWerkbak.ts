"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ecdFetch, getUserId, getUserRole } from "../../lib/api";
import { workflowFetch } from "../../lib/workflow-api";

/* ---------- Types (contract met de bridge/catalogus, zie W1-plan) ---------- */

export interface TaakVeld {
  name: string;
  label: string;
  type: "boolean" | "text" | "select" | "number";
  options?: Array<{ value: string; label: string }>;
  verplicht?: boolean;
}

interface CatalogusStap {
  taskKey: string;
  naam: string;
  rol: string;
  velden: TaakVeld[];
}

interface CatalogusProces {
  key: string;
  naam: string;
  omschrijving: string;
  trigger: string;
  stappen: CatalogusStap[];
}

export type WerkbakScope = "mijn" | "beschikbaar" | "alle";

export interface WerkbakTaak {
  id: string;
  bron: "flowable" | "fhir";
  naam: string;
  omschrijving?: string;
  processKey: string;
  procesNaam: string;
  clientRef?: string;
  clientNaam?: string;
  aangemaakt: string;
  deadline?: string | null;
  assignee?: string | null;
  taskDefinitionKey?: string;
  velden: TaakVeld[];
}

interface FlowableTaakDto {
  id: string;
  name: string;
  description?: string;
  assignee?: string | null;
  createTime: string;
  dueDate?: string | null;
  processDefinitionId?: string;
  taskDefinitionKey?: string;
  variables?: Array<{ name: string; value: unknown }>;
}

interface FhirTaskDto {
  resourceType: "Task";
  id?: string;
  status?: string;
  code?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  description?: string;
  authoredOn?: string;
  executionPeriod?: { end?: string };
  for?: { reference?: string; display?: string };
  owner?: { reference?: string };
}

interface FhirBundle<T> {
  resourceType: "Bundle";
  entry?: Array<{ resource: T }>;
}

const OVERSIGHT_ROLLEN = new Set(["teamleider", "beheerder", "tenant-admin"]);
const FHIR_VELDEN: TaakVeld[] = [{ name: "opmerking", label: "Opmerking", type: "text" }];

function processKeyVan(processDefinitionId?: string): string {
  return processDefinitionId?.split(":")[0] ?? "";
}

function variabele(taak: FlowableTaakDto, naam: string): string | undefined {
  const waarde = taak.variables?.find((v) => v.name === naam)?.value;
  return typeof waarde === "string" ? waarde : undefined;
}

/* ---------- Hook ---------- */

export function useWerkbak() {
  const rol = typeof window !== "undefined" ? getUserRole() : "zorgmedewerker";
  const eigenId = typeof window !== "undefined" ? getUserId() : null;
  const heeftOversight = OVERSIGHT_ROLLEN.has(rol);

  const [scope, setScope] = useState<WerkbakScope>("beschikbaar");
  const [flowableTaken, setFlowableTaken] = useState<Record<WerkbakScope, FlowableTaakDto[]>>({
    mijn: [],
    beschikbaar: [],
    alle: [],
  });
  const [fhirTaken, setFhirTaken] = useState<FhirTaskDto[]>([]);
  const [catalogus, setCatalogus] = useState<CatalogusProces[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [actieFout, setActieFout] = useState<string | null>(null);
  const [bezigMet, setBezigMet] = useState<string | null>(null);

  const herlaad = useCallback(async () => {
    setLaden(true);
    setFout(null);

    const scopes: WerkbakScope[] = heeftOversight
      ? ["mijn", "beschikbaar", "alle"]
      : ["mijn", "beschikbaar"];

    const [flowableResultaten, fhirResultaat, catalogusResultaat] = await Promise.all([
      Promise.all(
        scopes.map((s) =>
          workflowFetch<{ data: FlowableTaakDto[] }>(`/api/taken?scope=${s}`),
        ),
      ),
      ecdFetch<FhirBundle<FhirTaskDto>>("/api/fhir-taken"),
      workflowFetch<{ processen: CatalogusProces[] }>("/api/catalogus"),
    ]);

    const nieuweTaken: Record<WerkbakScope, FlowableTaakDto[]> = {
      mijn: [],
      beschikbaar: [],
      alle: [],
    };
    let eersteFout: string | null = null;
    scopes.forEach((s, i) => {
      const resultaat = flowableResultaten[i];
      if (resultaat?.error) {
        eersteFout = eersteFout ?? resultaat.error;
      } else {
        nieuweTaken[s] = resultaat?.data?.data ?? [];
      }
    });

    setFlowableTaken(nieuweTaken);
    setFhirTaken((fhirResultaat.data?.entry ?? []).map((e) => e.resource));
    if (catalogusResultaat.data?.processen) {
      setCatalogus(catalogusResultaat.data.processen);
    }
    // FHIR-taken zijn een aanvulling; alleen een Flowable-fout is blokkerend
    setFout(eersteFout);
    setLaden(false);
  }, [heeftOversight]);

  useEffect(() => {
    void herlaad();
  }, [herlaad]);

  /* ---------- Mapping naar WerkbakTaak ---------- */

  const procesOpKey = useMemo(() => {
    const map = new Map<string, CatalogusProces>();
    for (const p of catalogus) map.set(p.key, p);
    return map;
  }, [catalogus]);

  const mapFlowable = useCallback(
    (taak: FlowableTaakDto): WerkbakTaak => {
      const key = processKeyVan(taak.processDefinitionId);
      const proces = procesOpKey.get(key);
      const stap = proces?.stappen.find((s) => s.taskKey === taak.taskDefinitionKey);
      return {
        id: taak.id,
        bron: "flowable",
        naam: taak.name,
        omschrijving: taak.description,
        processKey: key,
        procesNaam: proces?.naam ?? (key || "Proces"),
        clientRef: variabele(taak, "clientRef"),
        clientNaam: variabele(taak, "clientNaam"),
        aangemaakt: taak.createTime,
        deadline: taak.dueDate ?? null,
        assignee: taak.assignee ?? null,
        taskDefinitionKey: taak.taskDefinitionKey,
        velden: stap?.velden ?? [{ name: "opmerking", label: "Opmerking", type: "text" }],
      };
    },
    [procesOpKey],
  );

  const mapFhir = useCallback((taak: FhirTaskDto): WerkbakTaak => {
    const ownerId = taak.owner?.reference?.replace("Practitioner/", "") ?? null;
    return {
      id: taak.id ?? "",
      bron: "fhir",
      naam: taak.code?.text ?? taak.code?.coding?.[0]?.display ?? "Taak",
      omschrijving: taak.description,
      processKey: taak.code?.coding?.[0]?.code ?? "fhir-taak",
      procesNaam: "Zorgplan-evaluatie",
      clientRef: taak.for?.reference,
      clientNaam: taak.for?.display,
      aangemaakt: taak.authoredOn ?? new Date().toISOString(),
      deadline: taak.executionPeriod?.end ?? null,
      assignee: ownerId,
      velden: FHIR_VELDEN,
    };
  }, []);

  const taken = useMemo<Record<WerkbakScope, WerkbakTaak[]>>(() => {
    const fhirAlle = fhirTaken.map(mapFhir);
    const fhirMijn = fhirAlle.filter((t) => t.assignee && t.assignee === eigenId);
    const fhirBeschikbaar = fhirAlle.filter((t) => !t.assignee);

    return {
      mijn: [...flowableTaken.mijn.map(mapFlowable), ...fhirMijn],
      beschikbaar: [...flowableTaken.beschikbaar.map(mapFlowable), ...fhirBeschikbaar],
      alle: [...flowableTaken.alle.map(mapFlowable), ...fhirAlle],
    };
  }, [flowableTaken, fhirTaken, mapFlowable, mapFhir, eigenId]);

  const aantallen = useMemo(
    () => ({
      mijn: taken.mijn.length,
      beschikbaar: taken.beschikbaar.length,
      ...(heeftOversight ? { alle: taken.alle.length } : {}),
    }),
    [taken, heeftOversight],
  );

  /* ---------- Acties (bron-routing) ---------- */

  const claim = useCallback(
    async (taak: WerkbakTaak) => {
      setActieFout(null);
      setBezigMet(taak.id);
      const { error } =
        taak.bron === "fhir"
          ? await ecdFetch(`/api/fhir-taken/${taak.id}/claim`, { method: "POST" })
          : await workflowFetch(`/api/taken/${taak.id}/claim`, { method: "POST" });
      setBezigMet(null);
      if (error) {
        setActieFout(error);
        return false;
      }
      await herlaad();
      return true;
    },
    [herlaad],
  );

  const geefTerug = useCallback(
    async (taak: WerkbakTaak) => {
      if (taak.bron === "fhir") return false; // FHIR-taken kennen geen teruggeven
      setActieFout(null);
      setBezigMet(taak.id);
      const { error } = await workflowFetch(`/api/taken/${taak.id}/unclaim`, { method: "POST" });
      setBezigMet(null);
      if (error) {
        setActieFout(error);
        return false;
      }
      await herlaad();
      return true;
    },
    [herlaad],
  );

  const voltooi = useCallback(
    async (taak: WerkbakTaak, waarden: Record<string, string>) => {
      setActieFout(null);
      setBezigMet(taak.id);

      let error: string | null;
      if (taak.bron === "fhir") {
        ({ error } = await ecdFetch(`/api/fhir-taken/${taak.id}/complete`, {
          method: "POST",
          body: JSON.stringify({ opmerking: waarden["opmerking"] ?? "" }),
        }));
      } else {
        // Typeer de waarden conform het veldtype: Flowable-gateways
        // (bv. ${goedgekeurd == true}) vereisen echte booleans/getallen.
        const variables: Record<string, unknown> = {};
        for (const veld of taak.velden) {
          const ruw = waarden[veld.name];
          if (ruw === undefined || ruw === "") continue;
          if (veld.type === "boolean") variables[veld.name] = ruw === "true";
          else if (veld.type === "number") variables[veld.name] = Number(ruw);
          else variables[veld.name] = ruw;
        }
        ({ error } = await workflowFetch(`/api/taken/${taak.id}/complete`, {
          method: "POST",
          body: JSON.stringify({ variables }),
        }));
      }

      setBezigMet(null);
      if (error) {
        setActieFout(error);
        return false;
      }
      await herlaad();
      return true;
    },
    [herlaad],
  );

  return {
    rol,
    eigenId,
    heeftOversight,
    scope,
    setScope,
    taken,
    aantallen,
    laden,
    fout,
    actieFout,
    bezigMet,
    herlaad,
    claim,
    geefTerug,
    voltooi,
  };
}
