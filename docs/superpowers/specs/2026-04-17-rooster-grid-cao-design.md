# Rooster Drag-and-Drop Grid + CAO-uren

> **Status:** Approved 2026-04-17
> **Branch:** plan-2a-execute

## Problem

Het huidige rooster (`apps/web/src/app/planning/rooster/page.tsx`) toont een statische tabel met beschikbaarheid en afspraken per medewerker per dag. Planners kunnen niet visueel inplannen: ze moeten handmatig afspraken aanmaken en verplaatsen via formulieren. Er is geen CAO-compliance check, waardoor planners onbewust arbeidstijdenwet-overtredingen kunnen veroorzaken. Er is ook geen inzicht in contract-uren vs. geplande uren.

## Solution

Vervang de huidige roostertabel door een interactief drag-and-drop weekgrid met:
1. **Visuele tijdsgrid** — medewerkers op Y-as, 30-min tijdslots op X-as (6:00-22:00)
2. **Drag-and-drop** — afspraken verplaatsen tussen tijden en medewerkers
3. **Click-to-create** — klik op lege slot om inline afspraak aan te maken
4. **CAO-engine** — informatieve ATW-waarschuwingen met override-mogelijkheid
5. **Contract-uren** — gepland vs. contract weergave per medewerker

## Design Decisions

| Beslissing | Keuze | Reden |
|---|---|---|
| Grid library | `@dnd-kit/core` + `@dnd-kit/sortable` | Accessible (ARIA drag-and-drop), React-native, lichtgewicht (~15KB gzipped), actief onderhouden |
| Tijdresolutie | 30 minuten | Balans tussen precisie en bruikbaarheid; VVT-afspraken zijn zelden korter |
| Dagbereik | 06:00 - 22:00 | Dekt vroege ochtend- en avondzorg; nachtdienst apart behandeld |
| CAO-modus | Informatief + override | Planner blijft verantwoordelijk; systeem waarschuwt maar blokkeert niet. Override-reden wordt gelogd in audit_log |
| Weekweergave | Ma-zo (7 dagen) | VVT-zorg is 7 dagen; weekend visueel gemarkeerd |
| Contract-uren bron | Nieuw endpoint `/api/medewerkers/:id/contract` | FHIR PractitionerRole.extension of Medplum-custom; valt terug op 36u default |

## Feature 1: Grid Component Architecture

### Component hierarchy

```
RoosterPage (page.tsx)
  RoosterToolbar          — weeknavigatie, vandaag-knop, view-toggle
  RoosterGrid             — DndContext wrapper
    RoosterHeader           — tijdslot kolom-headers (06:00, 06:30, ... 21:30)
    RoosterRow[]            — per medewerker
      MedewerkerLabel       — naam + contract-uren badge
      TimeSlotCell[]        — droppable zones (30-min slots)
        AfspraakBlock       — draggable afspraakblok (spans meerdere cells)
    CaoWarningBanner       — sticky onderaan bij overtredingen
  InlineAfspraakForm      — popover bij click op lege slot
```

### Library setup

```bash
pnpm --filter @openzorg/web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### DndContext configuration

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
  modifiers={[restrictToWindowEdges]}
>
  {/* Grid content */}
</DndContext>
```

Sensors: `useSensor(PointerSensor, { activationConstraint: { distance: 8 } })` om accidentele drags te voorkomen. Keyboard sensor voor accessibility.

## Feature 2: Grid Layout

### Structuur

- **Y-as (rijen):** Medewerkers uit `GET /api/medewerkers?_count=50&_sort=name`, gefilterd op `active !== false`
- **X-as (kolommen):** 32 kolommen van 06:00 tot 22:00 (elke 30 min)
- **Cel-breedte:** `min-w-[60px]` per 30-min slot, horizontaal scrollbaar
- **Sticky kolom:** Medewerker-naam kolom is `sticky left-0` met z-index

### Afspraakblokken

