# Demo-script — OpenZorg voor VVT + thuiszorg (30 minuten)

**Voor**: verkoop / product owner die de demo geeft · **Doelgroep**: bestuurder, zorgmanager of ICT-verantwoordelijke van een kleine tot middelgrote VVT-instelling met thuiszorg.
**Laatst bijgewerkt**: 2026-07-11 · **Bron van de "werkt"-claims**: de geautomatiseerde browsertests in `apps/web/tests/e2e/` (draaien bij elke wijziging op de volledige stack in CI) en het acceptatietestplan `docs/testplan-acceptatie-mvp.md`. Elke stap hieronder verwijst naar zijn bewijs.

> **Waarom dit script eerlijk is.** We laten alleen zien wat aantoonbaar werkt. Elke stap noemt de test of het testplan-scenario dat de flow in CI bewijst. Wat nog niet werkt, tonen we niet en verzwijgen we niet — dat staat in de `feature-roadmap-matrix.md` naast dit script. Een VVT-inkoper prikt door een gladde façade heen; onze kracht is dat de demo doet wat hij belooft.

---

## Het verhaal dat je vertelt

De hele demo speelt zich af bij één herkenbare instelling: **Zorggroep Horizon — 4 locaties, ongeveer 80 cliënten, zowel intramurale afdelingen als thuiszorg-routes.** Dat is bewust het profiel van een realistische eerste pilot-klant. De kijker moet zijn eigen organisatie terugzien, niet een abstracte showcase. Je loopt langs zes rollen/momenten en eindigt met de twee onderdelen waar OpenZorg het verschil maakt: **planning** en **procesmanagement**.

Rode draad: *"Dit is geen mockup. Alles wat ik u laat zien, draait, en elke stap wordt bij elke code-wijziging automatisch getest."*

---

## Voorbereiding (5 minuten vóór de demo, niet meegeteld)

1. **Omgeving**: een draaiende stack met de demo-tenant Horizon geseed (lokaal `docker compose up -d --build`, of de staging-URL zodra live). Controleer dat je kunt inloggen en dat de Processen-hub het intake-zorgpad als **Actief** toont (zie stap 4 — activeer het anders even vooraf).
2. **AI**: wil je de AI-samenvatting laten zien (stap 2), controleer dan dat de lokale AI (Ollama) bereikt wordt vanuit de tenant-AI-instellingen. Is die niet geconfigureerd, sla de AI-knop dan over — kondig hem aan als "lokale AI, draait binnen uw eigen netwerk" en toon hem pas als hij live staat. Nooit een AI-knop indrukken die je niet vooraf getest hebt.
3. **Accounts** — log per rol in met een eigen account (elk account heeft sinds de identiteitslaag een echte, gekoppelde rol; je hoeft géén rol uit een keuzelijst te kiezen):

   | Rol in de demo | Account | Wachtwoord |
   |---|---|---|
   | Teamleider | teamleider@horizon.nl | Hz!Team#2026tL9c |
   | Zorgmedewerker | zorg@horizon.nl | Hz!Zorg#2026fZ4a |
   | Planner | planner@horizon.nl | Hz!Plan#2026pT7b |
   | Functioneel beheerder | beheer@horizon.nl | Hz!Behr#2026bB3d |
   | Tenant-admin (optioneel) | jan@horizon.nl | Hz!J4n#2026pKw8 |

   > Rol wisselen = uitloggen en met een ander account inloggen. Accounts staan in `docs/testplan-acceptatie-mvp.md` §1 en `apps/web/tests/e2e/helpers/test-users.ts`. Wil je tenant-isolatie laten zien, log dan kort in als `maria@delinde.nl` (tweede instelling "De Linde") — die ziet nooit Horizon-gegevens.

