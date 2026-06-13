# OpenZorg Informatie-Architectuur

**Status**: doelbeeld v1 (Fase 1, iteratie 1) — goedgekeurd ontwerp in spec 2026-06-12
**Principe**: taak-gericht per rol, niet module-gericht. Radicale IA, evolutionaire migratie: oude URL's blijven werken tot de betreffende verticale slice ze vervangt.

## Werkruimtes

Een gebruiker landt in de werkruimte van zijn rol. Wie meerdere werkruimtes heeft (beheerder, tenant-admin, master admin) krijgt linksboven een link-lijst om te wisselen; één werkruimte = geen switcher. De actieve werkruimte volgt het huidige pad (de nav reflecteert waar je bent).

| Werkruimte | Slug | Rollen | Startroute | Nav-items (max 5) |
|---|---|---|---|---|
| Vandaag | vandaag | zorgmedewerker | /vandaag | Vandaag · Cliënten · Berichten |
| Rooster | rooster | planner | /planning/rooster | Rooster · Dagplanning · Wachtlijst · Medewerkers · Berichten |
| Team | team | teamleider | /dashboard | Overzicht · Cliënten · MIC-meldingen · Signaleringen · Berichten |
| Bouwen | bouwen | beheerder, tenant-admin | /admin/configuratie | Overzicht · Processen · Formulieren & velden · Regels & lijsten · Codelijsten |
| Organisatie | organisatie | beheerder, tenant-admin | /admin/medewerkers | Medewerkers · Competenties · Bezetting & normen · Diensten · Organisatie |
| Systeem | systeem | tenant-admin | /admin/rollen | Rollen · State-machines · Modules · AI |
| Platform | platform | master admin | /master-admin | Tenants · Onboarding · Wiki |

Rol→werkruimtes-mapping: zorgmedewerker→[vandaag], planner→[rooster], teamleider→[team], beheerder→[bouwen, organisatie], tenant-admin→[systeem, bouwen, organisatie], master admin→ eigen rol-werkruimtes + [platform].

> **Open review-punt (Kevin):** de oorspronkelijke spec gaf beheerder alleen [bouwen]. Tijdens iteratie-1-review bleek dat beheerder daarmee geen klikbare navigatie meer had naar medewerkers/competenties/bezetting/diensten — kerntaken volgens CLAUDE.md. Daarom is de werkruimte **Organisatie** toegevoegd en krijgt beheerder twee werkruimtes. Bevestig of deze groepering klopt.

Functionaliteit die niet in een werkruimte-nav zit blijft bereikbaar via directe URL en sneltoetsen (`g …`, `/`); niets wordt verwijderd in deze iteratie. API-keys-beheer (eerder genoemd onder Systeem) heeft nog geen route en staat op de backlog; daarom niet in de nav.

## Cliëntdossier: 5 werkgebieden (doelbeeld, implementatie in Fase 2-slice "Cliëntdossier")

| Werkgebied | Bevat (huidige tabs) |
|---|---|
| Overzicht | dashboard-widgets: signaleringen, actuele medicatie, laatste rapportages, actieve doelen |
| Rapportage | rapportages (+ doel-koppeling) |
| Gezondheid | medicatie, medicatie-overzicht, toediening, allergieën, diagnoses, vaccinaties, risicoscreening, VBM, wilsverklaringen |
| Zorgplan | zorgplan, MDO, indicaties, vragenlijsten |
| Administratie | contactpersonen, verzekering, documenten, extra-velden, MIC-meldingen, signaleringen-beheer |

URL-doelbeeld: `/clienten/[id]/(overzicht|rapportage|gezondheid|zorgplan|administratie)`; huidige `/ecd/[id]/<tab>`-routes blijven tot die slice.

## Schermtype-patronen

Zes patronen, elk met verplichte states leeg/laden/fout/succes: werkruimte-start, lijstpagina, dossierpagina, formulier (inline, geen modals), wizard, admin-builder. Primitieven in `@openzorg/shared-ui`; referentie-implementaties per patroon in Fase 1-iteraties. "Vandaag" is de referentie voor werkruimte-start.

## Open punten

- "Wie ben ik": geen koppeling ingelogde gebruiker→Practitioner; Vandaag gebruikt een onthouden medewerker-keuze. Structurele oplossing (/api/me) op backlog.
- Werkruimte Team krijgt later een eigen signalen-startpagina (vervangt /dashboard als start).
