# Pilot-inrichtingsdraaiboek

> **Doel:** stap-voor-stap aantonen dat wij een échte VVT-instelling met
> thuiszorg in OpenZorg kunnen inrichten — van lege tenant tot een werkend
> pilotprofiel (4 locaties, ~80 cliënten, actieve zorgpaden, rollen per
> medewerker). Dit document is voor de PO/consultant die de inrichting bij de
> klant uitvoert via de gebruikersinterface.

**Pilotprofiel (verkoop-spec §1):** een kleine VVT-instelling met een
thuiszorgtak, ~4 locaties en ±80 cliënten. Onderstaande stappen bouwen precies
dat profiel op. Per stap staan de **schermroute** en het **verwachte resultaat**
zodat je onderweg kunt controleren of alles klopt.

Reken op ongeveer een halve dag voor de eerste inrichting; de cliëntimport en
zorgpad-activatie zijn samen minder dan een uur werk.

---

## Overzicht van de stappen

| # | Stap | Werkruimte / rol | Schermroute |
|---|------|------------------|-------------|
| 1 | Tenant aanmaken | Platform (master-admin) | `/master-admin` → Onboarding |
| 2 | Organisatiestructuur | Organisatie (beheerder) | `/admin/organisatie` |
| 3 | Diensten + bezettingsprofielen | Organisatie (beheerder) | `/admin/dienst-config`, `/admin/bezetting` |
| 4 | Cliënten importeren (CSV) | Cliënten (beheerder) | `/ecd/import` |
| 5 | Zorgpaden activeren | Bouwen (beheerder) | `/admin/workflows` → Sjablonen |
| 6 | Accounts + rollen per medewerker | Platform / roadmap | zie stap 6 |
| 7 | Controle-rondje per rol | alle rollen | zie stap 7 |

---

## Stap 1 — Tenant aanmaken (master-admin)

Een nieuwe klant = een nieuwe tenant (eigen Medplum-project, eigen data-isolatie).

- **Schermroute:** log in als master-admin → **Platform** → **Tenants**
  (`/master-admin`). Nieuwe klant erbij? Gebruik **Onboarding**
  (`/master-admin/onboarding`) en doorloop de wizard: organisatienaam, sector(en)
  (VVT; eventueel GGZ/GHZ), en het eerste beheerdersaccount.
- **Verwacht resultaat:** de tenant verschijnt in de tenant-lijst; je kunt als
  master-admin via de **tenant-switcher** (rechtsboven) naar de nieuwe omgeving
  wisselen. Er is minimaal één beheerder- of tenant-admin-account waarmee de
  klant zelf kan inloggen.

> Tip: bewaar de inloggegevens van het eerste beheerdersaccount veilig; daarmee
> doet de klant (of jij namens de klant) de rest van de inrichting.

---

## Stap 2 — Organisatiestructuur opbouwen

Bouw de boom: instelling → locaties → afdelingen/teams. Voor het pilotprofiel:
3 intramurale locaties + 1 thuiszorglocatie, elk met een paar afdelingen/teams.

- **Schermroute:** log in als **functioneel beheerder** → kies in de
  werkruimte-switcher (linksboven) **Organisatie** → **Organisatie**
  (`/admin/organisatie`).
- **Doen:**
  1. Onder **Organisatiestructuur** zie je de bestaande boom met de tenant-root.
  2. Gebruik **Locatie toevoegen**: kies een **Naam** (bijv. *Horizon Centrum*),
     een **Bovenliggende organisatie** (de tenant-root voor een locatie), en een
     **Type** (`Locatie` voor de intramurale huizen, `Thuiszorg team` of
     `Locatie` voor de thuiszorgtak). Vul adres/telefoon in.
  3. Voeg per intramurale locatie 2 afdelingen/teams toe (Type `Team`), met de
     locatie als bovenliggende organisatie.
- **Verwacht resultaat:** de boom toont de instelling met 4 locaties en de
  onderliggende afdelingen. De cliëntimport in stap 4 matcht op de **exacte
  locatienaam**, dus noteer de namen zoals je ze hier typt.

---

## Stap 3 — Diensten en bezettingsprofielen

