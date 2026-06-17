# Fase 2 — Slice: Cliëntdossier 5 werkgebieden

**Versie**: 1.0
**Datum**: 2026-06-17
**Status**: Autonoom uitgevoerd (Kevin: "start volgende slices, ik test als alles erdoor is")
**Relatie**: IA-doc `docs/design/informatie-architectuur.md` (§ Cliëntdossier 5 werkgebieden, doelbeeld). Tweede verticale slice na Rapportage.

## Doel

Het cliëntdossier van **21 platte tabs** naar **5 werkgebieden** brengen, conform de goedgekeurde IA. De daadwerkelijke tab-routes blijven 1:1 bestaan; alleen de navigatie groepeert. Laag risico, hoge IA-winst.

## Aanpak (besloten)

**Twee-niveau navigatie** i.p.v. de 21-tab platte balk:
- Niveau 1: de 5 werkgebieden (Overzicht / Rapportage / Gezondheid / Zorgplan / Administratie).
- Niveau 2: de sub-tabs van het actieve werkgebied (alleen getoond bij >1 sub-tab).
- Actief werkgebied volgt het pad; klikken op een werkgebied gaat naar zijn eerste sub-tab.
- Alle bestaande routes (`/ecd/[id]/<slug>`) blijven werken → geen pagina's herschreven.

Bewust **niet** in deze slice (volgt per gebied later): de per-pagina patroonlaag-normalisatie (20 pagina's gebruiken nog eigen inline spinner/error) en de Epic A-diepte (CAK A-02, alarmering A-03, mantelzorg A-08).

## Werkgebied-indeling

| Werkgebied | Sub-tabs |
|---|---|
| Overzicht | (basis-route /ecd/[id] — het widget-dashboard) |
| Rapportage | Rapportages |
| Gezondheid | Medicatie, Medicatieoverzicht, Toediening, Allergieën, Vaccinaties, Diagnoses, Risicoscreening, Vragenlijsten, Signaleringen, MIC-meldingen, VBM |
| Zorgplan | Zorgplan, Indicaties, MDO |
| Administratie | Contactpersonen, Wilsverklaringen, Documenten, Verzekering, Extra velden |

De indeling staat in `apps/web/src/app/ecd/[id]/werkgebieden.ts` — eenvoudig aan te passen. Vragenlijsten is bij Gezondheid gezet (klinische assessments); te heroverwegen.

## Bestanden
- Nieuw: `apps/web/src/app/ecd/[id]/werkgebieden.ts` (data + helpers).
- Herschreven: `apps/web/src/app/ecd/[id]/TabNav.tsx` (twee-niveau, her-exporteert `TABS` voor breadcrumb).
- E2E: golden-path + rapportage-soep klikken nu werkgebied "Rapportage" (één sub-tab → direct /rapportages).
- Dashboard-stub-tab (`/ecd/[id]/dashboard`) niet meer in de nav; Overzicht wijst naar de basis-route (lost de oude dubbele-dashboard-inconsistentie op).

## DoD
- Dossier toont 5 werkgebieden + sub-tabs; routes intact; golden-path + soep e2e groen; typecheck/lint/build groen.
