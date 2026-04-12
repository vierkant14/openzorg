# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, and Lint Commands

```bash
# Full stack — local development (standard ports)
docker compose up -d --build

# Full stack — Unraid deployment (conflict-free ports 1xxxx)
docker compose -f docker-compose.unraid.yml up -d --build

# Rebuild specific services (faster, keeps data)
docker compose up -d --build ecd web

# Dev without Docker (run in separate terminals)
pnpm --filter "@openzorg/shared-*" build           # Build shared packages FIRST
pnpm --filter @openzorg/web dev                     # Next.js dev (port 3000)
pnpm --filter @openzorg/service-ecd dev             # ECD service (port 4001)
pnpm --filter @openzorg/service-planning dev        # Planning service (port 4002)

# Tests
pnpm test                                           # All tests (Vitest)
pnpm --filter @openzorg/service-ecd test            # Single package tests
pnpm --filter @openzorg/service-ecd test -- --run src/__tests__/client.test.ts  # Single test file

# Quality checks
pnpm lint                                           # ESLint (strict: no-explicit-any, import/order)
pnpm typecheck                                      # TypeScript strict mode
pnpm forbidden-words                                # CI check for competitor terms
pnpm check-all                                      # All of the above + build
```

## Architecture

OpenZorg is an open-source (EUPL 1.2) modular healthcare platform for Dutch VVT care institutions. Legal structure: Stichting OpenZorg (non-profit, open-source core) + B.V. (commercial hosting/consulting). See ADR-006 for details.

### Monorepo Structure

```
apps/web/              → Next.js 15 App Router + Tailwind (port 3000)
services/
  ecd/                 → Hono backend, ECD module (port 4001) — 30 route files
  planning/            → Hono backend, planning module (port 4002) — 6 route files
  workflow-bridge/     → Hono backend, Flowable BPMN bridge (port 4003)
  facturatie/          → Hono backend, billing module (port 4004)
packages/
  shared-domain/       → Roles, permissions, FHIR types, BSN/AGB validation
  shared-config/       → Three-layer validation engine, tenant configuration types
  shared-ui/           → React UI components (shadcn)
  shared-test/         → Vitest shared test utilities
adapters/
  ons-import/          → ONS (competitor) data import adapter (stub)
infra/
  compose/             → docker-compose.yml (10 services)
  docker/              → Dockerfile.service (parameterized), Dockerfile.web
  postgres/            → init.sql (tenants, audit_log, prestaties, declaraties with RLS)
  scripts/             → seed.sh (creates test users + rich test data via Medplum PKCE)
  medplum/             → medplum.config.json
docs/architecture/     → ADR-005 (OTAP deployment), ADR-006 (open-source business model)
```

### Data Flow

```
Frontend (Next.js) → /api/{ecd,planning,workflow,facturatie}/* (proxy routes)
    → Hono service → Medplum FHIR R4 server → PostgreSQL
```

- **Frontend proxy**: `apps/web/src/app/api/{ecd,planning,workflow,facturatie}/[...path]/route.ts` — Server-side reverse proxy that forwards requests to backend services. The browser never talks to Hono directly.
- **Auth**: Medplum PKCE → token + projectId + role stored in localStorage → sent as `Authorization: Bearer` + `X-Tenant-ID` + `X-User-Role` headers
- **FHIR proxy pattern**: Each Hono service forwards the user's auth token to Medplum via `medplumFetch()` / `medplumProxy()` (see `services/ecd/src/lib/medplum-client.ts`). Services never store credentials.
- **Tenant isolation**: Middleware chain on `/api/*`: tenant → rbac → audit. PostgreSQL RLS + Medplum Projects enforce data isolation.
- **Master admin**: Routes at `/api/master/*` protected by `X-Master-Key` header. Multiple master admins stored in `openzorg.master_admins` table.

### Backend Middleware Chain (services/ecd/src/app.ts)

All `/api/*` routes pass through three middlewares in order:

1. **tenant.ts** — Extracts `X-Tenant-ID` header (400 if missing). Skips `/api/master/*` routes.
2. **rbac.ts** — Reads `X-User-Role` header, checks against `ROUTE_PERMISSIONS` matrix from shared-domain. Returns 403 on insufficient permissions.
3. **audit.ts** — NEN 7513 compliant logging. Async fire-and-forget to `openzorg.audit_log`. Logs user, action, resource type, path, duration.

### Route Ordering (important)