Voor de intramurale locaties leg je de dienstsoorten (vroeg/laat/nacht) en de
minimale bezetting per dienst vast — de basis waarop de planningsmodule roostert
en gaten signaleert.

- **Schermroute (diensten):** werkruimte **Organisatie** → **Diensten**
  (`/admin/dienst-config`). Kies de locatie en leg de diensttypen vast
  (starttijd, eindtijd, kleur). Diensten erven van tenant → locatie → afdeling.
- **Schermroute (bezetting):** werkruimte **Organisatie** → **Bezetting & normen**
  (`/admin/bezetting`). Leg per afdeling en per dienst de minimale bezetting vast
  (aantal per competentie, bijv. 1 verpleegkundige + 2 verzorgenden in de vroege
  dienst).
- **Verwacht resultaat:** per intramurale locatie staan de diensttypen klaar en
  hebben de afdelingen een bezettingsprofiel. In het **Rooster**
  (`/planning/rooster`) en de bezettingscheck zie je de normen terug.

> De thuiszorglocatie werkt route-gebaseerd (dagplanning per medewerker) en heeft
> geen intramuraal bezettingsprofiel nodig.

---

## Stap 4 — Cliënten importeren via CSV

80 cliënten opvoeren mag geen dagen kosten. De CSV-import doet het in minuten,
met een foutenrapport dat per rij zegt wat er misging.

- **Schermroute:** werkruimte-onafhankelijk → **Cliënten** (`/ecd`) → knop
  **Importeren (CSV)** → importscherm (`/ecd/import`).
- **Doen:**
  1. Download op het importscherm het **voorbeeldbestand**
     (`/voorbeelden/clienten-import-voorbeeld.csv`) en gebruik het als sjabloon.
  2. Vast formaat (kolomnamen verplicht in de header; volgorde vrij):
     `achternaam;voornaam;geboortedatum;bsn;straat;huisnummer;postcode;plaats;locatie`
     - **Verplicht:** `achternaam`, `geboortedatum` (JJJJ-MM-DD).
     - **`bsn`** is optioneel; staat er wel een BSN, dan wordt de elfproef
       gecontroleerd én op dubbelen getoetst.
     - **`locatie`** moet exact matchen op de naam van een locatie uit stap 2.
  3. Kies het bestand en start de import.
- **Verwacht resultaat:** een resultaatscherm met **totaal / aangemaakt /
  fouten**. De foutentabel noemt per rij het veld en de reden (NL), zodat de
  beheerder precies ziet welke rij waarom faalde. Geldige rijen zijn direct
  zichtbaar in de cliëntenlijst.

> Voor het pilotprofiel: verdeel ~60 cliënten over de 3 intramurale locaties en
> ~20 over de thuiszorglocatie via de kolom `locatie`.

---

## Stap 5 — Zorgpaden activeren

Zorgpaden (intake, zorgplan-evaluatie, herindicatie, MIC-afhandeling,
vaccinatiecampagne) zijn kant-en-klare sjablonen. Activeren = per tenant
inschakelen; daarna verschijnen taken automatisch in de werkbak van de juiste
rol.

- **Schermroute:** werkruimte **Bouwen** → **Processen** (`/admin/workflows`) →
  tab **Sjablonen**.
- **Doen:** klik per gewenst zorgpad op **Activeren**. Met **Bekijk stappen** zie
  je vooraf welke stappen en rollen erbij horen. Fijnafstemming van de
  afrond-formulieren doe je in **Taakformulieren** (`/admin/task-form-options`):
  per zorgpad en stap kun je velden toevoegen of aanpassen zonder nieuwe release.
- **Verwacht resultaat:** de geactiveerde sjablonen tonen een label **Actief ·
  v1** (of hoger). In de tab **Lopend** verschijnen instanties zodra een trigger
  afgaat (bijv. een nieuwe cliënt start automatisch de intake).

---

## Stap 6 — Accounts en rollen per medewerker

Elke medewerker logt in met een eigen account dat aan een **server-rol** hangt
(planner, teamleider, zorgmedewerker, functioneel beheerder). De rol bepaalt de
werkruimte en de rechten; er is dan géén demo-rolkeuze meer bij het inloggen.

