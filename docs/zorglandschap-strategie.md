# Zorglandschap-Strategie: Van VVT naar Heel Nederland

> Versie 1.0 — 10 april 2026
> Status: Strategisch visiestuk
> Doelgroep: Investeerders, CTO, architectuurteam, product owners

OpenZorg is een open-source, FHIR-native zorgplatform. Vandaag bedienen we de VVT-sector. Morgen de hele Nederlandse zorg. Dit document beschrijft **hoe** we dat doen — niet door een monoliet uit te rollen, maar door een modulaire kern te bouwen waarop sectorspecifieke modules als bouwstenen worden gestapeld. Elke zorgorganisatie krijgt precies wat ze nodig heeft. Niets meer, niets minder.

---

## Inhoudsopgave

1. [Het Nederlandse Zorglandschap](#1-het-nederlandse-zorglandschap)
2. [Wat is gemeenschappelijk — de OpenZorg Kern](#2-wat-is-gemeenschappelijk--de-openzorg-kern)
3. [Wat verschilt per sector — Sectormodules](#3-wat-verschilt-per-sector--sectormodules)
4. [Modulaire Architectuur](#4-modulaire-architectuur)
5. [Onboarding per Sector](#5-onboarding-per-sector)
6. [Marktstrategie — Waarom Open Source Wint](#6-marktstrategie--waarom-open-source-wint)
7. [Roadmap — Van VVT naar Heel Nederland](#7-roadmap--van-vvt-naar-heel-nederland)

---

## 1. Het Nederlandse Zorglandschap

De Nederlandse gezondheidszorg is verdeeld in drie hoofddomeinen: **Care** (langdurige zorg), **Cure** (geneeskundige zorg) en **Overig** (aanvullende zorgvormen). Elk domein kent eigen financieringswetten, primaire processen, en softwarebehoeften.

### 1.1 Care — Langdurige Zorg

#### VVT: Verpleging, Verzorging, Thuiszorg

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Ouderenzorg (verpleeghuizen), wijkverpleging, thuiszorg, hospicezorg |
| **Financiering** | Wlz (intramurale ouderenzorg), Zvw (wijkverpleging), Wmo (huishoudelijke hulp, begeleiding) |
| **Primair proces** | Langdurig zorgplan met leefgebieden, dagelijkse rapportage (SOEP), indicatieverwerking, medicatieverstrekking |
| **Kenmerkende ECD-behoeften** | Zorgplan per leefgebied, cliëntdossier, SOEP-rapportage, MIC-meldingen, Wzd-registratie, planning/roostering, iWlz-berichtenverkeer |
| **Marktomvang** | ~2.700 VVT-organisaties, ~400.000 medewerkers, ~€22 miljard per jaar |
| **Huidige ECD-leveranciers** | Ons (marktleider intramurale VVT), Ecare (thuiszorg), Lable Care, Puur, Fierit (Cerner), Unit4 Care |

#### GHZ: Gehandicaptenzorg

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Verstandelijk gehandicaptenzorg (VG), lichamelijk gehandicaptenzorg (LG), zintuiglijk gehandicaptenzorg (ZG) |
| **Financiering** | Wlz (langdurig verblijf), Wmo (ambulante begeleiding, dagbesteding), Zvw (behandeling), Jeugdwet (kinderen <18) |
| **Primair proces** | Ondersteuningsplan (niet zorgplan), persoonsgericht, ontwikkelingsgericht, dagbesteding, arbeidsmatige activiteiten |
| **Kenmerkende ECD-behoeften** | Ondersteuningsplan, gedragsanalyse, dagbesteding, ZZP-registratie, groepszorg, MDO-verslaglegging |
| **Marktomvang** | ~700 organisaties, ~170.000 medewerkers, ~€12 miljard per jaar |
| **Huidige ECD-leveranciers** | Ons, Ecare, CarinZorgt, ONS (GHZ-variant), Pluriforms |

#### GGZ Langdurig: Beschermd Wonen, RIBW, Klinisch

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Beschermd wonen (RIBW), langdurig klinische GGZ, forensische GGZ (tbs) |
| **Financiering** | Wlz (langdurig klinisch), Wmo (beschermd wonen), Zvw (behandeling), Forensisch: justitie |
| **Primair proces** | Behandelplan + herstelgericht werken, medicatiebeheer, crisispreventie, rehabilitatie |
| **Kenmerkende ECD-behoeften** | Behandelplan, ROM-metingen, medicatiebewaking, crisiskaart, Wvggz/Wzd-registratie |
| **Marktomvang** | Onderdeel van GGZ-markt (~€8 miljard totaal), ~80 RIBW/beschermd wonen organisaties |
| **Huidige ECD-leveranciers** | Topicus (GGZ-marktleider), User (Xmcare), Adapcare |

### 1.2 Cure — Geneeskundige Zorg

#### Ziekenhuizen

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | UMC's (8 academische centra), topklinische ziekenhuizen (~28), algemene ziekenhuizen (~50), ZBC's (zelfstandige behandelcentra) |
| **Financiering** | Zvw (DBC/DOT-systematiek), aanvullend: onderzoeksgelden (UMC), WMO (PAAZ) |
| **Primair proces** | Diagnostiek, behandeling, operaties, polikliniek, spoedeisende hulp, klinische opname |
| **Kenmerkende ECD-behoeften** | Order-entry (lab, radiologie), DBC-registratie, OK-planning, polikliniekagenda, SEH-triage, verpleegkundige overdracht, medicatievoorschrift |
| **Marktomvang** | ~80 ziekenhuislocaties, ~300.000 medewerkers, ~€30 miljard per jaar |
| **Huidige ECD-leveranciers** | HiX (ChipSoft, ~65% markt), Epic (UMC's), SAP/Cerner, IZIT |

#### GGZ Kort: Basis- en Gespecialiseerde GGZ

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Basis GGZ (huisarts+POH-GGZ, kortdurend), gespecialiseerde GGZ (ambulant, klinisch), crisiszorg |
| **Financiering** | Zvw (zorgprestatiemodel per 2022, voorheen DBC/DBBC) |
| **Primair proces** | Intake, diagnostiek (DSM-5), behandelplan, therapiesessies, ROM-meting, evaluatie, afsluiting |
| **Kenmerkende ECD-behoeften** | Behandelplan, ROM-vragenlijsten (OQ-45, SQ-48, PHQ-9), DBC/DBBC-registratie, GAF/HoNOS scores, groepsbehandeling, e-health integratie |
| **Marktomvang** | ~4.000 GGZ-aanbieders (incl. vrijgevestigden), ~95.000 medewerkers, ~€8 miljard per jaar |
| **Huidige ECD-leveranciers** | Topicus/Gerimedica, User (Xmcare), Medicore, Fierit, PsychIT |

#### Huisartsenzorg

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Huisartspraktijken (solo/duo/groep), gezondheidscentra, huisartsenposten (HAP), POH-GGZ/somatiek |
| **Financiering** | Zvw (inschrijftarief + consulttarief + M&I verrichtingen + ketenzorg DBC's) |
| **Primair proces** | Consultvoering (SOEP), verwijzing, voorschrijven, ketenzorg (diabetes, COPD, CVRM), triage |
| **Kenmerkende ECD-behoeften** | HIS-functionaliteit (ICPC-codering, SOEP), e-recept (EVS), lab-aanvragen, verwijsbrieven, ketenzorg modules |
| **Marktomvang** | ~5.000 praktijken, ~13.000 huisartsen, ~€4 miljard per jaar |
| **Huidige ECD-leveranciers** | Pharmapartners (Medicom), ChipSoft (Microhis), Promedico ASP, CGM |

#### Revalidatie

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Medisch specialistische revalidatie (MSR), geriatrische revalidatiezorg (GRZ) |
| **Financiering** | Zvw (DBC-systematiek voor MSR), Wlz (GRZ via Wlz-zorgprofiel) |
| **Primair proces** | Multidisciplinair behandelplan, doelgericht trainen, functionele diagnostiek, meetinstrumenten |
| **Kenmerkende ECD-behoeften** | Multidisciplinair behandelplan, ICF-registratie, meetinstrumenten (FIM, BI), teamoverleg, doelregistratie |
| **Marktomvang** | ~20 revalidatiecentra + revalidatie-afdelingen in ziekenhuizen, ~€1,5 miljard per jaar |
| **Huidige ECD-leveranciers** | HiX (ChipSoft), Epic, Pluriforms |

### 1.3 Overig

#### Jeugdzorg

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Jeugd-GGZ, jeugdhulp (ambulant/residentieel), jeugdbescherming (voogdij, OTS), jeugdreclassering |
| **Financiering** | Jeugdwet (gemeente-inkoop), soms Zvw (basis-GGZ jeugd) |
| **Primair proces** | Gezinsplan, veiligheidsplan, hulpverleningsplan, gezinsvoogdij, beschermingstafel |
| **Kenmerkende ECD-behoeften** | Gezinsplan, Signs of Safety, DSMB/RJ-registratie, iJW-berichtenverkeer, caseload management |
| **Marktomvang** | ~2.000 jeugdzorgaanbieders, ~30.000 medewerkers, ~€5 miljard per jaar |
| **Huidige ECD-leveranciers** | Topicus (Jeugd), Kei-IT, Fierce, Fierit |

#### Kraamzorg

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Kraamzorg aan huis, kraamhotels, prenatale zorg |
| **Financiering** | Zvw (verloskundig systeem) |
| **Primair proces** | Intake zwangere, partusassistentie, kraambed (8-10 dagen), JGZ-overdracht |
| **Kenmerkende ECD-behoeften** | Verloskundig dossier (Perined), partusverslag, observatielijsten moeder+kind, materiaalregistratie |
| **Marktomvang** | ~70 kraamzorgorganisaties, ~€0,5 miljard per jaar |
| **Huidige ECD-leveranciers** | CareByte, KraamZorgCompleet, ONS Kraam |

#### Paramedisch

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Fysiotherapie, ergotherapie, logopedie, dietetiek, podotherapie, oefentherapie |
| **Financiering** | Zvw (aanvullende verzekering + basispakket bij chronisch), Wmo (indicatie), Wlz (intramuraal) |
| **Primair proces** | Verwijzing, intake, behandelplan, behandelsessies, evaluatie, afsluiting |
| **Kenmerkende ECD-behoeften** | Behandelplan, meetinstrumenten (VAS, ROM), KNGF-richtlijnen (fysio), declaratie (Vektis), verwijzing huisarts |
| **Marktomvang** | ~20.000 praktijken (fysio alleen al ~9.000), ~€3 miljard per jaar |
| **Huidige ECD-leveranciers** | Intramed (marktleider fysio), FysioManager, Neofix, Practice |

#### Apotheek

| Kenmerk | Details |
|---------|---------|
| **Subsectoren** | Openbare apotheek, ziekenhuisapotheek, poliklinische apotheek |
| **Financiering** | Zvw (receptregelvergoeding + materiaalkosten) |
| **Primair proces** | Receptverwerking, medicatiebewaking (G-standaard), bereiding, terhandstelling, farmaceutische patiëntenzorg |
| **Kenmerkende ECD-behoeften** | Apotheek-informatiesysteem (AIS), G-standaard integratie, medicatiebewaking, LSP-aansluiting, robotsturing |
| **Marktomvang** | ~2.000 openbare apotheken, ~80 ziekenhuisapotheken, ~€5 miljard per jaar |
| **Huidige ECD-leveranciers** | Pharmapartners (Pharmacom), CGM, Mosadex, iSoft (Baxter) |

### Totaaloverzicht Financieringsstromen

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NEDERLANDSE ZORGFINANCIERING                      │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│     Wlz      │     Zvw      │     Wmo      │      Jeugdwet          │
│  Langdurige  │  Curatieve   │  Maatschap-  │   Jeugdhulp &          │
│    zorg      │    zorg      │  pelijke     │   jeugdbescherming     │
│              │              │  ondersteu-  │                        │
│              │              │  ning        │                        │
├──────────────┼──────────────┼──────────────┼────────────────────────┤
│ • VVT        │ • Ziekenhuis │ • VVT (Wmo)  │ • Jeugd-GGZ            │
│   (intramur.)│ • GGZ kort   │ • GHZ        │ • Jeugdhulp            │
│ • GHZ        │ • Huisarts   │   (ambulant) │ • Jeugdbescherming     │
│   (intramur.)│ • Wijkverpl. │ • Beschermd  │ • GHZ <18              │
│ • GGZ lang   │ • Revalidatie│   wonen      │                        │
│              │ • Kraamzorg  │              │                        │
│              │ • Paramedisch│              │                        │
│              │ • Apotheek   │              │                        │
├──────────────┼──────────────┼──────────────┼────────────────────────┤
│  CIZ-indicat.│  Verzekeraars│  Gemeenten   │  Gemeenten             │
│  Zorgkantoor │  NZa-tarieven│  Eigen beleid│  Eigen inkoop          │
└──────────────┴──────────────┴──────────────┴────────────────────────┘
```

### Marktomvang per Sector (geschat, per jaar)

| Sector | Omzet zorg | Geschatte IT-spend (2-4%) | ECD-markt |
|--------|-----------|--------------------------|-----------|
| Ziekenhuizen | €30 mrd | €600-1.200 mln | €300+ mln |
| VVT | €22 mrd | €440-880 mln | €200+ mln |
| GHZ | €12 mrd | €240-480 mln | €100+ mln |
| GGZ (totaal) | €8 mrd | €160-320 mln | €80+ mln |
| Jeugdzorg | €5 mrd | €100-200 mln | €50+ mln |
| Apotheek | €5 mrd | €100-200 mln | €40+ mln |
| Huisarts | €4 mrd | €80-160 mln | €60+ mln |
| Paramedisch | €3 mrd | €60-120 mln | €30+ mln |
| Revalidatie | €1,5 mrd | €30-60 mln | €15+ mln |
| Kraamzorg | €0,5 mrd | €10-20 mln | €5+ mln |
| **Totaal** | **~€91 mrd** | **~€1,8-3,6 mrd** | **~€900+ mln** |

> De Nederlandse zorg-IT markt is bijna een **miljard euro per jaar** aan ECD-licenties. Dit is het speelveld.

---

## 2. Wat is gemeenschappelijk — de OpenZorg Kern

Ondanks de enorme diversiteit in de zorg, deelt elke sector een fundamentele set van processen en datastructuren. Dit is de **OpenZorg Kern** — het fundament waarop alle sectormodules worden gebouwd.

### Kern-capabilities en FHIR-mapping

| Capability | Omschrijving | FHIR Resources | Alle sectoren? |
|------------|-------------|----------------|----------------|
| **Persoon registratie** | Client/patient met BSN, NAW, contactgegevens, verzekering | `Patient`, `Coverage` | Ja |
| **Zorgverlener registratie** | Medewerker met AGB/BIG-nummer, kwalificaties, rollen | `Practitioner`, `PractitionerRole` | Ja |
| **Organisatiestructuur** | Afdelingen, teams, locaties, hiërarchie | `Organization`, `Location` | Ja |
| **Contactpersonen** | Familie, wettelijk vertegenwoordiger, mantelzorger | `RelatedPerson` | Ja |
| **Rapportage/dossier** | Observaties, notities, documenten, beeldmateriaal | `Observation`, `DocumentReference`, `Binary` | Ja |
| **Planning & roostering** | Diensten, beschikbaarheid, afspraken | `Schedule`, `Slot`, `Appointment` | Ja |
| **Toegangsbeheer** | Rollen, rechten, inloggen, sessies | RBAC + `AuditEvent` | Ja |
| **Audit trail** | Wie heeft wat wanneer gedaan/gezien | `AuditEvent`, `Provenance` | Ja |
| **Berichtenverkeer** | Notificaties, taken, interne berichten | `Communication`, `Task` | Ja |
| **Facturatie basis** | Declaraties aanmaken, indienen, status volgen | `Claim`, `ClaimResponse` | Ja |
| **Configuratie engine** | Custom velden, validatieregels, formulieren | OpenZorg-specifiek (drie-laags model) | Ja |
| **Workflow engine** | BPMN-processen, taken, goedkeuringsflows | Flowable + `Task` | Ja |

### Architectuurprincipes van de Kern

```
┌──────────────────────────────────────────────────────────────┐
│                     OpenZorg Kern                             │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Patient  │ │Practitio-│ │Organiza- │ │  Audit   │       │
│  │ Register │ │ner Reg.  │ │tion Mgmt │ │ & Auth   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Planning &│ │Rapportage│ │Configura-│ │Facturatie│       │
│  │Roostering│ │& Dossier │ │tie Engine│ │  Basis   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌──────────┐ ┌──────────┐                                  │
│  │Berichten-│ │ Workflow  │   FHIR R4 + Zib-profielen       │
│  │ verkeer  │ │  Engine   │   Multi-tenant (RLS + Projects) │
│  └──────────┘ └──────────┘   API-first (Hono)               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### FHIR-profielen: gedeeld vs. sectorspecifiek

De kern gebruikt de **nl-core** FHIR-profielen (Nictiz):
- `nl-core-Patient` (BSN, naamgebruik, adres conform BRP)
- `nl-core-Practitioner` (AGB, BIG, specialisme)
- `nl-core-Organization` (AGB, KvK, UZOVI)
- `nl-core-ContactPerson` (relatie, rol)

Sectormodules voegen hier sectorspecifieke profielen en extensions aan toe (zie sectie 3).

### Drie-laags configuratiemodel (bestaand, kern-breed)

| Laag | Scope | Voorbeeld |
|------|-------|-----------|
| **Kern (L1)** | Onwijzigbaar, wettelijk verplicht | BSN elfproef, AGB-validatie, verplichte Zib-velden |
| **Uitbreiding (L2)** | Tenant-configureerbaar | Extra velden, validatieregels, workflow-definities |
| **Plugin (L3)** | Sectorspecifieke uitbreidingen | VVT-leefgebieden, GGZ-ROM instrumenten, ziekenhuis-DBC |

> **Kernprincipe:** De kern is sectoragnostisch. Een VVT-organisatie en een GGZ-instelling draaien dezelfde kern. Het verschil zit in de actieve modules.

---

## 3. Wat verschilt per sector — Sectormodules

Elke sector heeft unieke zorgprocessen, registratie-eisen en declaratiestandaarden. Deze worden geïsoleerd in **sectormodules** die alleen worden gedeployed wanneer een tenant ze nodig heeft.

### 3.1 VVT-module (huidige focus)

**Package:** `packages/module-vvt`
**Status:** In ontwikkeling (Sprint 1-3 compleet, Sprint 4 gepland)

| Component | Omschrijving | FHIR Resources/Extensions |
|-----------|-------------|--------------------------|
| **Zorgplan** | 12 leefgebieden (Zib ZorgplanActiviteit), doelen, acties, evaluatie | `CarePlan`, `Goal`, `ServiceRequest` + ext: `openzorg-leefgebied` |
| **Indicatieverwerking** | CIZ/Wlz-indicatie, Wmo-beschikking, Zvw-indicatie verwerken | `ServiceRequest` + ext: `openzorg-indicatie` |
| **SOEP-rapportage** | Subjectief, Objectief, Evaluatie, Plan — gestructureerde rapportage | `Observation` + ext: `soep-subjectief`, `soep-objectief`, `soep-evaluatie`, `soep-plan` |
| **MIC-meldingen** | Meldingen Incidenten Client — ernst, type, analyse, maatregelen | `AuditEvent` + ext: `mic-ernst` |
| **Wzd-registratie** | Wet zorg en dwang — onvrijwillige zorg, vrijheidsbeperkende maatregelen | `Procedure` + ext: `openzorg-wzd-maatregel` |
| **AW319/AW320** | Vektis-declaratiestandaard voor Wlz-zorg | `Claim` + sectorspecifieke coding |
| **iWlz-berichten** | Berichtenverkeer met zorgkantoren (indicatie, mutatie, verantwoording) | `MessageHeader`, `Bundle` |
| **Wachtlijst** | Aanmelding, beoordeling, plaatsing (BPMN-workflow) | `ServiceRequest` (status: draft → active) |

### 3.2 GGZ-module (toekomstig)

**Package:** `packages/module-ggz`
**Status:** Gepland 2027 H1

| Component | Omschrijving | FHIR Resources/Extensions |
|-----------|-------------|--------------------------|
| **Behandelplan** | Doelgericht behandelplan (anders dan zorgplan — focus op herstel, niet onderhoud) | `CarePlan` + ext: `openzorg-behandeldoel`, `openzorg-behandelfase` |
| **ROM-vragenlijsten** | Routine Outcome Monitoring (OQ-45, SQ-48, PHQ-9, GAD-7, AUDIT, MATE) | `Questionnaire`, `QuestionnaireResponse` |
| **DBC/DBBC-registratie** | Diagnose Behandel Combinatie — openingsdatum, diagnoseas, verrichtingen | `EpisodeOfCare`, `Encounter`, `Condition` (DSM-5 codering) |
| **Crisiskaart** | Door client opgesteld: wat te doen bij crisis, contactpersonen, voorkeuren | `CarePlan` (type: crisis) + ext: `openzorg-crisiskaart` |
| **GAF/HoNOS scores** | Global Assessment of Functioning, Health of the Nation Outcome Scales | `Observation` (coding: GAF/HoNOS) |
| **Medicatiebewaking** | Voorschrijven, interactiecontrole, bijwerkingen, G-standaard | `MedicationRequest`, `MedicationAdministration`, `DetectedIssue` |
| **Wvggz/Wzd** | Wet verplichte GGZ — zorgmachtiging, crisismaatregel, verplichte zorg | `Procedure` + ext: `openzorg-wvggz-maatregel` |
| **GGZ-facturatie** | Zorgprestatiemodel, DIS-aanlevering, Grouper-integratie | `Claim` + sectorspecifieke coding |
| **E-health integratie** | Online behandelmodules, beeldbellen, huiswerkopdrachten | `Task`, `Communication` |

### 3.3 Ziekenhuis-module (toekomstig)

**Package:** `packages/module-ziekenhuis`
**Status:** Gepland 2028 H2

| Component | Omschrijving | FHIR Resources/Extensions |
|-----------|-------------|--------------------------|
| **Order-entry** | Lab-aanvragen, radiologie-aanvragen, pathologie, microbiologie | `ServiceRequest`, `DiagnosticReport`, `Specimen` |
| **DBC-registratie** | DOT-systematiek, zorgproducten, DBC-regels, Grouper | `EpisodeOfCare`, `Encounter`, `Claim` |
| **OK-planning** | Operatiekamer planning, pre-operatieve checklist, anesthesie | `Appointment`, `Procedure` + ext: `openzorg-ok-planning` |
| **Verpleegkundige overdracht** | SBAR-methodiek (Situation, Background, Assessment, Recommendation) | `Communication` + ext: `openzorg-sbar` |
| **Polikliniek-agenda** | Spreekuurplanning, wachttijdregistratie, verwijzingen | `Schedule`, `Slot`, `Appointment`, `ServiceRequest` |
| **SEH-triage** | Manchester Triage Systeem (MTS) — urgentiebepaling, behandelspoor | `Encounter` + ext: `openzorg-mts-urgentie` |
| **Ziekenhuis-facturatie** | DBC/DOT Grouper, add-ons, IC-registratie, dure geneesmiddelen | `Claim` + sectorspecifieke coding |
| **Medicatievoorschrift** | Elektronisch voorschrijven, CPOE, G-standaard, interactiecontrole | `MedicationRequest`, `MedicationDispense` |

### 3.4 GHZ-module (toekomstig)

**Package:** `packages/module-ghz`
**Status:** Gepland 2027 H2

| Component | Omschrijving | FHIR Resources/Extensions |
|-----------|-------------|--------------------------|
| **Ondersteuningsplan** | Persoonsgericht plan (niet zorgplan) — wensen, mogelijkheden, ondersteuning | `CarePlan` + ext: `openzorg-ondersteuningsdomein` |
| **Gedragsanalyse** | ABC-registratie, functieanalyse, begeleidingsadviezen | `Observation` + ext: `openzorg-gedragsanalyse` |
| **Dagbesteding** | Activiteitenregistratie, groepsactiviteiten, aanwezigheid | `Encounter`, `Group` |
| **ZZP-registratie** | Zorgzwaartepakketten — VG/LG profielen, herindicatie | `ServiceRequest` + ext: `openzorg-zzp-profiel` |
| **Groepszorg** | Groepsactiviteiten, woongroep, dagactiviteitencentrum | `Group`, `Encounter` |
| **Wlz-facturatie** | AW319/AW320 (gedeeld met VVT), ZZP-declaratie | `Claim` + sectorspecifieke coding |

### 3.5 Jeugdzorg-module (toekomstig)

**Package:** `packages/module-jeugd`
**Status:** Gepland 2028 H1

| Component | Omschrijving | FHIR Resources/Extensions |
|-----------|-------------|--------------------------|
| **Gezinsplan** | Plan per gezinssysteem (niet per individu) — meerdere jeugdigen, ouders, netwerk | `CarePlan`, `Group` (type: gezin) |
| **Veiligheidsplan** | Signs of Safety methodiek — gevaar, veiligheid, kracht, doel | `CarePlan` + ext: `openzorg-signs-of-safety` |
| **Jeugdhulpregistratie** | Soort hulp, duur, resultaat, reden beeindiging | `EpisodeOfCare`, `Encounter` |
| **iJW-berichtenverkeer** | Berichtenverkeer met gemeenten — toewijzing, start, stop, declaratie | `MessageHeader`, `Bundle` |
| **Jeugdwet-facturatie** | Gemeentelijke declaratie, productcodes, iJW-standaard | `Claim` + sectorspecifieke coding |
| **Caseload management** | Overzicht per gezinsvoogd/hulpverlener — belasting, prioriteiten | Dashboard + `PractitionerRole` |

### Sectorvergelijking: plantype en financiering

| Sector | Plantype | Methodiek | Primaire financiering | Declaratiestandaard |
|--------|----------|-----------|----------------------|---------------------|
| VVT | Zorgplan | Leefgebieden (12 domeinen) | Wlz/Wmo/Zvw | AW319/AW320, iWlz |
| GGZ | Behandelplan | Doelgericht, herstelfasen | Zvw (zorgprestatiemodel) | DIS, Grouper |
| Ziekenhuis | Behandelplan | Per specialisme/DBC | Zvw (DOT) | DBC Grouper |
| GHZ | Ondersteuningsplan | Persoonsgericht, QoL-domeinen | Wlz/Wmo | AW319/AW320, iWlz |
| Jeugd | Gezinsplan | Signs of Safety, SoS | Jeugdwet | iJW |

---

## 4. Modulaire Architectuur

### Overzicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Tenant Configuratie                           │
│            sector: VVT | modules: [kern, vvt, medicatie]            │
│         financiering: [Wlz, Wmo] | subsector: verpleeghuis         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                        OpenZorg Kern                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Patient │ Practitioner │ Organization │ Audit & Auth        │   │
│  │ Planning & Roostering │ Rapportage & Dossier                │   │
│  │ Configuratie Engine │ Facturatie Basis │ Berichtenverkeer    │   │
│  │ Workflow Engine (Flowable) │ Multi-tenant (RLS + Projects)  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌───────┐ ┌───────────┐   │
│  │   VVT   │ │   GGZ   │ │Ziekenhuis │ │  GHZ  │ │  Jeugd    │   │
│  │  Module  │ │  Module │ │  Module   │ │ Module│ │  Module   │   │
│  │─────────│ │─────────│ │───────────│ │───────│ │───────────│   │
│  │Zorgplan │ │Behandel-│ │Order-entry│ │Onderst│ │Gezinsplan │   │
│  │SOEP     │ │plan     │ │DBC/DOT    │ │plan   │ │Signs of   │   │
│  │MIC      │ │ROM      │ │OK-plan    │ │Gedrags│ │Safety     │   │
│  │Wzd      │ │DBC/DBBC │ │SEH-triage │ │analyse│ │iJW        │   │
│  │iWlz     │ │Crisis   │ │SBAR       │ │Dagbest│ │Jeugdwet   │   │
│  │AW319/320│ │Wvggz    │ │Poli-agenda│ │ZZP    │ │facturatie │   │
│  └─────────┘ └─────────┘ └───────────┘ └───────┘ └───────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               Cross-sectorale optionele modules              │   │
│  │  Medicatie │ E-health │ Laboratorium │ Beeldbellen          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  FHIR R4 (Medplum) │ PostgreSQL 16 (RLS) │ Flowable BPMN         │
│  nl-core profielen  │ Sector-extensions   │ Sector-workflows      │
└─────────────────────────────────────────────────────────────────────┘
```

### Technische implementatie

#### pnpm Workspace-structuur

```
openzorg/
├── apps/
│   └── web/                          → Next.js 15 frontend (alle sectoren)
├── services/
│   ├── ecd/                          → ECD backend (kern + modules)
│   ├── planning/                     → Planning backend
│   └── workflow-bridge/              → Flowable BPMN bridge
├── packages/
│   ├── shared-domain/                → Gedeelde types, FHIR-mapping, validatie
│   ├── shared-config/                → Drie-laags configuratie engine
│   ├── shared-ui/                    → React componenten (sectoragnostisch)
│   ├── module-vvt/                   → VVT-specifieke logica
│   │   ├── src/
│   │   │   ├── zorgplan/             → Leefgebieden, doelen, acties
│   │   │   ├── soep/                 → SOEP-rapportage
│   │   │   ├── mic/                  → MIC-meldingen
│   │   │   ├── wzd/                  → Vrijheidsbeperkende maatregelen
│   │   │   ├── facturatie/           → AW319/AW320
│   │   │   ├── iwlz/                 → iWlz-berichtenverkeer
│   │   │   ├── fhir-profiles/        → VVT FHIR-profielen + extensions
│   │   │   ├── workflows/            → BPMN-templates (intake, indicatie)
│   │   │   └── ui/                   → VVT-specifieke React componenten
│   │   └── package.json
│   ├── module-ggz/                   → GGZ-specifieke logica (toekomstig)
│   ├── module-ziekenhuis/            → Ziekenhuis-specifieke logica (toekomstig)
│   ├── module-ghz/                   → GHZ-specifieke logica (toekomstig)
│   └── module-jeugd/                 → Jeugdzorg-specifieke logica (toekomstig)
└── infra/
    └── compose/
```

#### Module-registratie en Feature Flags

Elke module registreert zichzelf bij het platform via een standaard interface:

```typescript
// packages/module-vvt/src/index.ts
import type { SectorModule } from '@openzorg/shared-domain';

export const vvtModule: SectorModule = {
  id: 'vvt',
  name: 'VVT — Verpleging, Verzorging, Thuiszorg',
  sector: 'care',
  version: '1.0.0',

  // API routes die deze module registreert
  routes: (app) => {
    app.route('/api/zorgplan', zorgplanRoutes);
    app.route('/api/mic-meldingen', micRoutes);
    app.route('/api/wzd', wzdRoutes);
  },

  // FHIR-profielen en extensions
  fhirProfiles: ['openzorg-vvt-zorgplan', 'openzorg-vvt-soep'],
  fhirExtensions: ['soep-subjectief', 'soep-objectief', 'mic-ernst'],

  // BPMN-workflow templates
  workflows: ['vvt-intake', 'vvt-indicatie-verwerking'],

  // UI-componenten (lazy loaded)
  uiComponents: {
    'zorgplan-editor': () => import('./ui/ZorgplanEditor'),
    'soep-rapportage': () => import('./ui/SoepRapportage'),
    'mic-melding-form': () => import('./ui/MicMeldingForm'),
  },

  // Validatieregels (Layer 1 voor deze sector)
  validationRules: vvtValidationRules,

  // Configuratie-opties voor tenant setup
  configSchema: vvtConfigSchema,
};
```

#### Tenant configuratie bepaalt actieve modules

```typescript
// Opgeslagen in PostgreSQL (tenant_configurations)
interface TenantModuleConfig {
  tenantId: string;
  sector: 'vvt' | 'ggz' | 'ziekenhuis' | 'ghz' | 'jeugd';
  subsector: string;                    // bijv. 'verpleeghuis', 'thuiszorg'
  activeModules: string[];              // bijv. ['kern', 'vvt', 'medicatie']
  financieringsstromen: string[];       // bijv. ['wlz', 'wmo']
  sectorConfig: Record<string, unknown>; // sector-specifieke instellingen
}
```

#### Frontend: Tree-shaking en Lazy Loading

```typescript
// apps/web/src/lib/module-loader.ts
const MODULE_REGISTRY: Record<string, () => Promise<SectorModule>> = {
  vvt:         () => import('@openzorg/module-vvt'),
  ggz:         () => import('@openzorg/module-ggz'),
  ziekenhuis:  () => import('@openzorg/module-ziekenhuis'),
  ghz:         () => import('@openzorg/module-ghz'),
  jeugd:       () => import('@openzorg/module-jeugd'),
};

export async function loadActiveModules(
  activeModules: string[]
): Promise<SectorModule[]> {
  // Alleen actieve modules worden geladen — rest wordt ge-tree-shaked
  const loaders = activeModules
    .filter((m) => m in MODULE_REGISTRY)
    .map((m) => MODULE_REGISTRY[m]!());
  return Promise.all(loaders);
}
```

#### Backend: Conditionele route-registratie

```typescript
// services/ecd/src/app.ts
import { Hono } from 'hono';
import { tenantMiddleware } from './middleware/tenant';
import { loadTenantModules } from './lib/module-loader';

const app = new Hono();

// Kern-routes zijn altijd actief
app.use('*', tenantMiddleware);
app.route('/api/clients', clientRoutes);
app.route('/api/rapportages', rapportageRoutes);
app.route('/api/planning', planningRoutes);

// Sectormodule-routes worden dynamisch geregistreerd
app.use('/api/*', async (c, next) => {
  const modules = await loadTenantModules(c.get('tenantId'));
  for (const mod of modules) {
    mod.routes(app);
  }
  await next();
});
```

#### FHIR Profiles per Sector

```
fhir-profiles/
├── shared/                          → nl-core profielen (alle sectoren)
│   ├── nl-core-Patient.json
│   ├── nl-core-Practitioner.json
│   └── nl-core-Organization.json
├── vvt/                             → VVT-specifiek
│   ├── openzorg-vvt-CarePlan.json   → Zorgplan met leefgebieden
│   ├── openzorg-vvt-Observation.json→ SOEP-rapportage
│   └── openzorg-vvt-AuditEvent.json → MIC-melding
├── ggz/                             → GGZ-specifiek
│   ├── openzorg-ggz-CarePlan.json   → Behandelplan
│   ├── openzorg-ggz-Questionnaire.json → ROM-instrumenten
│   └── openzorg-ggz-EpisodeOfCare.json → DBC/DBBC
├── ziekenhuis/                      → Ziekenhuis-specifiek
│   ├── openzorg-zh-ServiceRequest.json → Order-entry
│   └── openzorg-zh-Encounter.json   → SEH/OK/Poli
├── ghz/                             → GHZ-specifiek
│   └── openzorg-ghz-CarePlan.json   → Ondersteuningsplan
└── jeugd/                           → Jeugdzorg-specifiek
    └── openzorg-jeugd-CarePlan.json → Gezinsplan
```

#### Plugin-architectuur voor derden

```
┌────────────────────────────────────────────────┐
│              OpenZorg Plugin API                 │
├────────────────────────────────────────────────┤
│                                                │
│  interface OpenZorgPlugin {                    │
│    id: string;                                 │
│    name: string;                               │
│    version: string;                            │
│    hooks: {                                    │
│      onPatientCreate?: (patient) => void;      │
│      onCarePlanUpdate?: (plan) => void;        │
│      onClaimSubmit?: (claim) => void;          │
│      // ... extensible hook points             │
│    };                                          │
│    routes?: (app: Hono) => void;               │
│    uiSlots?: Record<string, Component>;        │
│  }                                             │
│                                                │
│  Voorbeelden:                                  │
│  • Koppeling met medicatie-robot               │
│  • SMS/WhatsApp notificaties                   │
│  • BI-dashboard (PowerBI/Tableau)              │
│  • Koppeling met gemeentelijk portaal          │
│  • Farmaceutische integratie (G-standaard)     │
│                                                │
└────────────────────────────────────────────────┘
```

### Deployment-model

```
Tenant A (VVT - Verpleeghuis)          Tenant B (GGZ - Ambulant)
┌───────────────────────┐              ┌───────────────────────┐
│ Kern + VVT-module     │              │ Kern + GGZ-module     │
│ Modules: zorgplan,    │              │ Modules: behandelplan,│
│   soep, mic, wzd,     │              │   rom, dbc, crisis,   │
│   aw319, iwlz         │              │   medicatie, wvggz    │
│ Financiering: Wlz,Wmo │              │ Financiering: Zvw     │
└───────────────────────┘              └───────────────────────┘
         │                                      │
         └──────────────┬───────────────────────┘
                        │
              Gedeelde infrastructuur
         ┌──────────────┴───────────────┐
         │  Medplum (FHIR) — Projects   │
         │  PostgreSQL (RLS)            │
         │  Flowable (tenantId)         │
         │  Next.js (tree-shaked)       │
         └──────────────────────────────┘
```

> **Belangrijk:** Er draait geen apart cluster per sector. Alle tenants delen dezelfde infrastructuur. De isolatie zit in de data (RLS, Medplum Projects) en de configuratie (actieve modules). Dit houdt de operationele kosten laag.

---

## 5. Onboarding per Sector

Bij het aanmaken van een nieuwe tenant doorloopt de beheerder een wizard die de organisatie in vijf stappen configureert.

### Stap 1: Sector kiezen

```
┌─────────────────────────────────────────┐
│       Welkom bij OpenZorg                │
│       Kies uw sector:                    │
│                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │   VVT   │  │   GGZ   │  │  GHZ    │ │
│  │Verpleging│  │Geestelij│  │Gehandi- │ │
│  │Verzorging│  │ke Gezond│  │capten-  │ │
│  │Thuiszorg │  │heidszorg│  │zorg     │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                          │
│  ┌─────────┐  ┌─────────┐              │
│  │ Jeugd   │  │Ziekenhuis│              │
│  │ zorg    │  │(pilot)   │              │
│  └─────────┘  └─────────┘              │
└─────────────────────────────────────────┘
```

### Stap 2: Subsector specificeren

| Sector | Subsector-opties |
|--------|-----------------|
| VVT | Verpleeghuis, Verzorgingshuis, Thuiszorg, Wijkverpleging, Hospice, Gecombineerd |
| GGZ | Basis GGZ, Gespecialiseerde GGZ (ambulant), Gespecialiseerde GGZ (klinisch), Beschermd wonen/RIBW, Forensisch, Verslavingszorg |
| GHZ | Verstandelijk gehandicapt (VG), Lichamelijk gehandicapt (LG), Zintuiglijk gehandicapt (ZG), Gecombineerd |
| Jeugd | Jeugdhulp ambulant, Jeugdhulp residentieel, Jeugdbescherming, Jeugd-GGZ |
| Ziekenhuis | Academisch (UMC), Topklinisch, Algemeen, ZBC |

### Stap 3: Modules selecteren

De sector bepaalt de standaard-moduleset. De beheerder kan optionele modules toe- of uitschakelen.

| Module | VVT | GGZ | GHZ | Jeugd | Ziekenhuis |
|--------|:---:|:---:|:---:|:-----:|:----------:|
| **Kern** (altijd aan) | V | V | V | V | V |
| Zorgplan (leefgebieden) | **V** | - | - | - | - |
| Behandelplan | - | **V** | - | - | **V** |
| Ondersteuningsplan | - | - | **V** | - | - |
| Gezinsplan | - | - | - | **V** | - |
| SOEP-rapportage | **V** | O | - | - | - |
| ROM-vragenlijsten | - | **V** | O | O | - |
| DBC/DBBC-registratie | - | **V** | - | - | **V** |
| MIC-meldingen | **V** | O | **V** | O | **V** |
| Wzd/Wvggz | **V** | **V** | **V** | - | - |
| Order-entry | - | - | - | - | **V** |
| OK-planning | - | - | - | - | O |
| Medicatie | O | **V** | O | - | **V** |
| iWlz-berichten | **V** | O | **V** | - | - |
| iJW-berichten | - | - | - | **V** | - |

> **V** = standaard aan, **O** = optioneel, **-** = niet beschikbaar

### Stap 4: Financieringsstromen configureren

Een organisatie kan meerdere financieringsstromen combineren (bijv. een VVT-organisatie die Wlz EN Wmo-zorg levert).

```
┌─────────────────────────────────────────┐
│  Welke financieringsstromen zijn actief? │
│                                          │
│  [x] Wlz  — Wet langdurige zorg         │
│      → CIZ-indicatie, zorgkantoor       │
│      → AW319/AW320 declaratie           │
│                                          │
│  [x] Wmo  — Wet maatschappelijke onderst│
│      → Gemeentelijke beschikking        │
│      → iWmo berichtenverkeer            │
│                                          │
│  [ ] Zvw  — Zorgverzekeringswet         │
│      → Verwijzing huisarts              │
│      → Verzekeraar declaratie           │
│                                          │
│  [ ] Jeugdwet                            │
│      → Gemeentelijke verwijzing         │
│      → iJW berichtenverkeer             │
└─────────────────────────────────────────┘
```

### Stap 5: Sectorspecifieke configuratie

| Sector | Configuratie-opties |
|--------|-------------------|
| **VVT** | Leefgebieden (standaard 12, aanpasbaar), rapportagetype (SOEP/vrij/beide), MIC-categorieën, Wzd-maatregeltypen, indicatietypes |
| **GGZ** | ROM-instrumenten (OQ-45, PHQ-9, etc.), behandelfasen, DBC-instellingen (DBC-startregels, diagnose-assen), crisisprotocol |
| **Ziekenhuis** | Specialismen, DBC-regels, OK-kamers, afdelingen, lab-testcatalogus, triage-protocol |
| **GHZ** | Ondersteuningsdomeinen, ZZP-profielen, dagbestedingsactiviteiten, gedragsregistratie-typen |
| **Jeugd** | Hulpvormen, Signs of Safety-configuratie, productcodes (gemeente-afhankelijk), caseload-limieten |

### Na onboarding

Na het doorlopen van de wizard wordt automatisch:
1. Een Medplum Project aangemaakt (FHIR-isolatie)
2. PostgreSQL RLS-policies ingesteld
3. De geselecteerde modules geactiveerd in `tenant_configurations`
4. Sector-specifieke BPMN-workflows gedeployed in Flowable
5. Standaard validatieregels (Layer 1) geladen voor de sector
6. Een beheerder-account aangemaakt met juiste rollen

---

## 6. Marktstrategie — Waarom Open Source Wint

### Het probleem: vendor lock-in domineert de Nederlandse zorg-IT

```
HUIDIGE SITUATIE                          OPENZORG VISIE
                                          
┌──────────────┐                         ┌──────────────────────┐
│  Ziekenhuis  │ → HiX/Epic              │                      │
│  (gesloten)  │   €10M+ licentie        │   Eén open platform  │
├──────────────┤                         │                      │
│    VVT       │ → Gesloten ECD          │   Modulair           │
│  (gesloten)  │   €100K-500K/jaar       │   FHIR-native        │
├──────────────┤                         │   Sectoragnostisch   │
│    GGZ       │ → Gesloten ECD          │                      │
│  (gesloten)  │   €50K-300K/jaar        │   Open source        │
├──────────────┤                         │   Community-driven   │
│    GHZ       │ → Gesloten ECD          │                      │
│  (gesloten)  │   €50K-200K/jaar        │   Betaalbaar         │
├──────────────┤                         │   Interoperabel      │
│   Jeugd      │ → Gesloten ECD          │                      │
│  (gesloten)  │   €30K-150K/jaar        └──────────────────────┘
└──────────────┘
  Geen data-uitwisseling
  tussen sectoren!
```

### Huidige marktspelers per sector

| Sector | Marktleider | Marktaandeel (geschat) | Zwakte |
|--------|------------|----------------------|--------|
| **Ziekenhuis** | ChipSoft (HiX) | ~65% | Monoliet, hoge kosten, beperkte innovatie |
| **Ziekenhuis UMC** | Epic | ~80% van UMC's | Amerikaans, extreem duur, vendor lock-in |
| **VVT intramuaal** | Leverancier X (marktleider) | ~40% | Gesloten, trage innovatie, hoge prijzen |
| **VVT extramuraal** | Ecare | ~25% | Verouderde architectuur |
| **GGZ** | Topicus | ~35% | Beperkte interoperabiliteit |
| **GHZ** | Meerdere spelers | Gefragmenteerd | Geen duidelijke standaard |
| **Jeugd** | Topicus/Kei-IT | ~30% | Matig, hoge implementatiekosten |

### Waarom open source het wint in de zorg

| Factor | Gesloten ECD | OpenZorg |
|--------|-------------|----------|
| **Licentiekosten** | €50K-500K/jaar (per organisatie) | €0 (open source) |
| **Implementatie** | 6-18 maanden | Weken (modulair, standaard config) |
| **Interoperabiliteit** | Proprietary API's, HL7v2 legacy | FHIR-native, nl-core profielen |
| **Vendor lock-in** | Ja — data-export is moeilijk tot onmogelijk | Nee — alle data in open FHIR-formaat |
| **Innovatiesnelheid** | 1-2 major releases per jaar | Continue delivery, community bijdragen |
| **Aanpasbaarheid** | Wachten op leverancier | Zelf aanpassen of community feature request |
| **Sectoroverstijgend** | Nee — apart systeem per sector | Ja — gedeelde kern, sectormodules |
| **Transparantie** | Blackbox | Volledig inzichtelijk (code, data, beslissingen) |

### Revenue model

OpenZorg is open source, maar het bedrijf achter het platform verdient geld met:

| Inkomstenstroom | Omschrijving | Marge |
|----------------|-------------|-------|
| **Managed hosting** | SaaS — wij draaien het platform per tenant | Hoog (recurring) |
| **Implementatie** | Onboarding, configuratie, datamigratie | Medium |
| **Support & SLA** | Helpdesk, updates, monitoring, incident response | Hoog (recurring) |
| **Custom modules** | Sectorspecifieke of organisatie-specifieke modules | Medium-hoog |
| **Training** | Functioneel beheerders, eindgebruikers, ontwikkelaars | Medium |
| **Consultancy** | FHIR-integratie, koppelingen, architectuur-advies | Hoog |

### Land-and-expand strategie

```
2026                2027                2028                2029+
 │                   │                   │                   │
 │  ┌─────────┐     │  ┌─────────┐     │  ┌─────────┐     │  ┌──────────┐
 │  │   VVT   │     │  │   GGZ   │     │  │  Jeugd  │     │  │Ziekenhuis│
 │  │ Bewezen │────>│  │ Dichtst │────>│  │ Gemeente│────>│  │  Groot   │
 │  │ model   │     │  │ bij VVT │     │  │ overlap │     │  │ ambitie  │
 │  └─────────┘     │  ├─────────┤     │  └─────────┘     │  └──────────┘
 │                   │  │   GHZ   │     │                   │
 │                   │  │ Wlz=VVT │     │                   │
 │                   │  └─────────┘     │                   │
 │                   │                   │                   │
 ▼                   ▼                   ▼                   ▼
Proof of concept   Sector-expansie    Breed portfolio     Marktdominantie
5-10 VVT-klanten   30+ klanten        100+ klanten        Platform = standaard
```

**Waarom deze volgorde?**
1. **VVT eerst**: Meeste overlap met bestaande architectuur, markt is gefrustreerd met incumbents
2. **GGZ als tweede**: Langdurige GGZ lijkt op VVT (wonen + behandelen), dezelfde financiering (Wlz), veel gedeelde kern-functionaliteit
3. **GHZ parallel met GGZ**: Ondersteuningsplan lijkt op zorgplan, zelfde Wlz-financiering, AW319/AW320 gedeeld
4. **Jeugdzorg**: Gemeentelijke financiering (overlap met Wmo), gezinsgerichte aanpak is onderscheidend
5. **Ziekenhuis als laatste**: Meest complex (order-entry, OK, lab), hoogste drempel, maar ook grootste markt

---

## 7. Roadmap — Van VVT naar Heel Nederland

### Tijdlijn

```
2026 H1          2026 H2          2027 H1          2027 H2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VVT Sprint 4     VVT Productie    GGZ MVP          GHZ MVP
Facturatie       Eerste klanten   Behandelplan     Ondersteunings-
E2E tests        Hardening        ROM              plan
                 Medicatie-MVP    DBC basis         Dagbesteding
                 Stabilisatie     Crisis            ZZP

2028 H1          2028 H2          2029 H1          2029 H2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Jeugdzorg MVP    Ziekenhuis       Ziekenhuis       Ziekenhuis
Gezinsplan       Pilot            Uitbreiding      Volledig
Signs of Safety  Polikliniek      Order-entry      OK, SEH
iJW              Basis-DBC        Lab-integratie   Medicatie
```

### Gedetailleerde roadmap

#### 2026 H1: VVT Volwassen Maken (huidige fase)

| Item | Status | Toelichting |
|------|--------|-------------|
| Sprint 4: Facturatie (AW319/AW320) | Niet gestart | Vektis-declaratieberichten, iWlz-koppeling |
| Sprint 4: E2E tests (Playwright) | Niet gestart | Volledige gebruikersflows testen |
| Medicatie-module (basis) | Gepland | Toedienregistratie, medicatieoverzicht |
| Performance & security audit | Gepland | Penetratietest, load test, OWASP |

#### 2026 H2: VVT Productie & Eerste Klanten

| Item | Toelichting |
|------|-------------|
| Productie-deployment | Kubernetes, monitoring, alerting, backup |
| Eerste 3-5 pilot-klanten | Kleinere VVT-organisaties, intensieve begeleiding |
| Documentatie & training | Gebruikershandleiding, functioneel beheerdershandleiding |
| Module-architectuur refactor | Kern en VVT-module scheiden in aparte packages |
| Medicatie uitbreiding | G-standaard integratie, interactiecontrole |
| iWlz-berichtenverkeer | Volledige iWlz keten (indicatie t/m verantwoording) |

#### 2027 H1: GGZ-module MVP

| Item | Toelichting |
|------|-------------|
| Behandelplan | Doelgericht plan, behandelfasen, evaluatiemomenten |
| ROM-vragenlijsten | FHIR Questionnaire engine, OQ-45, PHQ-9, GAD-7 |
| DBC/DBBC-registratie (basis) | Openen, diagnosticeren, registreren, sluiten |
| Crisiskaart | Door client opgesteld crisisplan |
| GGZ-facturatie (basis) | Zorgprestatiemodel declaratie |
| Wvggz-registratie | Zorgmachtiging, verplichte zorg administratie |
| Eerste GGZ pilot-klant | RIBW of ambulante GGZ-praktijk |

#### 2027 H2: GHZ-module MVP

| Item | Toelichting |
|------|-------------|
| Ondersteuningsplan | Persoonsgericht plan, kwaliteit van leven domeinen |
| Dagbestedingsregistratie | Activiteiten, aanwezigheid, groepen |
| Gedragsanalyse (basis) | ABC-registratie, rapportage |
| ZZP-registratie | Zorgzwaartepakketten, herindicatie |
| Wlz-facturatie (hergebruik VVT) | AW319/AW320 — grotendeels gedeeld met VVT |
| Eerste GHZ pilot-klant | Kleine VG-organisatie |

#### 2028 H1: Jeugdzorg-module

| Item | Toelichting |
|------|-------------|
| Gezinsplan | Plan per gezinssysteem, meerdere jeugdigen |
| Signs of Safety | Veiligheidsplan methodiek |
| iJW-berichtenverkeer | Gemeentelijke berichtenuitwisseling |
| Jeugdwet-facturatie | Productcodes, gemeentelijke declaratie |
| Caseload management | Dashboard per gezinsvoogd |

#### 2028 H2: Ziekenhuis Pilot

| Item | Toelichting |
|------|-------------|
| Polikliniek-module | Spreekuurplanning, wachttijden, verwijzingen |
| DBC-registratie (DOT) | Zorgproducten, Grouper-integratie |
| Verpleegkundige module | Opname, overdracht (SBAR), ontslagplanning |
| Basis order-entry | Lab-aanvragen (beperkt) |
| Pilot met ZBC of klein ziekenhuis | Beperkte scope: 1-2 specialismen |

#### 2029+: Volledig Ziekenhuisplatform

| Item | Toelichting |
|------|-------------|
| Volledige order-entry | Lab, radiologie, pathologie, microbiologie |
| OK-planning | Operatiekamer planning, anesthesie |
| SEH-module | Manchester Triage, behandelspoor |
| Medicatievoorschrift (CPOE) | Elektronisch voorschrijven, interactiecontrole |
| IC-registratie | Intensive care scoring, PDMS |

### Mijlpalen en KPI's

| Mijlpaal | Wanneer | KPI |
|----------|---------|-----|
| Eerste VVT-klant live | 2026 Q3 | 1 tenant in productie |
| 10 VVT-klanten | 2026 Q4 | €500K ARR |
| GGZ MVP live | 2027 Q2 | Eerste GGZ pilot-klant |
| 30 klanten (multi-sector) | 2027 Q4 | €2M ARR |
| 100 klanten | 2028 Q4 | €8M ARR |
| Ziekenhuis pilot | 2028 Q4 | 1 ziekenhuis in pilot |
| 500 klanten | 2030 | €30M+ ARR |

---

## Bijlage A: FHIR Resource Mapping per Sector

| FHIR Resource | Kern | VVT | GGZ | Ziekenhuis | GHZ | Jeugd |
|---------------|:----:|:---:|:---:|:----------:|:---:|:-----:|
| Patient | K | | | | | |
| Practitioner | K | | | | | |
| PractitionerRole | K | | | | | |
| Organization | K | | | | | |
| Location | K | | | | | |
| RelatedPerson | K | | | | | |
| Schedule | K | | | | | |
| Slot | K | | | | | |
| Appointment | K | | | | | |
| AuditEvent | K | V | | V | V | |
| Task | K | | | | | |
| Communication | K | | | V | | |
| Claim | K | V | V | V | V | V |
| CarePlan | | V | V | V | V | V |
| Goal | | V | V | V | V | V |
| ServiceRequest | | V | | V | V | |
| Observation | | V | V | V | V | |
| DocumentReference | K | | | | | |
| Binary | K | | | | | |
| Condition | | | V | V | | |
| Procedure | | V | V | V | | |
| MedicationRequest | | O | V | V | O | |
| MedicationAdministration | | O | V | V | O | |
| Questionnaire | | | V | | | |
| QuestionnaireResponse | | | V | | | |
| EpisodeOfCare | | | V | V | | V |
| Encounter | | | V | V | V | V |
| Group | | | | | V | V |
| DiagnosticReport | | | | V | | |
| Specimen | | | | V | | |
| DetectedIssue | | | V | V | | |
| MessageHeader | | V | | | V | V |
| Coverage | K | | | | | |

> **K** = Kern, **V** = Sectormodule (verplicht), **O** = Optioneel

## Bijlage B: Standaarden en Koppelingen per Sector

| Standaard/Koppeling | VVT | GGZ | Ziekenhuis | GHZ | Jeugd |
|---------------------|:---:|:---:|:----------:|:---:|:-----:|
| iWlz (berichtenverkeer) | V | O | - | V | - |
| iWmo (berichtenverkeer) | V | - | - | V | - |
| iJW (berichtenverkeer) | - | - | - | - | V |
| AW319/AW320 (Vektis) | V | - | - | V | - |
| DBC/DOT (Grouper) | - | V | V | - | - |
| DIS (aanlevering) | - | V | V | - | - |
| G-standaard (medicatie) | O | V | V | O | - |
| VECOZO (declaratie) | V | V | V | V | V |
| LSP (medicatieoverdracht) | O | V | V | O | - |
| Perined (verloskunde) | - | - | O | - | - |
| PALGA (pathologie) | - | - | V | - | - |
| Vektis-standaarden | V | V | V | V | V |
| Nictiz/nl-core FHIR | V | V | V | V | V |
| MedMij (PGO-uitwisseling) | V | V | V | V | V |
| SNOMED CT | O | V | V | O | O |
| ICPC-2 | - | - | O | - | - |
| DSM-5 | - | V | O | - | V |
| ICF | - | O | O | O | - |

> **V** = Verplicht, **O** = Optioneel, **-** = Niet van toepassing

---

> *Dit document is een levend strategiedocument. Het wordt bijgewerkt naarmate OpenZorg groeit en nieuwe sectoren worden ontsloten. De visie is helder: een open, modulair platform dat de hele Nederlandse zorg bedient — zonder vendor lock-in, zonder onnodige complexiteit, zonder concessies aan kwaliteit.*
>
> *Denk groot. Bouw modulair. Lever precies wat de klant nodig heeft.*
