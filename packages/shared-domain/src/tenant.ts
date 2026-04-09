/**
 * Multi-tenancy types for OpenZorg.
 * Each tenant represents a separate care organization (zorginstelling).
 * Tenant isolation is enforced at database level via RLS and at API level via Medplum projects.
 */

export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly medplumProjectId: string;
  readonly enabledModules: ReadonlyArray<OpenZorgModule>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type OpenZorgModule = "ecd" | "planning" | "facturatie" | "rapportage";

export const ALL_MODULES: readonly OpenZorgModule[] = [
  "ecd",
  "planning",
  "facturatie",
  "rapportage",
] as const;

export const MVP_MODULES: readonly OpenZorgModule[] = ["ecd", "planning"] as const;

export function isModuleEnabled(tenant: Tenant, module: OpenZorgModule): boolean {
  return tenant.enabledModules.includes(module);
}
