# Q2-Plan 2A: ECD Herstel — Monolith-split + Lookups + Bugfixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `apps/web/src/app/ecd/[id]/page.tsx` van een 5345-LoC monolith naar per-tab routes, bouw herbruikbare lookup-componenten voor het vrije-tekst-patroon, en fix systematisch de 22 non-P0 bugs uit bug-bash ronde 1. Geen nieuwe features — alleen structuur en fixes.

**Architecture:** (1) Split-eerst-fix-daarna. De monolith wordt opgeknipt vóór bugfixes, zodat we in kleine, geïsoleerde bestanden werken i.p.v. een 5k-regel-monster. (2) Lookup-componenten-eerst. Drie herbruikbare componenten (`PractitionerLookup`, `ContactPersoonLookup`, `CodeListLookup`) worden vóór de individuele fixes gebouwd, zodat 5+ P1/P2 bugs in één klap met dezelfde tool worden weggewerkt. (3) Regressie-tests per fix. Elke bugfix krijgt een Playwright-regressietest die het gedrag vastlegt.

**Tech Stack:** Next.js 15 App Router, Tailwind, Hono (ECD service), Medplum FHIR R4, Playwright E2E, Vitest unit. Alle bestaande conventies behouden.

**Spec referenties:**
- `docs/superpowers/specs/2026-04-13-fundering-eerst-design.md` — Q2 spec, werkstroom 1 (bug-bash fixes)
- `docs/superpowers/findings/2026-04-13-ecd-bugbash-1.md` — bron van alle bugs, severities, en architectuur-aanbeveling
- `docs/superpowers/plans/2026-04-13-q2-plan-1-veiligheidsnet.md` — voorganger, leverde de E2E-testinfra die dit plan gebruikt voor regressie-tests

**Branch:** `plan-2-ecd-herstel` (al actief na merge van Plan 1).

---

## File Structure

### Aan te maken (nieuw)

**Layout + per-tab routes:**
```
apps/web/src/app/ecd/[id]/
  layout.tsx                        ← shared: fetch client, header, tab-nav
  page.tsx                          ← overzicht/header content (dunt, <300 LoC)
  zorgplan/page.tsx
  rapportages/page.tsx
  medicatie/page.tsx
  vaccinaties/page.tsx
  allergieen/page.tsx
  mic/page.tsx
  mdo/page.tsx
  documenten/page.tsx
  wilsverklaringen/page.tsx
  vbm/page.tsx
  risicoscreening/page.tsx
```

**Shared UI componenten (in `packages/shared-ui` OF `apps/web/src/components/lookups/`):**
```
lookups/
  PractitionerLookup.tsx      ← async autocomplete over FHIR Practitioner
  ContactPersoonLookup.tsx    ← per-client contactpersonen (RelatedPerson)
  CodeListLookup.tsx          ← generiek, accepteert system+valueset
  index.ts                    ← re-exports
```

**Regressie-tests:**
```
apps/web/tests/e2e/
  regression/
    lookup-medewerker.spec.ts
    lookup-contactpersoon.spec.ts
    save-wilsverklaring.spec.ts
    save-medicatie-wijzigen.spec.ts
    save-patient-extensions.spec.ts
    mic-tab.spec.ts
    medicatieoverzicht.spec.ts
    allergie-header.spec.ts
    navigatie-clientenlijst.spec.ts
```

### Te wijzigen (bestaand)

- `apps/web/src/app/ecd/[id]/page.tsx` — wordt drastisch kleiner (alleen header/overzicht)
- `apps/web/src/app/ecd/page.tsx` — dubbele navigatie-handler weghalen
- `apps/web/src/components/RapportageForm.tsx` (of waar de form zit) — save-feedback toast, label-binding
- `services/ecd/src/routes/medicatie.ts` — wijzig-route fix (404)
- `services/ecd/src/routes/wilsverklaring.ts` — enum-validatie vóór opslaan
- Diverse route-files waar `Patient.extension[...]` wordt opgebouwd — leeg extension zonder `url` weghalen

---

## Fasering

Het plan heeft 6 fases. Binnen elke fase zijn taken bite-sized; tussen fases zijn er natuurlijke review-pauzes.

- **Fase 1 — Baseline & voorbereiding** (1 taak, ~1 uur)
- **Fase 2 — Monolith-split** (3 taken, ~1 dag werk) — geen gedragswijziging
- **Fase 3 — Lookup-componenten** (4 taken, ~2 dagen werk)
- **Fase 4 — P1-fixes via lookups** (5 taken, ~2 dagen werk)
- **Fase 5 — Gebroken saves & ontbrekende features** (8 taken, ~3-4 dagen werk)
- **Fase 6 — Polish & finalisatie** (3 taken, ~1 dag werk)

Totaal: 24 taken, geschatte doorlooptijd 1,5-2 weken fulltime.

---

## Fase 1 — Baseline & voorbereiding

### Task 1: Baseline bevestigen

**Doel:** voordat we gaan breken, verifieer dat alles vandaag werkt. Geen verrassingen later.

