# Rooster Drag-and-Drop Grid + CAO-uren — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static rooster table with an interactive drag-and-drop week grid featuring visual time slots, click-to-create appointments, client-side CAO/ATW compliance warnings with override logging, and per-medewerker contract-uren progress bars.

**Architecture:** Frontend uses `@dnd-kit/core` + `@dnd-kit/sortable` inside a `DndContext` wrapping a time-grid (medewerkers on Y-axis, 30-min slots 06:00-22:00 on X-axis). Drag-end fires `PUT /api/afspraken/:id` via `planningFetch()`. A new `GET /api/medewerkers/:id/contract` endpoint reads contract-uren from FHIR `PractitionerRole` extensions. CAO engine runs client-side for instant feedback; overrides are logged via audit middleware.

**Tech Stack:** Next.js 15, React 19, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`, Hono (planning service), FHIR R4 via Medplum, Tailwind with OKLCH design tokens.

**Spec reference:** `docs/superpowers/specs/2026-04-17-rooster-grid-cao-design.md`

---

## File Structure

### To create (new)

```
apps/web/src/lib/cao-engine.ts                           — Client-side CAO/ATW rule checker
apps/web/src/components/planning/RoosterGrid.tsx          — Main grid with DndContext
apps/web/src/components/planning/RoosterRow.tsx           — Single medewerker row with droppable cells
apps/web/src/components/planning/AfspraakBlock.tsx        — Draggable appointment block
apps/web/src/components/planning/InlineAfspraakForm.tsx   — Click-to-create popover form
apps/web/src/components/planning/CaoWarning.tsx           — Sticky CAO warning banner
apps/web/src/components/planning/MedewerkerLabel.tsx      — Name + contract-uren progress bar
apps/web/src/components/planning/RoosterToolbar.tsx       — Week navigation, today button
services/planning/src/routes/contract.ts                  — Contract-uren endpoint
```

### To modify (existing)

```
apps/web/package.json                                     — Add @dnd-kit dependencies
apps/web/src/app/planning/rooster/page.tsx                — Replace with grid-based version
services/planning/src/app.ts                              — Mount contract routes
```

---

## Task 1: Install @dnd-kit dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1.1: Install @dnd-kit packages**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm --filter @openzorg/web add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 1.2: Verify installation**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
node -e "require.resolve('@dnd-kit/core')"
```

- [ ] **Step 1.3: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(rooster): install @dnd-kit/core, sortable, utilities"
```

---

## Task 2: CAO engine (client-side rule checker)

**Files:**
- Create: `apps/web/src/lib/cao-engine.ts`

- [ ] **Step 2.1: Create cao-engine.ts**

Create `apps/web/src/lib/cao-engine.ts`:

```typescript
/**
 * Client-side CAO/ATW compliance engine.
 * Checks appointment schedules against Dutch labor law (Arbeidstijdenwet)
 * and CAO VVT rules. Returns violations as warnings — never blocks.
 */

export interface FhirAppointment {
  id?: string;
  status?: string;
  start?: string;
  end?: string;
  description?: string;
  participant?: Array<{
    actor?: { reference?: string; display?: string };
    status?: string;
  }>;
}

export interface CaoViolation {
  regel: string;
  code: "ATW_MAX_WEEK" | "ATW_MIN_RUST" | "ATW_MAX_DIENST" | "CAO_CONTRACT";
  ernst: "waarschuwing" | "overtreding";
  medewerker: string;
  medewerkerId: string;
  details: string;
  waarde: number;
  grens: number;
}

export interface CaoOverride {
  code: string;
  medewerkerId: string;
  waarde: number;
  grens: number;
  reden: string;
  bevestigdDoor: string;
  timestamp: string;
}

interface DagSamenvatting {
  datum: string;
  firstStart: Date;
  lastEnd: Date;
}

function parseDateSafe(iso: string): Date {
  return new Date(iso);
}