4. **Wat je deze demo NIET aanraakt** (en waarom) — houd deze lijst in je hoofd:
   - **Beslisregels / DMN** (Processen → Geavanceerd → Beslisregels): gelabeld **"Experimenteel"**. Rendert wél, maar opslaan naar de engine is roadmap. Niet openen tijdens de demo.
   - **Medicatie als "medicatieveiligheid"**: het medicatie-overzicht bestaat, maar interactiebewaking, dubbele controle en G-Standaard-koppeling (BEM) zijn licentie-geblokkeerd (roadmap R-01/R-02). Toon medicatie als registratie, claim geen veiligheidscontrole.
   - **Facturatie**: de basis (prestaties/declaraties) staat, maar Vektis-/iWlz-export is roadmap (R-04/R-05). Open het niet als "declareren werkt end-to-end".
   - **Dossier-diepte die roadmap is**: gestructureerde meetinstrumenten (Braden, SNAQ-RC, MMSE…), EPUAP-wondclassificatie en de 4-domein-zorgleefplanstructuur zijn nog niet af (Epic B/C). Blijf in het dossier bij de tabs die je in stap 2 loopt.
   - Kies nooit een rol uit de login-keuzelijst voor de zorgflows — gebruik de dedicated rol-accounts hierboven, anders krijg je een "demo-rol"-terugval in beeld.

---

## Het script (30 minuten)

Tijdsindicatie per blok staat tussen haakjes. Loop de blokken in deze volgorde: planning en processen zijn bewust de climax.

### 1 · De teamleider begint zijn dag (3 min)

- **Account**: teamleider@horizon.nl · **Route**: `/dashboard` (start-scherm van de werkruimte "Team")
- **Verwacht scherm**: een begroeting op dagdeel ("Goedemorgen/…"), een rij **snelle acties** (waaronder **Werkbak**), en signaal-/taak-secties die netjes leeg blijven of vullen — nooit een foutmelding, ook niet als een databron traag is.
- **Kernzin voor de verkoper**: *"De teamleider landt op één overzicht: waar moet ik vandaag op letten, en met één klik ben ik in de taken."*
- **Valkuil**: laat de secties even uitladen voordat je klikt; ze degraderen stil, dus wacht niet op iets dat "hoort te knipperen".
- **Bewijs**: `apps/web/tests/e2e/dashboard.spec.ts` ("dashboard toont begroeting en degradeert zonder foutmeldingen") + testplan §3-A.

### 2 · De zorgmedewerker: van vandaag naar dossier naar rapportage (7 min)

- **Account**: zorg@horizon.nl · **Route**: `/vandaag`
- **Verwacht scherm**: "Vandaag" met drie werkgebieden — **Mijn route vandaag**, **Open taken** en **Overdracht**. Dit is het dagelijkse thuis van de zorgmedewerker.
- **Doe dit**:
  1. Open vanuit **Cliënten** (`/ecd`) een cliënt van Horizon → je komt in het dossier met werkgebieden.
  2. Ga naar **Rapportages** en schrijf een **SOEP**-rapportage (of een vrije notitie). Sla op → hij verschijnt direct in de lijst.
  3. **AI-samenvatting** (indien geconfigureerd, zie voorbereiding): druk op de samenvat-knop op de rapportages en laat de lokale AI een dagsamenvatting maken.
- **Kernzin**: *"Rapporteren kost seconden, de AI vat de dag samen — en die AI draait lokaal, uw cliëntgegevens verlaten uw netwerk niet."*
- **Valkuilen**: blijf in de tabs die je toont (dossier, rapportages); duik niet in medicatie/risicoscreening met een "veiligheids"-claim (zie voorbereiding). AI-knop alleen indrukken als je hem vooraf getest hebt.
- **Bewijs**: `vandaag.spec.ts` (route/taken/overdracht), `golden-path-zorgmedewerker.spec.ts` ("login → client openen → rapportage schrijven → opslaan → zien in lijst"), `rapportage-soep.spec.ts` (partiële SOEP). AI-samenvatting: bestaand en solide (gap-analyse §5, D-06).

### 3 · Climax 1 — Planning: rooster, bezetting, thuiszorg-route (7 min)

- **Account**: planner@horizon.nl · **Route**: `/planning/rooster` (start-scherm van de werkruimte "Rooster")
- **Doe dit**:
  1. **Rooster** (`/planning/rooster`): toon het rooster per locatie/afdeling met sleep-en-neerzet-diensten. Benoem dat CAO-VVT/ATW-regels (48u/week, 11u rust, max dienstduur) meelopen als bewaking.
  2. **Bezetting** (`/planning/bezetting`): laat de bezettingscheck zien — per dienst het minimum aan medewerkers/competenties tegen wat er staat. Dit koppelt aan de bezettingsprofielen die de beheerder inricht (stap 5).
  3. **Dagplanning** (`/planning/dagplanning`): presenteer dit als de **thuiszorg-route** — de dagindeling langs cliënten aan huis. Dit draagt in de demo (en pilot) het thuiszorg-verhaal.
