# Role Split: Tenant Admin + Functioneel Beheerder

> **Status:** Approved 2026-04-16
> **Branch:** plan-2a-execute

## Problem

The current `beheerder` role has all permissions — from zorginhoudelijke configuratie (validatieregels, workflows, codelijsten) to technische/beveiligingsgevoelige instellingen (state-machines, feature flags, rollen, API keys). In practice, the zorginhoudelijk manager die dagelijks beheert hoeft geen toegang te hebben tot technische systeemconfiguratie.

## Solution

Split into two roles:
- **`beheerder`** (display: "Functioneel beheerder") — manages day-to-day care configuration
- **`tenant-admin`** (display: "Tenant admin") — manages technical/security settings

## Design Decisions

1. **Single role per user** — no multi-role or hierarchy. Simplest model, matches current system.
2. **`beheerder` slug unchanged** — avoids migration. Display name changes to "Functioneel beheerder". Permissions narrowed.
3. **New `tenant-admin` slug** — gets all permissions including the new tenant-admin-only ones.
4. **Navigation split** — "Beheer" section for functioneel beheerder items, new "Systeem" section for tenant-admin-only items.
5. **Tenant admin can be customer staff or OpenZorg B.V.** — role exists regardless of who fills it.

## Roles (5 total, was 4)

| Slug | Display Name | Wie | Beschrijving |
|---|---|---|---|
| `tenant-admin` | Tenant admin | IT/applicatiebeheerder of OpenZorg B.V. | Beheert technische instellingen, rollen, feature flags, state-machines |
| `beheerder` | Functioneel beheerder | Zorginhoudelijk manager | Beheert medewerkers, organisatie, validatieregels, workflows, codelijsten |
| `teamleider` | Teamleider | Team manager | Monitort caseload, escalaties, MIC-meldingen |
| `zorgmedewerker` | Zorgmedewerker | Wijkverpleegkundige/verzorgende | Raadpleegt dossiers, rapporteert, bekijkt planning |
| `planner` | Planner | Roosterplanner | Maakt roosters, plant afspraken |

## Permissions

### New permissions (add to Permission type)

```typescript
| "state-machines:read"
| "state-machines:write"
| "feature-flags:read"
| "feature-flags:write"
| "api-keys:read"
| "api-keys:write"
```

### Permission matrix

| Permission | tenant-admin | beheerder | teamleider | zorgmedewerker | planner |
|---|---|---|---|---|---|
| clients:read | Y | Y | Y | Y | Y |
| clients:write | Y | Y | Y | Y | - |
| clients:delete | Y | Y | - | - | - |
| zorgplan:read | Y | Y | Y | Y | - |
| zorgplan:write | Y | Y | - | Y | - |
| rapportage:read | Y | Y | Y | Y | - |
| rapportage:write | Y | Y | - | Y | - |
| documenten:read | Y | Y | Y | Y | - |
| documenten:write | Y | Y | - | Y | - |
| medicatie:read | Y | Y | Y | Y | - |
| medicatie:write | Y | Y | - | - | - |
| mic:read | Y | Y | Y | Y | - |
| mic:write | Y | Y | Y | Y | - |
| planning:read | Y | Y | Y | Y | Y |
| planning:write | Y | Y | Y | - | Y |
| berichten:read | Y | Y | Y | Y | Y |
| berichten:write | Y | Y | Y | Y | Y |
| medewerkers:read | Y | Y | Y | - | Y |
| medewerkers:write | Y | Y | - | - | - |
| organisatie:read | Y | Y | Y | - | - |
| organisatie:write | Y | Y | - | - | - |
| configuratie:read | Y | Y | - | - | - |
| configuratie:write | Y | Y | - | - | - |
| workflows:read | Y | Y | - | - | - |
| workflows:write | Y | Y | - | - | - |
| rollen:read | Y | - | - | - | - |
| rollen:write | Y | - | - | - | - |
| state-machines:read | Y | - | - | - | - |
| state-machines:write | Y | - | - | - | - |
| feature-flags:read | Y | - | - | - | - |
| feature-flags:write | Y | - | - | - | - |
| api-keys:read | Y | - | - | - | - |
| api-keys:write | Y | - | - | - | - |

## Navigation

### Beheer (functioneel beheerder + tenant admin)
- Medewerkers
- Organisatie
- Codelijsten
- Vragenlijsten
- Validatieregels
- Workflows
- Task-form-options
- Facturatie

### Systeem (tenant admin only)
- State-machines
- Feature flags
- Rollen
- API keys / Webhooks

### Platform (master admin only, unchanged)
- Tenants
- Onboarding
- Wiki

## Migration

- **No database migration** — role is stored in Medplum user profile / X-User-Role header
- `beheerder` slug unchanged, permissions narrowed, display name updated
- New `tenant-admin` slug added to `OpenZorgRole` union type
- Seed script: `jan@horizon.nl` and `maria@delinde.nl` get `tenant-admin` role
- RBAC middleware unchanged — already checks permission, not role name

## Files to change

### Core (packages/shared-domain)
- `src/roles.ts` — add `tenant-admin` to `OpenZorgRole`, update `ROLE_DEFINITIONS`, add new permissions to `Permission` type, update `ROLE_PERMISSIONS` matrix, add route permission entries for state-machines/feature-flags/api-keys endpoints, update `NAV_PERMISSIONS`

### Frontend (apps/web)
- `src/components/AppShell.tsx` — add "Systeem" nav section with tenant-admin-only items, rename "Beheer" label clarity
- Any admin pages that check role directly (should be minimal since RBAC is permission-based)

### Backend (services/ecd)
- Route permission entries for `/api/admin/state-machines`, `/api/admin/feature-flags`, `/api/admin/rollen`, `/api/admin/api-keys` — ensure they map to the new permissions
- RBAC middleware already checks permissions generically, no changes needed

### Seed (infra/scripts)
- `seed.sh` — update tenant admin accounts to use `tenant-admin` role

## Risks

1. **Existing `beheerder` users lose access to state-machines/feature-flags/rollen** — expected. Communicate in release notes. Tenant must assign someone as `tenant-admin`.
2. **Seed data uses old role** — mitigated by updating seed.sh.
3. **Frontend pages may hardcode `beheerder` checks** — grep for `role === "beheerder"` or `getUserRole()` comparisons and update to include `tenant-admin` where needed.
