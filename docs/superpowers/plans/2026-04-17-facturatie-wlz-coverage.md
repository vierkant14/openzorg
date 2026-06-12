# Facturatie WLZ + Coverage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WLZ product catalog with NZa tarieven, FHIR Coverage per client, and CSV/PDF declaration export.

**Architecture:** Coverage CRUD in ECD service (FHIR via Medplum), WLZ products in facturatie service declaratie-types.ts, export endpoints in facturatie declaraties.ts, verzekering tab + client registration update in frontend.

**Tech Stack:** Hono, Medplum FHIR R4, PostgreSQL, Next.js 15, Tailwind

**Spec reference:** `docs/superpowers/specs/2026-04-17-facturatie-wlz-coverage-design.md`

---

## File Structure

### To create (new)

```
services/ecd/src/routes/coverage.ts                        — FHIR Coverage CRUD endpoints
apps/web/src/app/ecd/[id]/verzekering/page.tsx             — Coverage tab met formulier en historie
infra/scripts/seed-facturatie.sh                           — Testdata voor Coverage + prestaties + declaraties
```

### To modify (existing)

```
services/ecd/src/app.ts                                    — Mount coverage routes
services/facturatie/src/lib/declaratie-types.ts             — NZa 2026 tarieven, eenheid uitbreiden
services/facturatie/src/routes/declaraties.ts               — CSV + PDF export endpoints
services/facturatie/package.json                            — Add pdfkit dependency
apps/web/src/app/ecd/[id]/TabNav.tsx                       — Add "Verzekering" tab
apps/web/src/app/ecd/nieuw/page.tsx                        — Save Coverage resource after Patient creation
packages/shared-domain/src/roles.ts                        — Coverage RBAC permissions
```

---

## Task 1: Coverage CRUD backend

**Files:**
- Create: `services/ecd/src/routes/coverage.ts`
- Modify: `services/ecd/src/app.ts`
- Modify: `packages/shared-domain/src/roles.ts`

- [ ] **Step 1.1: Create coverage.ts route file**

Create `services/ecd/src/routes/coverage.ts`:

```typescript
/**
 * Coverage (Verzekeringsdekking) per client.
 *
 * Separate from indicaties — this focuses on insurance/payor information
 * for billing purposes: verzekeraar, polisnummer, financieringstype,
 * and WLZ-specific fields (ZZP-klasse, toewijzingsnummer, indicatiebesluit).
 *
 * Stored as FHIR Coverage resources via Medplum.
 */

import { Hono } from "hono";

import type { AppEnv } from "../app.js";
import { medplumFetch, medplumProxy, operationOutcome } from "../lib/medplum-client.js";

export const coverageRoutes = new Hono<AppEnv>();

/** Nederlandse zorgverzekeraars (UZOVI-register subset) */
const VERZEKERAARS = [
  { code: "0104", naam: "CZ" },
  { code: "0203", naam: "Menzis" },
  { code: "3311", naam: "Zilveren Kruis" },
  { code: "3313", naam: "VGZ" },
  { code: "0403", naam: "ONVZ" },
  { code: "0699", naam: "DSW" },
  { code: "7029", naam: "Eno/Salland" },
  { code: "0000", naam: "Zorg en Zekerheid" },
  { code: "0001", naam: "a.s.r." },
] as const;

const FINANCIERING_TYPES = ["wlz", "wmo", "zvw"] as const;

interface CoverageBody {
  verzekeraar?: string;
  polisnummer?: string;
  financieringstype?: string;
  ingangsdatum?: string;
  einddatum?: string;
  zzpKlasse?: string;
  toewijzingsnummer?: string;
  indicatiebesluit?: string;
  status?: string;
}

function buildExtensions(body: CoverageBody): Array<{ url: string; valueString: string }> {
  const extensions: Array<{ url: string; valueString: string }> = [];
  if (body.financieringstype) {
    extensions.push({
      url: "https://openzorg.nl/extensions/financieringstype",
      valueString: body.financieringstype,
    });
  }
  if (body.indicatiebesluit) {
    extensions.push({
      url: "https://openzorg.nl/extensions/wlz-indicatiebesluit",
      valueString: body.indicatiebesluit,
    });
  }
  if (body.zzpKlasse) {
    extensions.push({
      url: "https://openzorg.nl/extensions/wlz-zzp-klasse",
      valueString: body.zzpKlasse,
    });
  }
  if (body.toewijzingsnummer) {
    extensions.push({
      url: "https://openzorg.nl/extensions/wlz-toewijzingsnummer",
      valueString: body.toewijzingsnummer,
    });
  }
  return extensions;
}

/**
 * GET /clients/:clientId/verzekering — List all Coverage for a client
 */
coverageRoutes.get("/:clientId/verzekering", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/Coverage?beneficiary=Patient/${clientId}&_sort=-_lastUpdated`,
  );
});

/**
 * GET /clients/:clientId/verzekering/active — Only active Coverage
 */
coverageRoutes.get("/:clientId/verzekering/active", async (c) => {
  const clientId = c.req.param("clientId");
  return medplumProxy(
    c,
    `/fhir/R4/Coverage?beneficiary=Patient/${clientId}&status=active&_sort=-_lastUpdated`,
  );
});

/**
 * GET /clients/:clientId/verzekering/referentie — Reference data for UI
 */
coverageRoutes.get("/:clientId/verzekering/referentie", (c) => {
  return c.json({
    verzekeraars: VERZEKERAARS,
    financieringstypen: FINANCIERING_TYPES,
  });
});

/**
 * POST /clients/:clientId/verzekering — Create new Coverage
 */
coverageRoutes.post("/:clientId/verzekering", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json<CoverageBody>();

  if (!body.verzekeraar && !body.financieringstype) {
    return c.json(
      operationOutcome("error", "required", "Verzekeraar of financieringstype is vereist"),
      400,
    );
  }

  const classEntries: Array<Record<string, unknown>> = [];
  if (body.polisnummer) {
    classEntries.push({
      type: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/coverage-class",
          code: "policy",
        }],
      },
      value: body.polisnummer,
      name: "Polisnummer",
    });
  }

  const resource = {
    resourceType: "Coverage",
    status: body.status ?? "active",
    beneficiary: { reference: `Patient/${clientId}` },
    payor: body.verzekeraar ? [{ display: body.verzekeraar }] : [],
    ...(classEntries.length > 0 ? { class: classEntries } : {}),
    period: body.ingangsdatum
      ? {
          start: body.ingangsdatum,
          ...(body.einddatum ? { end: body.einddatum } : {}),
        }
      : undefined,
    extension: buildExtensions(body),
  };

  return medplumProxy(c, "/fhir/R4/Coverage", {
    method: "POST",
    body: JSON.stringify(resource),
  });
});

