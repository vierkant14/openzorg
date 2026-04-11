# Architectuur

## Overzicht

OpenZorg is een FHIR-native, multi-tenant, microservices-gebaseerd platform voor de Nederlandse zorg. Het is ontworpen om meerdere zorgsectoren te ondersteunen (VVT, GGZ, GHZ, Ziekenhuis, Jeugdzorg) vanuit een enkele codebase.

## Kernprincipes

1. **FHIR-native**: Alle zorgdata wordt opgeslagen als FHIR R4 resources. Geen custom datamodellen voor klinische informatie.
2. **Multi-tenant**: Elke zorgorganisatie is een volledig geïsoleerde tenant met eigen data, configuratie en gebruikers.
3. **Multi-sector**: Organisaties kunnen in meerdere zorgsectoren opereren. Sectorspecifieke modules worden per tenant in/uitgeschakeld.
4. **Configuration as data**: Procesflows, formulieren en validatieregels zijn data, geen code.
5. **API-first**: Dezelfde API bedient zowel de frontend als externe integraties.

## Stack

| Component | Technologie | Doel |
|-----------|------------|------|
| Frontend | Next.js 15, Tailwind, shadcn/ui | Web applicatie |
| Backend services | Hono (TypeScript) | API-laag, middleware, business logic |
| FHIR server | Medplum (zelf-gehost) | Opslag en query van FHIR resources |
| Database | PostgreSQL 16 | Tenant configuratie, auditlog, RLS |
| Workflow engine | Flowable Community | BPMN 2.0 procesflows |
| Monorepo | pnpm workspaces | Package management |

## Monorepo structuur

```
apps/web/                  → Next.js 15 App Router (port 3000)
services/
  ecd/                     → ECD service: clientdossier, zorgplan, rapportage (port 4001)
  planning/                → Planning service: afspraken, beschikbaarheid (port 4002)
  workflow-bridge/         → Workflow bridge: Flowable BPMN integratie (port 4003)
packages/
  shared-domain/           → Rollen, permissies, FHIR types, BSN/AGB validatie
  shared-config/           → Drie-lagen validatie-engine, tenant configuratietypes
  shared-ui/               → React UI componenten (shadcn basis)
infra/
  compose/                 → docker-compose.yml (9 services inclusief seed)
  docker/                  → Dockerfile.service (geparametriseerd), Dockerfile.web
  postgres/                → init.sql (tenants, audit_log, tenant_configurations met RLS)
  scripts/                 → seed.sh (test gebruikers via Medplum PKCE flow)
```

## Data flow

```
Browser → Next.js (SSR/CSR) → Hono service → Medplum FHIR R4 → PostgreSQL
                                   ↓
                              Middleware chain:
                              1. Tenant (X-Tenant-ID)
                              2. RBAC (X-User-Role)
                              3. Audit (NEN 7513)
```

De frontend communiceert via `ecdFetch()` / `planningFetch()` met de Hono services. Elke request bevat drie headers:
- `Authorization: Bearer <token>` — Medplum auth token
- `X-Tenant-ID: <projectId>` — Tenant identificatie
- `X-User-Role: <role>` — Gebruikersrol voor RBAC

De Hono services forwarden het auth token naar Medplum via `medplumFetch()`. Services slaan zelf geen credentials op.

## Drie-lagen validatie

Alle invoervalidatie verloopt via de validatie-engine in `packages/shared-config/`:

| Laag | Naam | Wijzigbaar | Voorbeeld |
|------|------|-----------|---------|
| 1 | Kern | Nee (immutable) | BSN elfproef, AGB 8 cijfers, verplichte Zib-velden |
| 2 | Uitbreiding | Ja (per tenant) | Extra verplichte velden, patroonvalidatie, bereikcontroles |
| 3 | Plugin | Toekomstig | Custom validatieplugins per organisatie |

Kern-validatie wordt altijd uitgevoerd en kan niet worden uitgeschakeld. Uitbreidingsregels worden per tenant beheerd via `/api/admin/validation-rules`.

## Design system

- OKLCH-gebaseerde kleurtokens in `tailwind.config.ts` en `globals.css`
- Semantische tokens: `bg-page`, `bg-raised`, `bg-sunken`, `text-fg`, `text-fg-muted`, `border-default`
- Brandkleuren: teal (hue 178), navy (hue 258), coral (hue 16-25)
- Dark mode via `class` strategie, automatisch gedetecteerd
- Fonts: Nunito (display), Source Sans 3 (body), JetBrains Mono (mono)
- Alle pagina's gebruiken de `AppShell` wrapper (sidebar + topbar)

## Services en poorten

| Service | Poort | Beschrijving |
|---------|-------|-------------|
| Web (Next.js) | 3000 | Frontend applicatie |
| ECD API | 4001 | Clientdossier, zorgplan, rapportage, medicatie, berichten |
| Planning API | 4002 | Afspraken, beschikbaarheid, wachtlijst |
| Workflow API | 4003 | BPMN procesflows, taakwerkbak |
| Medplum FHIR | 8103 | FHIR R4 server (intern) |
| Flowable REST | 8080 | BPMN engine (intern) |
| PostgreSQL | 5432 | Database |
