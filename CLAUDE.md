# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, and Lint Commands

```bash
# Full stack (Docker) — first time or after schema changes
docker compose -f infra/compose/docker-compose.yml down -v
docker compose -f infra/compose/docker-compose.yml up -d --build
docker compose -f infra/compose/docker-compose.yml up -d seed  # Create test users

# Rebuild specific services (faster, keeps data)
docker compose -f infra/compose/docker-compose.yml up -d --build ecd web

# Dev without Docker (run in separate terminals)
pnpm --filter "@openzorg/shared-*" build           # Build shared packages FIRST
pnpm --filter @openzorg/web dev                     # Next.js dev (port 3000)
pnpm --filter @openzorg/service-ecd dev             # ECD service (port 4001)
pnpm --filter @openzorg/service-planning dev        # Planning service (port 4002)

# Tests
pnpm test                                           # All tests (Vitest)
pnpm --filter @openzorg/service-ecd test            # Single package tests

# Quality checks
pnpm lint                                           # ESLint (strict: no-explicit-any, import/order)
pnpm typecheck                                      # TypeScript strict mode
pnpm forbidden-words                                # CI check for competitor terms
pnpm check-all                                      # All of the above + build
```

## Architecture

OpenZorg is an open-source modular healthcare platform for Dutch VVT (Verpleging, Verzorging, Thuiszorg) care institutions, designed to support the entire Dutch healthcare landscape (VVT, GGZ, GHZ, Ziekenhuis, Jeugdzorg). The business model is hosting environments per care organization.

### Monorepo Structure

```
apps/web/              → Next.js 15 App Router + Tailwind (port 3000)
services/
  ecd/                 → Hono backend, ECD module (port 4001)
  planning/            → Hono backend, planning module (port 4002)
  workflow-bridge/     → Hono backend, Flowable BPMN bridge (port 4003)
packages/
  shared-domain/       → Roles, permissions, FHIR types, BSN/AGB validation
  shared-config/       → Three-layer validation engine, tenant configuration types
  shared-ui/           → React UI components (shadcn)
infra/
  compose/             → docker-compose.yml (9 services including seed)
  docker/              → Dockerfile.service (parameterized), Dockerfile.web
  postgres/            → init.sql (tenants, audit_log, tenant_configurations tables with RLS)
  scripts/             → seed.sh (creates test users via Medplum PKCE flow)
```

### Data Flow

Frontend → Hono service (ECD/Planning/Workflow) → Medplum FHIR R4 server → PostgreSQL

- **Auth**: Medplum PKCE → token + projectId + role stored in localStorage → sent as `Authorization: Bearer` + `X-Tenant-ID` + `X-User-Role` headers
- **FHIR proxy pattern**: Each Hono service forwards the user's auth token to Medplum via `medplumFetch()` (see `services/ecd/src/lib/medplum-client.ts`). Services never store credentials.
- **Tenant isolation**: Middleware chain on `/api/*`: tenant → rbac → audit. PostgreSQL RLS + Medplum Projects enforce data isolation.
- **Master admin**: Separate routes at `/api/master/*` protected by `X-Master-Key` header (bypasses tenant middleware). Connects directly to PostgreSQL `openzorg.tenants` table.

### Backend Middleware Chain (services/ecd/src/app.ts)

All `/api/*` routes pass through three middlewares in order:

1. **tenant.ts** — Extracts `X-Tenant-ID` header (400 if missing). Skips `/api/master/*` routes.
2. **rbac.ts** — Reads `X-User-Role` header, checks against `ROUTE_PERMISSIONS` matrix from shared-domain. Returns 403 on insufficient permissions. Backwards compatible: allows through if no role header.
3. **audit.ts** — NEN 7513 compliant logging. Async fire-and-forget to `openzorg.audit_log`. Logs user, action, resource type, path, duration for all patient-data routes.

### RBAC System (packages/shared-domain/src/roles.ts)

