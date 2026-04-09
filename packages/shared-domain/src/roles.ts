/**
 * Role definitions for OpenZorg.
 * These map to Medplum AccessPolicy resources.
 */

export type OpenZorgRole = "beheerder" | "zorgmedewerker" | "planner" | "teamleider";

export const ALL_ROLES: readonly OpenZorgRole[] = [
  "beheerder",
  "zorgmedewerker",
  "planner",
  "teamleider",
] as const;

export interface RoleDefinition {
  readonly role: OpenZorgRole;
  readonly displayName: string;
  readonly description: string;
}

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    role: "beheerder",
    displayName: "Beheerder",
    description: "Functioneel beheerder: beheert processen, formulieren, validatieregels en gebruikers",
  },
  {
    role: "zorgmedewerker",
    displayName: "Zorgmedewerker",
    description: "Wijkverpleegkundige of verzorgende: raadpleegt dossiers, rapporteert, bekijkt planning",
  },
  {
    role: "planner",
    displayName: "Planner",
    description: "Maakt roosters, beheert beschikbaarheid, plant afspraken",
  },
  {
    role: "teamleider",
    displayName: "Teamleider",
    description: "Monitort caseload, bekijkt kwaliteitsindicatoren, handelt escalaties af",
  },
] as const;

export function getRoleDefinition(role: OpenZorgRole): RoleDefinition {
  const definition = ROLE_DEFINITIONS.find((d) => d.role === role);
  if (!definition) {
    throw new Error(`Unknown role: ${role}`);
  }
  return definition;
}
