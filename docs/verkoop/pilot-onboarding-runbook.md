# Pilot-onboarding-runbook — van handtekening naar draaiende pilot

**Voor**: verkoop + implementatie (OpenZorg) en de pilot-instelling · **Laatst bijgewerkt**: 2026-07-11
**Doel**: één genummerd draaiboek dat een getekende pilot in een paar dagen operationeel maakt, met per stap de **eigenaar** (wij / instelling / samen) en een **doorlooptijd**. Eindigt met eerlijke support-afspraken en go/no-go-criteria.

> **Scope-afbakening.** Dit runbook is het *proces*: wie doet wat, wanneer, met welke afhankelijkheden. De **technische inrichtingsstappen** (tenant aanmaken, 4 locaties + afdelingen + diensten + bezettingsprofielen configureren, zorgpaden activeren) staan in het **pilot-inrichtingsdraaiboek** — *dat document is in aanlevering (PR #36)*. Zodra het op deze branch staat, verwijst dit runbook er per stap naar; tot die tijd geldt: niet dupliceren, wél naar verwijzen.
>
> Compliance-context bij dit runbook: `docs/compliance/audit-readiness.md` (wat er staat met bewijs, wat een auditor opvraagt). Wat vandaag werkt vs. roadmap: `feature-roadmap-matrix.md`.

---

## Overzicht in één blik

| # | Stap | Eigenaar | Doorlooptijd | Blokkeert |
|---|---|---|---|---|
| 1 | Verwerkersovereenkomst tekenen (R-08) | samen | 2-6 wk (start bij intentie) | onboarding (AVG) |
| 2 | Externe randvoorwaarden aanvragen (R-01/R-02) | instelling | 4-12 wk, **parallel** | medicatieveiligheid + declaratie (post-pilot) |
| 3 | Tenant + platform-config aanmaken | wij | dag 1 | stap 4-6 |
| 4 | Organisatie-inrichting (4 locaties + diensten + bezetting) | samen | dag 1-2 | planning + import |
| 5 | CSV-cliëntimport (~80 cliënten) | instelling levert, wij importeren | dag 2 | dossier + planning gevuld |
| 6 | Accounts + rollen | wij, met input instelling | dag 2 | gebruikers kunnen inloggen |
| 7 | Zorgpaden + taakformulieren afstemmen | samen | week 1 | processen passen bij werkwijze |
| 8 | Schaduwdraaien + evaluatiemomenten | instelling, wij ondersteunen | week 2-6 | go/no-go-beslissing |
| 9 | Go/no-go | samen | einde week 6 | productie-besluit |

De stappen 1 en 2 starten het vroegst (kalenderdoorlooptijd); de stappen 3-6 zijn de eigenlijke technische opstart (dag 1-2); 7-8 zijn het inregelen en beproeven.

---

## De stappen

### 1 · Verwerkersovereenkomst (R-08) — *samen, 2-6 weken, start direct*

- **Wat**: de AVG-verwerkersovereenkomst (art. 28) tussen de instelling (verwerkingsverantwoordelijke) en OpenZorg (verwerker) wordt getekend. Dit is een harde voorwaarde vóór er ook maar één cliëntgegeven de tenant in gaat.
- **Wij**: leveren het template-concept, afgestemd op de Stichting + B.V.-structuur (ADR-006).
- **Instelling**: laat het juridisch toetsen en tekent.
- **Let op**: het template moet juridisch getoetst zijn (R-08). Start dit bij de intentie tot pilot, niet pas bij de kick-off — de doorlooptijd (2-6 wk) loopt anders op het kritieke pad.
- **Verwijzing**: compliance-dossier §4 (documentenregister, #7) en §3.

### 2 · Externe randvoorwaarden aanvragen (R-01 / R-02) — *instelling, 4-12 weken, parallel*

- **Wat**: de instelling start de aanvragen die maanden doorlooptijd hebben, zodat ze klaar zijn tegen de tijd dat de bijbehorende functies aan de beurt zijn. Deze onderdelen zitten **niet** in de pilot-functionaliteit — ze bereiden de vervolgstappen voor.
  - **R-01 — KNMP G-Standaard** (4-8 wk, €2.000-€8.000/jaar per tenant): nodig voor medicatieveiligheid.
  - **R-02 — Vecozo-certificaat + AGB-aansluiting** (6-12 wk, €500-€1.500/jaar per AGB-organisatie): nodig voor SBV-Z, declaratie (Vektis/iWlz) en G-Standaard-transport.
- **Instelling**: dient de aanvragen in (het zijn organisatie-gebonden certificaten/licenties).
- **Wij**: leveren de technische aansluitgegevens en begeleiden.
- **Eerlijk kader**: zolang deze niet rond zijn, doet de pilot **medicatie-registratie** (geen bewaking) en **geen** declaratie naar het zorgkantoor. Dat is bekend en bewust — zie `feature-roadmap-matrix.md`.

### 3 · Tenant + platform-config — *wij, dag 1*

- **Wat**: wij maken de pilot-tenant aan (Medplum-project + PostgreSQL-tenant met RLS), zetten de master-configuratie en feature-flags, en koppelen de tenant-AI-instellingen (lokale Ollama) indien de instelling de AI-assistent wil.
- **Wij**: voeren dit uit; het is één keer werk aan onze kant.
- **Verwijzing**: technische stappen in het **pilot-inrichtingsdraaiboek** (in aanlevering, PR #36).

### 4 · Organisatie-inrichting — *samen, dag 1-2*

- **Wat**: de structuur van Zorggroep-Horizon-type wordt ingericht: **4 locaties** met hun afdelingen, de **dienst-configuratie** (welke diensten per locatie/afdeling) en de **bezettingsprofielen** (minimale bezetting per dienst per competentie), inclusief intramurale afdelingen én het thuiszorg-team.
- **Instelling**: levert de feitelijke structuur (locaties, afdelingen, diensten, minimale bezetting, competenties).
- **Wij**: voeren de inrichting uit in de configuratieschermen (`/admin/organisatie`, `/admin/dienst-config`, `/admin/bezetting`, `/admin/competenties`, `/admin/medewerkers`) samen met de beheerder van de instelling, zodat die het daarna zelf kan.
- **Verwijzing**: stap-voor-stap in het **pilot-inrichtingsdraaiboek** (in aanlevering, PR #36) — hier niet dupliceren.

### 5 · CSV-cliëntimport (~80 cliënten) — *instelling levert, wij importeren, dag 2*

- **Wat**: het cliëntenbestand wordt in één keer opgevoerd via de CSV-import — de pilot-belofte "**80 cliënten in minuten**".
- **Instelling**: levert een export met de vaste kolommen (`achternaam;voornaam;geboortedatum;bsn;straat;huisnummer;postcode;plaats;locatie`). Het downloadbare voorbeeldbestand op de importpagina (`/ecd/import`) is het formaat.
- **Wij**: importeren, lopen het **foutenrapport** per rij na (bv. BSN die de elfproef niet haalt, of een locatienaam die nog niet bestaat) en corrigeren samen met de instelling.
- **Bewijs dat dit werkt**: `apps/web/tests/e2e/client-import.spec.ts` (import met een foute rij → bruikbaar rapport → geslaagde rijen in de lijst) + testplan §3-F.
- **Let op**: dit is één vast formaat, geen mapping-wizard en geen automatische overname uit een bestaand systeem (dat is roadmap, gap-analyse I-05). Zorg dat de export vooraf op het formaat is gebracht.

### 6 · Accounts + rollen — *wij, met input van de instelling, dag 2*

- **Wat**: de medewerkers van de pilot krijgen een account met de juiste, aan hun Practitioner-profiel **gekoppelde rol** (zorgmedewerker, planner, teamleider, functioneel beheerder, tenant-admin). Sinds de identiteitslaag bepaalt de server de rol — geen vrije rolkeuze meer.
- **Instelling**: levert de lijst wie welke rol krijgt.
- **Wij**: maken de accounts aan en koppelen de rollen.
- **Bewijs**: `auth-helper.spec.ts` (account met gekoppelde server-rol toont geen demo-rol-markering); rolmatrix `packages/shared-domain/src/roles.ts` (compliance-dossier §2.2).

### 7 · Zorgpaden + taakformulieren afstemmen — *samen, week 1*

- **Wat**: de zorgpaden (intake, zorgplan-evaluatie, MIC-afhandeling e.a.) worden **geactiveerd** en de **taakformulieren** afgestemd op de werkwijze van de instelling — velden en keuzelijsten aanpassen zonder nieuwe release.
- **Instelling**: beschrijft de eigen werkwijze (welke stappen, wie doet wat, welke velden).
- **Wij**: activeren de zorgpaden via de Processen-hub (`/admin/workflows`) en passen de taakformulieren aan (`/admin/task-form-options`), en dragen dit over aan de beheerder.
- **Bewijs**: `admin-processen.spec.ts` (hub + sjablonen), `proces-keten.spec.ts` (de volledige keten), testplan §3-C/D/G.
- **Let op**: Beslisregels/DMN blijven op **"Experimenteel"** — niet inzetten in de pilot-werkwijze.

### 8 · Schaduwdraaien + evaluatiemomenten — *instelling, wij ondersteunen, week 2-6*

- **Wat**: de instelling gaat OpenZorg **naast** het bestaande systeem gebruiken (schaduwdraaien), niet in plaats van — zo is er geen risico voor de zorgcontinuïteit terwijl we samen leren.
- **Ritme**: wekelijks evaluatiemoment (30-45 min) met de beheerder/teamleider: wat ging goed, waar liep men vast, welke bevindingen. Bevindingen krijgen een testnummer-stijl-notitie (zie testplan §4) zodat ze traceerbaar zijn.
- **Wij**: verhelpen bevindingen, leveren updates, houden het compliance-dossier en de roadmap-matrix actueel.
- **Instelling**: gebruikt het systeem realistisch (rapporteren, plannen, processen doorlopen) en levert feedback.

### 9 · Go/no-go — *samen, einde week 6*

Beslis op basis van concrete criteria, niet op onderbuik:

- **GO-criteria**:
  1. De **kernflows** draaien in de praktijk van de instelling: inloggen per rol, cliëntdossier + rapportage, planning (rooster/dagplanning), en de **proces-keten** (nieuwe cliënt → taak → afronden → voortgang). Elk van deze is in CI bewezen (zie bewijsregister in `demo-script.md`).
  2. De **CSV-import** heeft het cliëntenbestand correct opgevoerd; openstaande foutrijen zijn opgelost.
  3. De **verwerkersovereenkomst** (R-08) is getekend en de **support-afspraken** (zie hieronder) zijn belegd.
  4. Bevindingen uit het schaduwdraaien zijn afgehandeld of hebben een afgesproken planning.
- **NO-GO / uitstel-signalen**:
  1. Een kernflow blijft in de praktijk haperen (niet reproduceerbaar op te lossen binnen de pilot).
  2. Randvoorwaarden voor de beoogde productie-scope (bv. declaratie → R-04/R-05, medicatieveiligheid → R-01/R-02) zijn nog niet rond terwijl de instelling die vanaf dag 1 productief nodig heeft.
  3. De operationele support (R-06) is nog niet op productie-niveau — dan blijft de pilot in schaduw-/pilotmodus tot dat wél zo is.

---

## Support-afspraken — het eerlijke deel (R-06)

Een instelling kan niet zonder betrouwbare support voor een productie-ECD. Dit hoort expliciet besproken te worden vóór de pilot productief wordt:

- **R-06 — Operational readiness** (backup-cron, on-call, runbook, support-SLA) is **procesueel/organisatorisch**, geen feature. Het staat **niet** automatisch met de software mee — het moet actief opgetuigd worden en is een continue FTE-inspanning.
- **Wat er vandaag staat**: backup- en restore-scripts met een **geteste restore**, een deploy-runbook (`docs/deployment-production.md`), healthchecks en herstart-beleid. *Wat nog niet actief is*: de productie-backup-cron en off-host-kopie (wacht op de live-server), en een formele 24/7-support-SLA.
- **Voor de pilot** (schaduwdraaien): support in kantooruren met een afgesproken reactietijd volstaat, mits het schaduwdraaien is en er geen zorgcontinuïteit van afhangt.
- **Voor echte productie**: de commerciële B.V.-laag (ADR-006) moet de 24/7-support, monitoring en incidentafhandeling invullen. Het open-source-community-model dekt dit niet. Dit is een expliciete voorwaarde in de go/no-go (criterium 3, NO-GO-signaal 3).
- **Verwijzing**: compliance-dossier §1 (R-06/R-07-kader) en §3 (backup-cron M-05, incidentproces).

---

## Verantwoordelijkhedenmatrix (RACI-licht)

| Onderwerp | OpenZorg (wij) | Instelling |
|---|---|---|
| Verwerkersovereenkomst-template | opstellen | juridisch toetsen + tekenen |
| G-Standaard / Vecozo / AGB (R-01/R-02) | technisch begeleiden | aanvragen + bekostigen |
| Tenant + platform-config | uitvoeren | — |
| Organisatiestructuur (locaties/diensten/bezetting) | inrichten in het systeem | aanleveren + valideren |
| Cliëntbestand (CSV) | importeren + fouten nalopen | export op formaat leveren |
| Accounts + rollen | aanmaken + koppelen | rollenlijst leveren |
| Zorgpaden + taakformulieren | activeren + afstemmen | werkwijze beschrijven |
| Schaduwdraaien | ondersteunen + fixen | dagelijks gebruiken + feedback |
| Support tijdens pilot | leveren (kantooruren) | melden via afgesproken kanaal |
| Productie-support (R-06) | opzetten (B.V.-laag) | afnemen |

*Prijs- en contractafspraken (inclusief support-SLA-tarieven) lopen separaat en staan bewust buiten dit runbook (spec §10) — prijsafspraken: separaat.*