- **Kernzin**: *"Eén planningsmodule voor beide werelden: intramuraal roosteren én de thuiszorg-route van de dag — met de CAO en de minimale bezetting als vangnet, niet als handwerk."*
- **Valkuilen**: presenteer de dagplanning als dagindeling/route, niet als mobiele tijdregistratie of GPS-route-navigatie — die (mobiele check-in E-03, routelijst-app E-04) zijn roadmap. Reistijd-optimalisatie tussen adressen is eveneens roadmap.
- **Eerlijk kader (belangrijk)**: de planningsmodule zit sinds release v0.2.0 in het product (`CHANGELOG.md`: rooster drag-and-drop, planning-engine valideer/optimaliseer/genereer, bezettingsprofielen, CAO/ATW, herhalingen, wachtlijst). Er is nog **geen** aparte geautomatiseerde browsertest voor de planner-flow; die golden-path-test staat op de planning (W3, zie `docs/testplan-acceptatie-mvp.md` §5). Demonstreer deze module dus **live** en zeg er eerlijk bij dat het CI-bewijs voor de planner-flow in aanbouw is, in tegenstelling tot de proceslaag hierna die volledig door CI gedekt is.

### 4 · Climax 2 — Processen: de keten die écht loopt (8 min)

Dit is het sterkste blok en volledig door CI bewezen. Je laat een zorgpad van begin tot eind lopen, over drie rollen heen.

- **Account**: beheer@horizon.nl · **Route**: `/admin/workflows` (werkruimte "Bouwen" → **Processen**)
- **Doe dit**:
  1. **Sjablonen-tab**: toon de galerij met zorgpad-sjablonen in gewone taal (o.a. **Intake nieuwe cliënt**, **Zorgplan-evaluatie**, **MIC-afhandeling**). Klik **Bekijk stappen** op Intake — je ziet drie stappen met rol-labels. Nergens staat het woord "deployen".
  2. Klik **Activeren** op *Intake nieuwe cliënt* (of wijs het **Actief · v1**-label aan als het al draait).
  3. Wissel naar **zorgmedewerker** (zorg@horizon.nl) → **Cliënten → Nieuwe client** (`/ecd/nieuw`), vul voornaam/achternaam/geboortedatum en maak aan. *Op de achtergrond start automatisch het intake-zorgpad.*
  4. Wissel naar **planner** (planner@horizon.nl) → **Werkbak** (`/werkbak`) → tab **Beschikbaar**: daar staat de taak **"Aanmelding beoordelen"** met de nieuwe cliëntnaam. Klik **Oppakken** → hij verhuist naar **Mijn taken** met *"Opgepakt door jou"*. Klik **Afronden**, beantwoord de Ja/Nee-vraag + opmerking.
  5. Wissel naar **beheerder** → **Processen → Lopend**: het zorgpad staat er, met de **huidige stap** ("Intake gesprek plannen") bij de juiste cliënt.
- **Kernzin**: *"Nieuwe cliënt aanmaken zet automatisch het zorgpad in gang, de juiste rol krijgt de taak persoonlijk in de werkbak, en u ziet realtime waar elke cliënt in het proces zit — en dit exacte scenario draait bij elke wijziging in onze testautomatisering."*
- **Valkuilen**: neem de tijd — de werkbak laadt de taak zodra de achtergrond-trigger klaar is (kan enkele seconden duren; herlaad de tab desnoods). Ga **niet** naar Geavanceerd → Beslisregels/DMN (Experimenteel). Annuleren van een lopend zorgpad vraagt een verplichte reden — dat is bedoeld, geen bug.
- **Bewijs**: `proces-keten.spec.ts` (de volledige keten activeren → automatische start → persoonlijke claim → formulier → voortgang in de hub → afronden), `admin-processen.spec.ts` (hub met vier tabs + sjablonen-galerij, geen "deployen"), `werkbak.spec.ts` (werkbak via navigatie, tabs, oversight-tab "Alle taken"), `fhir-taak.spec.ts` (een zorgplan-evaluatietaak is opneembaar en afrondbaar zonder fout), `flowable-tenancy.spec.ts` (per-tenant isolatie). Testplan §3-C/D/E dekt dit stap voor stap.