- [ ] **Step 1.1: Lokaal pnpm install schoon**

```bash
pnpm install --frozen-lockfile
```

Expected: geen errors, geen warnings over peer deps die er eerder niet waren.

- [ ] **Step 1.2: Typecheck + lint groen**

```bash
pnpm typecheck
pnpm lint
```

Expected: beide exit 0. Als niet — stop en rapporteer, los eerst op.

- [ ] **Step 1.3: Vitest groen**

```bash
pnpm test
```

Expected: exit 0.

- [ ] **Step 1.4: Playwright groen tegen Unraid**

```bash
E2E_BASE_URL=http://192.168.1.10:13000 pnpm --filter @openzorg/web test:e2e
```

Expected: 3/3 tests groen (smoke, auth-helper, golden-path).

- [ ] **Step 1.5: Unraid smoke groen**

```bash
./scripts/unraid-smoke.sh
```

Expected: alle 6 services healthy.

- [ ] **Step 1.6: Dependency-map van ecd/[id]/page.tsx**

```bash
grep -c "^" apps/web/src/app/ecd/\[id\]/page.tsx
```

Noteer het huidige LoC-aantal als baseline (verwacht ~5345). Sla op in de commit-message van Task 2 als vergelijkingspunt.

Lees de file vluchtig (eerste 200 regels + grep naar `function` en `const.*=.*=>` voor component-namen). Maak een korte lijst van welke componenten/functies in de file zitten — je hebt deze nodig bij Task 2.

- [ ] **Step 1.7: Commit — leeg, markeert startpunt**

```bash
git commit --allow-empty -m "chore: baseline Plan 2A — alle checks groen, LoC monolith N"
```

Vervang `N` door het werkelijke aantal regels uit stap 1.6.

---

## Fase 2 — Monolith-split

### Task 2: Split-strategie en skeleton

**Doel:** expliciete beslissing over wat naar welke file verhuist, en maak een leeg skelet aan zonder gedragswijziging.

**Files:**
- Create: `apps/web/src/app/ecd/[id]/layout.tsx`
- Modify: `apps/web/src/app/ecd/[id]/page.tsx`
- Create: `apps/web/src/app/ecd/[id]/{zorgplan,rapportages,medicatie,vaccinaties,allergieen,mic,mdo,documenten,wilsverklaringen,vbm,risicoscreening}/page.tsx` (11 nieuwe files)

- [ ] **Step 2.1: Lees de volledige monolith en mindmap**

Open `apps/web/src/app/ecd/[id]/page.tsx` en noteer:
1. Welke state (useState/useEffect) is **globaal** (client-info, auth, active-tab)?
2. Welke state is **tab-specifiek** (zorgplan-form-state, rapportage-lijst, etc.)?
3. Welke hooks/queries worden **gedeeld** tussen tabs?
4. Waar zitten de **tab-navigation buttons** en hoe wordt de active-tab bepaald?

Schrijf dit op in een tijdelijk bestand `docs/superpowers/findings/monolith-mindmap.md` — dit bestand wordt NIET gecommit, het is jouw werkblad. Delete na Task 4.

- [ ] **Step 2.2: Maak `layout.tsx` met gedeelde state**

```typescript
// apps/web/src/app/ecd/[id]/layout.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ecdFetch } from "@/lib/api";
import type { Patient } from "@/types/fhir";

import { ClientHeader } from "./ClientHeader";
import { TabNav } from "./TabNav";

export default function EcdDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecdFetch(`/api/clients/${params.id}`)
      .then((res) => res.json())
      .then((data) => setClient(data))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div>Laden…</div>;
  if (!client) return <div>Cliënt niet gevonden</div>;

  return (
    <div className="p-6">
      <ClientHeader client={client} />
      <TabNav clientId={client.id!} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
```

**Let op:** `ClientHeader` en `TabNav` bestaan nog niet als losse componenten — die extraheer je in Step 2.3.

- [ ] **Step 2.3: Extracteer `ClientHeader.tsx` en `TabNav.tsx`**

Kopieer de huidige header-JSX en tab-navigatie uit de monolith naar twee losse componenten:

```typescript
// apps/web/src/app/ecd/[id]/ClientHeader.tsx
"use client";
import type { Patient } from "@/types/fhir";

export function ClientHeader({ client }: { client: Patient }) {
  // ... exact dezelfde JSX als nu in de monolith staat, alleen geëxtraheerd
}
```

