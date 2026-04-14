# OpenZorg Backlog

> Laatste sync met Notion: 2026-04-13
> Notion Board: https://www.notion.so/e9f47053acdf445487daece2e8c6ace0

## Done (afgerond)

| Taak | Module | Prioriteit | Sprint |
|------|--------|-----------|--------|
| Rapportages: zoeken/filteren op datum, type, medewerker | Rapportages | P0 | Module Diepte |
| Rapportages: afdrukken/exporteren naar PDF | Rapportages | P1 | Module Diepte |
| Rapportages: overdrachtsrapportage bij dienst-wissel | Rapportages | P1 | Module Diepte |
| Rapportages: koppeling aan zorgplandoelen | Rapportages | P1 | Module Diepte |
| Zorgplan: evaluatiecyclus (6-maandelijks) met workflow | Zorgplan | P0 | Module Diepte |
| Zorgplan: leefgebieden-structuur (12 domeinen) | Zorgplan | P0 | Module Diepte |
| Zorgplan: doelen met meetbare indicatoren en voortgang | Zorgplan | P1 | Module Diepte |
| Zorgplan: digitale handtekening (client/vertegenwoordiger) | Zorgplan | P1 | Module Diepte |
| Zorgplan: voorlopig zorgplan binnen 48 uur | Zorgplan | P1 | Module Diepte |
| Medicatie: dubbele controle bij risicovol medicatie | Medicatie | P0 | Module Diepte |
| Workflow: configureerbare triggers (JSON/YAML) | Workflow | P0 | Workflow Engine |
| Workflow: event-systeem (webhooks/pub-sub) | Workflow | P1 | Workflow Engine |
| Workflow: timer-events (herindicatie signalering, evaluatie herinnering) | Workflow | P1 | Workflow Engine |
| Workflow: timer events (automatische signalering) | Workflow | P0 | Workflow Engine |
| Signaleringen: client-specifieke alerts (valrisico, MRSA, allergie) | Platform | P1 | Module Diepte |
| Client lijst: tabel-view met BSN, locatie, indicatie, laatste rapportage | Design/UX | P1 | Module Diepte |
| Print/export voor zorgplan, rapportages, medicatieoverzicht | Platform | P1 | Module Diepte |
| Breadcrumb navigatie in client dossier | Design/UX | P2 | Module Diepte |
| Overdracht per dienst (overdrachtsfunctie) | Rapportages | P0 | Module Diepte |
| MDO: agenda + deelnemers + besluiten koppelen aan zorgplan | Zorgplan | P1 | Module Diepte |
| Indicatieverwerking: WLZ/WMO/ZVW onderscheid | Platform | P1 | Module Diepte |
| Productieregistratie per client per dag | Facturatie | P1 | Later |
| VVT/Revalidatie procesvalidatie: gap-analyse vs. werkprocessen | Platform | P0 | Module Diepte |

## Backlog (open)

### P2 - Medium

| Taak | Module | Sprint |
|------|--------|--------|
| Notificatie-systeem (badge + bell icon) | Platform | Pilot Voorbereiding |
| Rooster: drag-and-drop planning grid | Planning | Later |
| MIC: trendrapportage + statistieken | Platform | Later |
| Workflow: conditionele routing op basis van FHIR data | Workflow | Workflow Engine |
| Clientregistratie: verzekeringsgegevens (Coverage) | Platform | Module Diepte |
| Medicatie: toedieningsregistratie met barcode scan | Medicatie | Later |
| Audit trail viewer (NEN 7513) | Compliance | Compliance |
| 2FA / wachtwoordbeleid (NEN 7510) | Compliance | Compliance |
| AVG: data export + recht op vergetelheid | Compliance | Compliance |
| Facturatie: WLZ declaraties (ZZP/VPT/MPT) | Facturatie | Later |
| Koppelvlak: iWLZ (indicatie, toewijzing, declaratie) | Koppelvlakken | Later |
| Ontslagmanagement: workflow + eOverdracht | Platform | Later |
| Revalidatie: meetinstrumenten (FIM, Barthel, Utrecht Scale) | Zorgplan | Later |

### P1 - Hoog

| Taak | Module | Sprint |
|------|--------|--------|
| Frontend tests: E2E voor kernmodules | Platform | Pilot Voorbereiding |
| Revalidatie: GRZ behandelplan (apart van zorgplan) | Zorgplan | Later |
| Workflow: NEN 7513 audit-log voor taak-transities (start, claim, complete) | Compliance | Workflow Engine |
| Workflow: `zorgplan-evaluatie` BPMN-template deployen naar Flowable | Workflow | Workflow Engine |
| Workflow: Flowable-auth uit env ipv hardcoded `admin:admin` | Compliance | Pilot Voorbereiding |
| Werkbak: echte user-IDs ipv rol-als-candidateGroup (tenant-specifieke lookup) | Workflow | Later |
| Werkbak: opruimen legacy-fallback in `getTasksForUser` (taken zonder tenantId-variable) | Workflow | Later |

### P3 - Laag

| Taak | Module | Sprint |
|------|--------|--------|
| Keyboard shortcuts voor power users | Design/UX | Later |
| Koppelvlak: MedMij / PGO integratie | Koppelvlakken | Later |