Afspraken worden gerenderd als absoluut-gepositioneerde blokken die meerdere cellen overspannen:

```
left = (startMinuut - 360) / 30 * celBreedte    // 360 = 06:00
width = duurMinuten / 30 * celBreedte
```

Kleurcodering per type:
- **Persoonlijke verzorging:** `bg-brand-100 border-brand-300`
- **Verpleging:** `bg-navy-50 border-navy-300`
- **Begeleiding:** `bg-yellow-100 border-yellow-300`
- **Huishoudelijke hulp:** `bg-surface-200 border-surface-400`
- **Overig:** `bg-raised border-default`

### Weekend-markering

Zaterdag en zondag kolommen krijgen `bg-sunken/30` achtergrond.

### Responsiviteit

Het grid is primair voor desktop (1280px+). Op kleinere schermen: horizontaal scrollbaar met fixed medewerker-kolom. Geen mobiele drag-and-drop (te complex; mobiel toont read-only lijstweergave).

## Feature 3: Drag Behavior

### Drag start
- AfspraakBlock wordt visueel opgetild (schaal 1.02, schaduw)
- Originele positie toont ghost (opacity 0.3)
- Alle geldige drop-zones highlighten subtiel

### Drag over
- Huidige drop-zone toont preview-outline
- CAO-check draait real-time: als drop zou resulteren in overtreding, toont drop-zone rode rand

### Drag end — `handleDragEnd(event)`

```typescript
async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over) return;

  // Parse drop target: "slot:practitionerId:dateISO:timeHHMM"
  const [_, newPracId, newDate, newTime] = over.id.toString().split(":");
  const afspraakId = active.id;

  // Bereken nieuwe start/end
  const newStart = `${newDate}T${newTime}:00`;
  const duration = originalDuration(afspraakId);  // bewaar originele duur
  const newEnd = addMinutes(newStart, duration);

  // Optimistic update
  updateLocalState(afspraakId, newPracId, newStart, newEnd);

  // PUT naar backend
  const res = await planningFetch(`/api/afspraken/${afspraakId}`, {
    method: "PUT",
    body: JSON.stringify({
      start: newStart,
      end: newEnd,
      participantPractitionerId: newPracId,
    }),
  });

  if (res.error) {
    // Rollback optimistic update
    revertLocalState(afspraakId);
    toast.error("Afspraak verplaatsen mislukt");
  } else {
    // Run CAO check
    runCaoCheck(newPracId, newDate);
  }
}
```

## Feature 4: Click-to-Create (Inline Afspraak)

### Trigger
Klik op lege cel opent een popover `InlineAfspraakForm` gepositioneerd bij de cel.

### Mini-formulier velden

| Veld | Type | Bron |
|---|---|---|
| Client | Combobox/zoek | `GET /api/clients?name=<query>` |
| Type | Select | Persoonlijke verzorging, Verpleging, Begeleiding, Huishoudelijk, Overig |
| Duur | Select | 15, 30, 45, 60, 90, 120 minuten |
| Opmerking | Textarea (optioneel) | Vrij tekst |

Starttijd en medewerker zijn al bepaald door de aangeklikte cel.

### Submit flow

```
POST /api/afspraken
{
  start: "2026-04-17T09:00:00",
  end: "2026-04-17T09:30:00",
  description: "Persoonlijke verzorging",
  participants: [
    { reference: "Practitioner/{pracId}" },
    { reference: "Patient/{clientId}" }
  ],
  status: "booked"
}
```

Na succes: grid herlaadt betreffende rij, CAO-check draait.

## Feature 5: CAO-engine

### Regelset

De engine checkt na elke wijziging (drag, create, delete) de volgende ATW/CAO-regels:

| Regel | Code | Grens | Bron |
|---|---|---|---|
| Max weekuren | `ATW_MAX_WEEK` | 48 uur per 7 dagen | Arbeidstijdenwet art. 5:7 |
| Min rusttijd | `ATW_MIN_RUST` | 11 uur tussen diensten | Arbeidstijdenwet art. 5:3 |
| Max dienstduur | `ATW_MAX_DIENST` | 10 uur per dienst | CAO VVT art. 5.2 |
| Contract-overschrijding | `CAO_CONTRACT` | >110% van contracturen | CAO VVT / intern beleid |

### Implementatie

```typescript
// apps/web/src/lib/cao-engine.ts

interface CaoViolation {
  regel: string;
  code: string;
  ernst: "waarschuwing" | "overtreding";
  medewerker: string;
  medewerkerId: string;
  details: string;
  waarde: number;
  grens: number;
}

function checkCaoRegels(
  medewerkerId: string,
  medewerkerNaam: string,
  afspraken: FhirAppointment[],
  contractUren: number,
): CaoViolation[] {
  const violations: CaoViolation[] = [];

  // 1. Totaal weekuren
  const totaalMinuten = sumDurations(afspraken);
  const totaalUren = totaalMinuten / 60;
  if (totaalUren > 48) {
    violations.push({
      regel: "Maximaal 48 uur per week",
      code: "ATW_MAX_WEEK",
      ernst: "overtreding",
      medewerker: medewerkerNaam,
      medewerkerId,
      details: `${totaalUren.toFixed(1)} uur gepland (max 48)`,
      waarde: totaalUren,
      grens: 48,
    });
  }

  // 2. Rusttijd tussen diensten
  const diensten = groupByDay(afspraken);  // geeft per dag { start, end }
  // Check opeenvolgende dagen
  for (let i = 0; i < diensten.length - 1; i++) {
    const endPrev = diensten[i].lastEnd;
    const startNext = diensten[i + 1].firstStart;
    const rustUren = diffHours(endPrev, startNext);
    if (rustUren < 11) {
      violations.push({
        regel: "Minimaal 11 uur rust tussen diensten",
        code: "ATW_MIN_RUST",
        ernst: "overtreding",
        medewerker: medewerkerNaam,
        medewerkerId,
        details: `${rustUren.toFixed(1)} uur rust (min 11)`,
        waarde: rustUren,
        grens: 11,
      });
    }
  }

  // 3. Max dienstduur per dag
  for (const dag of diensten) {
    const duurUren = diffHours(dag.firstStart, dag.lastEnd);
    if (duurUren > 10) {
      violations.push({
        regel: "Maximaal 10 uur per dienst",
        code: "ATW_MAX_DIENST",
        ernst: "overtreding",
        medewerker: medewerkerNaam,
        medewerkerId,
        details: `${duurUren.toFixed(1)} uur dienst op ${dag.datum} (max 10)`,
        waarde: duurUren,
        grens: 10,
      });
    }
  }

  // 4. Contract-overschrijding
  if (contractUren > 0 && totaalUren > contractUren * 1.1) {
    violations.push({
      regel: "Contract-uren overschreden (>110%)",
      code: "CAO_CONTRACT",
      ernst: "waarschuwing",
      medewerker: medewerkerNaam,
      medewerkerId,
      details: `${totaalUren.toFixed(1)}/${contractUren} uur (${((totaalUren / contractUren) * 100).toFixed(0)}%)`,
      waarde: totaalUren,
      grens: contractUren * 1.1,
    });
  }

  return violations;
}
```

De engine draait client-side voor snelle feedback. Geen server-side blocking — de backend staat alle wijzigingen toe.

## Feature 6: CaoWarning Banner

### Gedrag
- Sticky aan de onderkant van het grid
- Verschijnt alleen bij actieve overtredingen
- Toont alle overtredingen gegroepeerd per medewerker
- Override-knop per overtreding (of "Alles bevestigen")

### UI structuur

```
[!] CAO-waarschuwing: 2 overtredingen gevonden
  - Jan de Vries: 52.5 uur gepland (max 48 uur/week)      [Bevestig met reden]
  - Maria Jansen: 8.5 uur rust wo→do (min 11 uur)         [Bevestig met reden]

[Alles bevestigen]
```