```typescript
// apps/web/src/app/ecd/[id]/TabNav.tsx
"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const TABS = [
  { slug: "zorgplan", label: "Zorgplan" },
  { slug: "rapportages", label: "Rapportages" },
  { slug: "medicatie", label: "Medicatie" },
  { slug: "vaccinaties", label: "Vaccinaties" },
  { slug: "allergieen", label: "Allergieën" },
  { slug: "mic", label: "MIC-meldingen" },
  { slug: "mdo", label: "MDO" },
  { slug: "documenten", label: "Documenten" },
  { slug: "wilsverklaringen", label: "Wilsverklaringen" },
  { slug: "vbm", label: "VBM" },
  { slug: "risicoscreening", label: "Risicoscreening" },
];

export function TabNav({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  return (
    <nav role="tablist" className="flex gap-2 border-b border-default">
      {TABS.map((tab) => {
        const active = pathname?.endsWith(`/${tab.slug}`);
        return (
          <Link
            key={tab.slug}
            href={`/ecd/${clientId}/${tab.slug}`}
            role="tab"
            aria-selected={active}
            className={active ? "border-b-2 border-brand px-3 py-2" : "px-3 py-2"}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Belangrijk (fix voor findings #P2 "tabs zonder role"):** let op `role="tablist"` op de `<nav>` en `role="tab"` + `aria-selected` op elke `<Link>`. Dit is meteen één bug weggewerkt.

- [ ] **Step 2.4: Maak 11 lege tab-pages als stubs**

Voor elke tab-slug:

```typescript
// apps/web/src/app/ecd/[id]/zorgplan/page.tsx
"use client";
export default function ZorgplanPage() {
  return <div>Zorgplan-tab — nog niet gemigreerd</div>;
}
```

Herhaal voor alle 11 tabs. Committeer deze stubs NIET losse — deze zijn onderdeel van de commit in Step 2.5.

- [ ] **Step 2.5: Dunne `page.tsx` als overzicht-redirect**

Verander `apps/web/src/app/ecd/[id]/page.tsx` naar een simpele redirect of overzicht. Kies één:

```typescript
// Optie A: redirect naar eerste tab
import { redirect } from "next/navigation";
export default function EcdOverviewPage({ params }: { params: { id: string } }) {
  redirect(`/ecd/${params.id}/zorgplan`);
}
```

Of als er echt een "overzicht"-sectie moet blijven die niet bij een tab hoort: behoud hier alleen die content (bv. samenvatting-cards).

- [ ] **Step 2.6: Build + typecheck**

```bash
pnpm --filter @openzorg/web build
pnpm typecheck
```

Expected: geen errors. Waarschijnlijk WEL waarschuwingen over ongebruikte imports in de originele (nog niet leeggemaakte) monolith — negeer die tijdelijk.

- [ ] **Step 2.7: Playwright — welke tests kapot?**

```bash
E2E_BASE_URL=http://192.168.1.10:13000 pnpm --filter @openzorg/web test:e2e
```

Verwacht: golden-path zal breken (URL verandert naar `/ecd/{id}/rapportages` i.p.v. `/ecd/{id}` met een tab-click). Dit is voorzien. Noteer precies welke selectoren falen — we fixen ze in Task 4.

- [ ] **Step 2.8: Commit — skeleton zonder behavior change**

```bash
git add apps/web/src/app/ecd/
git commit -m "refactor(ecd): skeleton voor per-tab routes + TabNav met role=tab"
```

---

### Task 3: Inhoud migreren per tab (batch 1 — Zorgplan, Rapportages, Medicatie)

**Doel:** verplaats de code voor de drie meest-gebruikte tabs uit de monolith naar hun eigen file. Geen gedragswijziging; alleen verplaatsing.

**Strategie:** per tab volgen we dit recept:
1. Vind de JSX-blok + state + handlers voor de tab in `page.tsx` (de oude monolith)
2. Knip die naar de betreffende `{tab}/page.tsx` file
3. Hoist shared imports
4. Bouw + test tab handmatig in browser
5. Verplaats helper-functies die ALLEEN door deze tab worden gebruikt naar de tab-file
6. Shared helpers blijven in een `_shared/` directory of blijven global imports

- [ ] **Step 3.1: Migreer Zorgplan-tab**

Knip zorgplan-code uit `page.tsx`, plaats in `zorgplan/page.tsx`. Volg recept hierboven. Lokaal testen: `pnpm --filter @openzorg/web dev`, navigeer naar `/ecd/C-00001/zorgplan`, verifieer dat de content verschijnt.

Commit:
```bash
git commit -m "refactor(ecd): migreer zorgplan naar eigen tab-route"
```

- [ ] **Step 3.2: Migreer Rapportages-tab**

Idem als 3.1.

Commit:
```bash
git commit -m "refactor(ecd): migreer rapportages naar eigen tab-route"
```

- [ ] **Step 3.3: Migreer Medicatie-tab**

Idem.

Commit:
```bash
git commit -m "refactor(ecd): migreer medicatie naar eigen tab-route"
```

- [ ] **Step 3.4: Tussentijdse Playwright-check**

```bash
E2E_BASE_URL=http://192.168.1.10:13000 pnpm --filter @openzorg/web test:e2e -- golden-path
```

**Fix de golden-path selectoren** zodat de test weer groen is. De test moet naar `/ecd/{id}/rapportages` navigeren i.p.v. op een tab klikken. Verwachte aanpassing in `golden-path-zorgmedewerker.spec.ts`:

```typescript
// Oud:
// await page.getByRole("button", { name: "Rapportages", exact: true }).click();
// Nieuw:
await page.goto(`/ecd/${clientId}/rapportages`);
```

OF gebruik de TabNav-link (nu een echte `<Link>` met `role="tab"`):
```typescript
await page.getByRole("tab", { name: "Rapportages" }).click();
```

Laatste is mooier — test de navigatie via UI, niet via directe URL.

Commit:
```bash
git commit -m "test(e2e): golden-path bijgewerkt voor per-tab routes"
```

---

### Task 4: Inhoud migreren per tab (batch 2 — overige 8 tabs)

**Files:** 8 tabs × `page.tsx` elk, plus `apps/web/src/app/ecd/[id]/page.tsx` (leegmaken tot redirect)

- [ ] **Step 4.1: Migreer Vaccinaties**
- [ ] **Step 4.2: Migreer Allergieën**
- [ ] **Step 4.3: Migreer MIC-meldingen** (zie finding P1: deze tab ontbreekt UI-wise — migreer wat er wel is, de uitbreiding komt in Task 14)
- [ ] **Step 4.4: Migreer MDO**
- [ ] **Step 4.5: Migreer Documenten**
- [ ] **Step 4.6: Migreer Wilsverklaringen**
- [ ] **Step 4.7: Migreer VBM**
- [ ] **Step 4.8: Migreer Risicoscreening**
- [ ] **Step 4.9: Monolith moet nu leeg zijn**

Na alle migraties mag `apps/web/src/app/ecd/[id]/page.tsx` ofwel een redirect zijn, ofwel alleen een hoog-niveau overzicht (cards met counts/recent activity). Absoluut GEEN tab-specifieke state of JSX meer.

```bash
wc -l apps/web/src/app/ecd/\[id\]/page.tsx
```

Expected: <300 LoC. Zo niet, zoek uit wat er nog inzit dat er niet hoort.

- [ ] **Step 4.10: Playwright full suite groen**

```bash
E2E_BASE_URL=http://192.168.1.10:13000 pnpm --filter @openzorg/web test:e2e
```

Expected: alle 3 tests groen. Zo niet, fix selectoren — niet de code, niet de tabs.

- [ ] **Step 4.11: Delete werkblad**

```bash
rm docs/superpowers/findings/monolith-mindmap.md
```

- [ ] **Step 4.12: Commit — monolith-split compleet**

```bash
git add -A
git commit -m "refactor(ecd): monolith gesplitst in 11 tab-routes + layout"
```

---

## Fase 3 — Lookup-componenten

De volgende fase bouwt 3 herbruikbare componenten die het "vrije-tekst waar lookup hoort" patroon oplost. Zodra deze staan, fixen 5+ bugs in Fase 4 zonder nieuwe logica per fix.

### Task 5: PractitionerLookup component

**Files:**
- Create: `apps/web/src/components/lookups/PractitionerLookup.tsx`
- Create: `apps/web/src/components/lookups/index.ts`
- Create: `apps/web/tests/e2e/regression/lookup-medewerker.spec.ts`

**API:** component neemt een `value` (Practitioner reference of null), een `onChange(ref: string, display: string)`, en optioneel een `rolFilter` (bv. alleen behandelaars).

- [ ] **Step 5.1: Failing regressietest**

```typescript
// tests/e2e/regression/lookup-medewerker.spec.ts
import { expect, test } from "@playwright/test";