Four roles: `beheerder`, `zorgmedewerker`, `planner`, `teamleider`. Each mapped to a set of 27 permissions (e.g. `clients:read`, `zorgplan:write`, `configuratie:read`). The `ROUTE_PERMISSIONS` array maps API route patterns + HTTP methods to required permissions. The `NAV_PERMISSIONS` object controls frontend sidebar visibility.

Frontend: `AppShell.tsx` filters sidebar items based on `getUserRole()` from localStorage. The `ecdFetch()` client auto-redirects to `/geen-toegang` on 403 responses.

### Multi-Tenant Architecture

- **PostgreSQL** (`openzorg` schema): `tenants` table stores org config (name, slug, sectors, enabled_modules, settings JSONB). RLS policies on `tenant_configurations` and `audit_log`.
- **Medplum Projects**: Each tenant gets a Medplum Project. Auth tokens are project-scoped.
- **Tenant settings**: Per-tenant JSONB with `bsnRequired`, `clientnummerPrefix`. Accessible via `/api/tenant-settings`.
- **Multi-sector**: Organizations can operate in multiple sectors (e.g. VVT + GGZ). Stored as `sectors TEXT[]`.
- **Master admin** (`/master-admin`): Super-admin dashboard for managing all tenants. Onboarding wizard creates new organizations.

### Design System

OKLCH-based color tokens defined in `tailwind.config.ts` and `globals.css`:
- Semantic tokens: `bg-page`, `bg-raised`, `bg-sunken`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-default`, `border-subtle`
- Brand: teal (hue 178), Navy (hue 258), Coral (hue 16-25), Surface (warm neutrals)
- Dark mode via `class` strategy, auto-detected from system preference, toggle in sidebar
- Font stack: Nunito (display), Source Sans 3 (body), JetBrains Mono (mono)
- All pages use `AppShell` wrapper (sidebar + topbar with user role/name)

### Three-Layer Validation

All validation runs through `packages/shared-config/src/validation-engine.ts`:

1. **Kern (Layer 1)** — Immutable, legally mandated. BSN elfproef, AGB validation, required Zib fields. Cannot be disabled by tenants.
2. **Uitbreiding (Layer 2)** — Tenant-configurable rules via `/api/admin/validation-rules`. Operators: `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `in`.
3. **Plugin (Layer 3)** — Reserved for future custom validation plugins.

### FHIR Resource Mapping

| Dutch term | FHIR Resource | API Route |
|------------|---------------|-----------|
| Client | Patient | /api/clients |
| Contactpersoon | RelatedPerson | /api/clients/:id/contactpersonen |
| Zorgplan | CarePlan + Goal + ServiceRequest | /api/clients/:id/zorgplan |
| Rapportage | Observation (SOEP/vrij) | /api/clients/:id/rapportages |
| Document | Binary + DocumentReference | /api/clients/:id/documenten |
| MIC-melding | AuditEvent | /api/mic-meldingen |
| Afspraak | Appointment | /api/afspraken |
| Beschikbaarheid | Schedule + Slot | /api/beschikbaarheid |
| Wachtlijst | ServiceRequest (draft) | /api/wachtlijst |
| Medicatie | MedicationRequest | /api/clients/:id/medicatie |
| Medewerker | Practitioner | /api/medewerkers |
| Organisatie | Organization | /api/organisatie |
| Bericht | Communication | /api/berichten |

Custom FHIR extensions use base URL `https://openzorg.nl/extensions/`. Client identifiers use `https://openzorg.nl/NamingSystem/clientnummer` (auto-generated C-00001 format).

### Workflow System

Flowable Community (BPMN 2.0) on port 8080, accessed via workflow-bridge service. BPMN templates in `services/workflow-bridge/src/routes/bpmn-templates.ts`. Tasks managed via `/api/taken` (werkbak).

### Medplum User Registration

