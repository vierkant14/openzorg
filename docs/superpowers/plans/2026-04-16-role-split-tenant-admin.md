# Role Split: Tenant Admin + Functioneel Beheerder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the all-access `beheerder` role into a narrower `beheerder` (functioneel beheerder) and a new `tenant-admin` role that owns technical/security settings.

**Architecture:** Add `tenant-admin` to the `OpenZorgRole` union type with all permissions. Narrow `beheerder` by removing 4 new permission pairs (state-machines, feature-flags, rollen, api-keys). Split the "Configuratie" nav section in AppShell into "Configuratie" (both roles) and "Systeem" (tenant-admin only). Update seed script to assign `tenant-admin` to tenant admin accounts.

**Tech Stack:** TypeScript, shared-domain package (roles.ts), Next.js AppShell, Hono middleware (RBAC), seed.sh

**Spec reference:** `docs/superpowers/specs/2026-04-16-role-split-design.md`

---

## File Structure

### To modify (existing)

- `packages/shared-domain/src/roles.ts` — add `tenant-admin` role, new permissions, update matrix + route mappings
- `apps/web/src/components/AppShell.tsx` — split nav into Configuratie + Systeem sections
- `infra/scripts/seed.sh` — update tenant admin accounts to use `tenant-admin` role

### No changes needed

- `services/ecd/src/middleware/rbac.ts` — already checks permissions generically via `getRequiredPermission()`
- `apps/web/src/lib/api.ts` — `getUserRole()` returns a string, no hardcoded role checks
- Backend route files — already protected by permission-based RBAC, not role name checks

---

## Task 1: Add tenant-admin role and permissions to shared-domain

**Files:**
- Modify: `packages/shared-domain/src/roles.ts`

- [ ] **Step 1.1: Add `tenant-admin` to OpenZorgRole type**

In `packages/shared-domain/src/roles.ts`, change line 6:

```typescript
// Before:
export type OpenZorgRole = "beheerder" | "zorgmedewerker" | "planner" | "teamleider";

// After:
export type OpenZorgRole = "tenant-admin" | "beheerder" | "zorgmedewerker" | "planner" | "teamleider";
```

- [ ] **Step 1.2: Add to ALL_ROLES array**

Change line 8-13:

```typescript
export const ALL_ROLES: readonly OpenZorgRole[] = [
  "tenant-admin",
  "beheerder",
  "zorgmedewerker",
  "planner",
  "teamleider",
] as const;
```

- [ ] **Step 1.3: Add role definition and update beheerder display**

In `ROLE_DEFINITIONS`, add `tenant-admin` before `beheerder` and update `beheerder` description:

```typescript
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
```

- [ ] **Step 1.4: Add new permissions to Permission type**

Add 6 new permissions after `"rollen:write"`:

```typescript
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
  | "api-keys:write";
```

- [ ] **Step 1.5: Update ROLE_PERMISSIONS matrix**

Replace the entire `ROLE_PERMISSIONS` object:

```typescript
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
  ],
} as const;
```

- [ ] **Step 1.6: Add route permission entries for new endpoints**

Add to `ROUTE_PERMISSIONS` array, before the closing `] as const;`:

```typescript
  { pattern: "/api/admin/state-machines", GET: "state-machines:read", POST: "state-machines:write", PUT: "state-machines:write", DELETE: "state-machines:write" },
  { pattern: "/api/admin/feature-flags", GET: "feature-flags:read", POST: "feature-flags:write", PUT: "feature-flags:write" },
  { pattern: "/api/admin/api-keys", GET: "api-keys:read", POST: "api-keys:write", DELETE: "api-keys:write" },
```

- [ ] **Step 1.7: Update NAV_PERMISSIONS**

Add entries for the new system pages:

```typescript
export const NAV_PERMISSIONS = {
  "/dashboard": null,
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
} as const;
```

- [ ] **Step 1.8: Build shared-domain and verify**

```bash
pnpm --filter @openzorg/shared-domain build
```

Expected: exit 0, no errors.

- [ ] **Step 1.9: Run full typecheck**

```bash
pnpm typecheck
```

Expected: exit 0. If there are errors, they will be in files that import from shared-domain and use the old role type — fix them in subsequent steps.

- [ ] **Step 1.10: Commit**

```bash
git add packages/shared-domain/src/roles.ts
git commit -m "feat(rbac): add tenant-admin role + split permissions from beheerder"
```

---

## Task 2: Split navigation in AppShell

**Files:**
- Modify: `apps/web/src/components/AppShell.tsx`

- [ ] **Step 2.1: Split "Configuratie" nav section into two**

In `apps/web/src/components/AppShell.tsx`, find the `NAV_SECTIONS` array (line 37). Replace the "Configuratie" section (lines 81-93) with two sections:

```typescript
  {
    label: "Configuratie",
    items: [
      { href: "/admin/configuratie", label: "Overzicht", icon: IconSettings, permission: "configuratie:read" },
      { href: "/admin/workflows", label: "Workflows", icon: IconFlow, permission: "workflows:read", featureFlag: "workflow-engine" },
      { href: "/admin/vragenlijsten", label: "Vragenlijsten", icon: IconClipboard, permission: "configuratie:read" },
      { href: "/admin/codelijsten", label: "Codelijsten", icon: IconList, permission: "configuratie:read" },
      { href: "/admin/validatie", label: "Validatieregels", icon: IconShield, permission: "configuratie:read" },
      { href: "/admin/task-form-options", label: "Taak-formulieren", icon: IconList, permission: "configuratie:read" },
      { href: "/admin/client-dashboard-config", label: "Client dashboard", icon: IconGrid, permission: "configuratie:read" },
      { href: "/admin/workflows/dmn", label: "DMN tabellen (beta)", icon: IconList, permission: "workflows:read", featureFlag: "dmn-editor" },
    ],
  },
  {
    label: "Systeem",
    items: [
      { href: "/admin/state-machines", label: "State-machines", icon: IconFlow, permission: "state-machines:read" },
      { href: "/admin/rollen", label: "Rollen & rechten", icon: IconShield, permission: "rollen:read" },
    ],
  },
```

