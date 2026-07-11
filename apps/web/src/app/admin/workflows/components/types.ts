/** Gedeelde types voor de Processen-hub (W1-4). */

export interface TaakVeld {
  name: string;
  label: string;
  type: "boolean" | "text" | "select" | "number";
  options?: Array<{ value: string; label: string }>;
  verplicht?: boolean;
}

export interface CatalogusStap {
  taskKey: string;
  naam: string;
  rol: string;
  velden: TaakVeld[];
}

export interface CatalogusProces {
  key: string;
  naam: string;
  omschrijving: string;
  trigger: string;
  stappen: CatalogusStap[];
}

export interface ProcesDefinitie {
  id: string;
  key: string;
  name: string;
  version: number;
}

export interface ProcesInstantie {
  id: string;
  processDefinitionId?: string;
  startTime?: string;
  variables?: Array<{ name: string; value: unknown }>;
}

export interface InstantieTaak {
  id: string;
  name: string;
  assignee?: string | null;
  processInstanceId?: string;
  createTime?: string;
}

export function processKeyVanDefinitie(processDefinitionId?: string): string {
  return processDefinitionId?.split(":")[0] ?? "";
}

export function instantieVariabele(instantie: ProcesInstantie, naam: string): string | undefined {
  const waarde = instantie.variables?.find((v) => v.name === naam)?.value;
  return typeof waarde === "string" ? waarde : undefined;
}