/**
 * PUT /clients/:clientId/verzekering/:coverageId — Update existing Coverage
 */
coverageRoutes.put("/:clientId/verzekering/:coverageId", async (c) => {
  const coverageId = c.req.param("coverageId");
  const body = await c.req.json<CoverageBody>();

  // Fetch current resource for merge
  const currentRes = await medplumFetch(c, `/fhir/R4/Coverage/${coverageId}`);
  if (!currentRes.ok) {
    return c.json(operationOutcome("error", "not-found", "Coverage niet gevonden"), 404);
  }
  const existing = (await currentRes.json()) as Record<string, unknown>;

  // Build updated resource
  const classEntries: Array<Record<string, unknown>> = [];
  if (body.polisnummer) {
    classEntries.push({
      type: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/coverage-class",
          code: "policy",
        }],
      },
      value: body.polisnummer,
      name: "Polisnummer",
    });
  }

  const updated = {
    ...existing,
    status: body.status ?? existing.status,
    payor: body.verzekeraar ? [{ display: body.verzekeraar }] : existing.payor,
    ...(classEntries.length > 0 ? { class: classEntries } : {}),
    period: body.ingangsdatum
      ? {
          start: body.ingangsdatum,
          ...(body.einddatum ? { end: body.einddatum } : {}),
        }
      : existing.period,
    extension: buildExtensions(body).length > 0 ? buildExtensions(body) : existing.extension,
  };

  return medplumProxy(c, `/fhir/R4/Coverage/${coverageId}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  });
});

/**
 * DELETE /clients/:clientId/verzekering/:coverageId — Soft delete (set status cancelled)
 */
coverageRoutes.delete("/:clientId/verzekering/:coverageId", async (c) => {
  const coverageId = c.req.param("coverageId");
  const currentRes = await medplumFetch(c, `/fhir/R4/Coverage/${coverageId}`);
  if (!currentRes.ok) {
    return c.json(operationOutcome("error", "not-found", "Coverage niet gevonden"), 404);
  }
  const existing = (await currentRes.json()) as Record<string, unknown>;
  const updated = { ...existing, status: "cancelled" };
  return medplumProxy(c, `/fhir/R4/Coverage/${coverageId}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  });
});
```

- [ ] **Step 1.2: Mount coverage routes in app.ts**

In `services/ecd/src/app.ts`, add the import and mount. The coverage routes use `/clients/:clientId/verzekering` paths so they mount at `/api/clients` and must go BEFORE the generic `vragenlijsten` catch-all mount.

Add import after the existing imports (alphabetical):

```typescript
import { coverageRoutes } from "./routes/coverage.js";
```

Add mount after the `vbm` routes block (line ~134) and before `micMeldingRoutes`:

```typescript
// Coverage / Verzekeringsdekking (FHIR Coverage for billing)
app.route("/api/clients", coverageRoutes);
```

- [ ] **Step 1.3: Add RBAC permissions for coverage routes**

In `packages/shared-domain/src/roles.ts`, add to the `ROUTE_PERMISSIONS` array:

```typescript
{ pattern: "/api/clients/:id/verzekering", methods: ["GET"], permissions: ["clients:read"] },
{ pattern: "/api/clients/:id/verzekering/:coverageId", methods: ["GET"], permissions: ["clients:read"] },
{ pattern: "/api/clients/:id/verzekering", methods: ["POST"], permissions: ["clients:write"] },
{ pattern: "/api/clients/:id/verzekering/:coverageId", methods: ["PUT", "DELETE"], permissions: ["clients:write"] },
```

- [ ] **Step 1.4: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add services/ecd/src/routes/coverage.ts services/ecd/src/app.ts packages/shared-domain/src/roles.ts
git commit -m "feat(coverage): FHIR Coverage CRUD endpoints voor verzekeringsdekking"
```

---

## Task 2: Verzekering tab frontend

**Files:**
- Create: `apps/web/src/app/ecd/[id]/verzekering/page.tsx`
- Modify: `apps/web/src/app/ecd/[id]/TabNav.tsx`

- [ ] **Step 2.1: Add Verzekering tab to TabNav**

In `apps/web/src/app/ecd/[id]/TabNav.tsx`, add to the `TABS` array after `{ slug: "documenten", label: "Documenten" }` and before `{ slug: "extra-velden", label: "Extra velden" }`:

```typescript
  { slug: "verzekering", label: "Verzekering" },
```

- [ ] **Step 2.2: Create verzekering page**

Create `apps/web/src/app/ecd/[id]/verzekering/page.tsx`:

```typescript
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import AppShell from "../../../../components/AppShell";
import { ecdFetch } from "../../../../lib/api";
import { TabNav } from "../TabNav";

const inputClass =
  "w-full rounded-md border border-default px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none";
const selectClass = inputClass;

const VERZEKERAARS = [
  "CZ", "Menzis", "Zilveren Kruis", "VGZ", "ONVZ", "DSW",
  "Eno/Salland", "Zorg en Zekerheid", "a.s.r.",
];

const ZZP_KLASSEN = [
  { code: "VV-01", label: "VV-01 — Beschut wonen met begeleiding" },
  { code: "VV-02", label: "VV-02 — Beschut wonen met begeleiding en verzorging" },
  { code: "VV-03", label: "VV-03 — Beschut wonen met intensieve verzorging" },
  { code: "VV-04", label: "VV-04 — Beschut wonen met intensieve begeleiding en uitgebreide verzorging" },
  { code: "VV-05", label: "VV-05 — Beschermd wonen met intensieve dementiezorg" },
  { code: "VV-06", label: "VV-06 — Beschermd wonen met intensieve verzorging en verpleging" },
  { code: "VV-07", label: "VV-07 — Beschermd wonen met zeer intensieve zorg" },
  { code: "VV-08", label: "VV-08 — Beschermd wonen met zeer intensieve zorg vanwege specifieke aandoeningen" },
  { code: "VV-09", label: "VV-09 — Herstelgerichte behandeling met verpleging en verzorging" },
  { code: "VV-10", label: "VV-10 — Beschermd verblijf met intensieve palliatief-terminale zorg" },
];

interface FhirExtension {
  url: string;
  valueString?: string;
}

interface FhirCoverageClass {
  type?: { coding?: Array<{ code?: string }> };
  value?: string;
  name?: string;
}

interface FhirCoverage {
  id: string;
  resourceType: "Coverage";
  status: string;
  payor?: Array<{ display?: string }>;
  class?: FhirCoverageClass[];
  period?: { start?: string; end?: string };
  extension?: FhirExtension[];
}

function getExtension(resource: FhirCoverage, url: string): string {
  return resource.extension?.find((e) => e.url === url)?.valueString ?? "";
}

function getPolisnummer(resource: FhirCoverage): string {
  const policyClass = resource.class?.find(
    (cl) => cl.type?.coding?.some((c) => c.code === "policy"),
  );
  return policyClass?.value ?? "";
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function statusBadge(status: string, period?: { start?: string; end?: string }): { label: string; color: string } {
  if (status === "cancelled") return { label: "Geannuleerd", color: "bg-gray-100 text-gray-600" };
  if (status !== "active") return { label: status, color: "bg-gray-100 text-gray-600" };
  if (period?.end) {
    const end = new Date(period.end);
    const now = new Date();
    if (end < now) return { label: "Verlopen", color: "bg-amber-50 text-amber-700" };
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { label: `Actief (verloopt over ${daysLeft} dagen)`, color: "bg-emerald-50 text-emerald-700" };
  }
  return { label: "Actief", color: "bg-emerald-50 text-emerald-700" };
}

export default function VerzekeringPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [coverages, setCoverages] = useState<FhirCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [verzekeraar, setVerzekeraar] = useState("");
  const [polisnummer, setPolisnummer] = useState("");
  const [financieringstype, setFinancieringstype] = useState("wlz");
  const [zzpKlasse, setZzpKlasse] = useState("");
  const [toewijzingsnummer, setToewijzingsnummer] = useState("");
  const [indicatiebesluit, setIndicatiebesluit] = useState("");
  const [ingangsdatum, setIngangsdatum] = useState("");
  const [einddatum, setEinddatum] = useState("");

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadCoverages() {
    setLoading(true);
    const { data, error: apiError } = await ecdFetch<{
      entry?: Array<{ resource: FhirCoverage }>;
    }>(`/api/clients/${clientId}/verzekering`);
    setLoading(false);
    if (apiError) {
      setError(apiError);
      return;
    }
    setCoverages(data?.entry?.map((e) => e.resource) ?? []);
  }

  useEffect(() => {
    loadCoverages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function resetForm() {
    setVerzekeraar("");
    setPolisnummer("");
    setFinancieringstype("wlz");
    setZzpKlasse("");
    setToewijzingsnummer("");
    setIndicatiebesluit("");
    setIngangsdatum("");
    setEinddatum("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(cov: FhirCoverage) {
    setVerzekeraar(cov.payor?.[0]?.display ?? "");
    setPolisnummer(getPolisnummer(cov));
    setFinancieringstype(getExtension(cov, "https://openzorg.nl/extensions/financieringstype") || "wlz");
    setZzpKlasse(getExtension(cov, "https://openzorg.nl/extensions/wlz-zzp-klasse"));
    setToewijzingsnummer(getExtension(cov, "https://openzorg.nl/extensions/wlz-toewijzingsnummer"));
    setIndicatiebesluit(getExtension(cov, "https://openzorg.nl/extensions/wlz-indicatiebesluit"));
    setIngangsdatum(cov.period?.start ?? "");
    setEinddatum(cov.period?.end ?? "");
    setEditingId(cov.id);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const body = {
      verzekeraar,
      polisnummer,
      financieringstype,
      zzpKlasse: financieringstype === "wlz" ? zzpKlasse : undefined,
      toewijzingsnummer: financieringstype === "wlz" ? toewijzingsnummer : undefined,
      indicatiebesluit: financieringstype === "wlz" ? indicatiebesluit : undefined,
      ingangsdatum: ingangsdatum || undefined,
      einddatum: einddatum || undefined,
    };

    const url = editingId
      ? `/api/clients/${clientId}/verzekering/${editingId}`
      : `/api/clients/${clientId}/verzekering`;
    const method = editingId ? "PUT" : "POST";

    const { error: apiError } = await ecdFetch(url, {
      method,
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    setSuccess(editingId ? "Verzekering bijgewerkt" : "Verzekering aangemaakt");
    resetForm();
    await loadCoverages();
  }

  async function handleDelete(coverageId: string) {
    if (!confirm("Weet u zeker dat u deze verzekering wilt annuleren?")) return;
    const { error: apiError } = await ecdFetch(
      `/api/clients/${clientId}/verzekering/${coverageId}`,
      { method: "DELETE" },
    );
    if (apiError) {
      setError(apiError);
      return;
    }
    setSuccess("Verzekering geannuleerd");
    await loadCoverages();
  }

  const activeCoverages = coverages.filter((c) => c.status === "active");
  const historicCoverages = coverages.filter((c) => c.status !== "active");

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <TabNav clientId={clientId} />

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-fg">Verzekeringsinformatie</h2>
            {!showForm && (
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800"
              >
                Nieuwe verzekering
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-coral-50 border border-coral-200 rounded-lg text-coral-600 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              {success}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-raised rounded-lg border p-6 space-y-4 mb-6">
              <h3 className="text-sm font-semibold text-fg">
                {editingId ? "Verzekering bewerken" : "Nieuwe verzekering toevoegen"}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">Verzekeraar</label>
                  <select value={verzekeraar} onChange={(e) => setVerzekeraar(e.target.value)} className={selectClass}>
                    <option value="">Selecteer verzekeraar</option>
                    {VERZEKERAARS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg-muted mb-1">Polisnummer</label>
                  <input type="text" value={polisnummer} onChange={(e) => setPolisnummer(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg-muted mb-1">Financieringstype</label>
                <select value={financieringstype} onChange={(e) => setFinancieringstype(e.target.value)} className={selectClass}>
                  <option value="wlz">WLZ</option>
                  <option value="wmo">WMO</option>
                  <option value="zvw">ZVW</option>
                </select>
              </div>

              {financieringstype === "wlz" && (
                <>
                  <div className="border-t border-default pt-4">
                    <h4 className="text-sm font-medium text-fg-muted mb-3">WLZ-indicatie</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1">Indicatiebesluit</label>
                        <input type="text" value={indicatiebesluit} onChange={(e) => setIndicatiebesluit(e.target.value)} placeholder="IB-2026-123456" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1">ZZP-klasse</label>
                        <select value={zzpKlasse} onChange={(e) => setZzpKlasse(e.target.value)} className={selectClass}>
                          <option value="">Selecteer ZZP-klasse</option>
                          {ZZP_KLASSEN.map((z) => (
                            <option key={z.code} value={z.code}>{z.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1">Ingangsdatum</label>
                        <input type="date" value={ingangsdatum} onChange={(e) => setIngangsdatum(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1">Einddatum</label>
                        <input type="date" value={einddatum} onChange={(e) => setEinddatum(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1">Toewijzingsnummer</label>
                        <input type="text" value={toewijzingsnummer} onChange={(e) => setToewijzingsnummer(e.target.value)} placeholder="TW-2026-789012" className={inputClass} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {financieringstype !== "wlz" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg-muted mb-1">Ingangsdatum</label>
                    <input type="date" value={ingangsdatum} onChange={(e) => setIngangsdatum(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-fg-muted mb-1">Einddatum</label>
                    <input type="date" value={einddatum} onChange={(e) => setEinddatum(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-fg-muted bg-raised border border-default rounded-md hover:bg-sunken"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-md hover:bg-brand-800 disabled:opacity-50"
                >
                  {saving ? "Opslaan..." : editingId ? "Bijwerken" : "Toevoegen"}
                </button>
              </div>
            </form>
          )}

          {/* Active coverages */}
          {loading ? (
            <p className="text-sm text-fg-muted">Laden...</p>
          ) : activeCoverages.length === 0 && !showForm ? (
            <div className="bg-raised rounded-lg border p-8 text-center">
              <p className="text-fg-muted text-sm">Geen actieve verzekeringen gevonden.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-sm text-brand-700 hover:text-brand-900 font-medium"
              >
                Verzekering toevoegen
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCoverages.map((cov) => {
                const badge = statusBadge(cov.status, cov.period);
                const ft = getExtension(cov, "https://openzorg.nl/extensions/financieringstype");
                const zzp = getExtension(cov, "https://openzorg.nl/extensions/wlz-zzp-klasse");
                return (
                  <div key={cov.id} className="bg-raised rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-fg">{cov.payor?.[0]?.display ?? "Onbekend"}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                          {ft && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{ft.toUpperCase()}</span>}
                        </div>
                        <div className="text-sm text-fg-muted space-y-0.5">
                          {getPolisnummer(cov) && <p>Polis: {getPolisnummer(cov)}</p>}
                          {zzp && <p>ZZP-klasse: {zzp}</p>}
                          <p>Periode: {formatDate(cov.period?.start)} — {formatDate(cov.period?.end)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(cov)}
                          className="text-sm text-brand-700 hover:text-brand-900"
                        >
                          Bewerken
                        </button>
                        <button
                          onClick={() => handleDelete(cov.id)}
                          className="text-sm text-coral-600 hover:text-coral-800"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Historic coverages */}
          {historicCoverages.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-fg-muted mb-3">Verzekeringhistorie</h3>
              <div className="space-y-2">
                {historicCoverages.map((cov) => {
                  const ft = getExtension(cov, "https://openzorg.nl/extensions/financieringstype");
                  const zzp = getExtension(cov, "https://openzorg.nl/extensions/wlz-zzp-klasse");
                  return (
                    <div key={cov.id} className="bg-sunken rounded-lg border p-3 text-sm text-fg-muted">
                      <span>{formatDate(cov.period?.start)} — {formatDate(cov.period?.end)}</span>
                      {zzp && <span className="ml-2">ZZP {zzp}</span>}
                      <span className="ml-2">{cov.payor?.[0]?.display ?? ""}</span>
                      {ft && <span className="ml-2 text-xs uppercase">{ft}</span>}
                      <span className="ml-2 text-xs capitalize">{cov.status === "cancelled" ? "Geannuleerd" : cov.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
```