- **Hoe het technisch werkt (referentie):** de W3-2-seed
  (`infra/scripts/seed.sh`) maakt per account een **Practitioner** met de
  extensie `https://openzorg.nl/extensions/rol` en koppelt de
  ProjectMembership-`profile` daaraan. Bij inloggen leest de app die rol via
  `/api/me`; is er een rol, dan verdwijnt de rolkeuze. De rol-mapping in de seed:
  `jan@horizon.nl` → tenant-admin, en `planner@…` / `teamleider@…` /
  `zorg@…` / `beheer@…` → hun respectieve rol.
- **Voor een échte klant:** het aanmaken van medewerkers en het koppelen van een
  rol gebeurt via de beheer-UI (**Organisatie → Medewerkers**,
  `/admin/medewerkers`). Het self-service koppelen van accounts + rollen via de
  UI is een roadmap-item; tot die tijd zetten wij (consultant) de rol-koppeling
  in bij de onboarding, op dezelfde manier als de seed dat doet.
- **Verwacht resultaat:** elke medewerker logt in en landt direct in de juiste
  werkruimte (planner → Rooster, teamleider → Team/Overzicht, beheerder →
  Bouwen/Organisatie), zónder rolkeuze en zónder het label "demo-rol".

---

## Stap 7 — Controle-rondje per rol

Loop na de inrichting één keer per rol de kern-flow af (dit zijn precies de
E2E-"golden paths" die in CI bewaakt worden):

- **Planner:** log in → **Rooster** (`/planning/rooster`) opent met de grid →
  **Dagplanning** (`/planning/dagplanning`) rendert zonder fout → **Werkbak**
  bereikbaar via de navigatie.
- **Functioneel beheerder:** **Organisatie** (`/admin/organisatie`) toont de
  boom → **Bouwen → Processen → Sjablonen** toont de 5 zorgpaden →
  **Taakformulieren** toont de catalogus-stappen.
- **Teamleider:** **Dashboard** toont de begroeting → **MIC-meldingen**
  (`/mic-meldingen`) → nieuwe melding aanmaken → melding staat in de lijst →
  **Werkbak** toont de tab **Alle taken**.
- **Zorgmedewerker:** **Cliënten** (`/ecd`) → cliënt openen → **Rapportage**
  schrijven en opslaan → rapportage staat in de lijst.

Slaagt elke flow, dan is het pilotprofiel verkoop-klaar.

---

## Wat het script `seed-pilotprofiel.sh` automatiseert (demo/staging)

Voor **demo- en staging-omgevingen** hoef je stap 2 en 4 niet handmatig te doen.
Het script `infra/scripts/seed-pilotprofiel.sh` bouwt de tenant *Zorggroep
Horizon* in één keer uit tot het pilotprofiel:

- **Logt in** als `jan@horizon.nl` (PKCE) en zoekt de tenant-root-Organization op.
- **Maakt 4 locaties** aan onder de root: *Horizon Centrum*, *Horizon Oost*,
  *Horizon West* (intramuraal) en *Thuiszorg Regio Noord* (extramuraal).
- **Maakt 2 afdelingen** per intramurale locatie.
- **Importeert 80 cliënten** via exact hetzelfde endpoint als de UI
  (`POST /api/clients/import`): 60 verdeeld over de 3 intramurale locaties en 20
  in de thuiszorg (realistische NL-namen, geboortedata 1935–1955, zonder BSN).
- **Is idempotent:** bestaande locaties/afdelingen worden hergebruikt, en de
  import wordt overgeslagen zodra er al ≥ 60 cliënten zijn — een tweede run
  dupliceert dus niets.

Draaien (standaardpoorten):

```sh
MEDPLUM_BASE_URL=http://localhost:8103 \
ECD_BASE_URL=http://localhost:4001 \
sh infra/scripts/seed-pilotprofiel.sh
```

Het script logt een samenvatting (locaties aangemaakt/hergebruikt, afdelingen,
en het importresultaat totaal/aangemaakt/fouten). Dit is een **demo/staging**-
hulpmiddel en hoort niet in de CI-keten of in productie — voor echte klanten
volg je de UI-stappen hierboven.
