# Intramuraal Planningssysteem — Bezettingsrooster + AI-optimalisatie

> **Status:** Approved 2026-04-20
> **Branch:** plan-2a-execute

## Problem

OpenZorg heeft een basisplanning (afspraken, beschikbaarheid, wachtlijst) maar mist de kern van intramurale workforce planning: bezettingseisen per afdeling per dienst, competentiemanagement, dynamische zorgzwaarte-berekening, en AI-gestuurde roosteroptimalisatie. Zonder dit kan een verpleeghuis niet veilig plannen.

---

## Design Decisions

### 1. Twee aparte modules

Intramuraal (bezettingsrooster) en Extramuraal (routeplanning) worden als aparte feature-flag modules gebouwd. Ze delen een gemeenschappelijke basis: contracten, beschikbaarheid, CAO-engine, competenties. Dit spec behandelt uitsluitend het intramurale deel. Feature-flag: `planning.intramuraal` in tenant-configuratie.

### 2. Flexibele organisatie-hierarchie

De bestaande n-niveau hierarchie (holding -> regio -> cluster -> locatie -> team) wordt hergebruikt via het FHIR Organization resource met `partOf`-referenties. Bezettingsprofiel en dienst-configuratie kan op elk niveau worden ingesteld. De UI biedt een tree-picker om het juiste niveau te selecteren.

### 3. Dienst-configuratie met overerving

Tenant definieert standaard diensttypen met tijden en kleuren. Locatie kan deze overschrijven. Afdeling kan opnieuw overschrijven. Overervingsketen: tenant -> locatie -> afdeling. Als een niveau geen eigen configuratie heeft, erft het van de parent. Dit voorkomt duplicatie bij organisaties met tientallen afdelingen die grotendeels dezelfde diensten draaien.

### 4. Bezettingseisen: statisch + dynamisch

Vaste minimumnorm per afdeling per dienst (beheerder stelt handmatig in) plus dynamische berekening op basis van client-zorgzwaarte (ZZP-klasse). De AI vergelijkt beide en signaleert wanneer de statische norm te laag is voor de huidige clientpopulatie. De beheerder beslist uiteindelijk; het systeem adviseert.

### 5. Competenties drie-laags

- **Kern**: Voorbehouden handelingen (wettelijk verplicht, niet aanpasbaar). Voorbeeld: injecteren, catheteriseren, medicatie voorschrijven.
- **Uitbreiding**: Standaard meegeleverde competenties die per tenant aan/uit gezet kunnen worden. Voorbeeld: dementiezorg, palliatief, wondzorg, diabeteszorg, revalidatie, psychiatrie, geriatrie.
- **Organisatie-specifiek**: Door beheerder zelf aangemaakt. Voorbeeld: "Tillift bediening", "Sondevoeding PEG".

### 6. AI drie modi

1. **Real-time assistent** (altijd actief): Toont gaten, CAO-overtredingen en competentie-alerts bij elke roosterwijziging.
2. **Optimaliseer**: Vult gaten in een half-ingevuld rooster met inachtneming van alle constraints.
3. **Auto-genereer**: Maakt een compleet concept-rooster vanaf nul.

De constraint-solving draait server-side als deterministische algoritmen, niet via LLM. LLM (via bestaande Ollama-integratie) is optioneel beschikbaar voor natuurlijke taal vragen over het rooster.

### 7. Client-toewijzing

Client krijgt een locatie-toewijzing (afdeling + optioneel kamernummer) via een FHIR Patient extension. Zorgzwaarte wordt afgeleid uit de CIZ-indicatie (ZZP-klasse) die al geregistreerd is als Coverage resource.

---

## 1. Datamodel

### 1.1 Dienst-configuratie (nieuw)

**Opslag:** `tenant_configurations` tabel met `config_type = 'dienst_config'`

**Schema per entry:**

```typescript
interface DienstConfig {
  orgId: string;               // Organization UUID
  erftVan?: string;            // parent Organization UUID (null = eigen config)
  diensttypen: DienstType[];
}

interface DienstType {
  code: string;                // uniek binnen org, bijv. "vroeg", "laat", "nacht"
  naam: string;                // display naam, bijv. "Vroege dienst"
  start: string;               // HH:mm format, bijv. "07:00"
  eind: string;                // HH:mm format, bijv. "15:00"
  kleur: string;               // hex kleur voor UI, bijv. "#4CAF50"
  actief: boolean;             // soft-delete
}
```

**Standaard diensttypen (tenant-niveau):**