### 5 · Beheer: de instelling inrichten zonder IT-project (4 min)

- **Account**: beheer@horizon.nl · **Werkruimtes "Bouwen" + "Organisatie"**
- **Doe dit**:
  1. **Organisatie** (`/admin/organisatie`, `/admin/medewerkers`, `/admin/bezetting`, `/admin/dienst-config`): laat zien dat de 4 locaties, afdelingen, diensten en bezettingsnormen configuratie zijn — geen code, geen ticket naar de leverancier.
  2. **CSV-cliëntimport** (`/ecd/import`): open de importpagina, toon het vaste kolomformaat en het downloadbare voorbeeldbestand. Kernboodschap: **80 cliënten in minuten**, met per foutregel een duidelijke melding (bv. een BSN die de elfproef niet haalt, of een onbekende locatie).
  3. **Taakformulieren** (`/admin/task-form-options`): voeg als voorbeeld een keuze-optie toe aan een processtap en sla op — die verschijnt daarna in de werkbak-taak **zonder** nieuwe release.
- **Kernzin**: *"U richt uw eigen organisatie, zorgpaden en formulieren in — en zet in één import uw hele cliëntenbestand klaar. Geen maandenlang implementatietraject."*
- **Valkuilen**: de CSV-import is bewust één vast formaat (geen mapping-wizard, geen overname uit een bestaand systeem — dat is roadmap I-05). Presenteer het als "snel opstarten", niet als volledige data-migratie.
- **Bewijs**: `client-import.spec.ts` (CSV met een foute rij → bruikbaar foutenrapport → geslaagde rijen in de cliëntenlijst) + testplan §3-F (import) en §3-G (taakformulieren).

### 6 · Afsluiter: waarom OpenZorg anders is (1 min)

- **Route**: blijf op een rustig scherm (bijv. het dashboard) of toon deze punten mondeling.
- **De vier boodschappen**:
  1. **Open source** (EUPL 1.2) — geen vendor lock-in, de code is transparant en audit-baar.
  2. **FHIR-native** — alle zorggegevens in de internationale standaard FHIR R4; uw data is van u en overdraagbaar.
  3. **Lokale AI** — de AI-assistent draait binnen uw eigen netwerk (Ollama); cliëntgegevens gaan niet naar een cloud-model.
  4. **Eerlijke roadmap** — verwijs naar `feature-roadmap-matrix.md`: wat werkt vandaag, wat is gedeeltelijk, en wat is licentie-geblokkeerd met concrete doorlooptijden.
- **Kernzin**: *"Wat u zag werkt vandaag. Wat er nog niet is, staat zwart-op-wit op onze roadmap met doorlooptijd — geen verrassingen na de handtekening."*
- **Vervolg**: prijs- en contractafspraken lopen separaat (bewust buiten deze demo). De volgende stap is de pilot: zie `pilot-onboarding-runbook.md`.

---

## Naslag: bewijsregister

| Demo-stap | Bewijs in `apps/web/tests/e2e/` | Testplan-scenario |
|---|---|---|
| 1 · Teamleider-dashboard | `dashboard.spec.ts` | §3-A |
| 2 · Zorgmedewerker → dossier → rapportage | `vandaag.spec.ts`, `golden-path-zorgmedewerker.spec.ts`, `rapportage-soep.spec.ts` | §3-A |
| 3 · Planning | *(geen e2e — CHANGELOG v0.2.0; planner-golden-path is W3-roadmap)* | §5 (bewust nog niet) |
| 4 · Processen-keten | `proces-keten.spec.ts`, `admin-processen.spec.ts`, `werkbak.spec.ts`, `fhir-taak.spec.ts`, `flowable-tenancy.spec.ts` | §3-C/D/E |
| 5 · Beheer + CSV-import | `client-import.spec.ts` | §3-F, §3-G |
| Login & identiteit (doorlopend) | `auth-helper.spec.ts`, `smoke.spec.ts` | §3-A |

*Prijsafspraken en commerciële voorwaarden: separaat (buiten scope van dit script — zie spec §10).*