### Override flow

1. Planner klikt "Bevestig met reden"
2. Textarea popover: "Reden voor afwijking van CAO-norm:"
3. Planner vult reden in (verplicht, min 10 tekens)
4. Submit: reden wordt gelogd via `POST /api/audit` (of bestaande audit-middleware)

```typescript
interface CaoOverride {
  code: string;           // ATW_MAX_WEEK
  medewerkerId: string;
  waarde: number;         // 52.5
  grens: number;          // 48
  reden: string;          // "Spoedvervanger ivm ziekte collega"
  bevestigdDoor: string;  // user ID van planner
  timestamp: string;
}
```

### Styling
- Achtergrond: `bg-yellow-50 dark:bg-yellow-950/20`
- Border: `border-yellow-300 dark:border-yellow-700`
- Icoon: waarschuwingsdriehoek (geel)
- Bij `ernst: "overtreding"`: `bg-coral-50 border-coral-300` (rood accent)

## Feature 7: Contract-uren weergave

### MedewerkerLabel (in grid rij-header)

```
Jan de Vries
32/36 uur  [===████████░░] 89%
```

- Balk vult proportioneel op basis van gepland/contract
- Kleuren:
  - 0-90%: `bg-brand-500` (teal, normaal)
  - 90-100%: `bg-yellow-500` (bijna vol)
  - 100-110%: `bg-coral-400` (overschreden)
  - >110%: `bg-coral-600` (ernstig overschreden)
- Tooltip: "32.0 van 36.0 uur gepland deze week (88.9%)"

### Data-ophaal

Contract-uren komen uit een nieuw endpoint (zie Feature 8). Bij ontbreken: default 36 uur, grijze badge "contract onbekend".

## Feature 8: Backend — Contract Endpoint

### Nieuw endpoint

`GET /api/medewerkers/:id/contract`

Response:
```json
{
  "medewerkerId": "abc-123",
  "urenPerWeek": 36,
  "fte": 1.0,
  "contractType": "vast",
  "ingangsdatum": "2025-01-01",
  "einddatum": null
}
```

### FHIR mapping

Contract-informatie wordt opgeslagen als FHIR `PractitionerRole` extensie:

```json
{
  "resourceType": "PractitionerRole",
  "practitioner": { "reference": "Practitioner/abc-123" },
  "extension": [
    {
      "url": "https://openzorg.nl/extensions/contract-uren",
      "valueDecimal": 36
    },
    {
      "url": "https://openzorg.nl/extensions/contract-fte",
      "valueDecimal": 1.0
    },
    {
      "url": "https://openzorg.nl/extensions/contract-type",
      "valueString": "vast"
    }
  ]
}
```

### Route implementatie

Bestand: `services/planning/src/routes/contract.ts`

```typescript
const contract = new Hono<AppEnv>();

// GET /api/medewerkers/:id/contract
contract.get("/medewerkers/:id/contract", async (c) => {
  // Zoek PractitionerRole voor deze Practitioner
  const pracId = c.req.param("id");
  const res = await medplumFetch(c, `/fhir/R4/PractitionerRole?practitioner=Practitioner/${pracId}&_count=1`);
  const bundle = await res.json();
  const role = bundle.entry?.[0]?.resource;

  if (!role) {
    return c.json({ medewerkerId: pracId, urenPerWeek: 36, fte: 1.0, contractType: "onbekend" });
  }

  const urenExt = role.extension?.find(e => e.url === "https://openzorg.nl/extensions/contract-uren");
  const fteExt = role.extension?.find(e => e.url === "https://openzorg.nl/extensions/contract-fte");
  const typeExt = role.extension?.find(e => e.url === "https://openzorg.nl/extensions/contract-type");

  return c.json({
    medewerkerId: pracId,
    urenPerWeek: urenExt?.valueDecimal ?? 36,
    fte: fteExt?.valueDecimal ?? 1.0,
    contractType: typeExt?.valueString ?? "onbekend",
  });
});
```