| Code | Naam | Start | Eind | Kleur |
|------|------|-------|------|-------|
| `vroeg` | Vroege dienst | 07:00 | 15:00 | `#4CAF50` (groen) |
| `laat` | Late dienst | 15:00 | 23:00 | `#FF9800` (oranje) |
| `nacht` | Nachtdienst | 23:00 | 07:00 | `#3F51B5` (indigo) |
| `dag` | Dagdienst | 08:30 | 17:00 | `#2196F3` (blauw) |
| `weekend` | Weekenddienst | 07:00 | 19:00 | `#9C27B0` (paars) |

**Overervingslogica:**

```
getEffectiveConfig(orgId):
  1. Zoek config voor orgId
  2. Als gevonden en erftVan == null → return eigen config
  3. Als niet gevonden → zoek parent org via Organization.partOf
  4. Herhaal stap 1-3 voor parent
  5. Als geen parent meer → return tenant default
```

Locatie/afdeling kan:
- Erven (geen eigen config, `erftVan` verwijst naar parent)
- Toevoegen (extra diensttypen naast overgenomen set)
- Overschrijven (eigen config met aangepaste tijden/namen)

**API:**

| Method | Endpoint | Beschrijving |
|--------|----------|-------------|
| `GET` | `/api/admin/dienst-config/:orgId` | Effectieve dienst-configuratie (met overerving) |
| `GET` | `/api/admin/dienst-config/:orgId/eigen` | Alleen eigen configuratie (zonder overerving) |
| `PUT` | `/api/admin/dienst-config/:orgId` | Sla configuratie op (overschrijft/maakt nieuw) |
| `DELETE` | `/api/admin/dienst-config/:orgId` | Verwijder eigen config (val terug op parent) |

### 1.2 Bezettingsprofiel (nieuw)

**Opslag:** `tenant_configurations` tabel met `config_type = 'bezettingsprofiel'`

**Schema:**

```typescript
interface BezettingsProfiel {
  orgId: string;                     // afdeling Organization UUID
  eisen: BezettingsEis[];
}

interface BezettingsEis {
  dienstCode: string;                // referentie naar DienstType.code
  rollen: RolEis[];
  totaalMinimum?: number;            // optioneel: totaal minimum ongeacht rol
}

interface RolEis {
  competentie: string;               // competentie-code, bijv. "verpleegkundige"
  minimum: number;                   // minimaal aantal medewerkers met deze competentie
  maximum?: number;                  // optioneel plafond
}
```

**Voorbeeld:**

```json
{
  "orgId": "uuid-afdeling-tulp",
  "eisen": [
    {
      "dienstCode": "vroeg",
      "rollen": [
        { "competentie": "verpleegkundige", "minimum": 2 },
        { "competentie": "verzorgende-ig", "minimum": 3 },
        { "competentie": "helpende", "minimum": 1 }
      ],
      "totaalMinimum": 6
    },
    {
      "dienstCode": "laat",
      "rollen": [
        { "competentie": "verpleegkundige", "minimum": 1 },
        { "competentie": "verzorgende-ig", "minimum": 2 }
      ],
      "totaalMinimum": 4
    },
    {
      "dienstCode": "nacht",
      "rollen": [
        { "competentie": "verpleegkundige", "minimum": 1 },
        { "competentie": "verzorgende-ig", "minimum": 1 }
      ],
      "totaalMinimum": 2
    }
  ]
}
```

**API:**

| Method | Endpoint | Beschrijving |
|--------|----------|-------------|
| `GET` | `/api/admin/bezetting/:orgId` | Bezettingsprofiel voor afdeling |
| `PUT` | `/api/admin/bezetting/:orgId` | Opslaan/bijwerken bezettingsprofiel |
| `GET` | `/api/admin/bezetting/:orgId/berekend` | Dynamische berekening op basis van zorgzwaarte |

### 1.3 Client-locatietoewijzing

**FHIR Patient extension:**

```json
{
  "url": "https://openzorg.nl/extensions/locatie-toewijzing",
  "extension": [
    {
      "url": "orgId",
      "valueString": "uuid-afdeling-tulp"
    },
    {
      "url": "afdelingNaam",
      "valueString": "Afdeling Tulp"
    },
    {
      "url": "kamer",
      "valueString": "204"
    }
  ]
}
```

Alternatief: `Patient.managingOrganization` referentie (al beschikbaar in FHIR R4). De extension biedt granulairere informatie (kamernummer). Beide worden ondersteund; de extension heeft prioriteit als aanwezig.

**API:** Bestaande `/api/clients/:id` endpoint wordt uitgebreid met locatie-toewijzing in de PATCH/PUT body.

### 1.4 Competenties

**Kern-competenties (hardcoded, shared-domain):**