Key changes:
- `state-machines` moved from Configuratie to Systeem with `permission: "state-machines:read"` (was `configuratie:read`)
- `rollen` moved from Configuratie to Systeem (already had `rollen:read`)
- Configuratie keeps everything else

- [ ] **Step 2.2: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0. The new permission strings (`state-machines:read`) must match the Permission type updated in Task 1.

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/src/components/AppShell.tsx
git commit -m "feat(nav): split Configuratie into Configuratie + Systeem sections"
```

---

## Task 3: Update seed script

**Files:**
- Modify: `infra/scripts/seed.sh`

- [ ] **Step 3.1: Change tenant admin seed accounts to `tenant-admin` role**

In `infra/scripts/seed.sh`, find line 108 where `jan@horizon.nl` is assigned role `beheerder`. The seed script creates practitioners with roles via a JSON array. Find all occurrences where tenant admin accounts get `role: 'beheerder'` and change to `role: 'tenant-admin'`.

Search for `role: 'beheerder'` in the seed script. The first practitioner (Jan de Vries) should be `tenant-admin` since he's the tenant admin for Zorggroep Horizon. Similarly, find Maria (Thuiszorg De Linde) and change her role too.

```bash
# Change:
{ family: 'de Vries', given: ['Jan'], role: 'beheerder', qualification: 'Wijkverpleegkundige' },
# To:
{ family: 'de Vries', given: ['Jan'], role: 'tenant-admin', qualification: 'Applicatiebeheerder' },
```

Do the same for Maria's entry if it exists.

- [ ] **Step 3.2: Update BPMN candidateGroups**

In the same seed.sh file, BPMN templates reference `candidateGroups="beheerder"`. These should also accept `tenant-admin`. Change:

```xml
flowable:candidateGroups="beheerder"
```

to:

```xml
flowable:candidateGroups="beheerder,tenant-admin"
```

There are 3 occurrences (lines ~1059, ~1144, ~1189).

- [ ] **Step 3.3: Commit**

```bash
git add infra/scripts/seed.sh
git commit -m "feat(seed): tenant admin accounts use tenant-admin role"
```

---

## Task 4: Update route permission mappings in backend

**Files:**
- Modify: `services/ecd/src/routes/state-machines.ts`
- Modify: `services/ecd/src/routes/rollen.ts`

- [ ] **Step 4.1: Check current state-machines route permissions**

Read `services/ecd/src/routes/state-machines.ts` to see if there are any hardcoded role checks (e.g., `c.get("role") === "beheerder"`). The RBAC middleware handles permissions generically, but some routes may have inline checks.

If there are any inline role checks, update them to also accept `tenant-admin`. If the route only uses middleware-based RBAC (via `ROUTE_PERMISSIONS` from shared-domain), no changes are needed here — the route mapping was already updated in Task 1 Step 1.6.

- [ ] **Step 4.2: Check rollen route permissions**

Read `services/ecd/src/routes/rollen.ts`. Same check — look for inline role checks.

- [ ] **Step 4.3: Grep for hardcoded beheerder checks across all backend routes**

```bash
grep -rn '"beheerder"\|beheerder' services/ecd/src/routes/ --include="*.ts"
```

For each occurrence that's a role check (not a string in a comment or template), update to include `tenant-admin` or switch to permission-based checking.

- [ ] **Step 4.4: Typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4.5: Commit**

```bash
git add services/ecd/src/routes/
git commit -m "fix(rbac): update hardcoded beheerder checks to include tenant-admin"
```

---

## Task 5: Verify and test

- [ ] **Step 5.1: Full build**

```bash
pnpm check-all
```

Expected: exit 0 (typecheck + lint + build + forbidden-words).

- [ ] **Step 5.2: Run tests**

```bash
pnpm test
```

Expected: exit 0.

- [ ] **Step 5.3: Manual verification plan**

After deploy, verify:
1. Login as `jan@horizon.nl` (tenant-admin) — should see both Configuratie AND Systeem nav sections
2. Login as a beheerder user — should see Configuratie but NOT Systeem
3. State-machines page returns 403 for beheerder role
4. Rollen page returns 403 for beheerder role
5. Validatieregels, workflows, medewerkers all still work for beheerder

- [ ] **Step 5.4: Commit — final verification**

```bash
git add -A
git commit -m "chore: role-split verification — tenant-admin + functioneel beheerder live"
```

---

## Risks

1. **Existing beheerder users lose state-machines/rollen access** — expected and documented. Tenant must promote one user to `tenant-admin`.
2. **BPMN candidateGroups** — updated in seed.sh but existing running process instances in Flowable won't pick up the change. New deployments will.
3. **Frontend hardcoded role checks** — Task 4.3 grep covers backend. Also grep frontend: `grep -rn 'beheerder' apps/web/src/ --include="*.tsx" --include="*.ts"` and update any direct role comparisons.