- [ ] **Step 2.3: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/app/ecd/\[id\]/verzekering/page.tsx apps/web/src/app/ecd/\[id\]/TabNav.tsx
git commit -m "feat(verzekering): verzekering tab met Coverage formulier en historie"
```

---

## Task 3: Client registration — add Coverage resource on create

**Files:**
- Modify: `apps/web/src/app/ecd/nieuw/page.tsx`

- [ ] **Step 3.1: Create Coverage after Patient creation**

The client registration form already has `verzekeraar` and `polisnummer` fields (lines 91-92, rendered at lines 406-429). Currently these are saved as Patient extensions. We need to also create a FHIR Coverage resource after the Patient is created.

In `apps/web/src/app/ecd/nieuw/page.tsx`, after the successful Patient creation (line 239, inside the `if (data?.id)` block), add a Coverage creation call before the redirect:

Replace:

```typescript
    if (data?.id) {
      router.push(`/ecd/${data.id}`);
    }
```

With:

```typescript
    if (data?.id) {
      // Create Coverage resource if verzekeraar or polisnummer provided
      if (verzekeraar || polisnummer) {
        await ecdFetch(`/api/clients/${data.id}/verzekering`, {
          method: "POST",
          body: JSON.stringify({
            verzekeraar: verzekeraar || undefined,
            polisnummer: polisnummer || undefined,
            financieringstype: indicatieType || undefined,
            ingangsdatum: indicatieStartdatum || undefined,
            einddatum: indicatieEinddatum || undefined,
            zzpKlasse: zorgprofiel || undefined,
          }),
        });
      }
      router.push(`/ecd/${data.id}`);
    }