Medplum requires a 3-step PKCE flow to register users (see `infra/scripts/seed.sh`):
1. `POST /auth/newuser` → returns `{ login: "<id>" }`
2. `POST /auth/newproject` with `{ login, projectName }` → returns `{ code }`
3. `POST /oauth2/token` with `grant_type=authorization_code&code=<code>&code_verifier=<verifier>`

Just calling `newuser` alone leaves the user in a half-registered state (can't login). The seed container handles this automatically.

## Hard Rules

- **All Dutch UI labels** — The frontend is entirely in Dutch
- **FHIR-native** — All care data stored as FHIR R4 resources. No custom data models for clinical information.
- **Forbidden words (CI enforced, case-insensitive)**: Caress, MijnCaress, OnsAdministratie, OnsAgenda, OnsDossier, OnsInsights, OnsPlanning, OnsToegang, Carenzorgt, Nedap, PinkRoccade
- **Import order** — ESLint enforces: builtin → external → internal → parent → sibling → index, alphabetized within groups
- **TypeScript strict** — `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` (prefix unused with `_`), `no-explicit-any`
- **Docker symlink workaround** — With `node-linker=hoisted`, pnpm does NOT create workspace symlinks. Dockerfiles must manually `ln -s` workspace packages after `pnpm install` (see `infra/docker/Dockerfile.service`)
- **Design system tokens** — Use `bg-page`/`bg-raised`/`text-fg` etc., never raw `bg-gray-*`/`text-gray-*`. All pages wrapped in `AppShell`.

## Service URLs (Docker stack)

| Service | URL | Auth |
|---------|-----|------|
| Web | http://localhost:3000 | Medplum PKCE login |
| Master Admin | http://localhost:3000/master-admin | Same login |
| Medplum FHIR | http://localhost:8103 | API only (no UI) |
| ECD API | http://localhost:4001 | X-Tenant-ID + Bearer token |
| Planning API | http://localhost:4002 | X-Tenant-ID + Bearer token |
| Workflow API | http://localhost:4003 | X-Tenant-ID + Bearer token |
| Facturatie API | http://localhost:4004 | X-Tenant-ID + Bearer token |
| Flowable REST | http://localhost:8080 | admin / admin (Basic auth) |
| PostgreSQL | localhost:5432 | openzorg / openzorg_dev_password |
| Master API | http://localhost:4001/api/master/* | X-Master-Key: dev-master-key |

### Test Accounts (created by seed container)

| Account | Email | Password | Rol |
|---------|-------|----------|-----|
| Super Admin | admin@openzorg.nl | Oz!Adm1n#2026mXq7 | Master admin |
| Kevin | kevin@openzorg.nl | Oz!K3v1n#2026xYp4 | Master admin |
| Meneka | meneka@openzorg.nl | Oz!M3n3k4#2026wZr7 | Master admin |
| Zorggroep Horizon | jan@horizon.nl | Hz!J4n#2026pKw8 | Tenant admin |
| Thuiszorg De Linde | maria@delinde.nl | Ld!M4r1a#2026nRt5 | Tenant admin |

### Test Data per Tenant (seeded)

Per tenant worden aangemaakt: 6 medewerkers, 8 clienten (met BSN, adres, indicatie),
4 zorgplannen met doelen, 10 rapportages (SOEP + vrij), 7 medicatievoorschriften,
4 allergieen, 6 vaccinaties, 5 contactpersonen, 6 afspraken.

## Sprint Status

- Sprint 1 (Fundament): COMPLETE
- Sprint 2 (ECD + Configuratie): COMPLETE
- Sprint 3 (Planning + Workflows): COMPLETE
- Sprint 3+ (RBAC, Design System, Multi-tenant Admin, Clientnummer): COMPLETE
- Sprint 4 (Facturatie + E2E): FACTURATIE COMPLETE, E2E NOT STARTED — see BACKLOG.md
