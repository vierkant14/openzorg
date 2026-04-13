# OpenZorg

Open source modulair zorgplatform voor Nederlandse zorginstellingen (VVT).

> **Status**: Sprint 1 — Fundament. De basis-architectuur, multi-tenancy, authenticatie en CI-pipeline staan.

## Snel starten (< 15 minuten)

### Vereisten

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- [Docker](https://www.docker.com/) en Docker Compose

### 1. Clone en installeer

```bash
git clone <repo-url>
cd openzorg
pnpm install
```

### 2. Start de stack

```bash
docker compose up
```

Dit start:
- **PostgreSQL 16** op `localhost:5432` — database met RLS voor tenant-isolatie
- **Redis** op `localhost:6379` — cache voor Medplum
- **Medplum** op `localhost:8103` — FHIR R4 server met multi-tenancy
- **ECD service** op `localhost:4001` — Hono backend (template)
- **Web** op `localhost:3000` — Next.js frontend

### 3. Open de applicatie

Ga naar [http://localhost:3000](http://localhost:3000) in je browser.

### Zonder Docker (alleen frontend/backend dev)

```bash
# Terminal 1: Bouw shared packages
pnpm --filter "@openzorg/shared-*" build

# Terminal 2: Start de web app
pnpm --filter @openzorg/web dev

# Terminal 3: Start de ECD service
pnpm --filter @openzorg/service-ecd dev
```

## Architectuur

```
openzorg/
├── apps/web/                  # Next.js 15 shell (localhost:3000)
├── services/
│   ├── ecd/                   # ECD module — Hono backend
│   ├── planning/              # Planning module — Hono backend
│   ├── facturatie/            # Facturatie module — Hono backend (beperkt)
│   └── workflow-bridge/       # Bridge naar Flowable (sprint 3)
├── packages/
│   ├── shared-domain/         # Zib-types, FHIR-mapping, BSN-validatie
│   ├── shared-ui/             # shadcn/ui componenten
│   ├── shared-config/         # Drielagen-configuratiemodel
│   └── shared-test/           # Test fixtures
├── adapters/ons-import/       # Importadapter voor publieke ONS API
├── infra/                     # Docker, Medplum config, PostgreSQL init
└── docs/architecture/         # Architecture Decision Records
```

### Kernprincipes

1. **Multi-tenant vanaf dag 1** — Row-level security in PostgreSQL + Medplum projects
2. **FHIR-native, Zib-gebaseerd** — Geen eigen datamodellen voor zorginformatie
3. **Drielagen-configureerbaarheid** — Kern (vast), uitbreiding (vrij), plugin (maatwerk)
4. **Configuratie als data** — Klantconfiguratie in de database, niet in code
5. **API-first** — De UI gebruikt dezelfde API als externe integraties

### Tech stack

| Laag | Keuze |
|------|-------|
| FHIR-fundament | Medplum (self-hosted, Apache 2.0) |
| Frontend | Next.js 15 + shadcn/ui + Tailwind CSS |
| Backend glue | Hono (TypeScript) |
| Database | PostgreSQL 16 |
| Workflow | Flowable Community (sprint 3) |
| Test | Vitest (unit), Playwright (E2E, sprint 4) |
| CI | GitHub Actions |

## Ontwikkelen

### Tests draaien

```bash
pnpm test              # Alle tests
pnpm test:coverage     # Met coverage rapport
```

### Linting en type-checking

```bash
pnpm lint              # ESLint
pnpm typecheck         # TypeScript strict
pnpm forbidden-words   # Check op verboden termen (CI-check)
```

### Alles tegelijk

```bash
pnpm check-all         # lint + typecheck + forbidden-words + test + build
```

## Rollen

OpenZorg kent vier basisrollen:

| Rol | Beschrijving |
|-----|-------------|
| Beheerder | Processen, formulieren, validatieregels en gebruikers beheren |
| Zorgmedewerker | Dossier raadplegen, rapporteren, planning bekijken |
| Planner | Roosters maken, beschikbaarheid beheren |
| Teamleider | Caseload monitoren, escalaties afhandelen |

## Multi-tenancy

Twee testtenants zijn vooraf geconfigureerd:

- **Zorggroep Horizon** — ECD + Planning
- **Thuiszorg De Linde** — alleen ECD

Data-isolatie wordt afgedwongen op:
1. Database-niveau via PostgreSQL Row-Level Security
2. API-niveau via Medplum projects
3. Applicatie-niveau via tenant middleware in elke service

## Smoke testing Unraid

Verifieer in één commando of de Unraid-deploy gezond is:

````bash
./scripts/unraid-smoke.sh                   # default host 192.168.1.10
./scripts/unraid-smoke.sh unraid.local      # custom host
````

Exit code 0 = alle services healthy. Niet-nul = lijst van wat down is.

## ADRs (Architecture Decision Records)

- [ADR-001: Medplum als FHIR-fundament](docs/architecture/ADR-001-medplum.md)

## Licentie

Apache 2.0