Mount in `services/planning/src/app.ts`.

### Batch endpoint (optioneel, performance)

`GET /api/medewerkers/contracts?ids=abc,def,ghi` — haalt contract voor meerdere medewerkers in een keer op om N+1 queries te voorkomen bij het laden van het grid.

## Feature 9: Test Data

### Seed script: `infra/scripts/seed-planning.sh`

Maakt testdata aan die CAO-scenario's triggert:

| Medewerker | Contract | Geplande uren | CAO-scenario |
|---|---|---|---|
| Jan de Vries | 36u | 38u | Normaal, licht boven contract |
| Maria Jansen | 32u | 50u | ATW_MAX_WEEK overtreding |
| Pieter Bakker | 24u | 24u | Exact op contract |
| Sanne de Groot | 36u | 36u | 8u rust wo-do: ATW_MIN_RUST overtreding |
| Ahmed El Amrani | 28u | 12u dienst dinsdag | ATW_MAX_DIENST overtreding |
| Lisa Vermeer | 36u | 16u | Onderbezet |

Afspraken verspreid over ma-zo, mix van types. Minimaal 30 afspraken totaal.

## Files to Create/Modify

### Nieuw

| Bestand | Beschrijving |
|---|---|
| `apps/web/src/components/planning/RoosterGrid.tsx` | Hoofdgrid met DndContext, rijen, kolommen |
| `apps/web/src/components/planning/RoosterRow.tsx` | Enkele medewerker-rij met droppable cellen |
| `apps/web/src/components/planning/AfspraakBlock.tsx` | Draggable afspraakblok |
| `apps/web/src/components/planning/InlineAfspraakForm.tsx` | Click-to-create popover formulier |
| `apps/web/src/components/planning/CaoWarning.tsx` | Sticky waarschuwingsbanner met override |
| `apps/web/src/components/planning/MedewerkerLabel.tsx` | Naam + contract-uren balk |
| `apps/web/src/components/planning/RoosterToolbar.tsx` | Weeknavigatie, filters |
| `apps/web/src/lib/cao-engine.ts` | Client-side CAO-regelcheck |
| `services/planning/src/routes/contract.ts` | Contract-uren endpoint |
| `infra/scripts/seed-planning.sh` | Testdata met CAO-scenario's |

### Wijzigen

| Bestand | Wijziging |
|---|---|
| `apps/web/src/app/planning/rooster/page.tsx` | Vervangen door grid-versie; huidige tabel wordt fallback |
| `services/planning/src/app.ts` | Mount contract routes |
| `apps/web/package.json` | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` toevoegen |

## Risks

| Risico | Impact | Mitigatie |
|---|---|---|
| Performance bij veel medewerkers (>20) | Grid wordt traag met 20+ rijen x 32 kolommen | Virtualisatie met `react-window` of paginering; lazy-load rijen buiten viewport |
| `@dnd-kit` breaking changes | Build breekt bij major update | Pin versie in package.json; `@dnd-kit` is stabiel (v6+) |
| Optimistic updates out of sync | UI toont andere state dan backend | Rollback bij fout + periodieke refresh (elke 60s) |
| CAO-regels zijn complex (nachtdienst, onregelmatig) | Huidige engine dekt niet alles | Start met 4 basisregels; uitbreiden op basis van feedback. Documenteer welke regels WEL en NIET gecheckt worden |
| Contract-uren niet ingevuld | Alle medewerkers tonen "36u" default | Visuele indicator "contract onbekend"; beheerder kan invullen via medewerker-beheerpagina |
| Concurrent edits door meerdere planners | Conflicten bij gelijktijdig plannen | Optimistic concurrency: ETag/If-Match op PUT. Fase 2: real-time sync via WebSocket |