```typescript
// packages/shared-domain/src/competenties.ts
export const KERN_COMPETENTIES = [
  { code: 'injecteren', naam: 'Injecteren', categorie: 'voorbehouden' },
  { code: 'catheteriseren', naam: 'Catheteriseren', categorie: 'voorbehouden' },
  { code: 'infuus-inbrengen', naam: 'Infuus inbrengen', categorie: 'voorbehouden' },
  { code: 'medicatie-iv', naam: 'Intraveneuze medicatie', categorie: 'voorbehouden' },
  { code: 'maagsonde', naam: 'Maagsonde inbrengen', categorie: 'voorbehouden' },
  { code: 'beademing', naam: 'Beademing', categorie: 'voorbehouden' },
  { code: 'defibrillatie', naam: 'Defibrillatie', categorie: 'voorbehouden' },
  { code: 'wondhechtingen', naam: 'Wondhechtingen', categorie: 'voorbehouden' },
] as const;
```

**Uitbreiding-competenties (hardcoded, optioneel per tenant):**

```typescript
export const UITBREIDING_COMPETENTIES = [
  { code: 'dementiezorg', naam: 'Dementiezorg', categorie: 'specialisatie' },
  { code: 'palliatief', naam: 'Palliatieve zorg', categorie: 'specialisatie' },
  { code: 'wondzorg', naam: 'Wondzorg', categorie: 'specialisatie' },
  { code: 'diabeteszorg', naam: 'Diabeteszorg', categorie: 'specialisatie' },
  { code: 'revalidatie', naam: 'Revalidatiezorg', categorie: 'specialisatie' },
  { code: 'psychiatrie', naam: 'Psychiatrische zorg', categorie: 'specialisatie' },
  { code: 'geriatrie', naam: 'Geriatrie', categorie: 'specialisatie' },
  { code: 'stomazorg', naam: 'Stomazorg', categorie: 'specialisatie' },
  { code: 'sondevoeding', naam: 'Sondevoeding', categorie: 'specialisatie' },
] as const;
```

**Organisatie-specifieke competenties:**

- Opslag: `tenant_configurations` met `config_type = 'competenties'`
- Schema: `{ competenties: [{ code, naam, categorie: 'organisatie' }] }`

**Per medewerker:**

- FHIR PractitionerRole extension: `https://openzorg.nl/extensions/competenties`
- Value: array van competentie-codes
- Voorbeeld: `["verpleegkundige", "injecteren", "dementiezorg", "tillift"]`

**Functieniveau-mapping:**

| Functie | Automatische competenties |
|---------|--------------------------|
| Verpleegkundige (niveau 4/5) | Alle kern-competenties |
| Verzorgende IG | Subset kern (injecteren, catheteriseren) + basis |
| Helpende | Geen kern-competenties |

**API:**

| Method | Endpoint | Beschrijving |
|--------|----------|-------------|
| `GET` | `/api/admin/competenties` | Alle competenties (kern + uitbreiding + organisatie) |
| `PUT` | `/api/admin/competenties` | Organisatie-specifieke competenties beheren |
| `GET` | `/api/medewerkers/:id/competenties` | Competenties van medewerker |
| `PUT` | `/api/medewerkers/:id/competenties` | Competenties toewijzen aan medewerker |

### 1.5 Zorgzwaarte-berekening

**Input:** Alle clienten op een afdeling met hun ZZP-klasse (uit CIZ-indicatie, opgeslagen als Coverage resource).

**Formule (vereenvoudigd, configureerbaar per tenant):**

| ZZP-klasse | FTE-factor per client | Toelichting |
|------------|----------------------|-------------|
| VV1-3 | 0.5 | Lichte zorgvraag, somatisch |
| VV4-6 | 0.8 | Gemiddelde zorgvraag, PG of somatisch |
| VV7-10 | 1.2 | Zware zorgvraag, intensieve begeleiding |

**Berekening:**

```typescript
interface ZorgzwaarteBerekening {
  orgId: string;
  afdelingNaam: string;
  clienten: {
    totaal: number;
    perZzp: Record<string, number>;    // bijv. { "VV4": 3, "VV5": 5, "VV7": 2 }
  };
  berekendeFte: {
    totaal: number;                    // gewogen som
    perDienst: {                       // verdeeld over diensten (40% vroeg, 35% laat, 25% nacht)
      vroeg: number;
      laat: number;
      nacht: number;
    };
  };
  vergelijking: {
    dienstCode: string;
    statischeNorm: number;             // uit bezettingsprofiel
    berekendeNorm: number;             // uit zorgzwaarte
    status: 'ok' | 'waarschuwing' | 'kritiek';
  }[];
}
```

**Dienstverdeling default (configureerbaar):**

