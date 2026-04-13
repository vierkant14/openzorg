# VVT Module — Processen & Flows

**Status:** Actief in ontwikkeling (v0.2.0)
**Sectoren:** Ouderenzorg, wijkverpleging, thuiszorg, hospicezorg
**Financiering:** WLZ, ZVW, WMO

---

## Overzicht Zorgprocessen

Het VVT-zorgproces volgt een vaste levenscyclus van instroom tot uitstroom. Elk proces is gekoppeld aan FHIR-resources, workflow-triggers, en gebruikersrollen.

```
INSTROOM          ZORGLEVERING              UITSTROOM
────────          ────────────              ─────────

Aanmelding →      Zorgplan →               Ontslagplanning
    ↓             Rapportage →                 ↓
Indicatie →      Medicatie →              eOverdracht
    ↓             MDO →                        ↓
Wachtlijst →     Evaluatie →             Dossier afsluiten
    ↓                 ↓                        ↓
Intake →         Herindicatie             Facturatie
    ↓
Dossier aanmaken
```

---

## 1. Instroom

### 1.1 Aanmelding & Intake

**Trigger:** Verwijzing huisarts, ziekenhuis, wijkteam, of client zelf

**Processtappen:**
1. Aanmelding ontvangen en registreren
2. Wachtlijst plaatsing (urgent/regulier)
3. Indicatie controleren (WLZ/WMO/ZVW)
4. Intake gesprek (huisbezoek of op locatie)
5. Clientregistratie (BSN, NAW, verzekering, contactpersonen)
6. Goedkeuring of afwijzing

**Workflow:** `intake-proces` (Flowable BPMN)
- Automatisch gestart bij client aanmaak
- Taken: planner beoordeelt → gateway goedgekeurd? → zorgmedewerker plant intake → of beheerder communiceert afwijzing

**FHIR Resources:** Patient, ServiceRequest (draft), Encounter (intake), RelatedPerson

**OpenZorg Status:** ✅ Werkend — auto-trigger, werkbak, wachtlijst

### 1.2 Indicatieverwerking

**Drie financieringsstromen:**

| Stroom | Indicatiesteller | Leveringsvorm | Declaratie |
|--------|-----------------|---------------|------------|
| **WLZ** | CIZ | ZZP, VPT, MPT, PGB | AW319 via Vecozo |
| **ZVW** | Wijkverpleegkundige zelf | Prestatie per uur | EI-standaard |
| **WMO** | Gemeente (keukentafelgesprek) | P×Q | iWMO |

**WLZ Zorgprofielen:** VV-01 t/m VV-10 (somatisch licht → palliatief-terminaal)

**OpenZorg Status:** ✅ Basis — indicatie-extensions op Patient, financieringsstroom badge, einddatum met verlopen-waarschuwing

---

## 2. Zorgplan (Zorgleefplan)

### 2.1 Leefgebieden (12 domeinen)

| # | Leefgebied | Voorbeelden |
|---|-----------|-------------|
| 1 | Lichamelijke gezondheid | Diagnoses, pijn, chronische aandoeningen |
| 2 | Geestelijke gezondheid | Stemming, cognitie, dementie |
| 3 | Mobiliteit | Transfers, lopen, valrisico |
| 4 | Voeding | Eetpatroon, dieet, slikproblemen |
| 5 | Huid en wondverzorging | Decubitus, wonden |
| 6 | Uitscheiding | Incontinentie, katheter |
| 7 | Slaap en rust | Slaappatroon, dag-nachtritme |
| 8 | Persoonlijke verzorging | ADL: wassen, kleden |
| 9 | Huishouden | Huishoudelijke taken |
| 10 | Sociale participatie | Sociaal netwerk, activiteiten |
| 11 | Regie en autonomie | Eigen regie, wilsbekwaamheid |
| 12 | Zingeving | Levensbeschouwing, rituelen |

**Per leefgebied:** situatieschets → SMART-doel → interventies → evaluatie

**OpenZorg Status:** ✅ Werkend

### 2.2 Evaluatiecyclus

**Wettelijk:** Minimaal elke 6 maanden (Kwaliteitskader Verpleeghuiszorg)

**Workflow:** `zorgplan-evaluatie` + timer trigger (6-maandelijks)

**OpenZorg Status:** ✅ Werkend

### 2.3 Handtekening (Informed Consent)

**Wettelijk:** WGBO art. 7:450 BW

**OpenZorg Status:** ✅ Werkend

---

## 3. Dagelijkse Zorg

### 3.1 Rapportage (SOEP)
**OpenZorg Status:** ✅ Werkend — SOEP + vrij, zoeken/filteren, koppeling aan doelen, afdrukken

### 3.2 Overdracht per Dienst
**OpenZorg Status:** ✅ Werkend — /overdracht pagina, auto-detectie dienst

---

## 4. Medicatie
**Dubbele controle (Wet BIG):** Verplicht bij risicovolle medicatie
**OpenZorg Status:** ✅ Werkend — risicovol-badge, controleren-knop

## 5. MDO
**OpenZorg Status:** ✅ Basis — planning, deelnemers, besluiten

## 6. MIC
**Workflow:** `mic-afhandeling`
**OpenZorg Status:** ✅ Werkend

## 7. Herindicatie
**Workflow:** `herindicatie` + timer trigger
**OpenZorg Status:** ✅ Werkend

## 8. Signaleringen
**OpenZorg Status:** ✅ Werkend — FHIR Flag resource, banner met emoji badges

---

## Workflow Configuratie

Alle processen zijn configureerbaar via het trigger-systeem:
- `resource.created` + Patient → start intake-proces
- `resource.created` + AuditEvent (MIC) → start mic-afhandeling
- `timer.cron` → check evaluatie-datums

Beheerders: `/admin/workflow-triggers`

---

## Requirements Status

| # | Requirement | Status |
|---|-----------|--------|
| 1-11 | Kern VVT processen | ✅ Done |
| 12 | eOverdracht (Nictiz) | ⏳ Gepland |
| 13 | iWLZ berichtenverkeer | ⏳ Gepland |
| 14 | Facturatie WLZ/WMO/ZVW | ⏳ Gepland |