In `services/ecd/src/app.ts`, `micMeldingRoutes` must be mounted BEFORE `vragenlijstenRoutes` because vragenlijsten has a `/:id` catch-all that would intercept `/api/mic-meldingen`.

### RBAC System (packages/shared-domain/src/roles.ts)

Four roles: `beheerder`, `zorgmedewerker`, `planner`, `teamleider`. Each mapped to permissions (e.g. `clients:read`, `zorgplan:write`). `ROUTE_PERMISSIONS` maps API route patterns + HTTP methods to required permissions. `NAV_PERMISSIONS` controls frontend sidebar visibility.

Frontend: `AppShell.tsx` filters sidebar items based on `getUserRole()`. The `ecdFetch()` client auto-redirects to `/geen-toegang` on 403.

### FHIR Resource Mapping

| Dutch term | FHIR Resource | API Route |
|------------|---------------|-----------|
| Client | Patient | /api/clients |
| Contactpersoon | RelatedPerson | /api/clients/:id/contactpersonen |
| Zorgplan | CarePlan + Goal + ServiceRequest | /api/clients/:id/zorgplan |
| Zorgplan evaluatie | Observation (goal-evaluatie) | /api/zorgplan/:id/doelen/:goalId/evaluaties |
| Zorgplan handtekening | Consent | /api/zorgplan/:id/handtekeningen |
| Rapportage | Observation (SOEP/vrij) | /api/clients/:id/rapportages |
| Medicatie (voorschrift) | MedicationRequest | /api/clients/:id/medicatie |
| Medicatieoverzicht | MedicationStatement | /api/clients/:id/medicatie-overzicht |
| Vaccinatie | Immunization | /api/clients/:id/vaccinaties |
| Allergie | AllergyIntolerance | /api/clients/:id/allergieen |
| Diagnose | Condition | /api/clients/:id/diagnoses |
| Risicoscreening | RiskAssessment | /api/clients/:id/risicoscreenings |
| Wilsverklaring/BOPZ | Consent | /api/clients/:id/wilsverklaringen |
| VBM | Procedure | /api/clients/:id/vbm |
| MDO | Encounter + Observation | /api/clients/:id/mdo |
| Toediening | MedicationAdministration | /api/clients/:id/toediening |
| Vragenlijst | Questionnaire/Response | /api/vragenlijsten |
| Document | Binary + DocumentReference | /api/clients/:id/documenten |
| MIC-melding | AuditEvent | /api/mic-meldingen |
| Afspraak | Appointment | /api/afspraken |
| Beschikbaarheid | Schedule + Slot | /api/beschikbaarheid |
| Wachtlijst | ServiceRequest (draft) | /api/wachtlijst |
| Medewerker | Practitioner | /api/medewerkers |
| Organisatie | Organization | /api/organisatie |
| Bericht | Communication | /api/berichten |
| Declaratie | — (PostgreSQL) | /api/declaraties (facturatie service) |
| Prestatie | — (PostgreSQL) | /api/prestaties (facturatie service) |

Custom FHIR extensions: `https://openzorg.nl/extensions/`. Client identifiers: `https://openzorg.nl/NamingSystem/clientnummer` (auto-generated C-00001).

### Multi-Tenant Architecture

- **PostgreSQL** (`openzorg` schema): `tenants`, `tenant_configurations`, `master_admins`, `prestaties`, `declaraties`, `audit_log`, `webhooks`, `api_keys` — all with RLS.
- **Medplum Projects**: Each tenant gets a Medplum Project. Auth tokens are project-scoped.
- **Tenant settings**: Per-tenant JSONB with `bsnRequired`, `clientnummerPrefix`. Accessible via `/api/tenant-settings`.
- **Multi-sector**: Organizations can operate in multiple sectors (VVT, GGZ, GHZ). Stored as `sectors TEXT[]`.
- **Master admins**: Multiple admins stored in `openzorg.master_admins`. Frontend checks `isMasterAdmin()` for Platform section visibility.

### Frontend Navigation Structure

Defined in `apps/web/src/components/AppShell.tsx`:
- **Overzicht** (Dashboard, Berichten) — everyone
- **Zorg** (Clienten) — zorgmedewerker/beheerder/teamleider
- **Planning** (Overzicht, Dagplanning, Rooster, Herhalingen, Wachtlijst) — planner/beheerder/teamleider
- **Beheer** (Medewerkers, Organisatie, Facturatie, etc.) — beheerder only
- **Platform** (Tenants, Onboarding, Wiki) — master admin only (`masterOnly: true`)