| Dienst | Percentage FTE | Rationale |
|--------|---------------|-----------|
| Vroeg | 40% | Meeste zorgmomenten (ADL, medicatie, arts-contact) |
| Laat | 35% | Avondverzorging, medicatie, toezicht |
| Nacht | 25% | Bewaking, noodgevallen, minimale ADL |

**API:** `GET /api/admin/bezetting/:orgId/berekend` retourneert bovenstaande structuur.

---

## 2. AI Planning Engine

### 2.1 Modus 1: Real-time assistent

**Gedrag:** Bij elke wijziging in het rooster (dienst toewijzen, verwijderen, wijzigen) wordt automatisch een validatie uitgevoerd.

**Checks:**

| Check | Type | Voorbeeld |
|-------|------|-----------|
| Bezettingsgat | Hard | "Geen verpleegkundige ingepland voor nacht maandag" |
| Onder norm | Zacht | "2 van 3 vereiste verzorgenden ingepland voor vroeg dinsdag" |
| CAO-overtreding | Hard | "Jan Pietersen overschrijdt 48u/week met deze dienst" |
| Rusttijd | Hard | "Minder dan 11 uur rust tussen late dienst en vroege dienst" |
| Dienstlengte | Hard | "Dienst langer dan 10 uur" |
| Contracturen | Zacht | "Maria de Boer is 4 uur boven contracturen deze week" |
| Competentie-mismatch | Hard | "Helpende ingepland maar verpleegkundige vereist" |
| Dynamische bezetting | Info | "Statische norm (3) lager dan berekende behoefte (4.2) voor vroeg" |

**UI:** Sidebar panel met drie secties:
- Rood: Kritieke problemen die opgelost moeten worden
- Oranje: Waarschuwingen die aandacht verdienen
- Groen: Alles in orde

**Endpoint:**

```
POST /api/planning/validate-bezetting
Body: {
  orgId: string,
  week: string,          // ISO week, bijv. "2026-W17"
  diensten: [{
    medewerkerIds: string[],
    dienstCode: string,
    datum: string,        // ISO date
    orgId: string         // afdeling
  }]
}
Response: {
  alerts: [{
    type: 'kritiek' | 'waarschuwing' | 'info',
    categorie: 'bezetting' | 'cao' | 'competentie' | 'zorgzwaarte',
    bericht: string,
    datum?: string,
    dienstCode?: string,
    medewerkerIds?: string[]
  }],
  score: number           // 0-100, overall roosterkwaliteit
}
```

### 2.2 Modus 2: Optimaliseer

**Input:** Huidig rooster (half-ingevuld) + constraints.

**Constraint solver werking:**

1. Identificeer alle onvervulde bezettingseisen
2. Per gat: zoek beschikbare medewerkers met juiste competenties
3. Sorteer kandidaten op:
   - Beschikbaarheid (0/1 filter)
   - Competentie-match (0/1 filter)
   - Resterende contracturen (meeste ruimte eerst)
   - Eerlijkheid (minste diensten in deze periode eerst)
   - Voorkeur/continuiteit (eerder op deze afdeling gewerkt)
4. Wijs toe en valideer CAO-constraints
5. Bij conflict: backtrack en probeer volgende kandidaat

**Output:**

```typescript
interface OptimalisatieResultaat {
  wijzigingen: {
    type: 'toevoegen' | 'verplaatsen';
    medewerkerId: string;
    medewerkerNaam: string;
    van?: { datum: string; dienstCode: string; orgId: string };
    naar: { datum: string; dienstCode: string; orgId: string };
    reden: string;           // bijv. "Vult verpleegkundige-gat, heeft 12 contracturen over"
  }[];
  onoplosbaar: {
    datum: string;
    dienstCode: string;
    orgId: string;
    reden: string;           // bijv. "Geen beschikbare verpleegkundige"
  }[];
  scoreVerbetering: {
    voor: number;
    na: number;
  };
}
```

**Endpoint:**

```
POST /api/planning/optimaliseer
Body: { orgId: string, week: string }
Response: OptimalisatieResultaat
```

De planner reviewt de voorgestelde wijzigingen en accepteert/verwerpt per wijziging. Geen automatische toepassing.

### 2.3 Modus 3: Auto-genereer

**Input:** Bezettingseisen + beschikbare medewerkers (geen bestaand rooster).

**Algoritme: Greedy assignment met backtracking**

```
voor elke dag in week:
  voor elke dienst in dag (gesorteerd op moeilijkheid: nacht eerst):
    voor elke roleis in bezettingsprofiel:
      kandidaten = beschikbare medewerkers met competentie
      filter: CAO-constraints (48u, 11u rust, 10u dienst)
      filter: al ingepland op deze dag/dienst
      sorteer: contracturen-saldo, eerlijkheid, continuiteit
      wijs minimum aantal toe
    als niet vervulbaar:
      backtrack: probeer herindeling vorige dienst
      als nog steeds niet vervulbaar: markeer als onoplosbaar
```

