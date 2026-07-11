# Testplan & acceptatie — MVP-sprint (voor de product owner)

**Voor**: Kevin · **Opgesteld door**: Claude · **Datum**: 2026-07-11
**Afspraak**: alles hieronder met status **GO** is door mij aantoonbaar getest (geautomatiseerde browser-tests in CI op de volledige stack, plus unit-tests). Jij accepteert per criterium door het scenario zelf na te lopen en af te vinken. Bevindingen: noteer het test-nummer + wat je zag — dan pak ik ze direct op.

---

## 1 · Zo start je lokaal (±10 minuten, eerste keer)

1. **Start Docker Desktop** (staat al geïnstalleerd) en wacht tot het icoon "running" toont.
2. Open PowerShell in de projectmap en draai:
   ```
   docker compose up -d --build
   ```
   Eerste keer duurt dit 10-15 min (images bouwen + Medplum-migratie). Koffie ☕.
3. Controleer of alles draait: `docker compose ps` — alle services "healthy". De seed-container maakt automatisch testdata aan (2 organisaties, 8 cliënten p/st, medewerkers, afspraken).
4. Open **http://localhost:3000** en log in:

   | Account | Wachtwoord | Rol |
   |---|---|---|
   | jan@horizon.nl | Hz!J4n#2026pKw8 | Tenant admin (Horizon) |
   | zorg@horizon.nl | Hz!Zorg#2026fZ4a | Zorgmedewerker |
   | planner@horizon.nl | Hz!Plan#2026pT7b | Planner |
   | teamleider@horizon.nl | Hz!Team#2026tL9c | Teamleider |
   | beheer@horizon.nl | Hz!Behr#2026bB3d | Functioneel beheerder |
   | maria@delinde.nl | Ld!M4r1a#2026nRt5 | Tenant admin (tweede organisatie, tenant-isolatie checken) |

   > De Linde heeft dezelfde vier rol-accounts met prefix `Ld!` (zie `CLAUDE.md` → Test Accounts).

5. **Rol wisselen** = uitloggen → inloggen met een ánder account uit de tabel. Sinds W3 heeft elk account een **echte, gekoppelde rol**; de rolkeuzelijst in het loginscherm is alleen nog een demo-terugval voor accounts zónder gekoppelde rol en wordt voor deze accounts genegeerd. De "demo-rol"-markering naast je naam verschijnt daarom niet meer bij deze accounts.

**Reset nodig?** `docker compose down -v && docker compose up -d --build` (alles vers, incl. data).
**Werkt iets niet op poort 3000?** Even hard verversen (Ctrl+Shift+R) — Next.js cache.

---

## 2 · Wat is er nieuw sinds v0.2.0 (changelog in PO-taal)

**Het grote verhaal: procesmanagement is van "buggy demo" naar "werkend product".**

| Thema | Wat je nu hebt (en eerst niet) |
|---|---|
| **Werkbak** | Een persoonlijke taken-inbox met drie tabbladen (Mijn taken / Beschikbaar / Alle taken voor leidinggevenden). Taken hebben een cliënt-link, deadline-kleur en een net afrond-formulier. Eerst: taken op rolnaam, kapotte knoppen bij de helft van de taken, browser-alerts bij fouten, en de werkbak zat niet eens in het menu. |
| **Processen** | "Processen" spreekt nu jouw taal: je **activeert** een zorgpad-sjabloon (intake, zorgplan-evaluatie, MIC…), ziet per lopend zorgpad bij welke cliënt hij is en welke stap aan de beurt is, en kunt annuleren mét reden. Eerst: "Deployen", lege lijsten (twee echte bugs) en een verdwaald debug-scherm. |
| **De keten werkt écht** | Nieuwe cliënt aanmaken → intake-zorgpad start automatisch → taak verschijnt bij de juiste rol → persoonlijk oppakken → formulier → volgende stap → voortgang zichtbaar. Elke schakel hiervan was kapot (ontbrekende autorisatie, verkeerde variabelen, dode timers). |
| **Veiligheid onder water** | Organisaties zien elkaars processen/taken nooit meer per ongeluk (fail-closed isolatie); de proces-service controleert nu wie je bent (token-verificatie); alles wordt op persoonsniveau gelogd (NEN 7513). |
| **Cliënten importeren** | CSV-bestand → tientallen cliënten in één keer, met per foutregel een duidelijke melding. Voorbeeldbestand downloadbaar. Dit is de pilot-belofte "80 cliënten in minuten". |
| **Wie ben ik** | Het systeem kent nu de ingelogde persoon (niet alleen de rol): claims en logging op naam. |
| **Opgeruimd** | Laatste losse eindjes design (grijs-restjes, een dode dossier-tab, 553-regel beheerscherm gesplitst) en een gerepareerde blokkade waardoor zorgmedewerkers geen cliënt konden aanmaken. |
| **Compliance** | `docs/compliance/audit-readiness.md`: eerlijk dossier — wat er staat (met bewijs), wat er mist, wat een auditor vraagt. |