import { login } from "../helpers/auth";
import { TEST_USERS } from "../helpers/test-users";

test("PractitionerLookup toont suggesties en vult geselecteerde medewerker in", async ({ page }) => {
  await login(page, TEST_USERS.zorgmedewerker);
  // Navigeer naar een plek waar de lookup gebruikt wordt — voorlopig een dedicated test-pagina of zorgplan-form
  await page.goto("/ecd/C-00001/zorgplan");
  await page.getByRole("button", { name: /nieuw doel|bewerken/i }).first().click();

  const lookup = page.getByLabel(/verantwoordelijke behandelaar/i);
  await lookup.fill("Jan");
  await expect(page.getByRole("option", { name: /Jan/ }).first()).toBeVisible({ timeout: 5000 });
  await page.getByRole("option", { name: /Jan/ }).first().click();

  // Na select moet de veld-waarde de gekozen naam tonen, niet meer de filter-tekst
  await expect(lookup).toHaveValue(/Jan de Vries|Jan/);
});
```

Draai (moet falen — component bestaat nog niet):
```bash
E2E_BASE_URL=http://192.168.1.10:13000 pnpm --filter @openzorg/web test:e2e -- lookup-medewerker
```

- [ ] **Step 5.2: Component-interface en skelet**

```typescript
// apps/web/src/components/lookups/PractitionerLookup.tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { ecdFetch } from "@/lib/api";

export interface PractitionerOption {
  id: string;
  display: string;
  qualification?: string;
}

