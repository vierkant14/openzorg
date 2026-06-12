# Facturatie WLZ-producten + Coverage (Verzekeringsdekking)

> **Status:** Approved 2026-04-17
> **Branch:** plan-2a-execute

## Problem

OpenZorg heeft een facturatie-stub met placeholder WLZ-tarieven (V001-V010 met fictieve bedragen) en geen koppeling tussen declaraties en de verzekeringsdekking van clienten. Planners en beheerders kunnen:

1. Niet vastleggen welke verzekeraar een client heeft en welk polisnummer
2. Geen WLZ-indicatie (ZZP-klasse, toewijzingsnummer) registreren bij een client
3. Niet valideren of een client een actieve indicatie heeft voordat een prestatie gedeclareerd wordt
4. Geen declaratie-export genereren voor handmatige upload naar Vecozo

De WLZ-tarieven in `declaratie-types.ts` zijn bovendien niet NZa 2026-conform.

## Solution

1. **Coverage tab** in client-dossier voor verzekeringsinformatie (FHIR Coverage resource)
2. **Verzekeraar + polisnummer** op client-registratieformulier
3. **NZa 2026 tarieven** voor WLZ ZZP-VV, VPT, MPT producten
4. **Declaratie-export** als CSV en PDF voor handmatige Vecozo-upload
5. **Validatie** bij prestatie-registratie: actieve Coverage vereist

## Design Decisions

| Beslissing | Keuze | Reden |
|---|---|---|
| Coverage-opslag | FHIR Coverage resource via Medplum | Past in FHIR-native architectuur; Coverage is standaard FHIR R4 resource |
| Basisvelden op registratie | Alleen verzekeraar + polisnummer | Laagdrempelig; WLZ-details op apart tabblad voor complexe gevallen |
| WLZ-details locatie | Nieuw tabblad `/ecd/{id}/verzekering` | Te veel velden voor de bestaande registratiepagina; apart tabblad past in TabNav-patroon |
| Tarieven | NZa 2026 officieel per dag/uur | Bedragen in eurocenten (bestaande conventie in `declaratie-types.ts`) |
| Export formaat | CSV + PDF | CSV voor import in Vecozo-portaal; PDF voor administratie. Geen AW319 XML (backlog) |
| Financieringstype validatie | Soft check | Waarschuwing als Coverage ontbreekt, niet blokkeren. Beheerder kan overriden |

## Feature 1: Coverage Tab in Client-dossier

### Route

`/ecd/{id}/verzekering` — nieuw tabblad in de client-dossier TabNav.

### TabNav uitbreiding

In `apps/web/src/app/ecd/[id]/TabNav.tsx`, voeg toe:

```typescript
{ label: "Verzekering", href: `/ecd/${id}/verzekering`, permission: "clients:read" }
```

### UI layout

```
Verzekeringsinformatie
  ┌─────────────────────────────────────────────────────┐
  │ Verzekeraar:     [CZ Zorgverzekeringen         ] ▼ │
  │ Polisnummer:     [123456789                      ]  │
  │ Financiering:    [WLZ ▼] [WMO ▼] [ZVW ▼]          │
  │                                                     │
  │ ── WLZ-indicatie ──────────────────────────────────  │
  │ Indicatiebesluit:  [IB-2026-123456               ]  │
  │ ZZP-klasse:        [VV-05 — Beschermd wonen... ▼ ]  │
  │ Ingangsdatum:      [01-03-2026                   ]  │
  │ Einddatum:         [28-02-2027                   ]  │
  │ Toewijzingsnummer: [TW-2026-789012               ]  │
  │                                                     │
  │ Status: ● Actief (verloopt over 347 dagen)         │
  │                                                     │
  │ [Opslaan]                                  [Annuleren]│
  └─────────────────────────────────────────────────────┘

  Verzekeringhistorie
  ┌────────────────────────────────────────────────┐
  │ 01-03-2025 — 28-02-2026  ZZP VV-04  CZ  Verlopen │
  │ 01-03-2024 — 28-02-2025  ZZP VV-03  CZ  Verlopen │
  └────────────────────────────────────────────────┘
```

### FHIR Coverage resource