**Prioriteit van constraints:**
1. **Hard (schending = ongeldig):** CAO 48u/week, 11u rust, 10u dienstlengte, contracttype, competentie
2. **Zacht (minimaliseer schendingen):** Eerlijkheid weekenddiensten, voorkeursdagen, team-continuiteit, afdeling-voorkeur

**Endpoint:**

```
POST /api/planning/genereer
Body: { orgId: string, week: string }
Response: {
  rooster: [{
    medewerkerId: string,
    medewerkerNaam: string,
    datum: string,
    dienstCode: string,
    orgId: string,           // afdeling
    reden: string
  }],
  onoplosbaar: [{ datum, dienstCode, orgId, reden }],
  statistieken: {
    bezettingsgraad: number,  // percentage eisen vervuld
    gemiddeldeUren: number,   // per medewerker
    eerlijheidScore: number   // 0-100, standaarddeviatie diensten
  }
}
```

Het gegenereerde rooster wordt als concept opgeslagen. Planner reviewt en publiceert.

### 2.4 LLM-integratie (optioneel)

Via bestaande Ollama-integratie (AI-chat assistent, zie spec 2026-04-16).

**Use cases:**
- "Wie kan dinsdagnacht op Tulp?" -> query beschikbare medewerkers met nacht-beschikbaarheid + competenties voor afdeling Tulp
- "Geef een samenvatting van knelpunten deze week" -> aggregate bezettingsgaten en CAO-waarschuwingen
- "Waarom kan Jan niet op woensdag vroeg?" -> check beschikbaarheid, contracturen, rusttijd
- "Ruil de dienst van Maria en Pieter op donderdag" -> valideer en voer swap uit

De LLM vertaalt natuurlijke taal naar API-calls. De constraint-solving zelf draait nooit via LLM.

---

## 3. Frontend Views

### 3.1 Bezettingsrooster (nieuwe hoofdview)

**URL:** `/planning/bezetting`

**Layout:**

```
+------------------------------------------------------------------+
| [Locatie: Verpleeghuis De Horizon v] [< Week 17 >] [Optimaliseer] [Genereer] |
+------------------------------------------------------------------+
|              | Ma 20/4      | Di 21/4      | Wo 22/4      | ...  |
|              | V  L  N      | V  L  N      | V  L  N      |      |
+--------------+--------------+--------------+--------------+------+
| Afd. Tulp    | 6  4  2      | 5  4  2      | 6  3  2      |      |
|   vereist    | 6  4  2      | 6  4  2      | 6  4  2      |      |
+--------------+--------------+--------------+--------------+------+
| Afd. Roos    | 5  4  2      | 5  4  2      | 4  4  2      |      |
|   vereist    | 5  4  2      | 5  4  2      | 5  4  2      |      |
+--------------+--------------+--------------+--------------+------+
| Afd. Lelie   | 4  3  2      | 4  3  2      | 4  3  2      |      |
|   vereist    | 4  3  2      | 4  3  2      | 4  3  2      |      |
+--------------+--------------+--------------+--------------+------+
```

**Cel-kleuring:**
- Groen (`bg-emerald-100`/`bg-emerald-900`): Bezetting >= vereist
- Oranje (`bg-amber-100`/`bg-amber-900`): Bezetting = vereist - 1 (net te weinig)
- Rood (`bg-red-100`/`bg-red-900`): Bezetting < vereist - 1 (ernstig tekort)
- Grijs (`bg-neutral-100`/`bg-neutral-800`): Geen bezettingseis ingesteld

**Interactie:**
- Klik op cel -> detail panel schuift in van rechts (AfdelingDetail)
- Hover op cel -> tooltip met namen van ingeplande medewerkers
- Drag-and-drop medewerker van beschikbaar-lijst naar cel (stretch goal)

### 3.2 Afdeling-detail (in-panel)

Schuift in als rechterpaneel wanneer een cel wordt aangeklikt.

**Inhoud:**

```
+----------------------------------------+
| Afdeling Tulp — Maandag 20/4 — Vroeg   |
+----------------------------------------+
| VEREIST           | INGEPLAND          |
| 2x Verpleegkundige | Maria de Boer     |
|                    | [leeg - TEKORT]    |
| 3x Verzorgende IG  | Jan Pietersen     |
|                    | Fatima El Amrani   |
|                    | Pieter van Dijk    |
| 1x Helpende        | Lisa Jansen       |
+----------------------------------------+
| BESCHIKBAAR & GEKWALIFICEERD           |
| Sophie Bakker (vpk) - 8u over [+ Plan] |
| Ahmed Hassan (vz)  - 12u over [+ Plan] |
+----------------------------------------+
| AI-SUGGESTIE                           |
| > Sophie Bakker inplannen als 2e vpk.  |
|   Reden: beschikbaar, 8 contracturen   |
|   over, werkte vorige week ook op Tulp |
|   [Accepteer]                          |
+----------------------------------------+
```