function diffHours(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function sumDurationMinutes(afspraken: FhirAppointment[]): number {
  let total = 0;
  for (const a of afspraken) {
    if (!a.start || !a.end) continue;
    if (a.status === "cancelled") continue;
    const start = parseDateSafe(a.start);
    const end = parseDateSafe(a.end);
    total += (end.getTime() - start.getTime()) / (1000 * 60);
  }
  return total;
}

function groupByDay(afspraken: FhirAppointment[]): DagSamenvatting[] {
  const dagMap = new Map<string, { starts: Date[]; ends: Date[] }>();

  for (const a of afspraken) {
    if (!a.start || !a.end) continue;
    if (a.status === "cancelled") continue;
    const datum = a.start.slice(0, 10);
    const start = parseDateSafe(a.start);
    const end = parseDateSafe(a.end);

    if (!dagMap.has(datum)) {
      dagMap.set(datum, { starts: [], ends: [] });
    }
    const dag = dagMap.get(datum)!;
    dag.starts.push(start);
    dag.ends.push(end);
  }

  const result: DagSamenvatting[] = [];
  for (const [datum, dag] of dagMap.entries()) {
    const firstStart = new Date(Math.min(...dag.starts.map((d) => d.getTime())));
    const lastEnd = new Date(Math.max(...dag.ends.map((d) => d.getTime())));
    result.push({ datum, firstStart, lastEnd });
  }

  result.sort((a, b) => a.datum.localeCompare(b.datum));
  return result;
}

export function checkCaoRegels(
  medewerkerId: string,
  medewerkerNaam: string,
  afspraken: FhirAppointment[],
  contractUren: number,
): CaoViolation[] {
  const active = afspraken.filter((a) => a.status !== "cancelled");
  const violations: CaoViolation[] = [];

  // 1. Totaal weekuren (ATW art. 5:7 — max 48 uur per 7 dagen)
  const totaalMinuten = sumDurationMinutes(active);
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

  // 2. Rusttijd tussen diensten (ATW art. 5:3 — min 11 uur)
  const diensten = groupByDay(active);
  for (let i = 0; i < diensten.length - 1; i++) {
    const endPrev = diensten[i]!.lastEnd;
    const startNext = diensten[i + 1]!.firstStart;
    const rustUren = diffHours(endPrev, startNext);
    if (rustUren < 11) {
      violations.push({
        regel: "Minimaal 11 uur rust tussen diensten",
        code: "ATW_MIN_RUST",
        ernst: "overtreding",
        medewerker: medewerkerNaam,
        medewerkerId,
        details: `${rustUren.toFixed(1)} uur rust ${diensten[i]!.datum} → ${diensten[i + 1]!.datum} (min 11)`,
        waarde: rustUren,
        grens: 11,
      });
    }
  }

  // 3. Max dienstduur per dag (CAO VVT art. 5.2 — max 10 uur)
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

  // 4. Contract-overschrijding (>110% van contracturen)
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

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm --filter @openzorg/web exec tsc --noEmit --strict apps/web/src/lib/cao-engine.ts 2>&1 || echo "Will verify in full typecheck later"
```

- [ ] **Step 2.3: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/lib/cao-engine.ts
git commit -m "feat(rooster): CAO/ATW compliance engine with 4 rule checks"
```

---

## Task 3: Contract-uren backend endpoint

**Files:**
- Create: `services/planning/src/routes/contract.ts`
- Modify: `services/planning/src/app.ts`

- [ ] **Step 3.1: Create contract route**

Create `services/planning/src/routes/contract.ts`:

```typescript
import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumFetch } from "../lib/medplum-client.js";

export const contractRoutes = new Hono<AppEnv>();

interface ContractResponse {
  medewerkerId: string;
  urenPerWeek: number;
  fte: number;
  contractType: string;
  ingangsdatum: string | null;
  einddatum: string | null;
}

interface FhirExtension {
  url: string;
  valueDecimal?: number;
  valueString?: string;
  valueDate?: string;
}

interface FhirPractitionerRole {
  resourceType: "PractitionerRole";
  extension?: FhirExtension[];
  period?: { start?: string; end?: string };
}

interface FhirBundle {
  entry?: Array<{ resource: FhirPractitionerRole }>;
}

const EXT_BASE = "https://openzorg.nl/extensions";

function extractContract(pracId: string, role: FhirPractitionerRole | undefined): ContractResponse {
  if (!role) {
    return {
      medewerkerId: pracId,
      urenPerWeek: 36,
      fte: 1.0,
      contractType: "onbekend",
      ingangsdatum: null,
      einddatum: null,
    };
  }

  const extensions = role.extension ?? [];
  const urenExt = extensions.find((e) => e.url === `${EXT_BASE}/contract-uren`);
  const fteExt = extensions.find((e) => e.url === `${EXT_BASE}/contract-fte`);
  const typeExt = extensions.find((e) => e.url === `${EXT_BASE}/contract-type`);

  return {
    medewerkerId: pracId,
    urenPerWeek: urenExt?.valueDecimal ?? 36,
    fte: fteExt?.valueDecimal ?? 1.0,
    contractType: typeExt?.valueString ?? "onbekend",
    ingangsdatum: role.period?.start ?? null,
    einddatum: role.period?.end ?? null,
  };
}

/**
 * GET /:id/contract — Get contract info for a single medewerker.
 * Falls back to 36 uur / 1.0 FTE if no PractitionerRole found.
 */
contractRoutes.get("/:id/contract", async (c) => {
  const pracId = c.req.param("id");

  const res = await medplumFetch(
    c,
    `/fhir/R4/PractitionerRole?practitioner=Practitioner/${pracId}&_count=1`,
  );

  if (!res.ok) {
    return c.json(extractContract(pracId, undefined));
  }

  const bundle = (await res.json()) as FhirBundle;
  const role = bundle.entry?.[0]?.resource;

  return c.json(extractContract(pracId, role));
});

/**
 * GET /contracts — Batch endpoint: get contracts for multiple medewerkers.
 * Query: ?ids=abc,def,ghi
 */
contractRoutes.get("/contracts", async (c) => {
  const idsParam = c.req.query("ids") ?? "";
  const ids = idsParam.split(",").filter(Boolean);

  if (ids.length === 0) {
    return c.json({ contracts: [] });
  }

  // Fetch all PractitionerRoles in one query using _id search
  const practitionerParams = ids
    .map((id) => `Practitioner/${id}`)
    .join(",");

  const res = await medplumFetch(
    c,
    `/fhir/R4/PractitionerRole?practitioner=${encodeURIComponent(practitionerParams)}&_count=100`,
  );

  const roleMap = new Map<string, FhirPractitionerRole>();

  if (res.ok) {
    const bundle = (await res.json()) as FhirBundle;
    for (const entry of bundle.entry ?? []) {
      const role = entry.resource;
      // Extract practitioner ID from reference
      const pracRef = (role as Record<string, unknown>)["practitioner"] as { reference?: string } | undefined;
      const pracId = pracRef?.reference?.replace("Practitioner/", "");
      if (pracId) {
        roleMap.set(pracId, role);
      }
    }
  }

  const contracts = ids.map((id) => extractContract(id, roleMap.get(id)));
  return c.json({ contracts });
});
```

- [ ] **Step 3.2: Mount contract routes in app.ts**

In `services/planning/src/app.ts`, add the import and route mount.

Add import after the existing imports:

```typescript
import { contractRoutes } from "./routes/contract.js";
```

Add route mount after the wachtlijst line:

```typescript
// PLN-06: Contract-uren (Medewerker contract info)
app.route("/api/medewerkers", contractRoutes);
```

- [ ] **Step 3.3: Verify TypeScript compiles**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm --filter @openzorg/service-planning exec tsc --noEmit
```

- [ ] **Step 3.4: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add services/planning/src/routes/contract.ts services/planning/src/app.ts
git commit -m "feat(planning): contract-uren endpoint via PractitionerRole extensions"
```

---

## Task 4: MedewerkerLabel component

**Files:**
- Create: `apps/web/src/components/planning/MedewerkerLabel.tsx`

- [ ] **Step 4.1: Create MedewerkerLabel.tsx**

Create `apps/web/src/components/planning/MedewerkerLabel.tsx`:

```tsx
"use client";

interface MedewerkerLabelProps {
  naam: string;
  geplandUren: number;
  contractUren: number;
  contractOnbekend: boolean;
}

export function MedewerkerLabel({
  naam,
  geplandUren,
  contractUren,
  contractOnbekend,
}: MedewerkerLabelProps) {
  const percentage = contractUren > 0 ? (geplandUren / contractUren) * 100 : 0;
  const clampedWidth = Math.min(percentage, 100);

  let barColor = "bg-brand-500";
  if (percentage > 110) {
    barColor = "bg-coral-600";
  } else if (percentage > 100) {
    barColor = "bg-coral-400";
  } else if (percentage > 90) {
    barColor = "bg-yellow-500";
  }

  return (
    <div className="flex flex-col gap-1 min-w-[160px] py-1">
      <span className="text-sm font-medium text-fg truncate">{naam}</span>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 flex-1 rounded-full bg-sunken overflow-hidden max-w-[100px]"
          title={
            contractOnbekend
              ? `${geplandUren.toFixed(1)} uur gepland (contract onbekend)`
              : `${geplandUren.toFixed(1)} van ${contractUren.toFixed(1)} uur gepland deze week (${percentage.toFixed(0)}%)`
          }
        >
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${clampedWidth}%` }}
          />
        </div>
        <span className="text-[11px] text-fg-muted whitespace-nowrap">
          {geplandUren.toFixed(0)}/{contractOnbekend ? "?" : contractUren.toFixed(0)}u
        </span>
      </div>
      {contractOnbekend && (
        <span className="text-[10px] text-fg-subtle italic">contract onbekend</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/components/planning/MedewerkerLabel.tsx
git commit -m "feat(rooster): MedewerkerLabel with contract-uren progress bar"
```

---

## Task 5: AfspraakBlock (draggable)

**Files:**
- Create: `apps/web/src/components/planning/AfspraakBlock.tsx`

- [ ] **Step 5.1: Create AfspraakBlock.tsx**

Create `apps/web/src/components/planning/AfspraakBlock.tsx`:

```tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import type { FhirAppointment } from "../../lib/cao-engine";

const TYPE_COLORS: Record<string, string> = {
  "Persoonlijke verzorging": "bg-brand-100 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700 text-brand-800 dark:text-brand-200",
  "Verpleging": "bg-navy-50 dark:bg-navy-900/30 border-navy-300 dark:border-navy-700 text-navy-800 dark:text-navy-200",
  "Begeleiding": "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200",
  "Huishoudelijke hulp": "bg-surface-200 dark:bg-surface-800 border-surface-400 dark:border-surface-600 text-fg",
};

const DEFAULT_COLOR = "bg-raised border-default text-fg";

function formatTijd(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getClientName(appt: FhirAppointment): string {
  const patient = appt.participant?.find((p) =>
    p.actor?.reference?.startsWith("Patient/"),
  );
  return patient?.actor?.display ?? "";
}

interface AfspraakBlockProps {
  afspraak: FhirAppointment;
  celBreedte: number;
  gridStartMinuut: number; // 360 = 06:00
}

export function AfspraakBlock({
  afspraak,
  celBreedte,
  gridStartMinuut,
}: AfspraakBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: afspraak.id ?? "",
      data: { afspraak },
    });

  if (!afspraak.start || !afspraak.end) return null;

  const start = new Date(afspraak.start);
  const end = new Date(afspraak.end);
  const startMinuut = start.getHours() * 60 + start.getMinutes();
  const duurMinuten = (end.getTime() - start.getTime()) / (1000 * 60);

  const left = ((startMinuut - gridStartMinuut) / 30) * celBreedte;
  const width = (duurMinuten / 30) * celBreedte;

  const beschrijving = afspraak.description ?? "Afspraak";
  const colorClass = TYPE_COLORS[beschrijving] ?? DEFAULT_COLOR;
  const clientNaam = getClientName(afspraak);

  const style = {
    transform: CSS.Translate.toString(transform),
    left: `${left}px`,
    width: `${Math.max(width - 2, celBreedte - 2)}px`,
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute top-0.5 bottom-0.5 rounded-md border px-1.5 py-0.5 text-[11px] cursor-grab overflow-hidden z-10
        ${colorClass}
        ${isDragging ? "opacity-50 scale-[1.02] shadow-lg z-50" : "hover:shadow-sm"}
        transition-shadow`}
      style={style}
      title={`${beschrijving}${clientNaam ? ` — ${clientNaam}` : ""}\n${formatTijd(afspraak.start)}–${formatTijd(afspraak.end)}`}
    >
      <span className="font-medium block truncate leading-tight">
        {formatTijd(afspraak.start)}–{formatTijd(afspraak.end)}
      </span>
      <span className="block truncate leading-tight opacity-80">
        {clientNaam || beschrijving}
      </span>
    </div>
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/components/planning/AfspraakBlock.tsx
git commit -m "feat(rooster): draggable AfspraakBlock component"
```

---

## Task 6: RoosterRow (droppable row)

**Files:**
- Create: `apps/web/src/components/planning/RoosterRow.tsx`

- [ ] **Step 6.1: Create RoosterRow.tsx**

Create `apps/web/src/components/planning/RoosterRow.tsx`:

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";

import type { FhirAppointment } from "../../lib/cao-engine";
import { AfspraakBlock } from "./AfspraakBlock";
import { MedewerkerLabel } from "./MedewerkerLabel";

interface TimeSlotCellProps {
  slotId: string;
  isWeekend: boolean;
  onClick: () => void;
}

function TimeSlotCell({ slotId, isWeekend, onClick }: TimeSlotCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`h-full border-r border-subtle cursor-pointer transition-colors
        ${isWeekend ? "bg-sunken/30" : ""}
        ${isOver ? "bg-brand-100/50 dark:bg-brand-900/20 ring-1 ring-brand-300" : "hover:bg-sunken/50"}`}
      style={{ minWidth: "60px", width: "60px" }}
    />
  );
}

export interface RoosterRowProps {
  practitionerId: string;
  naam: string;
  geplandUren: number;
  contractUren: number;
  contractOnbekend: boolean;
  afspraken: FhirAppointment[];
  weekDays: Date[];
  onSlotClick: (practitionerId: string, date: string, time: string) => void;
  celBreedte: number;
}

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function timeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h < 22; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const GRID_START_MINUUT = 360; // 06:00 = 6 * 60
const TIME_SLOTS = timeSlots();

export function RoosterRow({
  practitionerId,
  naam,
  geplandUren,
  contractUren,
  contractOnbekend,
  afspraken,
  weekDays,
  onSlotClick,
  celBreedte,
}: RoosterRowProps) {
  return (
    <div className="flex border-b border-subtle last:border-0 hover:bg-sunken/20 transition-colors">
      {/* Sticky medewerker label */}
      <div className="sticky left-0 z-20 bg-raised border-r border-default px-3 py-2 flex items-center"
           style={{ minWidth: "180px", width: "180px" }}>
        <MedewerkerLabel
          naam={naam}
          geplandUren={geplandUren}
          contractUren={contractUren}
          contractOnbekend={contractOnbekend}
        />
      </div>

      {/* Day groups */}
      {weekDays.map((day) => {
        const dateStr = dateString(day);
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const dayAfspraken = afspraken.filter(
          (a) => a.start?.slice(0, 10) === dateStr,
        );

        return (
          <div
            key={dateStr}
            className="flex relative border-r border-default"
            style={{ minWidth: `${TIME_SLOTS.length * celBreedte}px` }}
          >
            {/* Time slot cells (droppable targets) */}
            {TIME_SLOTS.map((time) => {
              const slotId = `slot:${practitionerId}:${dateStr}:${time}`;
              return (
                <TimeSlotCell
                  key={slotId}
                  slotId={slotId}
                  isWeekend={isWeekend}
                  onClick={() => onSlotClick(practitionerId, dateStr, time)}
                />
              );
            })}

            {/* Appointment blocks (absolute positioned) */}
            {dayAfspraken.map((appt) => (
              <AfspraakBlock
                key={appt.id}
                afspraak={appt}
                celBreedte={celBreedte}
                gridStartMinuut={GRID_START_MINUUT}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/components/planning/RoosterRow.tsx
git commit -m "feat(rooster): RoosterRow with droppable time slot cells"
```

---

## Task 7: CaoWarning banner

**Files:**
- Create: `apps/web/src/components/planning/CaoWarning.tsx`

- [ ] **Step 7.1: Create CaoWarning.tsx**

Create `apps/web/src/components/planning/CaoWarning.tsx`:

```tsx
"use client";

import { useState } from "react";

import type { CaoViolation } from "../../lib/cao-engine";

interface CaoWarningProps {
  violations: CaoViolation[];
  overrides: Set<string>; // "code:medewerkerId" keys that have been overridden
  onOverride: (violation: CaoViolation, reden: string) => void;
  onOverrideAll: (reden: string) => void;
}

export function CaoWarning({
  violations,
  overrides,
  onOverride,
  onOverrideAll,
}: CaoWarningProps) {
  const [redenMap, setRedenMap] = useState<Record<string, string>>({});
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [bulkReden, setBulkReden] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const activeViolations = violations.filter(
    (v) => !overrides.has(`${v.code}:${v.medewerkerId}`),
  );

  if (activeViolations.length === 0) return null;

  const overtredingen = activeViolations.filter((v) => v.ernst === "overtreding");
  const waarschuwingen = activeViolations.filter((v) => v.ernst === "waarschuwing");

  function handleSubmitOverride(violation: CaoViolation) {
    const key = `${violation.code}:${violation.medewerkerId}`;
    const reden = redenMap[key] ?? "";
    if (reden.length < 10) return;
    onOverride(violation, reden);
    setOpenPopover(null);
  }

  function handleBulkOverride() {
    if (bulkReden.length < 10) return;
    onOverrideAll(bulkReden);
    setShowBulk(false);
    setBulkReden("");
  }

  const violationKey = (v: CaoViolation) => `${v.code}:${v.medewerkerId}`;

  return (
    <div className="sticky bottom-0 z-30 border-t-2 border-yellow-300 dark:border-yellow-700">
      <div className={`px-4 py-3 ${
        overtredingen.length > 0
          ? "bg-coral-50 dark:bg-coral-950/20 border-coral-300 dark:border-coral-700"
          : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700"
      }`}>
        <div className="flex items-start gap-3">
          {/* Warning icon */}
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>

          <div className="flex-1">
            <p className="text-sm font-semibold text-fg">
              CAO-waarschuwing: {activeViolations.length} {activeViolations.length === 1 ? "melding" : "meldingen"} gevonden
            </p>

            <ul className="mt-2 space-y-2">
              {[...overtredingen, ...waarschuwingen].map((v) => {
                const key = violationKey(v);
                const isOpen = openPopover === key;

                return (
                  <li key={key} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-fg-muted">
                      <span className="font-medium text-fg">{v.medewerker}:</span>{" "}
                      {v.details}
                      {v.ernst === "overtreding" && (
                        <span className="ml-1 text-[10px] font-semibold text-coral-600 dark:text-coral-400 uppercase">overtreding</span>
                      )}
                    </span>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenPopover(isOpen ? null : key)}
                        className="text-xs px-2 py-1 rounded-md bg-raised border border-default hover:bg-sunken transition-colors text-fg-muted"
                      >
                        Bevestig met reden
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 bottom-full mb-2 w-72 bg-raised border border-default rounded-xl shadow-lg p-3 z-50">
                          <p className="text-xs text-fg-muted mb-2">Reden voor afwijking van CAO-norm:</p>
                          <textarea
                            value={redenMap[key] ?? ""}
                            onChange={(e) => setRedenMap((m) => ({ ...m, [key]: e.target.value }))}
                            placeholder="Bijv. spoedvervanger ivm ziekte collega..."
                            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-2 text-fg resize-none h-16 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] text-fg-subtle">
                              {(redenMap[key] ?? "").length}/10 min. tekens
                            </span>
                            <button
                              onClick={() => handleSubmitOverride(v)}
                              disabled={(redenMap[key] ?? "").length < 10}
                              className="text-xs px-3 py-1 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Bevestigen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {activeViolations.length > 1 && (
              <div className="mt-3 relative">
                <button
                  onClick={() => setShowBulk(!showBulk)}
                  className="text-xs px-3 py-1.5 rounded-md bg-raised border border-default hover:bg-sunken transition-colors text-fg-muted"
                >
                  Alles bevestigen
                </button>

                {showBulk && (
                  <div className="absolute left-0 bottom-full mb-2 w-80 bg-raised border border-default rounded-xl shadow-lg p-3 z-50">
                    <p className="text-xs text-fg-muted mb-2">
                      Reden voor afwijking van alle {activeViolations.length} CAO-normen:
                    </p>
                    <textarea
                      value={bulkReden}
                      onChange={(e) => setBulkReden(e.target.value)}
                      placeholder="Bijv. noodplanning door meerdere ziekmeldingen..."
                      className="w-full text-sm rounded-lg border border-default bg-page px-3 py-2 text-fg resize-none h-16 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-fg-subtle">
                        {bulkReden.length}/10 min. tekens
                      </span>
                      <button
                        onClick={handleBulkOverride}
                        disabled={bulkReden.length < 10}
                        className="text-xs px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Alles bevestigen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/components/planning/CaoWarning.tsx
git commit -m "feat(rooster): CaoWarning sticky banner with override + reason logging"
```

---

## Task 8: InlineAfspraakForm (click-to-create)

**Files:**
- Create: `apps/web/src/components/planning/InlineAfspraakForm.tsx`

- [ ] **Step 8.1: Create InlineAfspraakForm.tsx**

Create `apps/web/src/components/planning/InlineAfspraakForm.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ecdFetch } from "../../lib/api";
import { planningFetch } from "../../lib/planning-api";

interface Patient {
  id: string;
  name?: Array<{ family?: string; given?: string[] }>;
}

interface PatientBundle {
  entry?: Array<{ resource: Patient }>;
}

interface InlineAfspraakFormProps {
  practitionerId: string;
  medewerkerNaam: string;
  datum: string;       // "2026-04-17"
  startTijd: string;   // "09:00"
  onClose: () => void;
  onCreated: () => void;
}

const DUUR_OPTIES = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 uur", value: 60 },
  { label: "1,5 uur", value: 90 },
  { label: "2 uur", value: 120 },
];

const TYPE_OPTIES = [
  "Persoonlijke verzorging",
  "Verpleging",
  "Begeleiding",
  "Huishoudelijke hulp",
  "Overig",
];

function addMinutesToTime(datum: string, tijd: string, minuten: number): string {
  const dt = new Date(`${datum}T${tijd}:00`);
  dt.setMinutes(dt.getMinutes() + minuten);
  return dt.toISOString();
}

function formatNaam(p: Patient): string {
  const name = p.name?.[0];
  if (!name) return "(onbekend)";
  const given = name.given?.join(" ") ?? "";
  return `${given} ${name.family ?? ""}`.trim() || "(onbekend)";
}

export function InlineAfspraakForm({
  practitionerId,
  medewerkerNaam,
  datum,
  startTijd,
  onClose,
  onCreated,
}: InlineAfspraakFormProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [clientId, setClientId] = useState("");
  const [clientZoek, setClientZoek] = useState("");
  const [clienten, setClienten] = useState<Patient[]>([]);
  const [showSuggesties, setShowSuggesties] = useState(false);
  const [type, setType] = useState(TYPE_OPTIES[0]!);
  const [duur, setDuur] = useState(30);
  const [opmerking, setOpmerking] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Search clients
  const zoekClienten = useCallback(async (query: string) => {
    if (query.length < 2) {
      setClienten([]);
      return;
    }
    const { data } = await ecdFetch<PatientBundle>(
      `/api/clients?name=${encodeURIComponent(query)}&_count=10`,
    );
    if (data?.entry) {
      setClienten(data.entry.map((e) => e.resource));
      setShowSuggesties(true);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => zoekClienten(clientZoek), 300);
    return () => clearTimeout(timeout);
  }, [clientZoek, zoekClienten]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Selecteer een client");
      return;
    }

    setSubmitting(true);
    setError(null);

    const start = `${datum}T${startTijd}:00`;
    const end = addMinutesToTime(datum, startTijd, duur);

    const body = {
      resourceType: "Appointment",
      status: "booked",
      start,
      end,
      description: type,
      comment: opmerking || undefined,
      participant: [
        {
          actor: { reference: `Practitioner/${practitionerId}` },
          status: "accepted",
        },
        {
          actor: { reference: `Patient/${clientId}` },
          status: "accepted",
        },
      ],
    };

    const { error: err } = await planningFetch("/api/afspraken", {
      method: "POST",
      body: JSON.stringify(body),
    });

    setSubmitting(false);

    if (err) {
      setError(err);
    } else {
      onCreated();
    }
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-raised border border-default rounded-xl shadow-lg p-4 w-80"
      style={{ top: "100%", left: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-fg">Nieuwe afspraak</h3>
        <button onClick={onClose} className="text-fg-subtle hover:text-fg">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-fg-muted mb-3">
        {medewerkerNaam} &middot; {datum} om {startTijd}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Client zoeken */}
        <div className="relative">
          <label className="text-xs font-medium text-fg-muted block mb-1">Client</label>
          <input
            type="text"
            value={clientZoek}
            onChange={(e) => {
              setClientZoek(e.target.value);
              setClientId("");
            }}
            placeholder="Zoek op naam..."
            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {showSuggesties && clienten.length > 0 && (
            <ul className="absolute top-full left-0 right-0 bg-raised border border-default rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto z-50">
              {clienten.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setClientId(c.id);
                      setClientZoek(formatNaam(c));
                      setShowSuggesties(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-sunken text-fg"
                  >
                    {formatNaam(c)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="text-xs font-medium text-fg-muted block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {TYPE_OPTIES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Duur */}
        <div>
          <label className="text-xs font-medium text-fg-muted block mb-1">Duur</label>
          <select
            value={duur}
            onChange={(e) => setDuur(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-1.5 text-fg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {DUUR_OPTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Opmerking */}
        <div>
          <label className="text-xs font-medium text-fg-muted block mb-1">Opmerking (optioneel)</label>
          <textarea
            value={opmerking}
            onChange={(e) => setOpmerking(e.target.value)}
            placeholder="Bijzonderheden..."
            className="w-full text-sm rounded-lg border border-default bg-page px-3 py-1.5 text-fg resize-none h-14 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {error && (
          <p className="text-xs text-coral-600 dark:text-coral-400">{error}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md border border-default bg-raised hover:bg-sunken text-fg-muted transition-colors"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={submitting || !clientId}
            className="text-xs px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Opslaan..." : "Afspraak aanmaken"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 8.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/components/planning/InlineAfspraakForm.tsx
git commit -m "feat(rooster): InlineAfspraakForm click-to-create popover"
```

---

## Task 9: RoosterToolbar

**Files:**
- Create: `apps/web/src/components/planning/RoosterToolbar.tsx`

- [ ] **Step 9.1: Create RoosterToolbar.tsx**

Create `apps/web/src/components/planning/RoosterToolbar.tsx`:

```tsx
"use client";

import Link from "next/link";

interface RoosterToolbarProps {
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  weekLabel: string;
}

export function RoosterToolbar({
  weekOffset: _weekOffset,
  onPrevWeek,
  onNextWeek,
  onToday,
  weekLabel,
}: RoosterToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/planning"
            className="text-sm text-brand-700 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300"
          >
            &larr; Planning
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-fg">Rooster</h1>
        <p className="text-sm text-fg-muted mt-1">
          {weekLabel}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onPrevWeek}
          className="p-2 rounded-lg hover:bg-sunken transition-colors text-fg-muted"
          aria-label="Vorige week"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-sunken transition-colors text-fg"
        >
          Vandaag
        </button>
        <button
          onClick={onNextWeek}
          className="p-2 rounded-lg hover:bg-sunken transition-colors text-fg-muted"
          aria-label="Volgende week"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 9.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/components/planning/RoosterToolbar.tsx
git commit -m "feat(rooster): RoosterToolbar with week navigation"
```

---

## Task 10: RoosterGrid (main grid with DndContext)

**Files:**
- Create: `apps/web/src/components/planning/RoosterGrid.tsx`

- [ ] **Step 10.1: Create RoosterGrid.tsx**

Create `apps/web/src/components/planning/RoosterGrid.tsx`:

```tsx
"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useCallback, useState } from "react";

import type { CaoOverride, CaoViolation, FhirAppointment } from "../../lib/cao-engine";
import { checkCaoRegels } from "../../lib/cao-engine";
import { planningFetch } from "../../lib/planning-api";
import { CaoWarning } from "./CaoWarning";
import { InlineAfspraakForm } from "./InlineAfspraakForm";
import { RoosterRow } from "./RoosterRow";

interface Practitioner {
  id: string;
  naam: string;
}

interface ContractInfo {
  medewerkerId: string;
  urenPerWeek: number;
  contractType: string;
}

interface RoosterGridProps {
  practitioners: Practitioner[];
  afsprakenMap: Record<string, FhirAppointment[]>; // keyed by practitionerId
  contractMap: Record<string, ContractInfo>;
  weekDays: Date[];
  onAfspraakMoved: () => void;
  onAfspraakCreated: () => void;
}

const CEL_BREEDTE = 60;

function timeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h < 22; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = timeSlots();

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDagKort(d: Date): string {
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

function sumDurationMinutes(afspraken: FhirAppointment[]): number {
  let total = 0;
  for (const a of afspraken) {
    if (!a.start || !a.end || a.status === "cancelled") continue;
    total += (new Date(a.end).getTime() - new Date(a.start).getTime()) / (1000 * 60);
  }
  return total;
}

function addMinutes(isoStart: string, minutes: number): string {
  const d = new Date(isoStart);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export function RoosterGrid({
  practitioners,
  afsprakenMap,
  contractMap,
  weekDays,
  onAfspraakMoved,
  onAfspraakCreated,
}: RoosterGridProps) {
  const [localAfspraken, setLocalAfspraken] = useState(afsprakenMap);
  const [violations, setViolations] = useState<CaoViolation[]>([]);
  const [overrides, setOverrides] = useState<Set<string>>(new Set());
  const [inlineForm, setInlineForm] = useState<{
    practitionerId: string;
    medewerkerNaam: string;
    datum: string;
    startTijd: string;
  } | null>(null);

  // Keep local state in sync when parent data changes
  if (afsprakenMap !== localAfspraken && Object.keys(afsprakenMap).length > 0) {
    setLocalAfspraken(afsprakenMap);
    runAllCaoChecks(afsprakenMap);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  function runAllCaoChecks(apMap: Record<string, FhirAppointment[]>) {
    const allViolations: CaoViolation[] = [];
    for (const prac of practitioners) {
      const appts = apMap[prac.id] ?? [];
      const contract = contractMap[prac.id];
      const uren = contract?.urenPerWeek ?? 36;
      const v = checkCaoRegels(prac.id, prac.naam, appts, uren);
      allViolations.push(...v);
    }
    setViolations(allViolations);
  }

  function findAfspraakById(id: string): { afspraak: FhirAppointment; pracId: string } | null {
    for (const [pracId, appts] of Object.entries(localAfspraken)) {
      const found = appts.find((a) => a.id === id);
      if (found) return { afspraak: found, pracId };
    }
    return null;
  }

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overIdStr = over.id.toString();
    if (!overIdStr.startsWith("slot:")) return;

    const parts = overIdStr.split(":");
    const newPracId = parts[1]!;
    const newDate = parts[2]!;
    const newTime = parts[3]!;

    const afspraakId = active.id.toString();
    const found = findAfspraakById(afspraakId);
    if (!found) return;

    const { afspraak, pracId: oldPracId } = found;
    if (!afspraak.start || !afspraak.end) return;

    const duurMs = new Date(afspraak.end).getTime() - new Date(afspraak.start).getTime();
    const duurMinuten = duurMs / (1000 * 60);
    const newStart = `${newDate}T${newTime}:00`;
    const newEnd = addMinutes(newStart, duurMinuten);

    // Optimistic update
    const prevState = { ...localAfspraken };
    const updated = { ...localAfspraken };

    // Remove from old practitioner
    updated[oldPracId] = (updated[oldPracId] ?? []).filter((a) => a.id !== afspraakId);

    // Add to new practitioner
    const movedAppt: FhirAppointment = {
      ...afspraak,
      start: newStart,
      end: newEnd,
      participant: afspraak.participant?.map((p) => {
        if (p.actor?.reference?.startsWith("Practitioner/")) {
          return { ...p, actor: { ...p.actor, reference: `Practitioner/${newPracId}` } };
        }
        return p;
      }),
    };
    updated[newPracId] = [...(updated[newPracId] ?? []), movedAppt];

    setLocalAfspraken(updated);
    runAllCaoChecks(updated);

    // PUT to backend — build full Appointment resource
    const body = {
      resourceType: "Appointment",
      id: afspraakId,
      status: afspraak.status ?? "booked",
      start: newStart,
      end: newEnd,
      description: afspraak.description,
      participant: movedAppt.participant,
    };

    const { error } = await planningFetch(`/api/afspraken/${afspraakId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (error) {
      // Rollback
      setLocalAfspraken(prevState);
      runAllCaoChecks(prevState);
    } else {
      onAfspraakMoved();
    }
  }, [localAfspraken, practitioners, contractMap, onAfspraakMoved]);

  function handleSlotClick(practitionerId: string, datum: string, time: string) {
    const prac = practitioners.find((p) => p.id === practitionerId);
    setInlineForm({
      practitionerId,
      medewerkerNaam: prac?.naam ?? "(onbekend)",
      datum,
      startTijd: time,
    });
  }

  function handleOverride(violation: CaoViolation, reden: string) {
    const key = `${violation.code}:${violation.medewerkerId}`;
    const override: CaoOverride = {
      code: violation.code,
      medewerkerId: violation.medewerkerId,
      waarde: violation.waarde,
      grens: violation.grens,
      reden,
      bevestigdDoor: "", // Filled by audit middleware
      timestamp: new Date().toISOString(),
    };

    // Log to audit via planning service
    planningFetch("/api/afspraken", {
      method: "POST",
      body: JSON.stringify({
        resourceType: "AuditEvent",
        type: { code: "cao-override" },
        entity: [{ detail: [{ type: "override", valueString: JSON.stringify(override) }] }],
      }),
    }).catch(() => {
      // Best effort audit log — don't block UI
    });

    setOverrides((prev) => new Set([...prev, key]));
  }

  function handleOverrideAll(reden: string) {
    const activeViolations = violations.filter(
      (v) => !overrides.has(`${v.code}:${v.medewerkerId}`),
    );
    for (const v of activeViolations) {
      handleOverride(v, reden);
    }
  }

  const isToday = (d: Date) => dateString(d) === dateString(new Date());

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToWindowEdges]}
    >
      <div className="bg-raised rounded-2xl border border-default overflow-hidden shadow-soft relative">
        <div className="overflow-x-auto">
          {/* Header row: day labels + time slot headers */}
          <div className="flex border-b border-default">
            {/* Spacer for medewerker column */}
            <div className="sticky left-0 z-20 bg-raised border-r border-default"
                 style={{ minWidth: "180px", width: "180px" }}>
              <div className="px-3 py-2 text-xs font-semibold text-fg-subtle uppercase tracking-wider">
                Medewerker
              </div>
            </div>

            {/* Day columns with time headers */}
            {weekDays.map((day) => {
              const isWknd = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={dateString(day)}
                  className={`border-r border-default ${isWknd ? "bg-sunken/30" : ""}`}
                  style={{ minWidth: `${TIME_SLOTS.length * CEL_BREEDTE}px` }}
                >
                  {/* Day label */}
                  <div className={`px-2 py-1 text-xs font-semibold border-b border-subtle text-center ${
                    isToday(day)
                      ? "text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/20"
                      : "text-fg-subtle"
                  }`}>
                    {formatDagKort(day)}
                    {isToday(day) && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 ml-1.5 align-middle" />
                    )}
                  </div>

                  {/* Time slot headers */}
                  <div className="flex">
                    {TIME_SLOTS.map((time) => (
                      <div
                        key={time}
                        className="text-[10px] text-fg-subtle text-center border-r border-subtle py-0.5"
                        style={{ minWidth: `${CEL_BREEDTE}px`, width: `${CEL_BREEDTE}px` }}
                      >
                        {time.endsWith(":00") ? time : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Practitioner rows */}
          {practitioners.map((prac) => {
            const appts = localAfspraken[prac.id] ?? [];
            const contract = contractMap[prac.id];
            const contractUren = contract?.urenPerWeek ?? 36;
            const contractOnbekend = !contract || contract.contractType === "onbekend";
            const geplandMinuten = sumDurationMinutes(appts);
            const geplandUren = geplandMinuten / 60;

            return (
              <RoosterRow
                key={prac.id}
                practitionerId={prac.id}
                naam={prac.naam}
                geplandUren={geplandUren}
                contractUren={contractUren}
                contractOnbekend={contractOnbekend}
                afspraken={appts}
                weekDays={weekDays}
                onSlotClick={handleSlotClick}
                celBreedte={CEL_BREEDTE}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-subtle flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-100 dark:bg-brand-900/30 border border-brand-300 dark:border-brand-700" />
            <span className="text-[11px] text-fg-subtle">Persoonlijke verzorging</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-navy-50 dark:bg-navy-900/30 border border-navy-300 dark:border-navy-700" />
            <span className="text-[11px] text-fg-subtle">Verpleging</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700" />
            <span className="text-[11px] text-fg-subtle">Begeleiding</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-surface-200 dark:bg-surface-800 border border-surface-400 dark:border-surface-600" />
            <span className="text-[11px] text-fg-subtle">Huishoudelijke hulp</span>
          </div>
        </div>

        {/* CAO Warnings */}
        <CaoWarning
          violations={violations}
          overrides={overrides}
          onOverride={handleOverride}
          onOverrideAll={handleOverrideAll}
        />

        {/* Inline create form */}
        {inlineForm && (
          <InlineAfspraakForm
            practitionerId={inlineForm.practitionerId}
            medewerkerNaam={inlineForm.medewerkerNaam}
            datum={inlineForm.datum}
            startTijd={inlineForm.startTijd}
            onClose={() => setInlineForm(null)}
            onCreated={() => {
              setInlineForm(null);
              onAfspraakCreated();
            }}
          />
        )}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 10.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/components/planning/RoosterGrid.tsx
git commit -m "feat(rooster): RoosterGrid main component with DndContext and CAO integration"
```

---

## Task 11: Replace rooster page

**Files:**
- Modify: `apps/web/src/app/planning/rooster/page.tsx`

- [ ] **Step 11.1: Replace page.tsx with grid-based version**

Replace the entire content of `apps/web/src/app/planning/rooster/page.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";
import { RoosterGrid } from "../../../components/planning/RoosterGrid";
import { RoosterToolbar } from "../../../components/planning/RoosterToolbar";
import type { FhirAppointment } from "../../../lib/cao-engine";
import { ecdFetch } from "../../../lib/api";
import { planningFetch } from "../../../lib/planning-api";

/* ---------- Types ---------- */

interface Practitioner {
  id: string;
  resourceType: "Practitioner";
  name?: Array<{ family?: string; given?: string[] }>;
  active?: boolean;
}

interface PractitionerBundle {
  entry?: Array<{ resource: Practitioner }>;
}

interface AppointmentBundle {
  entry?: Array<{ resource: FhirAppointment }>;
}

interface ContractInfo {
  medewerkerId: string;
  urenPerWeek: number;
  contractType: string;
}

interface ContractsResponse {
  contracts: ContractInfo[];
}

/* ---------- Helpers ---------- */

function getNaam(p: Practitioner): string {
  const name = p.name?.[0];
  if (!name) return "(onbekend)";
  const given = name.given?.join(" ") ?? "";
  return `${given} ${name.family ?? ""}`.trim() || "(onbekend)";
}

function getWeekDays(startDate: Date): Date[] {
  const monday = new Date(startDate);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(days: Date[]): string {
  if (days.length === 0) return "";
  const first = days[0]!;
  const last = days[6]!;
  const optFirst: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const optLast: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  return `${first.toLocaleDateString("nl-NL", optFirst)} — ${last.toLocaleDateString("nl-NL", optLast)}`;
}

/* ---------- Page ---------- */

export default function RoosterPage() {
  const [practitioners, setPractitioners] = useState<Array<{ id: string; naam: string }>>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [afsprakenMap, setAfsprakenMap] = useState<Record<string, FhirAppointment[]>>({});
  const [contractMap, setContractMap] = useState<Record<string, ContractInfo>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);

  const loadPractitioners = useCallback(async () => {
    const { data, error: err, status } = await ecdFetch<PractitionerBundle>(
      "/api/medewerkers?_count=50&_sort=name",
    );
    if (err) {
      setError(status === 0 ? err : null);
      if (status === 0) return [];
    }
    const pracs = (data?.entry?.map((e) => e.resource) ?? [])
      .filter((p) => p.active !== false)
      .map((p) => ({ id: p.id, naam: getNaam(p) }));
    setPractitioners(pracs);
    return pracs;
  }, []);

  const loadContracts = useCallback(async (pracIds: string[]) => {
    if (pracIds.length === 0) return;
    const { data } = await planningFetch<ContractsResponse>(
      `/api/medewerkers/contracts?ids=${pracIds.join(",")}`,
    );
    if (data?.contracts) {
      const map: Record<string, ContractInfo> = {};
      for (const c of data.contracts) {
        map[c.medewerkerId] = c;
      }
      setContractMap(map);
    }
  }, []);

  const loadAfspraken = useCallback(async (days: Date[], pracs: Array<{ id: string }>) => {
    if (days.length === 0 || pracs.length === 0) return;
    const weekStart = dateString(days[0]!);
    const weekEnd = dateString(days[6]!);

    const { data } = await planningFetch<AppointmentBundle>(
      `/api/afspraken?date=ge${weekStart}&date=le${weekEnd}&_count=500`,
    );

    const map: Record<string, FhirAppointment[]> = {};
    // Initialize all practitioners with empty arrays
    for (const prac of pracs) {
      map[prac.id] = [];
    }

    if (data?.entry) {
      for (const entry of data.entry) {
        const appt = entry.resource;
        if (!appt.start) continue;

        const pracRef = appt.participant?.find((p) =>
          p.actor?.reference?.startsWith("Practitioner/"),
        )?.actor?.reference;

        if (pracRef) {
          const pracId = pracRef.replace("Practitioner/", "");
          if (!map[pracId]) map[pracId] = [];
          map[pracId].push(appt);
        }
      }
    }

    setAfsprakenMap(map);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const pracs = await loadPractitioners();
      if (pracs.length > 0) {
        await Promise.all([
          loadAfspraken(weekDays, pracs),
          loadContracts(pracs.map((p) => p.id)),
        ]);
      }

      setLoading(false);
    })();
  }, [weekOffset, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const weekLabel = formatWeekLabel(weekDays);

  return (
    <AppShell>
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        <RoosterToolbar
          weekOffset={weekOffset}
          onPrevWeek={() => setWeekOffset((w) => w - 1)}
          onNextWeek={() => setWeekOffset((w) => w + 1)}
          onToday={() => setWeekOffset(0)}
          weekLabel={weekLabel}
        />

        {error && (
          <div className="p-3 bg-coral-50 dark:bg-coral-950/20 border border-coral-200 dark:border-coral-800 rounded-xl text-coral-600 dark:text-coral-400 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
              <p className="text-sm text-fg-muted">Rooster laden...</p>
            </div>
          </div>
        ) : practitioners.length === 0 ? (
          <div className="text-center py-24">
            <h3 className="text-lg font-semibold text-fg">Geen medewerkers</h3>
            <p className="text-sm text-fg-muted mt-1">
              Voeg eerst medewerkers toe via Beheer &gt; Medewerkers.
            </p>
          </div>
        ) : (
          <RoosterGrid
            practitioners={practitioners}
            afsprakenMap={afsprakenMap}
            contractMap={contractMap}
            weekDays={weekDays}
            onAfspraakMoved={handleRefresh}
            onAfspraakCreated={handleRefresh}
          />
        )}
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 11.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/app/planning/rooster/page.tsx
git commit -m "feat(rooster): replace static table with drag-and-drop grid page"
```

---

## Task 12: Seed script for CAO test scenarios

**Files:**
- Create: `infra/scripts/seed-planning.sh`

- [ ] **Step 12.1: Create seed-planning.sh**

Create `infra/scripts/seed-planning.sh`:

```bash
#!/bin/sh
# Seed script for rooster CAO test scenarios.
# Creates PractitionerRole resources with contract-uren extensions
# and Appointment resources that trigger various CAO violations.
#
# Requires: MEDPLUM_BASE_URL, TOKEN (Bearer token), PROJECT_ID
# Usage: TOKEN=<bearer> PROJECT_ID=<id> ./seed-planning.sh

set -e

MEDPLUM="${MEDPLUM_BASE_URL:-http://localhost:8103}"
TOKEN="${TOKEN:?TOKEN is required}"

echo "=== OpenZorg Planning Seed ==="
echo "Medplum: $MEDPLUM"

# Helper: create FHIR resource
create_resource() {
  local resource_type="$1"
  local body="$2"
  local result
  result=$(curl -sf -X POST "$MEDPLUM/fhir/R4/$resource_type" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/fhir+json" \
    -d "$body")
  echo "$result" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//'
}

# Helper: get Monday of current week
get_monday() {
  local dow
  dow=$(date +%u)
  local diff=$((dow - 1))
  date -d "-${diff} days" +%Y-%m-%d 2>/dev/null || date -v-${diff}d +%Y-%m-%d
}

MONDAY=$(get_monday)
TUESDAY=$(date -d "$MONDAY + 1 day" +%Y-%m-%d 2>/dev/null || date -j -v+1d -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d)
WEDNESDAY=$(date -d "$MONDAY + 2 days" +%Y-%m-%d 2>/dev/null || date -j -v+2d -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d)
THURSDAY=$(date -d "$MONDAY + 3 days" +%Y-%m-%d 2>/dev/null || date -j -v+3d -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d)
FRIDAY=$(date -d "$MONDAY + 4 days" +%Y-%m-%d 2>/dev/null || date -j -v+4d -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d)
SATURDAY=$(date -d "$MONDAY + 5 days" +%Y-%m-%d 2>/dev/null || date -j -v+5d -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d)
SUNDAY=$(date -d "$MONDAY + 6 days" +%Y-%m-%d 2>/dev/null || date -j -v+6d -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d)

echo "Week: $MONDAY to $SUNDAY"

# --- Create 6 test Practitioners ---

echo "Creating Practitioners..."

PRAC1_ID=$(create_resource "Practitioner" '{
  "resourceType": "Practitioner",
  "active": true,
  "name": [{"family": "de Vries", "given": ["Jan"]}]
}')
echo "  Jan de Vries: $PRAC1_ID"

PRAC2_ID=$(create_resource "Practitioner" '{
  "resourceType": "Practitioner",
  "active": true,
  "name": [{"family": "Jansen", "given": ["Maria"]}]
}')
echo "  Maria Jansen: $PRAC2_ID"

PRAC3_ID=$(create_resource "Practitioner" '{
  "resourceType": "Practitioner",
  "active": true,
  "name": [{"family": "Bakker", "given": ["Pieter"]}]
}')
echo "  Pieter Bakker: $PRAC3_ID"

PRAC4_ID=$(create_resource "Practitioner" '{
  "resourceType": "Practitioner",
  "active": true,
  "name": [{"family": "de Groot", "given": ["Sanne"]}]
}')
echo "  Sanne de Groot: $PRAC4_ID"

PRAC5_ID=$(create_resource "Practitioner" '{
  "resourceType": "Practitioner",
  "active": true,
  "name": [{"family": "El Amrani", "given": ["Ahmed"]}]
}')
echo "  Ahmed El Amrani: $PRAC5_ID"

PRAC6_ID=$(create_resource "Practitioner" '{
  "resourceType": "Practitioner",
  "active": true,
  "name": [{"family": "Vermeer", "given": ["Lisa"]}]
}')
echo "  Lisa Vermeer: $PRAC6_ID"

# --- Create PractitionerRoles with contract extensions ---

echo "Creating PractitionerRoles with contract-uren..."

for PAIR in "$PRAC1_ID:36" "$PRAC2_ID:32" "$PRAC3_ID:24" "$PRAC4_ID:36" "$PRAC5_ID:28" "$PRAC6_ID:36"; do
  PRAC_ID=$(echo "$PAIR" | cut -d: -f1)
  UREN=$(echo "$PAIR" | cut -d: -f2)
  FTE=$(echo "scale=2; $UREN / 36" | bc)

  create_resource "PractitionerRole" "{
    \"resourceType\": \"PractitionerRole\",
    \"active\": true,
    \"practitioner\": { \"reference\": \"Practitioner/$PRAC_ID\" },
    \"extension\": [
      { \"url\": \"https://openzorg.nl/extensions/contract-uren\", \"valueDecimal\": $UREN },
      { \"url\": \"https://openzorg.nl/extensions/contract-fte\", \"valueDecimal\": $FTE },
      { \"url\": \"https://openzorg.nl/extensions/contract-type\", \"valueString\": \"vast\" }
    ]
  }" > /dev/null
done

echo "  Done."

# --- Create a test patient ---

PAT_ID=$(create_resource "Patient" '{
  "resourceType": "Patient",
  "active": true,
  "name": [{"family": "Testclient", "given": ["CAO"]}]
}')
echo "Test patient: $PAT_ID"

# --- Helper: create appointment ---
create_appt() {
  local prac_id="$1" date="$2" start_time="$3" end_time="$4" desc="$5"
  create_resource "Appointment" "{
    \"resourceType\": \"Appointment\",
    \"status\": \"booked\",
    \"description\": \"$desc\",
    \"start\": \"${date}T${start_time}:00\",
    \"end\": \"${date}T${end_time}:00\",
    \"participant\": [
      { \"actor\": { \"reference\": \"Practitioner/$prac_id\" }, \"status\": \"accepted\" },
      { \"actor\": { \"reference\": \"Patient/$PAT_ID\" }, \"status\": \"accepted\" }
    ]
  }" > /dev/null
}

# --- Jan de Vries: 38u gepland (normaal, licht boven contract 36u) ---
echo "Appointments for Jan de Vries (38u)..."
create_appt "$PRAC1_ID" "$MONDAY"    "07:00" "15:00" "Persoonlijke verzorging"
create_appt "$PRAC1_ID" "$TUESDAY"   "07:00" "15:00" "Verpleging"
create_appt "$PRAC1_ID" "$WEDNESDAY" "07:00" "15:00" "Persoonlijke verzorging"
create_appt "$PRAC1_ID" "$THURSDAY"  "07:00" "15:00" "Begeleiding"
create_appt "$PRAC1_ID" "$FRIDAY"    "07:00" "13:00" "Huishoudelijke hulp"

# --- Maria Jansen: 50u gepland (ATW_MAX_WEEK overtreding) ---
echo "Appointments for Maria Jansen (50u — ATW_MAX_WEEK)..."
create_appt "$PRAC2_ID" "$MONDAY"    "06:00" "16:00" "Verpleging"
create_appt "$PRAC2_ID" "$TUESDAY"   "06:00" "16:00" "Verpleging"
create_appt "$PRAC2_ID" "$WEDNESDAY" "06:00" "16:00" "Persoonlijke verzorging"
create_appt "$PRAC2_ID" "$THURSDAY"  "06:00" "16:00" "Persoonlijke verzorging"
create_appt "$PRAC2_ID" "$FRIDAY"    "06:00" "16:00" "Begeleiding"

# --- Pieter Bakker: 24u exact (exact op contract) ---
echo "Appointments for Pieter Bakker (24u)..."
create_appt "$PRAC3_ID" "$MONDAY"    "08:00" "14:00" "Persoonlijke verzorging"
create_appt "$PRAC3_ID" "$WEDNESDAY" "08:00" "14:00" "Begeleiding"
create_appt "$PRAC3_ID" "$FRIDAY"    "08:00" "14:00" "Verpleging"
create_appt "$PRAC3_ID" "$SATURDAY"  "09:00" "15:00" "Huishoudelijke hulp"

# --- Sanne de Groot: ATW_MIN_RUST overtreding (8u rust wo-do) ---
echo "Appointments for Sanne de Groot (ATW_MIN_RUST)..."
create_appt "$PRAC4_ID" "$MONDAY"    "07:00" "15:00" "Verpleging"
create_appt "$PRAC4_ID" "$TUESDAY"   "07:00" "15:00" "Persoonlijke verzorging"
create_appt "$PRAC4_ID" "$WEDNESDAY" "14:00" "22:00" "Verpleging"
create_appt "$PRAC4_ID" "$THURSDAY"  "06:00" "14:00" "Persoonlijke verzorging"
create_appt "$PRAC4_ID" "$FRIDAY"    "07:00" "11:00" "Begeleiding"

# --- Ahmed El Amrani: ATW_MAX_DIENST overtreding (12u dienst dinsdag) ---
echo "Appointments for Ahmed El Amrani (ATW_MAX_DIENST)..."
create_appt "$PRAC5_ID" "$MONDAY"    "08:00" "14:00" "Begeleiding"
create_appt "$PRAC5_ID" "$TUESDAY"   "06:00" "18:00" "Verpleging"
create_appt "$PRAC5_ID" "$WEDNESDAY" "08:00" "14:00" "Persoonlijke verzorging"
create_appt "$PRAC5_ID" "$THURSDAY"  "08:00" "12:00" "Huishoudelijke hulp"

# --- Lisa Vermeer: 16u (onderbezet) ---
echo "Appointments for Lisa Vermeer (16u — onderbezet)..."
create_appt "$PRAC6_ID" "$MONDAY"    "09:00" "13:00" "Persoonlijke verzorging"
create_appt "$PRAC6_ID" "$WEDNESDAY" "09:00" "13:00" "Begeleiding"
create_appt "$PRAC6_ID" "$FRIDAY"    "09:00" "13:00" "Verpleging"
create_appt "$PRAC6_ID" "$SUNDAY"    "10:00" "14:00" "Huishoudelijke hulp"

echo ""
echo "=== Seed complete ==="
echo "Total: 6 practitioners, 6 PractitionerRoles, 1 patient, 30 appointments"
echo "CAO scenarios: ATW_MAX_WEEK (Maria), ATW_MIN_RUST (Sanne), ATW_MAX_DIENST (Ahmed), CAO_CONTRACT (Maria)"
```

- [ ] **Step 12.2: Make script executable**

```bash
chmod +x /c/Users/kevin/Documents/ClaudeCode/openzorg/infra/scripts/seed-planning.sh
```

- [ ] **Step 12.3: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add infra/scripts/seed-planning.sh
git commit -m "feat(rooster): CAO test data seed script with 6 medewerkers and 30 afspraken"
```

---

## Task 13: Verification and deploy

- [ ] **Step 13.1: TypeScript compile check**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm typecheck
```

- [ ] **Step 13.2: Lint check**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm lint
```

- [ ] **Step 13.3: Forbidden words check**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm forbidden-words
```

- [ ] **Step 13.4: Run tests**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm test
```

- [ ] **Step 13.5: Docker build test**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
docker compose up -d --build ecd web planning
```

- [ ] **Step 13.6: Manual verification checklist**

1. Navigate to `/planning/rooster` — grid loads with medewerkers on Y-axis and 30-min time slots on X-axis
2. Drag an appointment block to a different time slot — block snaps to new position, backend updated
3. Drag an appointment to a different medewerker row — block moves, participant updated
4. Click empty slot — InlineAfspraakForm popover opens with client search
5. Create appointment via form — block appears in grid
6. Trigger CAO violation (>48u or <11u rust) — CaoWarning banner appears at bottom
7. Click "Bevestig met reden" — override popover opens, requires 10+ characters
8. Contract-uren bars show correct percentages per medewerker
9. Weekend columns have subtle background tinting
10. Week navigation works (prev/next/today)

- [ ] **Step 13.7: Final commit if lint/type fixes needed**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add -A
git commit -m "fix(rooster): lint and type fixes for grid implementation"
```