### Design System

OKLCH-based color tokens in `tailwind.config.ts` and `globals.css`:
- Semantic: `bg-page`, `bg-raised`, `bg-sunken`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-default`
- Brand: teal (178), Navy (258), Coral (16-25), Surface (warm neutrals)
- Dark mode via `class` strategy, system preference auto-detect
- Fonts: Nunito (display), Source Sans 3 (body), JetBrains Mono (mono)

### Workflow System

Flowable Community (BPMN 2.0) accessed via workflow-bridge. Templates: intake-proces, zorgplan-evaluatie, herindicatie, mic-afhandeling. Tasks managed via `/api/taken` (werkbak).

### Three-Layer Validation

Via `packages/shared-config/src/validation-engine.ts`:
1. **Kern** — Immutable, legally mandated. BSN elfproef, AGB, required Zib fields.
2. **Uitbreiding** — Tenant-configurable rules via `/api/admin/validation-rules`.
3. **Plugin** — Reserved for future custom validation plugins.

## Hard Rules

- **All Dutch UI labels** — The frontend is entirely in Dutch
- **FHIR-native** — All care data stored as FHIR R4 resources. No custom data models for clinical information.
- **Forbidden words (CI enforced, case-insensitive)**: Caress, MijnCaress, OnsAdministratie, OnsAgenda, OnsDossier, OnsInsights, OnsPlanning, OnsToegang, Carenzorgt, Nedap, PinkRoccade
- **Import order** — ESLint enforces: builtin → external → internal → parent → sibling → index, alphabetized within groups
- **TypeScript strict** — `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` (prefix unused with `_`), `no-explicit-any`
- **Docker symlink workaround** — With `node-linker=hoisted`, pnpm does NOT create workspace symlinks. Dockerfiles must manually `ln -s` workspace packages after `pnpm install` (see `infra/docker/Dockerfile.service`)
- **Design system tokens** — Use `bg-page`/`bg-raised`/`text-fg` etc., never raw `bg-gray-*`/`text-gray-*`. All pages wrapped in `AppShell`.
- **Route mount order matters** — Routes with `/:id` catch-alls must be mounted AFTER more specific routes in app.ts.

## Deployment

### Local Development (default ports)

```
docker compose up -d --build    # Uses infra/compose/docker-compose.yml
```

### Unraid (192.168.1.10, conflict-free ports)

```
docker compose -f docker-compose.unraid.yml up -d --build
```

All ports shifted to 1xxxx range to avoid conflicts with existing Unraid services.

| Service | Local | Unraid |
|---------|-------|--------|
| Web UI | :3000 | :13000 |
| Medplum | :8103 | :18103 |
| ECD API | :4001 | :14001 |
| Planning | :4002 | :14002 |
| Workflow | :4003 | :14003 |
| Facturatie | :4004 | :14004 |
| Flowable | :8080 | :18080 |
| PostgreSQL | :5432 | :15432 |
| Redis | :6379 | :16379 |

### Test Accounts (created by seed container)

| Account | Email | Password | Rol |
|---------|-------|----------|-----|
| Super Admin | admin@openzorg.nl | Oz!Adm1n#2026mXq7 | Master admin |
| Kevin | kevin@openzorg.nl | Oz!K3v1n#2026xYp4 | Master admin |
| Meneka | meneka@openzorg.nl | Oz!M3n3k4#2026wZr7 | Master admin |
| Zorggroep Horizon | jan@horizon.nl | Hz!J4n#2026pKw8 | Tenant admin |
| Thuiszorg De Linde | maria@delinde.nl | Ld!M4r1a#2026nRt5 | Tenant admin |

### Test Data (seeded per tenant)

6 medewerkers, 8 clienten (BSN, adres, indicatie), 4 zorgplannen met doelen, 10 rapportages (SOEP + vrij), 7 medicatievoorschriften, 4 allergieen, 6 vaccinaties, 5 contactpersonen, 6 afspraken.

### Medplum User Registration

Medplum requires a 3-step PKCE flow (see `infra/scripts/seed.sh`):
1. `POST /auth/newuser` → `{ login }` 2. `POST /auth/newproject` → `{ code }` 3. `POST /oauth2/token` with code_verifier

Just calling `newuser` alone leaves the user half-registered. The seed container handles this.
