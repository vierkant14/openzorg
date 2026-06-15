# Fase 1 — Iteratie 2: Rapportage-slice (design brief / spec)

**Versie**: 0.9 (concept — wacht op Kevin-review)
**Datum**: 2026-06-15
**Status**: Concept, ter review
**Relatie**: Eerste verticale slice uit `2026-06-11-production-ready-traject-design.md` Fase 2-volgorde (Rapportage eerst). Bouwt op de shared-ui patroonlaag en het Vandaag-referentiescherm uit Fase 1 iteratie 1.

> **Vooraf al gedaan (los van dit ontwerp):** drie correctheidsbugs in de rapportage-module zijn gefixt in PR #10 (SOEP-extensies op url, AI-context-query, GET _count/date). Dit ontwerp gaat over de UX-/structuur-slag erbovenop.

---

## 1. Waarom dit scherm eerst

Rapporteren is de dagelijkse realiteit van de zorgmedewerker en — volgens de gap-analyse (§4, Epic D) — afhaakreden #1 bij slechte UX. De huidige pagina werkt, maar:
- `apps/web/src/app/ecd/[id]/rapportages/page.tsx` is **607 regels in één bestand** (3 componenten + helpers + types), met eigen spinner/error/empty i.p.v. de shared-ui primitieven.
- De labels van de SOEP-velden zijn niet aan de textareas gekoppeld (a11y-gat).
- Het schrijven (de #1 dagelijkse actie) zit achter een toggle en voelt als formulier-invullen, niet als "even snel iets noteren".

## 2. Primaire gebruikersactie

**Een rapportage schrijven in < 30 seconden, vanuit de flow.** Lezen/terugzoeken is secundair maar moet rustig en snel zijn.

## 3. Ontwerprichting

Knab-gevoel (`.impeccable.md`): taak af, weer weg. Warm, snel, minimale frictie. De teal/navy/coral-tokens en de patroonlaag blijven; de winst zit in flow en hiërarchie. Dit scherm wordt de **referentie voor het dossier-tab-patroon** (zoals Vandaag de referentie is voor de werkruimte-start).

## 4. Voorgestelde aanpak

### 4a. Structuur (geen UX-discussie — gewoon goed)
- Splits de 607-regel pagina in: `page.tsx` (container + data-hook), `RapportageLijst.tsx`, `RapportageComposer.tsx`, `AiSamenvatting.tsx`, en een `useRapportages`-hook.
- Vervang custom spinner/error/empty door `LoadingSkeleton`/`ErrorState`/`EmptyState`; gebruik `Section` voor blokken.
- Koppel SOEP-labels aan textareas (`htmlFor`/`id`) — a11y.

### 4b. Schrijf-flow (de kern — hier wil ik je mening)
Voorstel: een **persistente, compacte composer bovenaan** (denk: berichtenbalk) i.p.v. een verborgen toggle-formulier. Eén klik op "SOEP" vouwt de vier velden uit; "Vrij" toont één veld. Doel-koppeling als kleine dropdown ernaast. Opslaan = optimistic (verschijnt meteen in de lijst).

### 4c. Lees-flow
- Tijdlijn van rapportages, **gegroepeerd per dag** (lichte stap richting D-03 dagstructuur) met dag-kop; per item: tijd, type-badge, doel-badge, auteur.
- Filters (type/doel/datum/zoek) in een inklapbare balk (bestaand gedrag, opgeschoond).

### 4d. AI-samenvatting
De bestaande AI-samenvatting (D-06, differentiator) krijgt een duidelijker plek — een "Vat samen"-knop bij de lijst, met de drie doelen (dagoverdracht/week/MDO). Functioneel ongewijzigd; alleen beter vindbaar. (Kleine fix meegenomen: de echte cliëntnaam meesturen i.p.v. leeg.)

## 5. Verplichte states
Per blok leeg/laden/fout/succes, conform de patroonlaag. Lege lijst leert: "Nog geen rapportages vandaag — schrijf je eerste hierboven."

## 6. Buiten scope (latere iteraties, niet nu)
- **D-02** gestructureerde zorgmoment-templates (Questionnaire-infra bestaat al — eigen slice)
- **D-04** overdracht-snapshot tussen diensten
- **D-07** PDF-export voor familie
- **D-08** AI-signaalwoord-detectie (MIC-suggestie uit vrije tekst)
- Mobiele optimalisatie (per Fase 1-besluit desktop-eerst; mobiel volgt)

## 7. Open vragen voor Kevin
1. **Composer**: persistente balk bovenaan (mijn voorstel) of de huidige toggle behouden?
2. **Groeperen per dag** nu al (dagstructuur-light), of de platte lijst houden tot D-03?
3. **AI-samenvatting**: prominent bij de lijst, of subtiel in een menu?
4. Akkoord dat D-02/04/07/08 expliciet later komen (deze slice = herontwerp + flow van de bestaande functionaliteit)?

## 8. Definition of done
- Nieuw design toegepast (patroonlaag, splitsing, a11y-fix)
- Schrijf-flow < 30s, optimistic
- Alle vier states per blok
- Tests: e2e voor vrij én partieel-SOEP-schrijven+teruglezen (lockt de extensie-bug-fix vast); unit waar zinvol
- Golden-path E2E blijft groen
- PR met groene CI → Kevin-review vóór merge
