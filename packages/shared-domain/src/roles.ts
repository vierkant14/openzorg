/**
 * Role definitions for OpenZorg.
 * These map to Medplum AccessPolicy resources.
 */

export type OpenZorgRole = "tenant-admin" | "beheerder" | "zorgmedewerker" | "planner" | "teamleider";

export const ALL_ROLES: readonly OpenZorgRole[] = [
  "tenant-admin",
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
    role: "tenant-admin",
    displayName: "Tenant admin",
    description: "Applicatiebeheerder: beheert technische instellingen, rollen, feature flags, state-machines en API-koppelingen",
  },
  {
    role: "beheerder",
    displayName: "Functioneel beheerder",
    description: "Zorginhoudelijk beheerder: beheert medewerkers, organisatie, validatieregels, workflows en codelijsten",
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

/* ── Permissions ── */

export type Permission =
  | "clients:read"
  | "clients:write"
  | "clients:delete"
  | "zorgplan:read"
  | "zorgplan:write"
  | "rapportage:read"
  | "rapportage:write"
  | "documenten:read"
  | "documenten:write"
  | "medicatie:read"
  | "medicatie:write"
  | "mic:read"
  | "mic:write"
  | "planning:read"
  | "planning:write"
  | "berichten:read"
  | "berichten:write"
  | "medewerkers:read"
  | "medewerkers:write"
  | "organisatie:read"
  | "organisatie:write"
  | "configuratie:read"
  | "configuratie:write"
  | "workflows:read"
  | "workflows:write"
  | "rollen:read"
  | "rollen:write"
  | "state-machines:read"
  | "state-machines:write"
  | "feature-flags:read"
  | "feature-flags:write"
  | "api-keys:read"
  | "api-keys:write"
  | "ai-config:read"
  | "ai-config:write"
  | "ai-chat:read";

/**
 * Permission matrix: which role has which permissions.
 * Beheerder gets everything. Other roles are scoped.
 */
export const ROLE_PERMISSIONS: Record<OpenZorgRole, readonly Permission[]> = {
  "tenant-admin": [
    "clients:read", "clients:write", "clients:delete",
    "zorgplan:read", "zorgplan:write",
    "rapportage:read", "rapportage:write",
    "documenten:read", "documenten:write",
    "medicatie:read", "medicatie:write",
    "mic:read", "mic:write",
    "planning:read", "planning:write",
    "berichten:read", "berichten:write",
    "medewerkers:read", "medewerkers:write",
    "organisatie:read", "organisatie:write",
    "configuratie:read", "configuratie:write",
    "workflows:read", "workflows:write",
    "rollen:read", "rollen:write",
    "state-machines:read", "state-machines:write",
    "feature-flags:read", "feature-flags:write",
    "api-keys:read", "api-keys:write",
    "ai-config:read", "ai-config:write", "ai-chat:read",
  ],
  beheerder: [
    "clients:read", "clients:write", "clients:delete",
    "zorgplan:read", "zorgplan:write",
    "rapportage:read", "rapportage:write",
    "documenten:read", "documenten:write",
    "medicatie:read", "medicatie:write",
    "mic:read", "mic:write",
    "planning:read", "planning:write",
    "berichten:read", "berichten:write",
    "medewerkers:read", "medewerkers:write",
    "organisatie:read", "organisatie:write",
    "configuratie:read", "configuratie:write",
    "workflows:read", "workflows:write",
    "ai-chat:read",
  ],
  zorgmedewerker: [
    "clients:read", "clients:write",
    "zorgplan:read", "zorgplan:write",
    "rapportage:read", "rapportage:write",
    "documenten:read", "documenten:write",
    "medicatie:read",
    "mic:read", "mic:write",
    "planning:read",
    "berichten:read", "berichten:write",
    "ai-chat:read",
  ],
  planner: [
    "clients:read",
    "planning:read", "planning:write",
    "berichten:read", "berichten:write",
    "medewerkers:read",
  ],
  teamleider: [
    "clients:read", "clients:write",
    "zorgplan:read",
    "rapportage:read",
    "documenten:read",
    "medicatie:read",
    "mic:read", "mic:write",
    "planning:read", "planning:write",
    "berichten:read", "berichten:write",
    "medewerkers:read",
    "organisatie:read",
    "ai-chat:read",
  ],
} as const;

export function hasPermission(role: OpenZorgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissions(role: OpenZorgRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Route-to-permission mapping for backend middleware.
 * Maps API route prefixes to required permissions per HTTP method.
 */
export const ROUTE_PERMISSIONS: ReadonlyArray<{
  readonly pattern: string;
  readonly GET?: Permission;
  readonly POST?: Permission;
  readonly PUT?: Permission;
  readonly PATCH?: Permission;
  readonly DELETE?: Permission;
}> = [
  { pattern: "/api/clients", GET: "clients:read", POST: "clients:write", PUT: "clients:write", DELETE: "clients:delete" },
  { pattern: "/api/clients/*/contactpersonen", GET: "clients:read", POST: "clients:write", PUT: "clients:write", DELETE: "clients:write" },
  { pattern: "/api/clients/*/zorgplan", GET: "zorgplan:read", POST: "zorgplan:write", PUT: "zorgplan:write" },
  { pattern: "/api/clients/*/rapportages", GET: "rapportage:read", POST: "rapportage:write" },
  { pattern: "/api/clients/*/documenten", GET: "documenten:read", POST: "documenten:write", DELETE: "documenten:write" },
  { pattern: "/api/clients/*/medicatie", GET: "medicatie:read", POST: "medicatie:write", PUT: "medicatie:write", DELETE: "medicatie:write" },
  { pattern: "/api/clients/*/allergieen", GET: "clients:read", POST: "clients:write", DELETE: "clients:write" },
  { pattern: "/api/clients/*/vaccinaties", GET: "clients:read", POST: "clients:write", PUT: "clients:write", DELETE: "clients:write" },
  { pattern: "/api/clients/*/wilsverklaringen", GET: "clients:read", POST: "clients:write", DELETE: "clients:write" },
  { pattern: "/api/clients/*/medicatie-overzicht", GET: "medicatie:read", POST: "medicatie:write", PUT: "medicatie:write", DELETE: "medicatie:write" },
  { pattern: "/api/clients/*/foto", POST: "clients:write", DELETE: "clients:write" },
  { pattern: "/api/clients/*/diagnoses", GET: "clients:read", POST: "clients:write", PUT: "clients:write" },
  { pattern: "/api/clients/*/risicoscreenings", GET: "clients:read", POST: "clients:write" },
  { pattern: "/api/mic-meldingen", GET: "mic:read", POST: "mic:write" },
  { pattern: "/api/afspraken", GET: "planning:read", POST: "planning:write", PUT: "planning:write", DELETE: "planning:write" },
  { pattern: "/api/beschikbaarheid", GET: "planning:read", POST: "planning:write" },
  { pattern: "/api/wachtlijst", GET: "planning:read", POST: "planning:write", PUT: "planning:write" },
  { pattern: "/api/berichten", GET: "berichten:read", POST: "berichten:write", PATCH: "berichten:write" },
  { pattern: "/api/medewerkers", GET: "medewerkers:read", POST: "medewerkers:write", DELETE: "medewerkers:write" },
  { pattern: "/api/organisatie", GET: "organisatie:read", POST: "organisatie:write" },
  { pattern: "/api/admin/configuratie", GET: "configuratie:read", POST: "configuratie:write", PUT: "configuratie:write", PATCH: "configuratie:write" },
  { pattern: "/api/admin/validation-rules", GET: "configuratie:read", POST: "configuratie:write", DELETE: "configuratie:write" },
  { pattern: "/api/admin/workflows", GET: "workflows:read", POST: "workflows:write" },
  { pattern: "/api/admin/rollen", GET: "rollen:read", POST: "rollen:write", PUT: "rollen:write" },
  { pattern: "/api/admin/state-machines", GET: "state-machines:read", POST: "state-machines:write", PUT: "state-machines:write", DELETE: "state-machines:write" },
  { pattern: "/api/admin/feature-flags", GET: "feature-flags:read", POST: "feature-flags:write", PUT: "feature-flags:write" },
  { pattern: "/api/admin/api-keys", GET: "api-keys:read", POST: "api-keys:write", DELETE: "api-keys:write" },
  { pattern: "/api/admin/ai-settings", GET: "ai-config:read", PUT: "ai-config:write", POST: "ai-config:write" },
  { pattern: "/api/ai/chat", POST: "ai-chat:read" },
] as const;

/**
 * Find the required permission for a given route + method.
 * Returns undefined if no permission rule matches (public route).
 */
export function getRequiredPermission(path: string, method: string): Permission | undefined {
  for (const route of ROUTE_PERMISSIONS) {
    const regex = new RegExp("^" + route.pattern.replace(/\*/g, "[^/]+") + "(/.*)?$");
    if (regex.test(path)) {
      return route[method as keyof typeof route] as Permission | undefined;
    }
  }
  return undefined;
}

/**
 * Navigation sections with required permissions for frontend filtering.
 */
export const NAV_PERMISSIONS = {
  "/dashboard": null, // everyone
  "/ecd": "clients:read" as Permission,
  "/planning": "planning:read" as Permission,
  "/berichten": "berichten:read" as Permission,
  "/admin/medewerkers": "medewerkers:read" as Permission,
  "/admin/organisatie": "organisatie:read" as Permission,
  "/admin/configuratie": "configuratie:read" as Permission,
  "/admin/workflows": "workflows:read" as Permission,
  "/admin/rollen": "rollen:read" as Permission,
  "/admin/state-machines": "state-machines:read" as Permission,
  "/admin/feature-flags": "feature-flags:read" as Permission,
  "/admin/api-keys": "api-keys:read" as Permission,
  "/admin/ai-instellingen": "ai-config:read" as Permission,
} as const;