### 3.3 Medewerker-weekoverzicht

Bestaande rooster-view (`/planning/rooster`) wordt uitgebreid met:
- Competentie-badges naast medewerker-naam
- CAO-status indicator (uren deze week / contracturen)
- Kleurindicatie bij CAO-overtredingen
- Filter op competentie

---

## 4. Configuratie-pagina's

### 4.1 Dienst-configuratie (`/admin/dienst-config`)

**Toegang:** beheerder

**Layout:**

```
+------------------------------------------------------------------+
| Dienst-configuratie                                               |
+------------------------------------------------------------------+
| Organisatie: [Verpleeghuis De Horizon > Afdeling Tulp  v]         |
| Erft van: Verpleeghuis De Horizon [Eigen config aanmaken]         |
+------------------------------------------------------------------+
| Code    | Naam            | Start | Eind  | Kleur   | Acties     |
|---------|-----------------|-------|-------|---------|------------|
| vroeg   | Vroege dienst   | 07:00 | 15:00 | #4CAF50 | [Bewerk]   |
| laat    | Late dienst     | 15:00 | 23:00 | #FF9800 | [Bewerk]   |
| nacht   | Nachtdienst     | 23:00 | 07:00 | #3F51B5 | [Bewerk]   |
| dag     | Dagdienst       | 08:30 | 17:00 | #2196F3 | [Bewerk]   |
| weekend | Weekenddienst   | 07:00 | 19:00 | #9C27B0 | [Bewerk]   |
+------------------------------------------------------------------+
| [+ Diensttype toevoegen]                                         |
+------------------------------------------------------------------+
```

**Gedrag:**
- "Erft van" indicator toont of de afdeling eigen config heeft of erft
- "Eigen config aanmaken" kopieert parent config als startpunt
- Verwijderen van eigen config valt terug op parent
- Validatie: start/eind mogen niet overlappen (waarschuwing, geen blokkade)

### 4.2 Bezettingsprofiel (`/admin/bezetting`)

**Toegang:** beheerder

**Layout:**

```
+------------------------------------------------------------------+
| Bezetting & Normen                                                |
+------------------------------------------------------------------+
| Afdeling: [Afdeling Tulp v]                                      |
+------------------------------------------------------------------+
| Vroege dienst (07:00-15:00)                                      |
|   Verpleegkundige:  [2] minimum  | Berekend: 2.4 [!]            |
|   Verzorgende IG:   [3] minimum  | Berekend: 3.1                |
|   Helpende:         [1] minimum  | Berekend: 0.8                |
|   Totaal minimum:   [6]          | Berekend: 6.3                |
+------------------------------------------------------------------+
| Late dienst (15:00-23:00)                                        |
|   Verpleegkundige:  [1] minimum  | Berekend: 1.8 [!]            |
|   Verzorgende IG:   [2] minimum  | Berekend: 2.7 [!]            |
|   Totaal minimum:   [4]          | Berekend: 4.5 [!]            |
+------------------------------------------------------------------+
| Nachtdienst (23:00-07:00)                                        |
|   Verpleegkundige:  [1] minimum  | Berekend: 1.1                |
|   Verzorgende IG:   [1] minimum  | Berekend: 1.0                |
|   Totaal minimum:   [2]          | Berekend: 2.1                |
+------------------------------------------------------------------+
| [Opslaan]                                                        |
+------------------------------------------------------------------+
```

**[!] indicator:** Verschijnt als de statische norm lager is dan de dynamische berekening. Tooltip: "De huidige clientpopulatie (12 clienten, gem. ZZP 5.2) vereist meer personeel dan de ingestelde norm."

### 4.3 Competenties (`/admin/competenties`)

**Toegang:** beheerder

**Layout drie secties:**

**Kern (read-only):**
- Lijst voorbehouden handelingen met beschrijving
- Niet aanpasbaar, wettelijk bepaald
- Indicatie welke functieniveaus deze competenties automatisch krijgen

**Uitbreiding (aan/uit per tenant):**
- Toggle per competentie
- Uit = niet beschikbaar voor toewijzing aan medewerkers in deze organisatie
- Standaard allemaal aan

**Organisatie-specifiek (CRUD):**
- Toevoegen: code + naam
- Bewerken: naam aanpassen
- Verwijderen: alleen als niet toegewezen aan medewerkers (of: ontkoppel eerst)

