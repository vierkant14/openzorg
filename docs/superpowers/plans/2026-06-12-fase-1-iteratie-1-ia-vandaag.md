# Fase 1 — Iteratie 1: IA-document, patroon-primitieven, werkruimte-shell, Vandaag

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De eerste levende versie van de nieuwe IA: een IA-document, de eerste shared-ui patroon-primitieven (met states + tests), AppShell omgebouwd naar werkruimtes-per-rol, en het referentiescherm "Vandaag" voor zorgmedewerkers.

**Architecture:** Werkruimtes zijn data (rol → werkruimte → 3-5 nav-items) in AppShell; bestaande URL's blijven werken (radicale IA, evolutionaire migratie per slice). Patroon-primitieven (EmptyState/ErrorState/LoadingSkeleton/PageHeader/Section) landen in het lege `@openzorg/shared-ui` met jsdom+testing-library TDD, en gebruiken de bestaande semantic tokens uit apps/web. "Vandaag" componeert bestaande API's (dagplanning, workflow-taken) en zet de kwaliteitslat: alle vier verplichte states, warme microcopy, WCAG-basics.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind (OKLCH-tokens), Vitest + @testing-library/react (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-06-12-fase-1-ontwerp-fundament-design.md`. Dit plan dekt alleen **Iteratie 1**; overige referentieschermen (lijst, dossier, formulier, wizard, admin-builder) volgen in eigen plannen ná Kevin-review van deze iteratie.

**Repo-feiten:**
- `packages/shared-ui/src/index.ts` is een placeholder (`export {};`); package heeft vitest (node-env, geen config-bestand), géén testing-library
- `apps/web/src/components/AppShell.tsx` (733 regels): `NAV_SECTIONS` op regel 44, rol via `getUserRole()` (r213), master via `isMasterAdmin()` (r216), masterOnly-filter r229
- Tokens: utility-classes `bg-page/bg-raised/bg-sunken/text-fg/text-fg-muted/text-fg-subtle/border-default` (globals.css r93-100); brand/navy/coral/surface in tailwind.config.ts
- API-helpers: `ecdFetch` (lib/api.ts), `planningFetch` (lib/planning-api.ts), `workflowFetch` (lib/workflow-api.ts), `isFeatureEnabled` (lib/features.ts)
- Dagplanning-API: `planningFetch("/api/dagplanning/medewerker/${id}?datum=YYYY-MM-DD")`; medewerkers: `ecdFetch("/api/medewerkers?_count=100")`; taken: `workflowFetch("/api/taken?userId=${role}")`
- Er is GEEN ingelogde-gebruiker→Practitioner-koppeling; Vandaag gebruikt een medewerker-keuze onthouden in localStorage (`openzorg_practitioner_id`) — tijdelijk tot een /api/me bestaat
- AppShell wordt per pagina geïmporteerd (niet in layout.tsx)
- Branch-protectie actief: werk op branch `feat/fase1-iteratie-1` vanaf main, PR aan het eind
- Node staat niet op PATH in niet-interactieve shells: prefix `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`
- Impeccable-verboden blijven gelden: geen border-left/right-accentstrepen > 1px, geen gradient-tekst, geen modal-reflex, geen metric-card-sjablonen

---

### Task 0: Branch

- [ ] **Step 1:**
```powershell
git checkout -b feat/fase1-iteratie-1 main
git pull origin main --ff-only
```

### Task 1: IA-document

**Files:**
- Create: `docs/design/informatie-architectuur.md`

- [ ] **Step 1: Document schrijven**

Volledige inhoud `docs/design/informatie-architectuur.md`:

```markdown
# OpenZorg Informatie-Architectuur

**Status**: doelbeeld v1 (Fase 1, iteratie 1) — goedgekeurd ontwerp in spec 2026-06-12
**Principe**: taak-gericht per rol, niet module-gericht. Radicale IA, evolutionaire migratie: oude URL's blijven werken tot de betreffende verticale slice ze vervangt.

## Werkruimtes

Een gebruiker landt in de werkruimte van zijn rol. Multi-werkruimte-gebruikers (nu alleen tenant-admin en master admin) krijgen een switcher linksboven; één werkruimte = geen switcher.

| Werkruimte | Slug | Rollen | Startroute | Nav-items (max 5) |
|---|---|---|---|---|
| Vandaag | vandaag | zorgmedewerker | /vandaag | Vandaag · Cliënten · Berichten |
| Rooster | rooster | planner | /planning/rooster | Rooster · Dagplanning · Wachtlijst · Medewerkers · Berichten |
| Team | team | teamleider | /dashboard | Overzicht · Cliënten · MIC-meldingen · Signaleringen · Berichten |
| Bouwen | bouwen | beheerder | /admin/configuratie | Overzicht · Processen · Formulieren & velden · Regels & lijsten · Organisatie |
| Systeem | systeem | tenant-admin | /admin/rollen | Rollen · State-machines · Modules · AI · API-keys |
| Platform | platform | master admin | /master-admin/tenants | Tenants · Onboarding · Wiki |

Rol→werkruimtes-mapping: zorgmedewerker→[vandaag], planner→[rooster], teamleider→[team], beheerder→[bouwen], tenant-admin→[systeem, bouwen], master admin→ eigen rol-werkruimtes + [platform].

Functionaliteit die niet in een werkruimte-nav zit blijft bereikbaar via directe URL en sneltoetsen (`g …`, `/`); niets wordt verwijderd in deze iteratie.

## Cliëntdossier: 5 werkgebieden (doelbeeld, implementatie in Fase 2-slice "Cliëntdossier")

| Werkgebied | Bevat (huidige tabs) |
|---|---|
| Overzicht | dashboard-widgets: signaleringen, actuele medicatie, laatste rapportages, actieve doelen |
| Rapportage | rapportages (+ doel-koppeling) |
| Gezondheid | medicatie, medicatie-overzicht, toediening, allergieën, diagnoses, vaccinaties, risicoscreening, VBM, wilsverklaringen |
| Zorgplan | zorgplan, MDO, indicaties, vragenlijsten |
| Administratie | contactpersonen, verzekering, documenten, extra-velden, MIC-meldingen, signaleringen-beheer |

URL-doelbeeld: `/clienten/[id]/(overzicht|rapportage|gezondheid|zorgplan|administratie)`; huidige `/ecd/[id]/<tab>`-routes blijven tot die slice.

## Schermtype-patronen

Zes patronen, elk met verplichte states leeg/laden/fout/succes: werkruimte-start, lijstpagina, dossierpagina, formulier (inline, geen modals), wizard, admin-builder. Primitieven in `@openzorg/shared-ui`; referentie-implementaties per patroon in Fase 1-iteraties. "Vandaag" is de referentie voor werkruimte-start.

## Open punten

- "Wie ben ik": geen koppeling ingelogde gebruiker→Practitioner; Vandaag gebruikt een onthouden medewerker-keuze. Structurele oplossing (/api/me) op backlog.
- Werkruimte Team krijgt later een eigen signalen-startpagina (vervangt /dashboard als start).
```

- [ ] **Step 2: Commit**
```powershell
git add docs/design/informatie-architectuur.md
git commit -m "docs(design): informatie-architectuur werkruimtes + dossier-werkgebieden"
```

### Task 2: shared-ui test-setup

**Files:**
- Create: `packages/shared-ui/vitest.config.ts`
- Modify: `packages/shared-ui/package.json` (devDependencies)
- Modify: `apps/web/tailwind.config.ts` (content-glob — controleer eerst of `../../packages/shared-ui` er al in staat)

- [ ] **Step 1: devDependencies toevoegen**
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
pnpm --filter @openzorg/shared-ui add -D jsdom @testing-library/react @testing-library/jest-dom
```
Expected: exit 0; React 19-compatibel (@testing-library/react ≥16).

- [ ] **Step 2: vitest.config.ts schrijven**
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
  },
});
```

- [ ] **Step 3: Tailwind content-glob controleren/aanvullen**

Open `apps/web/tailwind.config.ts`; als de `content`-array geen pad naar shared-ui bevat, voeg toe:
```ts
"../../packages/shared-ui/src/**/*.{ts,tsx}",
```

- [ ] **Step 4: Commit**
```powershell
git add packages/shared-ui apps/web/tailwind.config.ts pnpm-lock.yaml
git commit -m "chore(shared-ui): jsdom + testing-library test-setup, tailwind scant shared-ui"
```

### Task 3: Patroon-primitieven — EmptyState, ErrorState, LoadingSkeleton (TDD)

**Files:**
- Create: `packages/shared-ui/src/states/EmptyState.tsx`
- Create: `packages/shared-ui/src/states/ErrorState.tsx`
- Create: `packages/shared-ui/src/states/LoadingSkeleton.tsx`
- Create: `packages/shared-ui/src/__tests__/states.test.tsx`
- Modify: `packages/shared-ui/src/index.ts`

- [ ] **Step 1: Failing tests schrijven** — `packages/shared-ui/src/__tests__/states.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../states/EmptyState";
import { ErrorState } from "../states/ErrorState";
import { LoadingSkeleton } from "../states/LoadingSkeleton";