```json
{
  "resourceType": "Coverage",
  "status": "active",
  "beneficiary": { "reference": "Patient/client-123" },
  "payor": [{ "display": "CZ Zorgverzekeringen" }],
  "class": [
    {
      "type": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/coverage-class", "code": "policy" }] },
      "value": "123456789",
      "name": "Polisnummer"
    }
  ],
  "extension": [
    {
      "url": "https://openzorg.nl/extensions/financieringstype",
      "valueString": "wlz"
    },
    {
      "url": "https://openzorg.nl/extensions/wlz-indicatiebesluit",
      "valueString": "IB-2026-123456"
    },
    {
      "url": "https://openzorg.nl/extensions/wlz-zzp-klasse",
      "valueString": "VV-05"
    },
    {
      "url": "https://openzorg.nl/extensions/wlz-toewijzingsnummer",
      "valueString": "TW-2026-789012"
    }
  ],
  "period": {
    "start": "2026-03-01",
    "end": "2027-02-28"
  }
}
```

## Feature 2: Client Registratie — Verzekeraar + Polisnummer

### Bestaand formulier uitbreiden

In `apps/web/src/app/ecd/nieuw/page.tsx`, voeg een sectie toe na de bestaande persoonsgegevens:

```
── Verzekering (optioneel) ──
Verzekeraar:    [                              ] ▼
Polisnummer:    [                               ]
```

### Verzekeraar opties

Hardcoded lijst van grote Nederlandse zorgverzekeraars (UZOVI-register):

| Code | Naam |
|---|---|
| 0104 | CZ |
| 0203 | Menzis |
| 3311 | Zilveren Kruis |
| 3313 | VGZ |
| 0403 | ONVZ |
| 0699 | DSW |
| 7029 | Eno/Salland |

Bij registratie: als verzekeraar + polisnummer ingevuld, wordt een `Coverage` resource aangemaakt met status `active` en de basisvelden. WLZ-details worden later ingevuld op het verzekering-tabblad.

## Feature 3: WLZ Product Catalog — NZa 2026 Tarieven

### Update `services/facturatie/src/lib/declaratie-types.ts`

Vervang de huidige `WLZ_PRODUCTEN` array met NZa 2026-conforme tarieven:

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

### Eenheid uitbreiden

Voeg `"dagdeel"` toe aan de `Prestatie` interface:

```typescript
eenheid: "uur" | "dag" | "etmaal" | "stuks" | "minuten" | "dagdeel";
```

## Feature 4: Prestatie Validatie tegen Coverage

### Validatieflow bij prestatie-registratie

Bij het aanmaken van een prestatie (`POST /api/prestaties`):

1. Haal client Coverage op: `GET /api/coverage/client/{clientId}?status=active`
2. Check:
   - Heeft client een actieve Coverage met matching financieringstype?
   - Valt de prestatie-datum binnen de Coverage-periode?
   - Past het productcode bij de ZZP-klasse? (soft check)
3. Resultaat:
   - **Geen Coverage:** Waarschuwing in response `{ warning: "Geen actieve verzekeringsdekking gevonden" }`
   - **Verlopen Coverage:** Waarschuwing `{ warning: "Verzekeringsdekking verlopen per {datum}" }`
   - **Mismatch financiering:** Waarschuwing `{ warning: "Product is WLZ maar client heeft ZVW-dekking" }`

Waarschuwingen blokkeren NIET — de prestatie wordt altijd opgeslagen. Frontend toont een gele banner met de waarschuwing.

## Feature 5: Declaratie Export

### Export endpoints

#### CSV Export

`GET /api/declaraties/:id/export/csv`

Response: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="DEC-2026-00001.csv"`

Kolommen:

```csv
Declaratienummer;BSN;Clientnaam;Productcode;Productomschrijving;Datum;Eenheid;Aantal;Tarief;Bedrag;Financieringstype;Periode_van;Periode_tot
DEC-2026-00001;123456789;De Vries, Jan;VV05;ZZP-VV5 — Beschermd wonen met intensieve dementiezorg;2026-03-15;dag;31;198.23;6145.13;wlz;2026-03-01;2026-03-31
```

Scheidingsteken: puntkomma (standaard in NL). Decimaal: punt (ISO). UTF-8 met BOM voor Excel-compatibiliteit.

#### PDF Export

`GET /api/declaraties/:id/export/pdf`

Response: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="DEC-2026-00001.pdf"`

PDF layout:

```
┌─────────────────────────────────────────────┐
│ [Tenant Logo]    DECLARATIEOVERZICHT        │
│                                             │
│ Declaratienummer: DEC-2026-00001            │
│ Periode: 01-03-2026 t/m 31-03-2026         │
│ Financieringstype: WLZ                      │
│ Status: Concept                             │
│ Aangemaakt: 17-04-2026                      │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Client: Jan de Vries (BSN: 123456789)       │
│ ZZP-klasse: VV-05                           │
│ Verzekeraar: CZ | Polis: 123456789         │
│                                             │
│ Datum      Product    Aantal  Tarief  Bedrag│
│ 15-03      ZZP-VV5    31 dgn  198.23 6145.13│
│                                             │
│ ─────────────────────────────────────────── │
│ Client: Maria Jansen (BSN: 987654321)       │
│ ...                                         │
│                                             │
│ ─────────────────────────────────────────── │
│ TOTAAL                           €12.890,45 │
│ Aantal prestaties: 8                        │
│ Aantal clienten: 3                          │
│                                             │
│ Gegenereerd door OpenZorg op 17-04-2026     │
└─────────────────────────────────────────────┘
```

### PDF library

Gebruik `@react-pdf/renderer` voor server-side PDF-generatie in de facturatie service, of het lichtere `pdfkit` (geen React dependency op backend). Aanbeveling: **`pdfkit`** (30KB, zero-dependency, stream-based).

```bash
pnpm --filter @openzorg/service-facturatie add pdfkit
pnpm --filter @openzorg/service-facturatie add -D @types/pdfkit
```

### Batch export

`GET /api/declaraties/export/csv?periode_van=2026-03-01&periode_tot=2026-03-31&financieringstype=wlz`

Exporteert alle declaraties in de periode als een enkel CSV-bestand. Handig voor maandelijkse Vecozo-upload.

## Feature 6: Backend Routes — Coverage CRUD

### Nieuw routebestand: `services/ecd/src/routes/coverage.ts`

```typescript
const coverage = new Hono<AppEnv>();

// GET /api/clients/:clientId/coverage
// Haal alle Coverage resources op voor een client
coverage.get("/clients/:clientId/coverage", async (c) => {
  const clientId = c.req.param("clientId");
  return proxyMedplumResponse(c, await medplumFetch(c,
    `/fhir/R4/Coverage?beneficiary=Patient/${clientId}&_sort=-period`
  ));
});

// GET /api/clients/:clientId/coverage/active
// Haal alleen actieve Coverage op
coverage.get("/clients/:clientId/coverage/active", async (c) => {
  const clientId = c.req.param("clientId");
  return proxyMedplumResponse(c, await medplumFetch(c,
    `/fhir/R4/Coverage?beneficiary=Patient/${clientId}&status=active`
  ));
});

// POST /api/clients/:clientId/coverage
// Maak nieuwe Coverage aan
coverage.post("/clients/:clientId/coverage", async (c) => {
  const clientId = c.req.param("clientId");
  const body = await c.req.json();

  const coverage: FhirCoverage = {
    resourceType: "Coverage",
    status: body.status ?? "active",
    beneficiary: { reference: `Patient/${clientId}` },
    payor: body.verzekeraar ? [{ display: body.verzekeraar }] : [],
    class: body.polisnummer ? [{
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/coverage-class", code: "policy" }] },
      value: body.polisnummer,
      name: "Polisnummer",
    }] : [],
    period: body.ingangsdatum ? {
      start: body.ingangsdatum,
      end: body.einddatum ?? undefined,
    } : undefined,
    extension: buildWlzExtensions(body),
  };

  return proxyMedplumResponse(c, await medplumFetch(c, "/fhir/R4/Coverage", {
    method: "POST",
    body: JSON.stringify(coverage),
  }));
});

// PUT /api/clients/:clientId/coverage/:coverageId
// Update bestaande Coverage
coverage.put("/clients/:clientId/coverage/:coverageId", async (c) => {
  const coverageId = c.req.param("coverageId");
  const body = await c.req.json();

  // Haal huidige resource op voor merge
  const current = await medplumFetch(c, `/fhir/R4/Coverage/${coverageId}`);
  const existing = await current.json();

  const updated = {
    ...existing,
    ...buildCoverageUpdate(body),
  };

  return proxyMedplumResponse(c, await medplumFetch(c, `/fhir/R4/Coverage/${coverageId}`, {
    method: "PUT",
    body: JSON.stringify(updated),
  }));
});

// DELETE /api/clients/:clientId/coverage/:coverageId
// Verwijder Coverage (soft: set status cancelled)
coverage.delete("/clients/:clientId/coverage/:coverageId", async (c) => {
  const coverageId = c.req.param("coverageId");
  const current = await medplumFetch(c, `/fhir/R4/Coverage/${coverageId}`);
  const existing = await current.json();

  return proxyMedplumResponse(c, await medplumFetch(c, `/fhir/R4/Coverage/${coverageId}`, {
    method: "PUT",
    body: JSON.stringify({ ...existing, status: "cancelled" }),
  }));
});
```