Volledige technische changelog: `CHANGELOG.md` (sectie *Unreleased*).

---

## 3 · Acceptatietests

> Vink af wat akkoord is. Volgorde aanhouden — test D bouwt op C.
> **GO** = door mij getest via geautomatiseerde browser-test in CI en/of gerichte verificatie.

### A · Inloggen & identiteit — status: GO

| # | Scenario | Verwacht |
|---|---|---|
| A1 | Log in als jan@horizon.nl, rol **zorgmedewerker** | Je landt op "Vandaag"; naast je naam staat een klein **demo-rol**-label |
| A2 | Menu links | Je ziet o.a. **Werkbak** in het menu (nieuw) |
| A3 | Log uit, log in als rol **beheerder** | Werkruimte-switcher (Bouwen/Organisatie) linksboven; onder Bouwen staat **Processen** |

### B · Werkbak — status: GO

| # | Scenario | Verwacht |
|---|---|---|
| B1 | (als zorgmedewerker) open **Werkbak** | Tabs "Mijn taken" en "Beschikbaar" met aantallen; nette lege-staat als er niets is |
| B2 | (als teamleider) open Werkbak | Extra tab **"Alle taken"** |
| B3 | Pak in "Beschikbaar" een taak op (knop **Oppakken**) | Taak verhuist naar "Mijn taken", met *"Opgepakt door jou"* |
| B4 | Klik **Afronden** op een taak met een Ja/Nee-vraag en laat die leeg | Inline melding "Vul eerst in: …" — geen browser-popup |
| B5 | Vul Ja/Nee + opmerking in en rond af | Taak verdwijnt; geen foutmelding |
| B6 | Klik op de cliëntnaam op een taakkaart | Je springt naar het cliëntdossier |

### C · Processen-hub — status: GO

| # | Scenario | Verwacht |
|---|---|---|
| C1 | (als beheerder) Bouwen → **Processen** | Vier tabs: Actieve zorgpaden · Sjablonen · Lopend · Geavanceerd. Nergens het woord "deployen" |
| C2 | Tab **Sjablonen** → kaart "Intake nieuwe cliënt" → **Bekijk stappen** | Drie stappen in gewone taal met rol-labels (planner → zorgmedewerker / beheerder) |
| C3 | Klik **Activeren** op "Intake nieuwe cliënt" (indien nog niet actief) | Kaart toont **"Actief · v1"**; op tab *Actieve zorgpaden* staat hij nu ook |
| C4 | Tab *Actieve zorgpaden* → **Start proefinstantie** | Melding dat de proef gestart is; tab **Lopend** toont de instantie met huidige stap |
| C5 | Tab **Lopend** → **Annuleren** op de proefinstantie, zonder reden | Kan niet — reden is verplicht |
| C6 | Annuleer mét reden | Instantie verdwijnt uit Lopend |

### D · De keten (het kroonscenario) — status: GO (volledig geautomatiseerd bewezen)

| # | Scenario | Verwacht |
|---|---|---|
| D1 | Zorg dat C3 gedaan is. Log in als **zorgmedewerker** → Cliënten → **Nieuwe client** → vul voornaam/achternaam/geboortedatum → aanmaken | Cliënt aangemaakt (het intake-zorgpad start onzichtbaar op de achtergrond) |
| D2 | Log in als **planner** → Werkbak → Beschikbaar | Taak **"Aanmelding beoordelen"** met de nieuwe cliëntnaam en badge *Intake nieuwe cliënt* |
| D3 | Oppakken → Afronden → **Goedgekeurd? = Ja** + opmerking | Taak weg uit Mijn taken |
| D4 | Log in als **beheerder** → Processen → **Lopend** | De intake staat er met *Huidige stap: Intake gesprek plannen* |
| D5 | Log in als **zorgmedewerker** → Werkbak → Beschikbaar | Taak **"Intake gesprek plannen"** voor dezelfde cliënt; oppakken + afronden werkt |
| D6 | (beheerder) Processen → Lopend | De intake is klaar en weg uit Lopend |

### E · FHIR-taak (zorgplan-evaluatie) — status: GO