**Medewerker-toewijzing:**
Via bestaande medewerker-detail pagina (`/beheer/medewerkers/:id`):
- Nieuwe tab/sectie "Competenties"
- Checkbox-lijst met alle beschikbare competenties
- Gegroepeerd per categorie (kern, uitbreiding, organisatie)
- Bulk-toewijzing op basis van functieniveau (knop "Standaard competenties op basis van functie")

---

## 5. Navigation

### Planning sectie (sidebar)

```
Planning
  Bezettingsrooster    (nieuw, hoofdview)
  Dagplanning          (bestaand)
  Medewerker rooster   (bestaand, hernoemd van "Rooster")
  Herhalingen          (bestaand)
  Beschikbaarheid      (bestaand)
  Wachtlijst           (bestaand)
```

**Permissies:** `bezetting:read` voor bekijken, `bezetting:write` voor bewerken. Toegankelijk voor: planner, beheerder, teamleider.

### Beheer sectie (sidebar)

Onder bestaande beheer-items:

```
Beheer
  ...bestaande items...
  Dienst-configuratie  (nieuw)
  Bezetting & normen   (nieuw)
  Competenties         (nieuw)
```

**Permissies:** `competenties:read`/`competenties:write`. Alleen beheerder.

---

## 6. Files to create/modify

### Backend: services/planning/src/

| Actie | Bestand | Beschrijving |
|-------|---------|-------------|
| Create | `routes/bezetting.ts` | Bezettingsrooster CRUD, validate-bezetting endpoint |
| Create | `routes/dienst-config.ts` | Dienst-configuratie CRUD met overervingslogica |
| Create | `routes/competenties.ts` | Competentie CRUD (admin) + medewerker-toewijzing |
| Create | `lib/planning-engine.ts` | Constraint solver: validate, optimaliseer, genereer |
| Create | `lib/zorgzwaarte.ts` | ZZP -> FTE berekening + dienstverdeling |
| Create | `lib/cao-engine.ts` | CAO-constraint checks (48u, 11u rust, 10u dienst, contract) |
| Modify | `app.ts` | Mount nieuwe routes: bezetting, dienst-config, competenties |

### Backend: services/ecd/src/

| Actie | Bestand | Beschrijving |
|-------|---------|-------------|
| Modify | `routes/medewerkers.ts` | GET/PUT competenties per medewerker endpoint |
| Modify | `routes/client.ts` | Locatie-toewijzing extension bij PATCH/PUT |

### Frontend: apps/web/src/

| Actie | Bestand | Beschrijving |
|-------|---------|-------------|
| Create | `app/planning/bezetting/page.tsx` | Bezettingsrooster hoofdview |
| Create | `components/planning/BezettingsGrid.tsx` | Grid component (afdelingen x dagen x diensten) |
| Create | `components/planning/BezettingsCell.tsx` | Cel met kleuring en tooltip |
| Create | `components/planning/AfdelingDetail.tsx` | Detail panel (rechts inschuivend) |
| Create | `components/planning/PlanningToolbar.tsx` | Week-navigatie + Optimaliseer/Genereer knoppen |
| Create | `app/admin/dienst-config/page.tsx` | Dienst-configuratie beheerpagina |
| Create | `app/admin/bezetting/page.tsx` | Bezettingsprofiel beheerpagina |
| Create | `app/admin/competenties/page.tsx` | Competentie beheerpagina |
| Modify | `components/AppShell.tsx` | Nieuwe navigatie-entries toevoegen |

### Shared: packages/shared-domain/

| Actie | Bestand | Beschrijving |
|-------|---------|-------------|
| Create | `src/competenties.ts` | KERN_COMPETENTIES + UITBREIDING_COMPETENTIES arrays |
| Modify | `src/roles.ts` | Nieuwe permissions: `bezetting:read`, `bezetting:write`, `competenties:read`, `competenties:write` |

### Frontend proxy: apps/web/src/app/api/

| Actie | Bestand | Beschrijving |
|-------|---------|-------------|
| Verify | `planning/[...path]/route.ts` | Controleer of proxy al alle planning-routes doorstuurt |

---

## 7. Seed data

### Afdelingen met bezettingsprofielen