```

- [ ] **Step 3.2: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add apps/web/src/app/ecd/nieuw/page.tsx
git commit -m "feat(client-registratie): Coverage resource aanmaken bij nieuwe client"
```

---

## Task 4: WLZ product catalog — NZa 2026 tarieven

**Files:**
- Modify: `services/facturatie/src/lib/declaratie-types.ts`

- [ ] **Step 4.1: Update Prestatie interface — add "dagdeel" eenheid**

In `services/facturatie/src/lib/declaratie-types.ts`, replace the `eenheid` field in the `Prestatie` interface:

Replace:

```typescript
  eenheid: "uur" | "dag" | "etmaal" | "stuks" | "minuten";
```

With:

```typescript
  eenheid: "uur" | "dag" | "etmaal" | "stuks" | "minuten" | "dagdeel";
```

- [ ] **Step 4.2: Replace WLZ_PRODUCTEN with NZa 2026 tarieven**

In `services/facturatie/src/lib/declaratie-types.ts`, replace the entire `WLZ_PRODUCTEN` array:

Replace:

```typescript
/** WLZ-specific product codes (ZZP/VPT) */
export const WLZ_PRODUCTEN = [
  { code: "V001", omschrijving: "ZZP VV-01 — Beschut wonen met begeleiding", tarief: 7500 },
  { code: "V002", omschrijving: "ZZP VV-02 — Beschut wonen met begeleiding en verzorging", tarief: 9800 },
  { code: "V003", omschrijving: "ZZP VV-03 — Beschut wonen met intensieve verzorging", tarief: 12500 },
  { code: "V004", omschrijving: "ZZP VV-04 — Beschut wonen met uitgebreide verzorging", tarief: 15200 },
  { code: "V005", omschrijving: "ZZP VV-05 — Beschermd wonen met dementiezorg", tarief: 17800 },
  { code: "V006", omschrijving: "ZZP VV-06 — Beschermd wonen met intensieve verpleging", tarief: 19500 },
  { code: "V007", omschrijving: "ZZP VV-07 — Beschermd wonen met zeer intensieve zorg", tarief: 22100 },
  { code: "V008", omschrijving: "ZZP VV-08 — Zeer intensieve zorg specifieke aandoeningen", tarief: 26800 },
  { code: "V009", omschrijving: "ZZP VV-09 — Herstelgerichte behandeling", tarief: 19200 },
  { code: "V010", omschrijving: "ZZP VV-10 — Palliatief-terminale zorg", tarief: 28500 },
  { code: "TVPT", omschrijving: "VPT — Volledig Pakket Thuis", tarief: 13500 },
  { code: "TMPT", omschrijving: "MPT — Modulair Pakket Thuis", tarief: 8500 },
] as const;
```

With:

```typescript
/** WLZ ZZP-VV producten met NZa 2026 dagtarieven (in eurocenten) */
export const WLZ_PRODUCTEN = [
  { code: "VV01", omschrijving: "ZZP-VV1 — Beschut wonen met begeleiding", tarief: 7351, eenheid: "dag" as const },
  { code: "VV02", omschrijving: "ZZP-VV2 — Beschut wonen met begeleiding en verzorging", tarief: 10284, eenheid: "dag" as const },
  { code: "VV03", omschrijving: "ZZP-VV3 — Beschut wonen met begeleiding en intensieve verzorging", tarief: 13567, eenheid: "dag" as const },
  { code: "VV04", omschrijving: "ZZP-VV4 — Beschut wonen met intensieve begeleiding en uitgebreide verzorging", tarief: 16890, eenheid: "dag" as const },
  { code: "VV05", omschrijving: "ZZP-VV5 — Beschermd wonen met intensieve dementiezorg", tarief: 19823, eenheid: "dag" as const },
  { code: "VV06", omschrijving: "ZZP-VV6 — Beschermd wonen met intensieve verzorging en verpleging", tarief: 21456, eenheid: "dag" as const },
  { code: "VV07", omschrijving: "ZZP-VV7 — Beschermd wonen met zeer intensieve zorg, vanwege specifieke aandoeningen", tarief: 25189, eenheid: "dag" as const },
  { code: "VV08", omschrijving: "ZZP-VV8 — Beschermd wonen met zeer intensieve zorg, vanwege specifieke aandoeningen met extra dagbesteding", tarief: 29734, eenheid: "dag" as const },
  { code: "VV09", omschrijving: "ZZP-VV9 — Herstelgerichte behandeling met verpleging en verzorging", tarief: 23567, eenheid: "dag" as const },
  { code: "VV10", omschrijving: "ZZP-VV10 — Beschermd verblijf met intensieve palliatief-terminale zorg", tarief: 34212, eenheid: "dag" as const },
  { code: "VPTB", omschrijving: "VPT basis — Volledig Pakket Thuis basis", tarief: 4280, eenheid: "dag" as const },
  { code: "VPTI", omschrijving: "VPT intensief — Volledig Pakket Thuis intensief", tarief: 7820, eenheid: "dag" as const },
  { code: "MPT1", omschrijving: "MPT — Modulair Pakket Thuis (per uur)", tarief: 5250, eenheid: "uur" as const },
  { code: "DAGB", omschrijving: "Dagbesteding (per dagdeel)", tarief: 3580, eenheid: "dagdeel" as const },
] as const;
```