export interface PractitionerLookupProps {
  value: PractitionerOption | null;
  onChange: (option: PractitionerOption | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function PractitionerLookup({
  value,
  onChange,
  label = "Medewerker",
  placeholder = "Zoek op naam…",
  disabled,
}: PractitionerLookupProps) {
  const [query, setQuery] = useState(value?.display ?? "");
  const [options, setOptions] = useState<PractitionerOption[]>([]);
  const [open, setOpen] = useState(false);
  const inputId = useRef(`practitioner-lookup-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (query.length < 2) { setOptions([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const res = await ecdFetch(`/api/medewerkers?name=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json() as { id: string; name: string; qualification?: string }[];
      setOptions(data.map((p) => ({ id: p.id, display: p.name, qualification: p.qualification })));
    }, 250); // debounce
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block text-sm font-medium">{label}</label>
      <input
        id={inputId}
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-autocomplete="list"
        aria-expanded={open}
        className="w-full rounded border px-3 py-2"
      />
      {open && options.length > 0 && (
        <ul role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border bg-raised shadow">
          {options.map((opt) => (
            <li
              key={opt.id}
              role="option"
              aria-selected={value?.id === opt.id}
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setQuery(opt.display); setOpen(false); }}
              className="cursor-pointer px-3 py-2 hover:bg-sunken"
            >
              {opt.display}
              {opt.qualification && <span className="ml-2 text-fg-muted text-sm">— {opt.qualification}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Let op:**
- `label` met `htmlFor` + matching `id` op de input (fix voor finding P2 "labels niet gebonden")
- `role="listbox"` + `role="option"` + `aria-selected` (a11y)
- `aria-autocomplete="list"` + `aria-expanded`
- Debounced fetch (250ms)
- AbortController om stale requests te cancelen

- [ ] **Step 5.3: Index re-export**

```typescript
// apps/web/src/components/lookups/index.ts
export { PractitionerLookup } from "./PractitionerLookup";
export type { PractitionerOption, PractitionerLookupProps } from "./PractitionerLookup";
// (volgende lookups komen hieronder in latere tasks)
```

- [ ] **Step 5.4: Mount in zorgplan-form (waar het gebruikt wordt)**

Zoek in `apps/web/src/app/ecd/[id]/zorgplan/page.tsx` de plek waar "Verantwoordelijke behandelaar" een vrij tekstveld is. Vervang door `<PractitionerLookup>`. Behoud het veld-label "Verantwoordelijke behandelaar".

- [ ] **Step 5.5: Regressietest groen**

```bash
E2E_BASE_URL=http://192.168.1.10:13000 pnpm --filter @openzorg/web test:e2e -- lookup-medewerker
```

Itereer selectoren tot groen. 3 consecutieve runs groen.

- [ ] **Step 5.6: Commit**

```bash
git commit -m "feat(lookups): PractitionerLookup met role=listbox + toegepast op verantwoordelijke behandelaar"
```

---

### Task 6: ContactPersoonLookup component

Zelfde patroon als Task 5, maar scope is beperkt tot contactpersonen van een specifieke cliënt.

**Files:**
- Create: `apps/web/src/components/lookups/ContactPersoonLookup.tsx`
- Create: `apps/web/tests/e2e/regression/lookup-contactpersoon.spec.ts`
- Modify: `apps/web/src/components/lookups/index.ts`

- [ ] **Step 6.1: Failing regressietest** — zelfde shape als 5.1 maar op wilsverklaringen-tab waar "vertegenwoordiger" hoort. Moet per cliënt de contactpersonen-lijst laden via `/api/clients/:id/contactpersonen`.
- [ ] **Step 6.2: Component** — copy `PractitionerLookup.tsx`, vervang fetch door `GET /api/clients/${clientId}/contactpersonen`, maak `clientId` een verplichte prop.
- [ ] **Step 6.3: Index re-export**
- [ ] **Step 6.4: Mount in wilsverklaring-form** (vervang vrij tekstveld "vertegenwoordiger")
- [ ] **Step 6.5: Regressietest groen (3 runs)**
- [ ] **Step 6.6: Commit** — `feat(lookups): ContactPersoonLookup + toegepast op wilsverklaring`

---

### Task 7: CodeListLookup component

Generiek, accepteert een `system` URI en levert opties uit een vaste codelijst (of uit Medplum ValueSet).

**Files:**
- Create: `apps/web/src/components/lookups/CodeListLookup.tsx`
- Create: `apps/web/src/components/lookups/codelists.ts` (vaste codelijsten voor dosering-eenheden, relatietypen, etc.)
- Create: `apps/web/tests/e2e/regression/lookup-codelijst.spec.ts`

**Codelijsten om in te bakken (`codelists.ts`):**
- `dosering-eenheid` → UCUM basics: mg, ml, stuk, druppel, IE, microgram, gram
- `wilsverklaring-type` → de enum die nu server-side wordt afgedwongen: behandelverbod, euthanasieverklaring, volmacht, levenswensverklaring, donorcodicil, bopz-mentorschap, bopz-curatele, bopz-beschermingsbewind
- `relatie-type` → echtgenoot, kind, ouder, broer/zus, wettelijk vertegenwoordiger, mantelzorger, overig

- [ ] **Step 7.1: Failing regressietest** — test dat selectie werkt en dat alleen toegestane waarden kiesbaar zijn
- [ ] **Step 7.2: Component met static option-source** (geen fetch, codelijsten uit `codelists.ts`)
- [ ] **Step 7.3: Alternatief-constructor `fromValueSet(url)` voor later Medplum-gebaseerd** (stub voor nu — gooi een comment `// TODO: Medplum ValueSet support in volgende iteratie` — dit is expliciet toegestaan als het in de roadmap staat)
- [ ] **Step 7.4: Mount in wilsverklaring-form (type-veld)** en medicatie-form (dosering-eenheid)
- [ ] **Step 7.5: Regressietest groen**
- [ ] **Step 7.6: Commit** — `feat(lookups): CodeListLookup + toegepast op wilsverklaring-type en medicatie-eenheid`

---

### Task 8: Lookup API-endpoints verifiëren

**Doel:** de componenten roepen `/api/medewerkers?name=...` en `/api/clients/:id/contactpersonen` aan. Verifieer dat deze endpoints bestaan, returneren wat de componenten verwachten, en de `name`-query parameter ondersteunen.

- [ ] **Step 8.1: Read `services/ecd/src/routes/medewerkers.ts`** — check of `GET /api/medewerkers?name=` werkt, zo niet: voeg de filter toe.
- [ ] **Step 8.2: Read `services/ecd/src/routes/clients.ts` (of `contactpersonen.ts`)** — check of contactpersoon-lijst per client beschikbaar is.
- [ ] **Step 8.3: Unit-test voor name-filter** — Vitest in `services/ecd/src/__tests__/` die `GET /api/medewerkers?name=Jan` test tegen een mock-Medplum response.
- [ ] **Step 8.4: Commit** — `fix(ecd): medewerkers endpoint ondersteunt name-filter voor lookup`

---

## Fase 4 — P1-fixes via lookups

Deze fase gebruikt de zojuist gebouwde componenten om de grote P1-bugs weg te werken. Tasks 9-13 volgen allemaal hetzelfde patroon:

**Recept per P1-fix:**
1. Schrijf een Playwright regressietest die het bug reproduceert
2. Draai — verifieer dat hij rood is (met de huidige bug)
3. Vervang het vrije tekstveld door de juiste lookup-component
4. Draai opnieuw — test groen
5. Commit

### Task 9: Fix vrije-tekst verantwoordelijke behandelaar (zorgplan)

**Reeds gedaan in Task 5.4** — maar voeg hier een aparte regressietest toe die specifiek verifieert dat het OPGESLAGEN zorgplan een FHIR Reference heeft naar een Practitioner, niet een plain string. Dit voorkomt regressie als iemand de lookup later terugvervangt door een tekstveld.

- [ ] **Step 9.1: Playwright test — submit form en fetch het zorgplan via API om structuur te checken**
- [ ] **Step 9.2: Commit**

### Task 10: Fix vrije-tekst MDO-deelnemers

- [ ] **Step 10.1: Failing regressietest**
- [ ] **Step 10.2: Vervang tekstveld door `<PractitionerLookup>` met multiselect (of meerdere instances)**
- [ ] **Step 10.3: Backend: MDO Encounter.participant moet Practitioner-refs opslaan**
- [ ] **Step 10.4: Regressietest groen**
- [ ] **Step 10.5: Commit**

### Task 11: Fix vrije-tekst medicatie-naam (target: G-Standaard, voor nu hardcoded lijst)

- [ ] **Step 11.1: Voeg `medicatie-basis` codelist toe aan `codelists.ts`** — ~50 meest gebruikte medicatie-namen als tijdelijke lijst. Volledige G-Standaard-integratie is buiten scope (Q3).
- [ ] **Step 11.2: Failing regressietest**
- [ ] **Step 11.3: Vervang vrij tekstveld door `CodeListLookup` met deze lijst**
- [ ] **Step 11.4: Commit**

### Task 12: Fix vrije-tekst dosering-eenheid (al gedaan in Task 7.4, alleen regressietest)

- [ ] **Step 12.1: Regressietest die alleen UCUM-eenheden accepteert**
- [ ] **Step 12.2: Commit**

### Task 13: Fix vertegenwoordiger wilsverklaring (al gedaan in Task 6, alleen regressietest)

- [ ] **Step 13.1: Regressietest**
- [ ] **Step 13.2: Commit**

---

## Fase 5 — Gebroken saves & ontbrekende features

### Task 14: MIC-meldingen tab terugbrengen

**Context:** finding P1 "Ik zie dit tabblad niet". Check eerst of de data-kant werkt (service `/api/mic-meldingen`) en alleen de UI-tab ontbreekt, of dat er dieper iets mis is.

- [ ] **Step 14.1: Verifieer MIC-endpoint via curl**

```bash
curl -sS http://192.168.1.10:14001/api/mic-meldingen \
  -H "X-Tenant-ID: $JAN_TENANT" \
  -H "Authorization: Bearer $JAN_TOKEN"
```

Als 200 → alleen UI fix. Als 404 → backend werk nodig.

- [ ] **Step 14.2: Failing regressietest `mic-tab.spec.ts`** — klik op MIC-tab, zie lijst, voeg melding toe, verifieer in lijst
- [ ] **Step 14.3: Implementeer `apps/web/src/app/ecd/[id]/mic/page.tsx`** — lijst + formulier
- [ ] **Step 14.4: Regressietest groen**
- [ ] **Step 14.5: Commit**

### Task 15: Fix medicatie-wijzigen 404

**Context:** finding P2 "Wijzigen krijg ik 404". Endpoint bestaat waarschijnlijk niet of is verkeerd gemount.

- [ ] **Step 15.1: Reproduceer via curl** — `PUT /api/clients/C-00001/medicatie/{id}` → welke status?
- [ ] **Step 15.2: Fix route-mount in `services/ecd/src/routes/medicatie.ts`** — check of de PUT-handler bestaat en de route-pattern klopt
- [ ] **Step 15.3: Regressietest `save-medicatie-wijzigen.spec.ts`** — wijzig bestaande medicatie, verifieer update
- [ ] **Step 15.4: Commit**

### Task 16: Fix wilsverklaring type-validatie (save faalt)

**Context:** finding "Opslaan lukt niet: type moet één van... zijn". De enum-validatie bestaat server-side, maar de UI stuurt waarschijnlijk iets anders (vrij tekst → getallen → nietszeggend).

- [ ] **Step 16.1: Reproduceer — verifieer dat opslaan met een niet-enum waarde 400 geeft**
- [ ] **Step 16.2: Dankzij Task 7 wordt type nu via CodeListLookup gekozen — verifieer dat alleen geldige enums uitgestuurd worden**
- [ ] **Step 16.3: Regressietest `save-wilsverklaring.spec.ts`**
- [ ] **Step 16.4: Commit**

### Task 17: Fix Patient.extension[1].url missing

**Context:** finding "Extra velden: Missing required property Patient.extension[1].url". FHIR heeft harde regel: elke extension MOET een `url`. Een leeg extension-item wordt waarschijnlijk toegevoegd zonder url.

- [ ] **Step 17.1: Grep naar `extension:` en `extension.push` in `services/ecd/src/routes/clients.ts`** en `apps/web/src/app/ecd/` — vind waar extension-items worden opgebouwd
- [ ] **Step 17.2: Identificeer het bug-pad** — waarschijnlijk een conditional die bij lege input een `{}` pusht i.p.v. te skippen
- [ ] **Step 17.3: Fix: skip lege extensions, of altijd met `url` aanmaken**
- [ ] **Step 17.4: Regressietest `save-patient-extensions.spec.ts`**
- [ ] **Step 17.5: Commit**

### Task 18: Medicatie stop-knop zet einddatum

**Context:** finding P2 "Stop geeft bevestiging maar einddatum wordt niet ingevuld"

- [ ] **Step 18.1: Failing test** — klik stop, verifieer dat `MedicationRequest.dispenseRequest.validityPeriod.end` nu is gevuld
- [ ] **Step 18.2: Fix in stop-handler**
- [ ] **Step 18.3: Commit**

### Task 19: Medicatieoverzicht vullen

**Context:** finding "Medicatieoverzicht is leeg". Zou een gecombineerde view moeten zijn van `MedicationRequest` + `MedicationStatement`.

- [ ] **Step 19.1: Check welke endpoint het overzicht ophaalt** — waarschijnlijk `/api/clients/:id/medicatie-overzicht`
- [ ] **Step 19.2: Fix data-fetch of route implementatie**
- [ ] **Step 19.3: Regressietest**
- [ ] **Step 19.4: Commit**

### Task 20: Allergie hoog-risico zichtbaar op header

**Context:** finding P1 "verwacht na toevoegen van hoog risico allergie dat de hoofd pagina zich daarop aanpast". Patient-safety issue.

- [ ] **Step 20.1: Failing regressietest `allergie-header.spec.ts`** — voeg high-criticality AllergyIntolerance toe, verifieer waarschuwings-badge op header
- [ ] **Step 20.2: Fetch allergies in `ClientHeader.tsx`** (layout-level)
- [ ] **Step 20.3: Render badge "⚠ Allergie: {substance}" als criticality=high**
- [ ] **Step 20.4: Commit**

### Task 21: Save-feedback toast + dubbele navigatie cliëntenlijst

**Context:** twee P1-fixes die naar aard samenhoren (beide UX-bugs in feedback/navigatie).

- [ ] **Step 21.1: Kies/installeer een toast-lib** — bij voorkeur `sonner` of een bestaande toast-implementatie (check `packages/shared-ui` eerst)
- [ ] **Step 21.2: Toast na rapportage opslaan** in `RapportageForm`
- [ ] **Step 21.3: Cliëntenlijst-rij: verwijder `onClick={window.location.href}`, laat alleen `<Link>` over**
- [ ] **Step 21.4: Failing regressietest `navigatie-clientenlijst.spec.ts`** — Ctrl+click opent in nieuwe tab (het enige voordeel van een echte `<Link>`)
- [ ] **Step 21.5: Commit**

---

## Fase 6 — Polish & finalisatie

### Task 22: P3-fixes batch

Alle vijf P3's in één sessie. Regressietests alleen waar zinvol (typo-fixes hoeven geen test).

- [ ] **Step 22.1: Zorgplan-interventie save fix** — track waarom save niks doet (silent failure?)
- [ ] **Step 22.2: Vaccinatie auto-volgende-datum button** — kleine UX toevoeging, `onClick={() => setDate(addYears(laatsteVaccinatie, 1))}`
- [ ] **Step 22.3: VBM permissie check** — alleen teamleider/beheerder mag VBM opleggen, voeg role-guard toe in de VBM-form
- [ ] **Step 22.4: Rapportage-formulier uitbreiding** — SOEP tabs of sjablonen toevoegen (als scope het toelaat, anders markeren als Plan 3)
- [ ] **Step 22.5: Documenten JPG viewer** — simpele `<img>` of `<embed>` als preview
- [ ] **Step 22.6: Commit** — `fix(ecd): P3 polish-batch`

### Task 23: Final regressie + header counts

- [ ] **Step 23.1: Volledige Playwright run (alle tests + regressies)**

```bash
E2E_BASE_URL=http://192.168.1.10:13000 pnpm --filter @openzorg/web test:e2e
```

Expected: 3 basis + 9 regressie = 12 tests groen.

- [ ] **Step 23.2: LoC-meting nieuwe situatie**

```bash
wc -l apps/web/src/app/ecd/\[id\]/page.tsx
wc -l apps/web/src/app/ecd/\[id\]/**/*.tsx
wc -l apps/web/src/app/ecd/\[id\]/layout.tsx
```

Vergelijk met baseline uit Task 1.6. Doel: geen file >500 LoC meer in de ECD-tree.

- [ ] **Step 23.3: Lint + typecheck schoon**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 23.4: Update findings-document**

In `docs/superpowers/findings/2026-04-13-ecd-bugbash-1.md`: markeer elke gefixte finding met ✓ + verwijs naar de commit-SHA. Ongefixte findings (als die er zijn) krijgen een notitie "uitgesteld naar Plan 3" of "doorgeschoven".

- [ ] **Step 23.5: Commit**

### Task 24: PR naar main

- [ ] **Step 24.1: Push branch**

```bash
git push -u origin plan-2-ecd-herstel
```

- [ ] **Step 24.2: PR openen met gh**

```bash
gh pr create --title "Q2-Plan 2A: ECD herstel — monolith-split + lookups + bugfixes" --body "..."
```

Body: korte samenvatting + verwijzing naar plan + findings-document + gefixte findings-count + CI-status.

- [ ] **Step 24.3: Wacht tot CI groen**
- [ ] **Step 24.4: Merge** (squash)

---

## Risico's

1. **Monolith-split breekt meer dan verwacht.** Mitigatie: Task 4.10 (Playwright full suite) vangt regressies. Als er iets fundamenteel stuk gaat dat niet door de 3 huidige tests wordt gedekt, escaleer en breid tests uit vóór verder splitsen.
2. **Lookup API-endpoints ontbreken/werken niet.** Mitigatie: Task 8 verifieert ze vooraf. Als er backend-werk nodig is dat groter is dan een filter-toevoeging, overweeg om de betreffende lookup later te mounten (de component werkt stand-alone).
3. **G-Standaard integratie wordt geëist voor medicatie-naam.** Mitigatie: we gebruiken een hardcoded ~50-items lijst als tijdelijke oplossing. Volledige G-Standaard is Q3 of later werk; dat staat expliciet in Task 11.
4. **Werkbak P0 verstoort ECD-fixes.** Mitigatie: niet dit plan's zorg — Plan 2B loopt parallel of erna. Als een ECD-fix afhangt van werkbak-functionaliteit (bv. een task moet na save verschijnen), skip die sub-fix en verwijs naar Plan 2B.
5. **Te veel scope-creep tijdens bugfixes.** Mitigatie: elke finding-fix MAG alleen z'n eigen bug raken, geen "en ik zag ook nog…" uitbreidingen. Nieuwe findings tijdens executie → nieuw issue of nieuw findings-document, niet in deze branch.

---

## Wat hierna komt

**Q2-Plan 2B** — werkbak + workflow audit en fix (apart document, parallel spoor).

**Q2-Plan 3** — multi-tenant security-review + RBAC uitrol naar planning/facturatie + performance baseline. Volgt na 2A/2B.

**Q3 — architecturaal** — kern/sector-boundary + sector-plugin contract + GRZ-light als proof. De monolith-split uit dit plan (Fase 2) is een directe voorbereiding hierop: elke tab is nu een zelfstandig file, waardoor de kern/sector-scheiding hooked kan worden op tab-niveau in plaats van op een monolith die je eerst nog moet uitpluizen.
