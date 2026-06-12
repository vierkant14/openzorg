# Fase 1 — Ontwerp-fundament (design brief / spec)

**Versie**: 1.0
**Datum**: 2026-06-12
**Status**: Goedgekeurd door Kevin (2026-06-12)
**Relatie**: Fase 1 uit `2026-06-11-production-ready-traject-design.md`. Bouwt op de design-context in `.impeccable.md` (warm/menselijk/betrokken; Knab/TickTick/Power Apps als referenties; SAP/HiX als anti-referenties).

**Besluiten uit de discovery (Kevin):** werkruimtes per rol · desktop eerst, mobiel per slice · radicale herziening toegestaan (URL's, menu's, dossier) · top-taken zorgmedewerker: rapporteren, medicatie aftekenen, dagplanning · werkruimte heet **"Vandaag"** · multi-rol via werkruimte-switcher · overdracht is onderdeel van Vandaag, geen eigen sectie.

---

## 1. Samenvatting

OpenZorg krijgt een nieuwe informatie-architectuur op basis van **werkruimtes per rol**, een **patroonlaag bovenop het bestaande design-systeem** (OKLCH-tokens blijven), en **referentie-implementaties** in `shared-ui` die de standaard zetten voor alle verticale slices (Fase 2+).

## 2. Primaire gebruikersactie per rol

- **Zorgmedewerker**: rapporteren binnen 30 seconden vanaf elk punt in de app
- **Planner**: het rooster rond krijgen (gaten zien → vullen)
- **Beheerder**: een proces aanpassen zonder handleiding ("bouwen, niet programmeren")
- **Teamleider**: in één oogopslag zien waar aandacht nodig is

## 3. Ontwerprichting

Warm professioneel — een goed ontworpen zorglocatie, geen systeem. Knab-gevoel voor zorgmedewerkers (taak af, weg), TickTick-dichtheid voor planners, Power Apps-gevoel voor beheerders. Teal/navy/coral-palet en warme neutralen blijven; de winst zit in **ritme, hiërarchie en patronen**, niet in nieuwe kleuren. Typografie (Nunito/Source Sans 3) blijft.

## 4. Informatie-architectuur

### Werkruimtes (één per rol, 3-5 navigatie-items elk)

| Werkruimte | Voor | Kern-items |
|---|---|---|
| **Vandaag** | zorgmedewerker | Dagplanning+route, taken, overdracht-snapshot → Cliënten → Berichten |
| **Rooster** | planner | Rooster-centrisch; bezetting/wachtlijst/herhalingen als context-panelen → Medewerkers → Berichten |
| **Team** | teamleider | Signalen-overzicht (MIC, escalaties, verlopen indicaties) → Cliënten → Team |
| **Bouwen** | functioneel beheerder | Processen (workflows/DMN), Formulieren & velden, Regels & lijsten, Organisatie |
| **Systeem** | tenant-admin | Rollen, flags, state-machines, API-keys, AI |
| **Platform** | master admin | Tenants, onboarding |

Multi-rol gebruikers wisselen via een werkruimte-switcher (vergelijkbaar met workspace-switchers in moderne tools). Eén rol = geen switcher zichtbaar.

### Cliëntdossier: van 21 tabs naar 5 werkgebieden

1. **Overzicht** — signaleringen, actuele medicatie, laatste rapportages, actieve doelen
2. **Rapportage** — de dagelijkse stroom, met doel-koppeling
3. **Gezondheid** — medicatie, toediening, allergieën, diagnoses, vaccinaties, risico's, VBM, wilsverklaringen
4. **Zorgplan** — doelen, evaluaties, MDO, indicaties, handtekeningen
5. **Administratie** — contactpersonen, verzekering, documenten, extra velden

Direct springen blijft mogelijk via zoek/command-palette en bestaande sneltoetsen.

### Canvas

Desktop eerst: ontwerpen op 1280-1440. Mobiel volgt per verticale slice (Fase 2+), niet in Fase 1.

## 5. Schermtype-patronen

Zes patronen, elk met verplichte states **leeg** (leert de interface), **laden** (skeleton), **fout** (herstelbaar) en **succes**:

1. Werkruimte-start (taak-gericht dashboard)
2. Lijstpagina (overzicht + filters + zoeken)
3. Dossierpagina (header + werkgebieden)
4. Formulier (inline/paneel — géén modals waar vermijdbaar)
5. Wizard (meerstaps, bijv. intake)
6. Admin-builder (config-ervaring)

## 6. Interactiemodel

- Rapportage als overlay-paneel beschikbaar vanaf elke cliëntcontext
- Bestaand sneltoetsen-systeem (`g c/p/d/w`, `/`, `?`) wordt onderdeel van de standaard
- Optimistic UI bij opslaan; progressive disclosure in formulieren (basisvelden eerst)

## 7. Content & microcopy

Nederlands, warm en direct ("Nog geen rapportages vandaag — begin bij je eerste cliëntbezoek" i.p.v. "Geen data"). Ontwerp-datavolumes: 10-30 cliënten per route, 5-15 rapportages per dienst, 200+ medewerkers in rooster.

## 8. Kwaliteit

WCAG 2.2 AA (backlog UX-A11Y-01) ingebakken in de patroonlaag: contrast, focus-states, toetsenbordnavigatie, screenreader-labels. Verboden patronen conform impeccable-richtlijnen (o.a. geen gekleurde border-left-strepen, geen gradient-tekst, geen modal-reflex, geen metric-card-sjablonen).

## 9. Deliverables Fase 1

1. **IA-document** — sitemap, URL-structuur, werkruimte-definities, dossier-werkgebieden (review Kevin)
2. **Patroonlaag** — design-systeem-standaarden per schermtype + aangevulde tokens (spacing-ritme, states) (review Kevin)
3. **Referentie-implementaties** — shared-ui componenten + één referentiescherm per patroon, te beginnen met werkruimte "Vandaag" (review Kevin per iteratie)

## 10. Buiten scope Fase 1

- Mobiele optimalisatie (per slice in Fase 2+)
- Feature-diepte (Tier 1-features volgen in de slices)
- Migratie van álle ~40 pagina's (alleen referentie-implementaties; de rest volgt per slice)