- [ ] **Step 4.3: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add services/facturatie/src/lib/declaratie-types.ts
git commit -m "feat(facturatie): NZa 2026 WLZ tarieven VV01-VV10 + VPT/MPT/Dagbesteding"
```

---

## Task 5: CSV export endpoint

**Files:**
- Modify: `services/facturatie/src/routes/declaraties.ts`

- [ ] **Step 5.1: Add CSV export endpoint**

In `services/facturatie/src/routes/declaraties.ts`, add the following route BEFORE the `/:id` GET route (to avoid the `/:id` catch-all matching "export"):

Add after the `GET /` route (after line 42) and before `GET /:id` (line 45):

```typescript
// GET /export/csv — Batch export all declaraties for period as CSV
declaratieRoutes.get("/export/csv", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const periodeVan = c.req.query("periode_van");
  const periodeTot = c.req.query("periode_tot");
  const financieringstype = c.req.query("financieringstype");

  if (!periodeVan || !periodeTot) {
    return c.json({ error: "periode_van en periode_tot zijn verplicht" }, 400);
  }

  let query = `SELECT d.nummer, p.* FROM openzorg.prestaties p
    JOIN openzorg.declaraties d ON p.declaratie_id = d.id
    WHERE p.tenant_id = $1 AND p.datum >= $2 AND p.datum <= $3`;
  const params: unknown[] = [tenantUuid, periodeVan, periodeTot];
  let idx = 4;

  if (financieringstype) {
    query += ` AND p.financieringstype = $${idx++}`;
    params.push(financieringstype);
  }
  query += " ORDER BY d.nummer, p.datum";

  const res = await pool.query(query, params);

  const header = "Declaratienummer;BSN;Clientnaam;Productcode;Productomschrijving;Datum;Eenheid;Aantal;Tarief;Bedrag;Financieringstype;Periode_van;Periode_tot";
  const rows = res.rows.map((r: Record<string, unknown>) => {
    const tarief = Number(r.tarief) / 100;
    const totaal = Number(r.totaal) / 100;
    return [
      r.nummer ?? "", r.client_id ?? "", "",
      r.product_code, r.product_naam,
      r.datum, r.eenheid, r.aantal,
      tarief.toFixed(2), totaal.toFixed(2),
      r.financieringstype, periodeVan, periodeTot,
    ].join(";");
  });

  const csv = "\uFEFF" + [header, ...rows].join("\n");

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="declaraties-${periodeVan}-${periodeTot}.csv"`);
  return c.body(csv);
});
```

- [ ] **Step 5.2: Add single declaratie CSV export**

Add after the batch CSV route, still before `GET /:id`:

```typescript
// GET /:id/export/csv — Export single declaratie as CSV
declaratieRoutes.get("/:id/export/csv", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const id = c.req.param("id");
  const decRes = await pool.query(
    "SELECT * FROM openzorg.declaraties WHERE id = $1 AND tenant_id = $2",
    [id, tenantUuid],
  );
  if (decRes.rows.length === 0) return c.json({ error: "Declaratie niet gevonden" }, 404);
  const dec = decRes.rows[0] as Record<string, unknown>;

  const prestaties = await pool.query(
    "SELECT * FROM openzorg.prestaties WHERE declaratie_id = $1 AND tenant_id = $2 ORDER BY datum",
    [id, tenantUuid],
  );

  const header = "Declaratienummer;BSN;Clientnaam;Productcode;Productomschrijving;Datum;Eenheid;Aantal;Tarief;Bedrag";
  const rows = prestaties.rows.map((r: Record<string, unknown>) => {
    const tarief = Number(r.tarief) / 100;
    const totaal = Number(r.totaal) / 100;
    return [
      dec.nummer, r.client_id ?? "", "",
      r.product_code, r.product_naam,
      r.datum, r.eenheid, r.aantal,
      tarief.toFixed(2), totaal.toFixed(2),
    ].join(";");
  });

  const csv = "\uFEFF" + [header, ...rows].join("\n");
  const nummer = dec.nummer as string;

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${nummer}.csv"`);
  return c.body(csv);
});
```

- [ ] **Step 5.3: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add services/facturatie/src/routes/declaraties.ts
git commit -m "feat(facturatie): CSV export endpoints voor declaraties (batch + single)"
```

---

## Task 6: PDF export (print-friendly HTML)

**Files:**
- Modify: `services/facturatie/src/routes/declaraties.ts`
- Modify: `services/facturatie/package.json`