### Mount in `services/ecd/src/app.ts`

Coverage routes moeten VOOR de `clients/:id` catch-all gemount worden (zelfde patroon als mic-meldingen).

### RBAC

Voeg toe aan `ROUTE_PERMISSIONS` in `packages/shared-domain/src/roles.ts`:

```typescript
{ pattern: "/api/clients/:id/coverage", methods: ["GET"], permissions: ["clients:read"] },
{ pattern: "/api/clients/:id/coverage", methods: ["POST", "PUT", "DELETE"], permissions: ["clients:write"] },
```

## Feature 7: Export Endpoints in Facturatie Service

### Uitbreiding `services/facturatie/src/routes/declaraties.ts`

#### CSV endpoint

```typescript
declaraties.get("/:id/export/csv", async (c) => {
  const id = c.req.param("id");
  const declaratie = await getDeclaratie(c, id);
  const prestaties = await getPrestatiesForDeclaratie(c, declaratie.prestaties);

  const header = "Declaratienummer;BSN;Clientnaam;Productcode;Productomschrijving;Datum;Eenheid;Aantal;Tarief;Bedrag;Financieringstype;Periode_van;Periode_tot";
  const rows = prestaties.map(p =>
    [declaratie.nummer, p.bsn, p.clientNaam, p.productCode, p.productOmschrijving,
     p.datum, p.eenheid, p.aantal, formatDecimal(p.tariefPerEenheid),
     formatDecimal(p.totaal), declaratie.financieringstype,
     declaratie.periode.van, declaratie.periode.tot].join(";")
  );

  const csv = "\uFEFF" + [header, ...rows].join("\n");  // BOM for Excel

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${declaratie.nummer}.csv"`);
  return c.body(csv);
});
```

#### PDF endpoint

```typescript
declaraties.get("/:id/export/pdf", async (c) => {
  const id = c.req.param("id");
  const declaratie = await getDeclaratie(c, id);
  const prestaties = await getPrestatiesForDeclaratie(c, declaratie.prestaties);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  // Header
  doc.fontSize(20).text("DECLARATIEOVERZICHT", { align: "center" });
  doc.moveDown();
  doc.fontSize(10)
    .text(`Declaratienummer: ${declaratie.nummer}`)
    .text(`Periode: ${formatDatum(declaratie.periode.van)} t/m ${formatDatum(declaratie.periode.tot)}`)
    .text(`Financieringstype: ${declaratie.financieringstype.toUpperCase()}`)
    .text(`Status: ${declaratie.status}`);
  doc.moveDown();

  // Prestaties per client
  const grouped = groupBy(prestaties, "clientNaam");
  for (const [clientNaam, clientPrestaties] of Object.entries(grouped)) {
    doc.fontSize(12).text(clientNaam, { underline: true });
    // Table rows...
    for (const p of clientPrestaties) {
      doc.fontSize(9).text(
        `${formatDatum(p.datum)}  ${p.productCode}  ${p.aantal} ${p.eenheid}  ${formatBedrag(p.tariefPerEenheid)}  ${formatBedrag(p.totaal)}`
      );
    }
    doc.moveDown();
  }

  // Totaal
  doc.fontSize(12).text(`TOTAAL: ${formatBedrag(declaratie.totaalBedrag)}`, { align: "right" });
  doc.text(`Aantal prestaties: ${declaratie.aantalPrestaties}`, { align: "right" });

  doc.end();

  await new Promise((resolve) => doc.on("end", resolve));
  const pdf = Buffer.concat(chunks);

  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${declaratie.nummer}.pdf"`);
  return c.body(pdf);
});
```

#### Batch CSV endpoint

```typescript
declaraties.get("/export/csv", async (c) => {
  const periodeVan = c.req.query("periode_van");
  const periodeTot = c.req.query("periode_tot");
  const financieringstype = c.req.query("financieringstype");

  // Query all declaraties matching filters
  // Generate combined CSV
  // Return as download
});
```

## Feature 8: Test Data

### Seed script: `infra/scripts/seed-facturatie.sh`

#### Coverage testdata

| Client | Verzekeraar | Polis | Financiering | ZZP | Status |
|---|---|---|---|---|---|
| Client 1 (Jan) | CZ | POL-001 | WLZ | VV-05 | Actief |
| Client 2 (Maria) | Zilveren Kruis | POL-002 | WLZ | VV-03 | Actief |
| Client 3 (Pieter) | VGZ | POL-003 | WMO | - | Actief |
| Client 4 (Ans) | CZ | POL-004 | WLZ | VV-07 | Verlopen |
| Client 5 (Bert) | Menzis | POL-005 | ZVW | - | Actief |
| Client 6 (Griet) | - | - | - | - | Geen coverage |

#### Prestatie testdata

12 prestaties verdeeld over de clients:
- 6x WLZ (ZZP-VV dagbedragen)
- 3x WMO (begeleiding per uur)
- 3x ZVW (verpleging per uur)

Mix van statussen: 6 geregistreerd, 4 gevalideerd, 2 gedeclareerd.

#### Declaratie testdata

2 concept-declaraties:
- DEC-2026-00001: WLZ maart 2026, 4 prestaties, totaal ca. EUR 8.500
- DEC-2026-00002: WMO maart 2026, 3 prestaties, totaal ca. EUR 1.200

## Files to Create/Modify

### Nieuw

| Bestand | Beschrijving |
|---|---|
| `apps/web/src/app/ecd/[id]/verzekering/page.tsx` | Coverage tab met formulier en historie |
| `services/ecd/src/routes/coverage.ts` | FHIR Coverage CRUD endpoints |
| `infra/scripts/seed-facturatie.sh` | Testdata voor Coverage + prestaties + declaraties |

### Wijzigen

| Bestand | Wijziging |
|---|---|
| `apps/web/src/app/ecd/nieuw/page.tsx` | Verzekeraar + polisnummer velden toevoegen |
| `apps/web/src/app/ecd/[id]/TabNav.tsx` | "Verzekering" tab toevoegen |
| `services/facturatie/src/lib/declaratie-types.ts` | NZa 2026 tarieven, `eenheid` uitbreiden met `"dagdeel"`, productcodes updaten |
| `services/facturatie/src/routes/declaraties.ts` | CSV + PDF export endpoints |
| `services/ecd/src/app.ts` | Coverage routes mounten |
| `packages/shared-domain/src/roles.ts` | Coverage RBAC permissions |
| `services/facturatie/package.json` | `pdfkit` dependency |

## Risks

| Risico | Impact | Mitigatie |
|---|---|---|
| NZa-tarieven veranderen jaarlijks | Tarieven 2026 zijn verouderd in 2027 | Tarieven in configuratie/database i.p.v. hardcoded. Fase 2: admin-UI voor tarief-updates |
| FHIR Coverage is complex resource | Niet alle velden relevant; extensies nodig voor NL-specifiek | Alleen relevante velden mappen; extensies documenteren op `https://openzorg.nl/extensions/` |
| CSV-formaat is niet gestandaardiseerd | Vecozo accepteert mogelijk afwijkend formaat | CSV is tussenoplossing; AW319 XML is backlog. CSV-kolommen documenteren voor handmatige mapping |
| PDF-generatie is CPU-intensief | Grote declaraties (100+ prestaties) kunnen traag zijn | Paginering in PDF; async generatie met download-link voor grote declaraties |
| Verzekeraar-lijst is hardcoded | Nieuwe verzekeraars of fusies vereisen code-wijziging | UZOVI-register als seed-data in database; admin-beheer in fase 2 |
| Coverage en prestatie zitten in verschillende services | ECD (Coverage) vs. Facturatie (prestatie) — cross-service validatie | Facturatie service roept ECD Coverage endpoint aan via interne HTTP call. Alternatief: shared event bus (fase 2) |
| BSN nodig voor export maar niet altijd ingevuld | CSV-export mist BSN kolom | Waarschuwing bij export als BSN ontbreekt; BSN is verplicht bij WLZ |