```typescript
const seedAfdelingen = [
  {
    naam: 'Afdeling Tulp',
    type: 'PG',           // psychogeriatrie
    bedden: 15,
    bezetting: {
      vroeg: { verpleegkundige: 2, 'verzorgende-ig': 3, helpende: 1 },
      laat: { verpleegkundige: 1, 'verzorgende-ig': 2 },
      nacht: { verpleegkundige: 1, 'verzorgende-ig': 1 },
    },
  },
  {
    naam: 'Afdeling Roos',
    type: 'somatisch',
    bedden: 20,
    bezetting: {
      vroeg: { verpleegkundige: 2, 'verzorgende-ig': 3 },
      laat: { verpleegkundige: 1, 'verzorgende-ig': 3 },
      nacht: { verpleegkundige: 1, 'verzorgende-ig': 1 },
    },
  },
  {
    naam: 'Afdeling Lelie',
    type: 'revalidatie',
    bedden: 12,
    bezetting: {
      vroeg: { verpleegkundige: 1, 'verzorgende-ig': 2, helpende: 1 },
      laat: { verpleegkundige: 1, 'verzorgende-ig': 2 },
      nacht: { verpleegkundige: 1, 'verzorgende-ig': 1 },
    },
  },
];
```

### Dienst-configuratie

- **Tenant default:** 5 standaard diensttypen (vroeg, laat, nacht, dag, weekend)
- **Locatie-override:** Verpleeghuis De Horizon past weekend aan: 07:00-15:00 + 15:00-23:00 (twee diensten ipv een lange)

### Competenties voor 6 medewerkers

| Medewerker | Functie | Competenties |
|-----------|---------|-------------|
| Maria de Boer | Verpleegkundige | Alle kern + dementiezorg, palliatief |
| Sophie Bakker | Verpleegkundige | Alle kern + wondzorg, diabeteszorg |
| Jan Pietersen | Verzorgende IG | injecteren, catheteriseren + dementiezorg |
| Fatima El Amrani | Verzorgende IG | injecteren, catheteriseren + palliatief, stomazorg |
| Pieter van Dijk | Verzorgende IG | injecteren + revalidatie |
| Lisa Jansen | Helpende | (geen kern) |

### Client-locatietoewijzingen

12 clienten verdeeld over afdelingen:
- Afdeling Tulp: 5 clienten (ZZP VV5, VV5, VV6, VV7, VV4)
- Afdeling Roos: 4 clienten (ZZP VV3, VV4, VV4, VV5)
- Afdeling Lelie: 3 clienten (ZZP VV4, VV5, VV6)

---

## 8. Risks

### 1. Planning engine performance

**Risico:** Constraint solving voor 20+ medewerkers x 7 dagen x 3 diensten kan complex worden. Worst case: exponentieel bij veel backtracking.

**Mitigatie:**
- Greedy algorithm met bounded backtracking (max 1000 iteraties)
- Server-side timeout van 10 seconden per generatie-verzoek
- Bij timeout: retourneer best-effort rooster met lijst van onoplosbare gaten
- Caching van tussenresultaten (beschikbaarheidsmatrix)

### 2. ZZP-zorgzwaarte formule

**Risico:** De vereenvoudigde FTE-factoren (0.5 / 0.8 / 1.2) zijn een benadering. Echte behoefte verschilt per organisatie, dagdeel, en zorgsituatie.

**Mitigatie:**
- Factoren configureerbaar per tenant via `tenant_configurations`
- Dienstverdeling (40/35/25%) ook configureerbaar
- UI toont "berekend" als advies, niet als voorschrift
- Mogelijkheid om berekening uit te schakelen en alleen statische normen te gebruiken

### 3. Scope creep naar extramuraal

**Risico:** Verzoeken om routeplanning, reistijd-optimalisatie, of extramuraal-specifieke features.

**Mitigatie:**
- Expliciet out of scope in deze spec
- Feature-flag `planning.intramuraal` scheidt modules
- Gedeelde basis (contracten, beschikbaarheid, CAO, competenties) is bewust modulair opgezet
- Extramuraal krijgt eigen spec

### 4. CAO-complexiteit

**Risico:** Er zijn tientallen CAO VVT-regels. Volledige implementatie is een project op zich.

**Mitigatie:**
- Fase 1 implementeert top 4 regels:
  1. Maximaal 48 uur per week (gemiddeld over 13 weken)
  2. Minimaal 11 uur rust tussen twee diensten
  3. Maximaal 10 uur per dienst
  4. Contracturen niet overschrijden (week-basis)
- Fase 2 (later): onregelmatigheidstoeslag berekening, maximaal 5 nachtdiensten achtereen, verplichte vrije weekenden
- CAO-engine als apart bestand (`cao-engine.ts`) zodat regels makkelijk toe te voegen zijn

### 5. Multi-tenant configuratie-drift

**Risico:** Elke tenant configureert diensten, bezetting en competenties anders. Support-complexiteit stijgt.

**Mitigatie:**
- Sterke defaults (standaard diensttypen, standaard competenties)
- Overervingsmodel reduceert configuratie-overhead
- Admin-UI met duidelijke "erft van" indicatoren
- Configuratie-export/import voor nieuwe tenants