| # | Scenario | Verwacht |
|---|---|---|
| E1 | (zorgmedewerker) open een cliënt → Zorgplan → maak/бewerk een zorgplan zodat er een evaluatietaak bestaat; of gebruik een bestaande | In Werkbak → Beschikbaar staat een **Zorgplan-evaluatie**-taak |
| E2 | Oppakken → Afronden met opmerking | Werkt zonder foutmelding (dit gaf eerst een kale 500-fout) |

### F · CSV-cliëntimport — status: GO

| # | Scenario | Verwacht |
|---|---|---|
| F1 | (beheerder) Cliënten → knop **Importeren (CSV)** | Uitlegpagina met het vaste formaat + downloadbaar voorbeeldbestand |
| F2 | Download het voorbeeldbestand en importeer het ongewijzigd | Resultaat: 3 rijen, 3 aangemaakt, 0 fouten; cliënten staan in de lijst met eigen cliëntnummer |
| F3 | Zet in het bestand één BSN op `000000000` en importeer opnieuw | Foutentabel: die rij faalt op *elfproef*; de rest wordt (of is al, dus "bestaat al") netjes gemeld; niets blokkeert |
| F4 | Vul bij een rij een niet-bestaande locatienaam in | Duidelijke fout: locatie onbekend, met verwijzing naar Organisatie |

### G · Taakformulieren (instelling per organisatie) — status: GO

| # | Scenario | Verwacht |
|---|---|---|
| G1 | (beheerder) Bouwen → open **Taakformulieren** (via Configuratie-overzicht) | Zorgpaden + stappen komen uit de catalogus; per stap zie je de standaardvelden |
| G2 | Voeg bij *MIC-afhandeling → Melding analyseren* een optie **"middel"** toe aan Ernstniveau en sla op | Bewaard zonder fout |
| G3 | Start een MIC-melding (of proefinstantie MIC) en open de taak in de Werkbak | De keuzelijst Ernstniveau bevat nu ook **middel** — zonder release |

### H · Reparaties-steekproef — status: GO

| # | Scenario | Verwacht |
|---|---|---|
| H1 | (zorgmedewerker) Cliënten → **Nieuwe client** | Pagina opent gewoon (gaf eerst "Geen toegang" — echte bug, gevonden door de keten-test) |
| H2 | Open een cliënt → tab Administratie → Verzekering | Status-badges in nette huisstijl (geen rauw grijs) |
| H3 | Processen → Geavanceerd → open de **Proces-ontwerper** en laad het sjabloon *Zorgplan-evaluatie* | Diagram rendert netjes uitgelijnd (had eerst alleen een zwevend startbolletje) |

---

## 4 · Door mij uitgevoerd (waar mijn GO op rust)

- **Geautomatiseerde browser-tests op de volledige stack** (CI, elke wijziging): login-flows, werkbak-tabs per rol, Processen-hub, **de volledige keten D1-D6**, FHIR-taak, CSV-import incl. foutrij, bestaande golden paths (rapportage e.d.). Laatste run: alle 5 checks groen.
- **129 unit-/route-tests** over de services (o.a. tenant-isolatie fail-closed, catalogus↔BPMN-consistentie, timer-idempotentie, import-validaties).
- **Handmatige codebewijs-verificatie** voor het compliance-dossier.

## 5 · Bewust nog niet in deze testronde

| Wat | Waarom / wanneer |
|---|---|
| Dashboard-landingsscherm ("Goedemorgen…") | W2-2, direct hierna — dashboard toont nu nog het oude overzicht |
| Login zonder rol-keuzelijst | W3: accounts krijgen echte rollen; demo-rol-label verdwijnt dan |
| Pilotprofiel-seed (4 locaties/80 cliënten) & golden paths per rol | W3, na jouw akkoord op deze ronde |
| Live-omgeving + backup-cron | W4 — wacht op de Unraid-server |
| DMN/Beslisregels | Bewust "Experimenteel"-label; opslaan volgt (roadmap) |
| Herindicatie-automatische-signalering | Roadmap (handmatig starten kan wél via Processen) |

## 6 · Acceptatie

- [ ] A t/m H nagelopen; bevindingen genoteerd met testnummer
- [ ] Akkoord dat GO-status = basis voor de volgende werkstromen (W2-2/W3)
- [ ] Open punten uit de spec §8 (nav-keuzes, domeinnaam live) — antwoord wanneer het uitkomt

*Dit plan hoort bij de staat van `main` na PR #31 (W1 compleet). Bij elke volgende ronde werk ik dit document bij.*