describe("EmptyState", () => {
  it("toont titel, uitleg en actie", () => {
    const onActie = vi.fn();
    render(
      <EmptyState
        titel="Nog geen rapportages vandaag"
        uitleg="Begin bij je eerste cliëntbezoek."
        actieLabel="Nieuwe rapportage"
        onActie={onActie}
      />,
    );
    expect(screen.getByText("Nog geen rapportages vandaag")).toBeDefined();
    expect(screen.getByText("Begin bij je eerste cliëntbezoek.")).toBeDefined();
    screen.getByRole("button", { name: "Nieuwe rapportage" }).click();
    expect(onActie).toHaveBeenCalledOnce();
  });

  it("rendert zonder actie geen knop", () => {
    render(<EmptyState titel="Leeg" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("toont melding en herstelactie", () => {
    const onRetry = vi.fn();
    render(<ErrorState melding="Kan rapportages niet laden" onOpnieuw={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Kan rapportages niet laden");
    screen.getByRole("button", { name: "Probeer opnieuw" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("LoadingSkeleton", () => {
  it("is verborgen voor screenreaders en toont het gevraagde aantal regels", () => {
    const { container } = render(<LoadingSkeleton regels={4} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.children.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run — verwacht FAIL (modules bestaan niet)**
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"; pnpm --filter @openzorg/shared-ui test
```

- [ ] **Step 3: Componenten schrijven**

`packages/shared-ui/src/states/EmptyState.tsx`:
```tsx
interface EmptyStateProps {
  titel: string;
  uitleg?: string;
  actieLabel?: string;
  onActie?: () => void;
  icoon?: React.ReactNode;
}

/**
 * Lege staat die de interface uitlegt: wat hoort hier, en wat is de
 * eerstvolgende zinvolle actie. Warme, directe microcopy — geen "Geen data".
 */
export function EmptyState({ titel, uitleg, actieLabel, onActie, icoon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default bg-sunken px-6 py-10 text-center">
      {icoon && <div className="text-fg-subtle">{icoon}</div>}
      <p className="text-sm font-semibold text-fg">{titel}</p>
      {uitleg && <p className="max-w-sm text-sm text-fg-muted">{uitleg}</p>}
      {actieLabel && onActie && (
        <button
          type="button"
          onClick={onActie}
          className="mt-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          {actieLabel}
        </button>
      )}
    </div>
  );
}
```

`packages/shared-ui/src/states/ErrorState.tsx`:
```tsx
interface ErrorStateProps {
  melding: string;
  onOpnieuw?: () => void;
}

/** Herstelbare foutstaat: zegt wat er misging en biedt één duidelijke uitweg. */
export function ErrorState({ melding, onOpnieuw }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-lg border border-coral-200 bg-coral-50 px-6 py-8 text-center dark:border-coral-800 dark:bg-coral-950/20"
    >
      <p className="text-sm font-medium text-coral-700 dark:text-coral-300">{melding}</p>
      {onOpnieuw && (
        <button
          type="button"
          onClick={onOpnieuw}
          className="mt-1 rounded-md border border-coral-300 px-4 py-1.5 text-sm font-medium text-coral-700 hover:bg-coral-100 dark:border-coral-700 dark:text-coral-300 dark:hover:bg-coral-950/40"
        >
          Probeer opnieuw
        </button>
      )}
    </div>
  );
}
```

`packages/shared-ui/src/states/LoadingSkeleton.tsx`:
```tsx
interface LoadingSkeletonProps {
  regels?: number;
}

/** Laadstaat als skeleton-regels; aria-hidden zodat screenreaders de echte content afwachten. */
export function LoadingSkeleton({ regels = 3 }: LoadingSkeletonProps) {
  return (
    <div aria-hidden="true" className="space-y-2">
      {Array.from({ length: regels }, (_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-md bg-surface-100 dark:bg-surface-800"
        />
      ))}
    </div>
  );
}
```

`packages/shared-ui/src/index.ts` wordt:
```ts
export { EmptyState } from "./states/EmptyState";
export { ErrorState } from "./states/ErrorState";
export { LoadingSkeleton } from "./states/LoadingSkeleton";
```

- [ ] **Step 4: Run — verwacht PASS**
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"; pnpm --filter @openzorg/shared-ui test
```
NB: als JSX in de node-build (tsc) klaagt: controleer dat `packages/shared-ui/tsconfig.json` `"jsx": "react-jsx"` heeft; zo niet, toevoegen.

- [ ] **Step 5: Commit**
```powershell
git add packages/shared-ui
git commit -m "feat(shared-ui): EmptyState/ErrorState/LoadingSkeleton met tests (patroonlaag states)"
```

### Task 4: Patroon-primitieven — PageHeader en Section (TDD)

**Files:**
- Create: `packages/shared-ui/src/layout/PageHeader.tsx`
- Create: `packages/shared-ui/src/layout/Section.tsx`
- Create: `packages/shared-ui/src/__tests__/layout.test.tsx`
- Modify: `packages/shared-ui/src/index.ts`

- [ ] **Step 1: Failing tests** — `packages/shared-ui/src/__tests__/layout.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "../layout/PageHeader";
import { Section } from "../layout/Section";

describe("PageHeader", () => {
  it("rendert h1-titel, omschrijving en acties", () => {
    render(
      <PageHeader titel="Vandaag" omschrijving="Donderdag 12 juni">
        <button>Actie</button>
      </PageHeader>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Vandaag" })).toBeDefined();
    expect(screen.getByText("Donderdag 12 juni")).toBeDefined();
    expect(screen.getByRole("button", { name: "Actie" })).toBeDefined();
  });
});

describe("Section", () => {
  it("rendert h2-kop met inhoud en optionele actie", () => {
    render(
      <Section titel="Open taken" actie={<a href="/werkbak">Alles</a>}>
        <p>inhoud</p>
      </Section>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Open taken" })).toBeDefined();
    expect(screen.getByText("inhoud")).toBeDefined();
    expect(screen.getByRole("link", { name: "Alles" })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — FAIL verwacht** (zelfde commando als Task 3)

- [ ] **Step 3: Componenten**

`packages/shared-ui/src/layout/PageHeader.tsx`:
```tsx
interface PageHeaderProps {
  titel: string;
  omschrijving?: string;
  children?: React.ReactNode;
}

/** Standaard paginakop: één h1 per pagina, acties rechts. */
export function PageHeader({ titel, omschrijving, children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-fg">{titel}</h1>
        {omschrijving && <p className="mt-1 text-sm text-fg-muted">{omschrijving}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
```

`packages/shared-ui/src/layout/Section.tsx`:
```tsx
interface SectionProps {
  titel: string;
  actie?: React.ReactNode;
  children: React.ReactNode;
}

/** Inhoudsblok met h2-kop; de bouwsteen van werkruimte-startpagina's. */
export function Section({ titel, actie, children }: SectionProps) {
  return (
    <section className="rounded-lg border border-default bg-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{titel}</h2>
        {actie}
      </div>
      {children}
    </section>
  );
}
```

Aan `packages/shared-ui/src/index.ts` toevoegen:
```ts
export { PageHeader } from "./layout/PageHeader";
export { Section } from "./layout/Section";
```

- [ ] **Step 4: Run — PASS verwacht**; daarna ook `pnpm --filter @openzorg/shared-ui build` (moet slagen voor consumptie door web).

- [ ] **Step 5: Commit**
```powershell
git add packages/shared-ui
git commit -m "feat(shared-ui): PageHeader en Section primitieven met tests"
```

### Task 5: AppShell → werkruimtes per rol

**Files:**
- Create: `apps/web/src/components/werkruimtes.ts` (datamodel, los van de 733-regel AppShell)
- Modify: `apps/web/src/components/AppShell.tsx` (NAV_SECTIONS-gebruik vervangen; switcher toevoegen)
- Modify: `apps/web/src/app/login/page.tsx` (redirect naar startroute van werkruimte; zoek de bestaande redirect naar "/dashboard")

- [ ] **Step 1: Werkruimte-datamodel schrijven** — `apps/web/src/components/werkruimtes.ts`:
```ts
import type { OpenZorgRole } from "@openzorg/shared-domain";

export interface WerkruimteNavItem {
  href: string;
  label: string;
  icon: string;
  featureFlag?: string;
}

export interface Werkruimte {
  slug: string;
  label: string;
  startRoute: string;
  items: WerkruimteNavItem[];
}

/**
 * Taak-gerichte werkruimtes per rol (IA-doc: docs/design/informatie-architectuur.md).
 * Max 5 items per werkruimte. Bestaande URL's blijven geldig; routes die hier
 * niet staan blijven bereikbaar via directe URL en sneltoetsen.
 */
export const WERKRUIMTES: Record<string, Werkruimte> = {
  vandaag: {
    slug: "vandaag",
    label: "Vandaag",
    startRoute: "/vandaag",
    items: [
      { href: "/vandaag", label: "Vandaag", icon: "🏠" },
      { href: "/ecd", label: "Cliënten", icon: "👥" },
      { href: "/berichten", label: "Berichten", icon: "💬" },
    ],
  },
  rooster: {
    slug: "rooster",
    label: "Rooster",
    startRoute: "/planning/rooster",
    items: [
      { href: "/planning/rooster", label: "Rooster", icon: "📅" },
      { href: "/planning/dagplanning", label: "Dagplanning", icon: "🗓️" },
      { href: "/wachtlijst", label: "Wachtlijst", icon: "⏳" },
      { href: "/admin/medewerkers", label: "Medewerkers", icon: "🧑‍⚕️" },
      { href: "/berichten", label: "Berichten", icon: "💬" },
    ],
  },
  team: {
    slug: "team",
    label: "Team",
    startRoute: "/dashboard",
    items: [
      { href: "/dashboard", label: "Overzicht", icon: "📊" },
      { href: "/ecd", label: "Cliënten", icon: "👥" },
      { href: "/mic-meldingen", label: "MIC-meldingen", icon: "📢" },
      { href: "/signaleringen", label: "Signaleringen", icon: "🚨" },
      { href: "/berichten", label: "Berichten", icon: "💬" },
    ],
  },
  bouwen: {
    slug: "bouwen",
    label: "Bouwen",
    startRoute: "/admin/configuratie",
    items: [
      { href: "/admin/configuratie", label: "Overzicht", icon: "🧭" },
      { href: "/admin/workflows", label: "Processen", icon: "⚙️", featureFlag: "workflow-engine" },
      { href: "/admin/vragenlijsten", label: "Formulieren & velden", icon: "📝" },
      { href: "/admin/validatie", label: "Regels & lijsten", icon: "✅" },
      { href: "/admin/organisatie", label: "Organisatie", icon: "🏢" },
    ],
  },
  systeem: {
    slug: "systeem",
    label: "Systeem",
    startRoute: "/admin/rollen",
    items: [
      { href: "/admin/rollen", label: "Rollen", icon: "🔐" },
      { href: "/admin/state-machines", label: "State-machines", icon: "🔄" },
      { href: "/admin/modules", label: "Modules", icon: "🧩" },
      { href: "/admin/ai-instellingen", label: "AI", icon: "✨" },
    ],
  },
  platform: {
    slug: "platform",
    label: "Platform",
    startRoute: "/master-admin/tenants",
    items: [
      { href: "/master-admin/tenants", label: "Tenants", icon: "🏥" },
      { href: "/master-admin/onboarding", label: "Onboarding", icon: "🚀" },
      { href: "/wiki", label: "Wiki", icon: "📚" },
    ],
  },
};

const ROL_WERKRUIMTES: Record<OpenZorgRole, string[]> = {
  zorgmedewerker: ["vandaag"],
  planner: ["rooster"],
  teamleider: ["team"],
  beheerder: ["bouwen"],
  "tenant-admin": ["systeem", "bouwen"],
};

export function werkruimtesVoorGebruiker(role: OpenZorgRole, masterAdmin: boolean): Werkruimte[] {
  const slugs = [...(ROL_WERKRUIMTES[role] ?? ["vandaag"])];
  if (masterAdmin) slugs.push("platform");
  return slugs.map((s) => WERKRUIMTES[s]).filter((w): w is Werkruimte => Boolean(w));
}

export function startRouteVoorGebruiker(role: OpenZorgRole, masterAdmin: boolean): string {
  return werkruimtesVoorGebruiker(role, masterAdmin)[0]?.startRoute ?? "/dashboard";
}
```
NB onboarding-route: controleer het echte pad (zoek "onboarding" onder apps/web/src/app/master-admin); pas aan als het afwijkt. Idem `/wiki` (zoek bestaande wiki-route; bestaat die alleen als master-pagina, gebruik dat pad).

- [ ] **Step 2: AppShell ombouwen**

In `AppShell.tsx`:
1. Importeer bovenaan: `import { WERKRUIMTES, werkruimtesVoorGebruiker } from "./werkruimtes";` (verwijder de `NAV_SECTIONS`-definitie regels 20-135 NIET in deze stap — eerst de nieuwe rendering, dan opruimen).
2. In de component: na `const masterAdmin = isMasterAdmin();`:
```tsx
const werkruimtes = werkruimtesVoorGebruiker(role, masterAdmin);
const [actieveWerkruimteSlug, setActieveWerkruimteSlug] = useState<string>(() => {
  if (typeof window === "undefined") return werkruimtes[0]?.slug ?? "vandaag";
  return localStorage.getItem("openzorg_werkruimte") ?? werkruimtes[0]?.slug ?? "vandaag";
});
const actieveWerkruimte =
  werkruimtes.find((w) => w.slug === actieveWerkruimteSlug) ?? werkruimtes[0] ?? WERKRUIMTES.vandaag!;
function wisselWerkruimte(slug: string) {
  setActieveWerkruimteSlug(slug);
  localStorage.setItem("openzorg_werkruimte", slug);
  const doel = werkruimtes.find((w) => w.slug === slug);
  if (doel) window.location.href = doel.startRoute;
}
```
3. Vervang de sectie-gebaseerde nav-rendering (regels ±312-363) door een platte lijst van `actieveWerkruimte.items`, met behoud van bestaande stijl-classes voor links/active-state en het bestaande `isFeatureEnabled`-gedrag voor items met `featureFlag`. De `role="navigation"`/`<nav>`-wrapper en de link-markup (Next `<Link>`) blijven — de bestaande E2E selecteert `getByRole("navigation").getByRole("link", { name: /cli[eë]nten/i })`.
4. Switcher boven de nav, alleen als `werkruimtes.length > 1`:
```tsx
{werkruimtes.length > 1 && (
  <select
    aria-label="Werkruimte wisselen"
    value={actieveWerkruimte.slug}
    onChange={(e) => wisselWerkruimte(e.target.value)}
    className="mx-3 mb-2 rounded-md border border-default bg-raised px-2 py-1.5 text-sm text-fg"
  >
    {werkruimtes.map((w) => (
      <option key={w.slug} value={w.slug}>{w.label}</option>
    ))}
  </select>
)}
```
5. Verwijder daarna `NAV_SECTIONS`, `NavSection`/oude `NavItem`-interfaces en de permissie-filterlogica die alleen daarvoor bestond (`NAV_PERMISSIONS`-gebruik in AppShell vervalt; rol-scheiding zit nu in de werkruimte-mapping). `rolePermissions` alleen behouden als het elders in het bestand gebruikt wordt.
6. Typecheck moet schoon; geen `any`.

- [ ] **Step 3: Login-redirect op startroute**

In `apps/web/src/app/login/page.tsx`: zoek de regel die na succesvol inloggen naar `/dashboard` stuurt en vervang door:
```tsx
import { startRouteVoorGebruiker } from "../../components/werkruimtes";
// ... na het zetten van de sessie:
window.location.href = startRouteVoorGebruiker(getUserRole() as OpenZorgRole, isMasterAdmin());
```
(Exacte imports afstemmen op wat het bestand al heeft; `getUserRole`/`isMasterAdmin` komen uit `../../lib/api`.)

- [ ] **Step 4: Verifiëren**
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
pnpm --filter @openzorg/shared-ui build; pnpm typecheck; pnpm lint; pnpm --filter @openzorg/web build
```
Expected: alles groen.

- [ ] **Step 5: Commit**
```powershell
git add apps/web/src/components apps/web/src/app/login
git commit -m "feat(ia): werkruimtes per rol in AppShell + switcher + rol-startroute"
```

### Task 6: Referentiescherm "Vandaag"

**Files:**
- Create: `apps/web/src/app/vandaag/page.tsx`

- [ ] **Step 1: Pagina schrijven** — volledige inhoud:

```tsx
"use client";

import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, Section } from "@openzorg/shared-ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../components/AppShell";
import { ecdFetch } from "../../lib/api";
import { planningFetch } from "../../lib/planning-api";
import { workflowFetch } from "../../lib/workflow-api";

interface FhirBundle<T> {
  entry?: Array<{ resource: T }>;
}

interface FhirPractitioner {
  id?: string;
  name?: Array<{ given?: string[]; family?: string; text?: string }>;
}

interface FhirAppointment {
  id?: string;
  start?: string;
  end?: string;
  description?: string;
  status?: string;
  participant?: Array<{ actor?: { reference?: string; display?: string } }>;
}

interface WorkflowTaak {
  id: string;
  name?: string;
  processName?: string;
  createTime?: string;
}

function naam(p: FhirPractitioner): string {
  const n = p.name?.[0];
  return n?.text ?? [n?.given?.join(" "), n?.family].filter(Boolean).join(" ") ?? "Onbekend";
}

function tijd(iso?: string): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function vandaagIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function datumLabel(): string {
  return new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

function begroeting(): string {
  const uur = new Date().getHours();
  if (uur < 6) return "Goedenacht";
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

export default function VandaagPage() {
  return (
    <AppShell>
      <VandaagInhoud />
    </AppShell>
  );
}

function VandaagInhoud() {
  const [medewerkers, setMedewerkers] = useState<FhirPractitioner[]>([]);
  const [practitionerId, setPractitionerId] = useState<string>(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("openzorg_practitioner_id") ?? "",
  );
  const [afspraken, setAfspraken] = useState<FhirAppointment[]>([]);
  const [taken, setTaken] = useState<WorkflowTaak[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    ecdFetch<FhirBundle<FhirPractitioner>>("/api/medewerkers?_count=100").then(({ data }) => {
      setMedewerkers(data?.entry?.map((e) => e.resource) ?? []);
    });
  }, []);

  const laad = useCallback(() => {
    setLaden(true);
    setFout(null);
    const rol = localStorage.getItem("openzorg_role") ?? "zorgmedewerker";
    const dagP = practitionerId
      ? planningFetch<FhirBundle<FhirAppointment>>(
          `/api/dagplanning/medewerker/${practitionerId}?datum=${vandaagIso()}`,
        )
      : Promise.resolve({ data: { entry: [] } as FhirBundle<FhirAppointment>, error: null });
    const takenP = workflowFetch<{ taken?: WorkflowTaak[]; data?: WorkflowTaak[] }>(
      `/api/taken?userId=${encodeURIComponent(rol)}`,
    );
    Promise.all([dagP, takenP]).then(([dag, tk]) => {
      if (dag.error) {
        setFout(dag.error);
      } else {
        setAfspraken(
          (dag.data?.entry?.map((e) => e.resource) ?? []).sort((a, b) =>
            (a.start ?? "").localeCompare(b.start ?? ""),
          ),
        );
        setTaken((tk.data?.taken ?? tk.data?.data ?? []).slice(0, 5));
      }
      setLaden(false);
    });
  }, [practitionerId]);

  useEffect(() => {
    laad();
  }, [laad]);

  function kiesMedewerker(id: string) {
    setPractitionerId(id);
    localStorage.setItem("openzorg_practitioner_id", id);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader titel={`${begroeting()}`} omschrijving={datumLabel()}>
        {/* Tijdelijk tot er een /api/me-koppeling is (zie IA-doc open punten) */}
        <select
          aria-label="Werken als medewerker"
          value={practitionerId}
          onChange={(e) => kiesMedewerker(e.target.value)}
          className="rounded-md border border-default bg-raised px-3 py-1.5 text-sm text-fg"
        >
          <option value="">Kies medewerker…</option>
          {medewerkers.map((m) => (
            <option key={m.id} value={m.id ?? ""}>
              {naam(m)}
            </option>
          ))}
        </select>
      </PageHeader>

      {fout && <ErrorState melding={fout} onOpnieuw={laad} />}

      {!fout && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Section
            titel="Mijn route vandaag"
            actie={
              <Link href="/planning/dagplanning" className="text-xs font-medium text-brand-600 hover:text-brand-800">
                Volledige dagplanning
              </Link>
            }
          >
            {laden ? (
              <LoadingSkeleton regels={5} />
            ) : !practitionerId ? (
              <EmptyState
                titel="Wie ben jij vandaag?"
                uitleg="Kies rechtsboven je naam, dan zie je hier je route en afspraken."
              />
            ) : afspraken.length === 0 ? (
              <EmptyState
                titel="Geen afspraken vandaag"
                uitleg="Je dag is leeg — check de dagplanning of je berichten."
              />
            ) : (
              <ol className="divide-y divide-surface-100 dark:divide-surface-800">
                {afspraken.map((a) => {
                  const client = a.participant?.find((p) => p.actor?.reference?.startsWith("Patient/"));
                  const clientId = client?.actor?.reference?.split("/")[1];
                  return (
                    <li key={a.id} className="flex items-center gap-4 py-2.5">
                      <span className="w-24 shrink-0 font-mono text-sm text-fg-muted">
                        {tijd(a.start)}–{tijd(a.end)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {client?.actor?.display ?? a.description ?? "Afspraak"}
                        </p>
                        {a.description && client?.actor?.display && (
                          <p className="truncate text-xs text-fg-subtle">{a.description}</p>
                        )}
                      </div>
                      {clientId && (
                        <Link
                          href={`/ecd/${clientId}`}
                          className="shrink-0 rounded-md border border-default px-3 py-1 text-xs font-medium text-fg-muted hover:bg-sunken"
                        >
                          Dossier
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          <div className="space-y-4">
            <Section
              titel="Open taken"
              actie={
                <Link href="/werkbak" className="text-xs font-medium text-brand-600 hover:text-brand-800">
                  Werkbak
                </Link>
              }
            >
              {laden ? (
                <LoadingSkeleton regels={3} />
              ) : taken.length === 0 ? (
                <EmptyState titel="Geen open taken" uitleg="Alles is opgepakt. Lekker bezig." />
              ) : (
                <ul className="space-y-2">
                  {taken.map((t) => (
                    <li key={t.id} className="text-sm">
                      <Link href="/werkbak" className="font-medium text-fg hover:text-brand-700">
                        {t.name ?? "Taak"}
                      </Link>
                      {t.processName && <p className="text-xs text-fg-subtle">{t.processName}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              titel="Overdracht"
              actie={
                <Link href="/overdracht" className="text-xs font-medium text-brand-600 hover:text-brand-800">
                  Openen
                </Link>
              }
            >
              <p className="text-sm text-fg-muted">
                Lees de overdracht van de vorige dienst voordat je begint.
              </p>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
```
NB: controleer de werkelijke response-vorm van `workflowFetch("/api/taken?...")` in `apps/web/src/app/werkbak/page.tsx` (regel ±204) en pas het `taken`-veld in de `Promise.all`-afhandeling daarop aan (de werkbak-pagina is de bron van waarheid voor de TasksResponse-shape).

- [ ] **Step 2: Verifiëren**
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
pnpm typecheck; pnpm lint; pnpm --filter @openzorg/web build
```

- [ ] **Step 3: Commit**
```powershell
git add apps/web/src/app/vandaag
git commit -m "feat(ia): referentiescherm Vandaag (werkruimte-start zorgmedewerker)"
```

### Task 7: E2E bijwerken + smoke voor Vandaag

**Files:**
- Modify: `apps/web/tests/e2e/golden-path-zorgmedewerker.spec.ts` (alleen als de nav-wijziging de selector breekt — login redirect gaat nu naar /vandaag i.p.v. /dashboard; controleer de login-helper in `tests/e2e/helpers/auth.ts` op een URL-assert en versoepel die naar `/(vandaag|dashboard)/`)
- Create: `apps/web/tests/e2e/vandaag.spec.ts`

- [ ] **Step 1: Nieuwe e2e-test** — `apps/web/tests/e2e/vandaag.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test("zorgmedewerker landt op Vandaag met route, taken en overdracht", async ({ page }) => {
  await login(page, TEST_USERS.zorgmedewerker);
  await page.goto("/vandaag");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mijn route vandaag" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open taken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overdracht" })).toBeVisible();
});
```

- [ ] **Step 2: Golden-path en auth-helper controleren**

Lees `tests/e2e/helpers/auth.ts`; als die na login op een specifieke URL assert (bijv. /dashboard), versoepel naar een patroon dat ook /vandaag toestaat. Draai daarna lokaal niets (volle stack vereist) — CI E2E is de poort.

- [ ] **Step 3: Commit**
```powershell
git add apps/web/tests/e2e
git commit -m "test(e2e): Vandaag-smoke + login-redirect naar werkruimte-start"
```

### Task 8: PR + review-gate Kevin

- [ ] **Step 1:**
```powershell
$env:PATH += ";C:\Program Files\GitHub CLI"
git push -u origin feat/fase1-iteratie-1
gh pr create --base main --title "feat(fase1): werkruimtes-IA + shared-ui patroonlaag + Vandaag" --body "Iteratie 1 van Fase 1: IA-document, EmptyState/ErrorState/LoadingSkeleton/PageHeader/Section in shared-ui (TDD), AppShell met werkruimtes per rol + switcher, referentiescherm Vandaag. Spec: docs/superpowers/specs/2026-06-12-fase-1-ontwerp-fundament-design.md"
gh pr checks --watch
```
- [ ] **Step 2:** CI groen → **STOP: Kevin reviewt de PR (en bij voorkeur het scherm op de dev-stack) vóór merge.** Dit is de iteratie-review uit de spec; niet zelfstandig mergen.

---

## Definition of done Iteratie 1

- [ ] IA-document op main (na review)
- [ ] 5 shared-ui primitieven met groene tests; `pnpm --filter @openzorg/shared-ui test` slaagt
- [ ] AppShell toont per rol de juiste werkruimte; switcher alleen bij >1 werkruimte; bestaande golden-path E2E blijft groen
- [ ] /vandaag rendert met alle vier states bereikbaar (leeg zonder medewerker-keuze, laden, fout bij API-uitval, gevuld)
- [ ] PR open met groene CI, wachtend op Kevin-review