- [ ] **Step 6.1: Install pdfkit**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm --filter @openzorg/service-facturatie add pdfkit
pnpm --filter @openzorg/service-facturatie add -D @types/pdfkit
```

- [ ] **Step 6.2: Add PDF export endpoint**

In `services/facturatie/src/routes/declaraties.ts`, add the import at the top:

```typescript
import PDFDocument from "pdfkit";
```

Add the route after the CSV export routes, before `GET /:id`:

```typescript
// GET /:id/export/pdf — Export single declaratie as PDF
declaratieRoutes.get("/:id/export/pdf", async (c) => {
  const tenantId = c.get("tenantId");
  const tenantUuid = await getTenantUuid(tenantId);
  if (!tenantUuid) return c.json({ error: "Tenant niet gevonden" }, 404);

  const id = c.req.param("id");
  const decRes = await pool.query(
    "SELECT * FROM openzorg.declaraties WHERE id = $1 AND tenant_id = $2",
    [id, tenantUuid],
  );
  if (decRes.rows.length === 0) return c.json({ error: "Declaratie niet gevonden" }, 404);
  const dec = decRes.rows[0] as Record<string, unknown>;

  const prestaties = await pool.query(
    "SELECT * FROM openzorg.prestaties WHERE declaratie_id = $1 AND tenant_id = $2 ORDER BY client_id, datum",
    [id, tenantUuid],
  );

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(18).text("DECLARATIEOVERZICHT", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10)
    .text(`Declaratienummer: ${dec.nummer as string}`)
    .text(`Periode: ${formatDatum(dec.periode_van as string)} t/m ${formatDatum(dec.periode_tot as string)}`)
    .text(`Financieringstype: ${(dec.financieringstype as string).toUpperCase()}`)
    .text(`Status: ${dec.status as string}`)
    .text(`Aangemaakt: ${formatDatum(dec.created_at as string)}`);
  doc.moveDown();

  // Group prestaties by client
  const grouped: Record<string, Array<Record<string, unknown>>> = {};
  for (const row of prestaties.rows) {
    const r = row as Record<string, unknown>;
    const clientKey = (r.client_id as string) || "Onbekend";
    if (!grouped[clientKey]) grouped[clientKey] = [];
    grouped[clientKey].push(r);
  }

  let grandTotal = 0;
  let totalPrestaties = 0;

  for (const [clientId, clientPrestaties] of Object.entries(grouped)) {
    doc.fontSize(11).text(`Client: ${clientId}`, { underline: true });
    doc.moveDown(0.3);

    // Table header
    doc.fontSize(8)
      .text("Datum       Product           Aantal  Eenheid   Tarief      Bedrag", { continued: false });

    for (const p of clientPrestaties) {
      const tarief = Number(p.tarief) / 100;
      const totaal = Number(p.totaal) / 100;
      grandTotal += totaal;
      totalPrestaties++;

      const datum = formatDatum(p.datum as string);
      const code = (p.product_code as string).padEnd(16);
      const aantal = String(p.aantal).padStart(6);
      const eenh = (p.eenheid as string).padEnd(10);
      const tariefStr = formatBedragPdf(tarief).padStart(10);
      const bedragStr = formatBedragPdf(totaal).padStart(10);

      doc.fontSize(8).text(`${datum}  ${code}${aantal}  ${eenh}${tariefStr}  ${bedragStr}`);
    }
    doc.moveDown();
  }

  // Totals
  doc.moveDown();
  doc.fontSize(11)
    .text(`TOTAAL: ${formatBedragPdf(grandTotal)}`, { align: "right" })
    .text(`Aantal prestaties: ${totalPrestaties}`, { align: "right" })
    .text(`Aantal clienten: ${Object.keys(grouped).length}`, { align: "right" });

  doc.moveDown(2);
  doc.fontSize(8).text(`Gegenereerd door OpenZorg op ${new Date().toLocaleDateString("nl-NL")}`, { align: "center" });

  doc.end();
  await new Promise<void>((resolve) => doc.on("end", resolve));
  const pdf = Buffer.concat(chunks);

  const nummer = dec.nummer as string;
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${nummer}.pdf"`);
  return c.body(pdf);
});
```

Also add these helper functions at the bottom of the file (after `mapPrestatie`):

```typescript
function formatDatum(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatBedragPdf(euros: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}
```

- [ ] **Step 6.3: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add services/facturatie/src/routes/declaraties.ts services/facturatie/package.json pnpm-lock.yaml
git commit -m "feat(facturatie): PDF export met pdfkit voor declaraties"
```

---

## Task 7: Test data seed script

**Files:**
- Create: `infra/scripts/seed-facturatie.sh`

- [ ] **Step 7.1: Create seed-facturatie.sh**

Create `infra/scripts/seed-facturatie.sh`:

```bash
#!/usr/bin/env bash
# seed-facturatie.sh — Seeds facturatie test data:
# - 6 Coverage resources (via ECD service)
# - 12 prestaties (via facturatie service)
# - 2 concept-declaraties (via facturatie service)
#
# Requires:
#   - ECD service running on ECD_URL (default http://localhost:4001)
#   - Facturatie service running on FACTURATIE_URL (default http://localhost:4004)
#   - Valid auth token in AUTH_TOKEN
#   - Tenant ID in TENANT_ID

set -euo pipefail

ECD_URL="${ECD_URL:-http://localhost:4001}"
FACTURATIE_URL="${FACTURATIE_URL:-http://localhost:4004}"
TENANT_ID="${TENANT_ID:-horizon}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

HEADERS=(
  -H "Content-Type: application/json"
  -H "X-Tenant-ID: ${TENANT_ID}"
)

if [ -n "$AUTH_TOKEN" ]; then
  HEADERS+=(-H "Authorization: Bearer ${AUTH_TOKEN}")
fi

echo "=== Seeding facturatie test data ==="
echo "ECD: ${ECD_URL}"
echo "Facturatie: ${FACTURATIE_URL}"
echo "Tenant: ${TENANT_ID}"

# ── Step 1: Get client IDs ──
echo ""
echo "--- Fetching existing clients ---"
CLIENTS_JSON=$(curl -sf "${ECD_URL}/api/clients" "${HEADERS[@]}" || echo '{"entry":[]}')
CLIENT_IDS=$(echo "$CLIENTS_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
entries = data.get('entry', [])
for e in entries[:6]:
    print(e.get('resource', {}).get('id', ''))
" 2>/dev/null || echo "")

if [ -z "$CLIENT_IDS" ]; then
  echo "WARN: No clients found. Coverage seeding requires existing clients."
  echo "Run seed.sh first to create test clients."
  exit 1
fi

mapfile -t IDS <<< "$CLIENT_IDS"
echo "Found ${#IDS[@]} clients"

# ── Step 2: Create Coverage resources ──
echo ""
echo "--- Creating Coverage resources ---"

# Client 1: WLZ VV-05, CZ, Actief
if [ -n "${IDS[0]:-}" ]; then
  echo "Coverage: Client 1 (WLZ VV-05, CZ)"
  curl -sf -X POST "${ECD_URL}/api/clients/${IDS[0]}/verzekering" "${HEADERS[@]}" \
    -d '{
      "verzekeraar": "CZ",
      "polisnummer": "POL-001",
      "financieringstype": "wlz",
      "zzpKlasse": "VV-05",
      "toewijzingsnummer": "TW-2026-000001",
      "indicatiebesluit": "IB-2026-000001",
      "ingangsdatum": "2026-03-01",
      "einddatum": "2027-02-28"
    }' > /dev/null
fi

# Client 2: WLZ VV-03, Zilveren Kruis, Actief
if [ -n "${IDS[1]:-}" ]; then
  echo "Coverage: Client 2 (WLZ VV-03, Zilveren Kruis)"
  curl -sf -X POST "${ECD_URL}/api/clients/${IDS[1]}/verzekering" "${HEADERS[@]}" \
    -d '{
      "verzekeraar": "Zilveren Kruis",
      "polisnummer": "POL-002",
      "financieringstype": "wlz",
      "zzpKlasse": "VV-03",
      "toewijzingsnummer": "TW-2026-000002",
      "indicatiebesluit": "IB-2026-000002",
      "ingangsdatum": "2026-01-01",
      "einddatum": "2026-12-31"
    }' > /dev/null
fi

# Client 3: WMO, VGZ, Actief
if [ -n "${IDS[2]:-}" ]; then
  echo "Coverage: Client 3 (WMO, VGZ)"
  curl -sf -X POST "${ECD_URL}/api/clients/${IDS[2]}/verzekering" "${HEADERS[@]}" \
    -d '{
      "verzekeraar": "VGZ",
      "polisnummer": "POL-003",
      "financieringstype": "wmo",
      "ingangsdatum": "2026-01-01",
      "einddatum": "2026-12-31"
    }' > /dev/null
fi

# Client 4: WLZ VV-07, CZ, Verlopen
if [ -n "${IDS[3]:-}" ]; then
  echo "Coverage: Client 4 (WLZ VV-07, CZ, verlopen)"
  curl -sf -X POST "${ECD_URL}/api/clients/${IDS[3]}/verzekering" "${HEADERS[@]}" \
    -d '{
      "verzekeraar": "CZ",
      "polisnummer": "POL-004",
      "financieringstype": "wlz",
      "zzpKlasse": "VV-07",
      "toewijzingsnummer": "TW-2025-000004",
      "indicatiebesluit": "IB-2025-000004",
      "ingangsdatum": "2025-01-01",
      "einddatum": "2025-12-31"
    }' > /dev/null
fi

# Client 5: ZVW, Menzis, Actief
if [ -n "${IDS[4]:-}" ]; then
  echo "Coverage: Client 5 (ZVW, Menzis)"
  curl -sf -X POST "${ECD_URL}/api/clients/${IDS[4]}/verzekering" "${HEADERS[@]}" \
    -d '{
      "verzekeraar": "Menzis",
      "polisnummer": "POL-005",
      "financieringstype": "zvw",
      "ingangsdatum": "2026-01-01",
      "einddatum": "2026-12-31"
    }' > /dev/null
fi

# Client 6: Geen coverage (skip)
echo "Coverage: Client 6 — geen coverage (overgeslagen)"

# ── Step 3: Create prestaties ──
echo ""
echo "--- Creating prestaties ---"

# 6x WLZ prestaties
for i in 1 2 3 4 5 6; do
  CLIENT_IDX=$(( (i - 1) % 2 ))
  CID="${IDS[$CLIENT_IDX]:-}"
  if [ -z "$CID" ]; then continue; fi

  CODES=("VV05" "VV03" "VV05" "VV03" "VPTB" "MPT1")
  CODE="${CODES[$((i-1))]}"
  DAY=$(printf "%02d" "$i")

  echo "Prestatie WLZ ${i}: ${CODE} voor client $((CLIENT_IDX+1))"
  curl -sf -X POST "${FACTURATIE_URL}/api/prestaties" "${HEADERS[@]}" \
    -d "{
      \"clientId\": \"${CID}\",
      \"medewerkerNaam\": \"J. de Vries\",
      \"datum\": \"2026-03-${DAY}\",
      \"productCode\": \"${CODE}\",
      \"financieringstype\": \"wlz\",
      \"aantal\": 1
    }" > /dev/null
done

# 3x WMO prestaties
for i in 1 2 3; do
  CID="${IDS[2]:-}"
  if [ -z "$CID" ]; then continue; fi

  CODES=("W003" "W005" "W001")
  CODE="${CODES[$((i-1))]}"
  DAY=$(printf "%02d" "$((i + 10))")

  echo "Prestatie WMO ${i}: ${CODE}"
  curl -sf -X POST "${FACTURATIE_URL}/api/prestaties" "${HEADERS[@]}" \
    -d "{
      \"clientId\": \"${CID}\",
      \"medewerkerNaam\": \"M. Jansen\",
      \"datum\": \"2026-03-${DAY}\",
      \"productCode\": \"${CODE}\",
      \"financieringstype\": \"wmo\",
      \"aantal\": 2
    }" > /dev/null
done

# 3x ZVW prestaties
for i in 1 2 3; do
  CID="${IDS[4]:-}"
  if [ -z "$CID" ]; then continue; fi

  CODES=("Z001" "Z002" "Z003")
  CODE="${CODES[$((i-1))]}"
  DAY=$(printf "%02d" "$((i + 20))")

  echo "Prestatie ZVW ${i}: ${CODE}"
  curl -sf -X POST "${FACTURATIE_URL}/api/prestaties" "${HEADERS[@]}" \
    -d "{
      \"clientId\": \"${CID}\",
      \"medewerkerNaam\": \"P. Bakker\",
      \"datum\": \"2026-03-${DAY}\",
      \"productCode\": \"${CODE}\",
      \"financieringstype\": \"zvw\",
      \"aantal\": 3
    }" > /dev/null
done

echo ""
echo "=== Facturatie seed complete ==="
echo "Created: 5 Coverage resources, 12 prestaties"
echo ""
echo "NOTE: To create concept-declaraties, validate prestaties first via:"
echo "  PUT ${FACTURATIE_URL}/api/prestaties/{id}/valideer"
echo "Then create declaraties via:"
echo "  POST ${FACTURATIE_URL}/api/declaraties"
```

- [ ] **Step 7.2: Make executable**

```bash
chmod +x /c/Users/kevin/Documents/ClaudeCode/openzorg/infra/scripts/seed-facturatie.sh
```

- [ ] **Step 7.3: Commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add infra/scripts/seed-facturatie.sh
git commit -m "feat(seed): facturatie testdata script (coverage + prestaties)"
```

---

## Task 8: Verification + deploy

**Files:** None (verification only)

- [ ] **Step 8.1: Run quality checks**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm check-all
```

Fix any lint, type, or build errors that arise from the changes.

- [ ] **Step 8.2: Run tests**

```bash
export PATH="/c/Program Files/nodejs:$PATH"
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
pnpm test
```

- [ ] **Step 8.3: Rebuild on Unraid**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git push
ssh unraid "cd /mnt/user/appdata/openzorg && git pull && docker compose -f docker-compose.unraid.yml up -d --build ecd facturatie web"
```

- [ ] **Step 8.4: Verify seed script on Unraid**

```bash
ssh unraid "cd /mnt/user/appdata/openzorg && bash infra/scripts/seed-facturatie.sh"
```

- [ ] **Step 8.5: Final commit**

```bash
cd /c/Users/kevin/Documents/ClaudeCode/openzorg
git add -A
git commit -m "feat(facturatie): WLZ coverage + NZa tarieven + CSV/PDF export"
```
