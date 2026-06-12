# Test-checklist 2026-04-15

Alle wijzigingen sinds 14 april 16:00, in testbare volgorde. Vink af wat werkt, markeer wat stuk is en stuur screenshots.

## 🔥 Fixes middag-sessie 15 april (test deze EERST)

Na deze middag-sessie zijn een aantal blockers opgelost. Verifieer in deze volgorde — alles hieronder moet werken voor de andere tests zin hebben.

- [ ] **Medewerkers lijst** (http://192.168.1.10:13000/admin/medewerkers) — moet **21 medewerkers** (Horizon) of ~20 (De Linde) tonen. Was leeg door een routing-bug waarbij vragenlijsten `/:id` catch-all `/api/medewerkers` opving.
- [ ] **Organisatie lijst** (http://192.168.1.10:13000/admin/organisatie) — moet **9 organisaties** tonen. Zelfde routing-bug.
- [ ] **Rooster pagina** (http://192.168.1.10:13000/rooster) — medewerker-dropdown moet gevuld zijn met 21 namen; niet meer "geen medewerkers".
- [ ] **Contracten** (http://192.168.1.10:13000/admin/contracten) — mag leeg zijn (0 geseed) maar **geen foutmelding**. Was `Invalid search chain: _has:extension:url` van Medplum.
- [ ] **Clientenlijst** (http://192.168.1.10:13000/ecd) — alle cliënten zichtbaar inclusief inactieve wanneer je "Toon inactief" aanzet. Was `Boolean search value must be 'true' or 'false'` van Medplum.
- [ ] **Validatieregels** (http://192.168.1.10:13000/admin/validatie) — maak een regel, refresh, regel is er nog. Was duplicate-route bug waarbij oude handlers in configuratie.ts de nieuwe shadowen.
- [ ] **State-machines** (http://192.168.1.10:13000/admin/state-machines) — dropdown toont **10 resource-types**: Patient, Practitioner, Appointment, CarePlan, Task, MedicationRequest, ServiceRequest, Encounter, Consent, RiskAssessment.
- [ ] **Zorgplan verantwoordelijke** (http://192.168.1.10:13000/ecd/{id}/zorgplan) — "Verantwoordelijke behandelaar" is nu een **dropdown** (PractitionerPicker), geen vrij tekstveld meer. Dit werkte pas nadat medewerkers-endpoint weer data gaf.
- [ ] **MDO deelnemers** — zelfde PractitionerPicker.
- [ ] **Medicatie voorschrijver** — zelfde PractitionerPicker.
- [ ] **Workflow canvas** (http://192.168.1.10:13000/admin/workflows/canvas) — na laden van een template is het **start-event al geselecteerd** en zie je direct het "Trigger-type" panel rechts (api/form/timer/event). Was discoverability-bug.
- [ ] **Workflow quick-insert** — 5 gekleurde knoppen boven het canvas (User Task / Beslissing / Parallel / Service / Einde). Klik toevoegt een shape naast het start-event of de huidige selectie.

Als iets van het bovenstaande NIET werkt, stop met testen en rapporteer — er zit dan een regressie in die de rest van de test ook blokkeert.

---


**Test-omgeving:** http://192.168.1.10:13000
**Login:** `admin@openzorg.nl` / `Oz!Adm1n#2026mXq7` (master) of `jan@horizon.nl` / `Hz!J4n#2026pKw8` (tenant beheerder)

> Doe altijd een **hard refresh** (Ctrl+Shift+R) voordat je een pagina test — Next.js cachet agressief.

---

## 1. Dashboard

URL: http://192.168.1.10:13000/dashboard

- [ ] **Persoonlijke begroeting** — je ziet "Goedemorgen, Jan" (of je eigen naam uit localStorage)
- [ ] **Stats-row** toont 4 kaarten: Clienten / Afspraken vandaag / Open taken / Wachtlijst
- [ ] **Mijn taken** preview (rechts) — eerste 3 taken uit werkbak, klikt door naar `/werkbak`
- [ ] **Signaleringen** card — top 5 actieve flags met iconen (🚨 valrisico, ⚠️ allergie, 🦠 MRSA). Klikken springt naar cliëntpagina
- [ ] **Actieve modules** sectie — toont live welke features aan/uit staan (bv. na master-admin toggle)

## 2. Clientenlijst

URL: http://192.168.1.10:13000/ecd

- [ ] Je ziet **~30 cliënten** (Horizon) of ~20 (De Linde) met Nederlandse namen
- [ ] Elke rij heeft een **gekleurde status-badge**: Aangemeld (blauw) / In intake (amber) / In zorg (groen) / Overdracht / Uitgeschreven / Overleden
- [ ] **"Alle statussen"** dropdown rechts boven werkt als filter
- [ ] **Zoekveld** zoekt op naam/BSN/locatie
- [ ] **Locatie-filter** dropdown werkt
- [ ] Elke cliënt heeft realistische data: BSN, leeftijd, adres, indicatie (ZZP/VPT/MPT)

## 3. Cliëntdossier — status-transities

URL: http://192.168.1.10:13000/ecd/{random-id}

- [ ] **Traject-status badge** bovenin, kleurgecodeerd
- [ ] Dropdown **"→ wijzig"** naast de badge
- [ ] Kies een nieuwe status → confirm-dialoog → refresh → badge is bijgewerkt
- [ ] Toegestane transities:
  - Aangemeld → In intake / Uitgeschreven
  - In intake → In zorg / Uitgeschreven
  - In zorg → Overdracht / Uitgeschreven / Overleden
  - Overdracht → In zorg / Uitgeschreven
  - Uitgeschreven → Aangemeld
  - Overleden = terminaal
- [ ] Profielkaart toont foto, edit-knop, signaleringen, indicatie, huisarts
- [ ] Alle 15 tabs werken (rapportages, medicatie, zorgplan, contactpersonen, mdo, vbm, etc.)

## 4. Werkbak

URL: http://192.168.1.10:13000/werkbak

- [ ] **Filter-bar** bovenin: zoek / proces-type / status
- [ ] Proces-type dropdown bevat alleen processen die écht taken hebben
- [ ] Status-filter: Alles / Niet geclaimd / Door mij / Door anderen
- [ ] Teller: "X van Y taken zichtbaar" + "filters wissen"-knop
- [ ] Als een taak een **dueDate** heeft: kleurgecodeerd ⏰-badge (groen >3d, amber <3d, koraal verlopen)
- [ ] Assignee zichtbaar onder taaknaam als taak geclaimd is

## 5. Workflow canvas (killer demo)

URL: http://192.168.1.10:13000/admin/workflows/canvas

- [ ] **"+ Nieuw (leeg)"** reset canvas naar lege start-event
- [ ] **"⬆ Importeer BPMN"** accepteert plak-XML en toont het diagram
- [ ] **Template-dropdown** → kies "Intake Proces" → diagram rendert met lijnen (geen losse cirkels meer)
- [ ] Klik op **"Goedgekeurd?"** gateway → properties-panel rechts toont:
  - ID + naam
  - Uitgaande paden ("→ Intake plannen", "→ Afwijzing") met bewerkbare conditie per pad
- [ ] Klik op **StartEvent** → panel toont:
  - Trigger-type dropdown (API / Formulier / Timer / Event)
  - Bij API: readonly cURL example
  - Bij Timer: cron-input met voorbeelden
- [ ] Klik op **UserTask** (bv. "Aanmelding beoordelen") → panel toont:
  - Naam bewerken
  - Rol-dropdown (Zorgmedewerker / Planner / Teamleider / Beheerder)
  - Specifieke persoon (assignee) veld
  - Formulier-key
  - Deadline (dueDate ISO duration)
- [ ] **"▶ Test dit proces"**-knop → deployt + start instance + springt naar /werkbak waar je de eerste taak ziet

## 6. Platform Admin (Plan 2C)

URL: http://192.168.1.10:13000/master-admin/tenants/a0000000-0000-0000-0000-000000000001/settings

- [ ] Je ziet **3 tabs**: Features / Sessie / Branding
- [ ] **Features tab**: 8 feature-flags met toggle-switches
  - `workflow-engine`, `bpmn-canvas`, `dmn-editor`, `facturatie-module`, `planning-module`, `mic-meldingen`, `rapportages-ai`, `sales-canvas`
  - Per flag een notitieveld
- [ ] Toggel **`facturatie-module`** uit → "Features opslaan"
- [ ] Log uit en in als tenant-admin → `/admin/facturatie` redirect naar `/geen-toegang` ✓
- [ ] **Sessie tab**: accessTokenLifetime dropdown (1u/8u/1d/7d/30d), refresh, idle-timeout
- [ ] **Branding tab**: organisatienaam override, logo URL (met preview), primary color picker

## 7. Rollen beheer (Plan 2E fase 1)

URL: http://192.168.1.10:13000/admin/rollen

- [ ] Je ziet **8 rollen** in de linker lijst:
  - 🔒 Beheerder / Zorgmedewerker / Planner / Teamleider (systeem, locked)
  - Controller / Kwaliteitsmedewerker / Zorgadministratie / MIC-coördinator (bewerkbaar)
- [ ] Klik een systeem-rol → editor is **read-only** met lock-badge
- [ ] Klik **Controller** → kan display_name, beschrijving en permissions bewerken
- [ ] Checkboxes voor permissions per categorie (Clienten, Zorgplan, Rapportage, Medicatie, MIC, Planning, Beheer)
- [ ] **"+ Nieuwe rol"** knop → invulveld voor slug/naam/beschrijving → create
- [ ] Nieuwe rol verschijnt in de lijst
- [ ] Delete-knop bij niet-systeem rollen (na confirm)

## 8. Taak-formulieren editor (Plan 2F voorwerk)

URL: http://192.168.1.10:13000/admin/task-form-options

- [ ] Links: proces-dropdown (intake / zorgplan-evaluatie / mic / herindicatie) + task-lijst
- [ ] Klik een task → editor rechts leeg (want nog geen overrides)
- [ ] **"+ Veld toevoegen"** → pas name, label, type (tekst/getal/ja-nee/dropdown) aan
- [ ] Bij type=**dropdown**: opties-lijst met value/label input per optie
- [ ] **Proef:** voeg aan "MIC Afhandeling > analyse" een veld `ernstNiveau` toe met opties `laag/Laag`, `middel/Middel`, `hoog/Hoog`
- [ ] "Alle wijzigingen opslaan" → toast "Opgeslagen"
- [ ] Start een MIC-proces via canvas → taak verschijnt in werkbak → "Voltooien" → zie je nu **"Middel"** als optie? *(Deze eindtest werkt alleen als de MIC-afhandeling task-definition-key `analyse` is — anders zie je nog de hardcoded opties)*

## 9. API audit-log voor BI

Query in postgres (via Unraid):

```sql
SELECT action, details->>'taskName' AS task, details->>'processKey' AS process, user_id, timestamp
FROM openzorg.audit_log
WHERE action LIKE 'workflow.task.%' OR action LIKE 'platform.settings.%' OR action LIKE 'role.%' OR action LIKE 'validation.rule.%'
ORDER BY timestamp DESC
LIMIT 30;
```

- [ ] Je ziet rijen voor: `workflow.task.claim`, `workflow.task.complete`, `platform.settings.update`, `role.create`, `role.update`
- [ ] Elke regel heeft user_id + details JSONB

## 10. Onderliggende backend endpoints (handmatig via curl)

Docker exec in het ecd-container:

```bash
docker exec openzorg-ecd-1 wget -qO- "http://localhost:4001/api/tenant-features" --header "X-Tenant-ID: a0000000-0000-0000-0000-000000000001"
```

- [ ] Retourneert `{"featureFlags": {...}, "branding": {...}}` — geen 401

```bash
docker exec openzorg-ecd-1 wget -qO- "http://localhost:4001/api/admin/rollen" --header "X-Tenant-ID: a0000000-0000-0000-0000-000000000001" --header "X-User-Role: beheerder"
```

- [ ] Retourneert 8 rollen

---

## 🐛 Bekende open punten

1. **MIC task-definition-keys** — de augment-seed gebruikt niet de "analyse"-task dus `/admin/task-form-options` kan niet 100% end-to-end getest worden zonder een MIC-proces handmatig te starten vanuit canvas
2. **State-machine is hardcoded** — de transitie-dropdown in het cliëntdossier zit hardcoded in `page.tsx`. Admin-UI volgt vandaag.
3. **Validation rules admin-UI** — backend staat (GET/POST/PUT/DELETE/test), UI komt vandaag
4. **Medewerker-management** — nog minimaal, update volgt vandaag
5. **BPMN-templates behalve intake** — herindicatie/mic/zorgplan-evaluatie hebben nog incomplete DI, renderen via auto-layout
6. **Seed cliënten** — je ziet `0` als je voor de eerste keer kijkt? De augment-seed is gedraaid tijdens de sessie, zou nu 30+20=50 moeten zijn. Als leeg, mogelijk dat de test-tenant via Medplum niet de juiste project-scope heeft.

## ⚡ Snelle smoke tests (30 sec elk)

| Wat | URL | Verwacht |
|---|---|---|
| Canvas laadt | `/admin/workflows/canvas` | Leeg canvas met startevent, geen JS errors |
| Clientenlijst heeft data | `/ecd` | 20+ cliënten met status-badges |
| Rollen werkt | `/admin/rollen` | 8 rollen, 4 locked |
| Settings werkt | `/master-admin/tenants/:id/settings` | 3 tabs |
| Werkbak opent | `/werkbak` | Filters zichtbaar |
| Dashboard persoon | `/dashboard` | Begroeting met naam |

Meld alles dat niet groen is, ik fix het.

## Bevindingen
1. Na inactief maken van client verdwijnd die van de clientenlijst, hij moet wel nog vindbaar zijn om hem eventueel te heractiveren. 
2. Verantwoordelijk behandelaar bij client onder zorgplan nog altijd geen LookUp alles naar medewerker of client en andere velden moet een lookup worden. Zo min mogelijk vrij text velden
3. Workflow: ik kan niet dezelfde opties kiezen in de UI als de voorbeeld processen, dus geen user of decision flow.
3. Workflow: ik kan geen start event kiezen hoe moet ik wten wat de start event zou kunnen zijn? Ah als je direct op het bolletje kklikt zie je meer maar er zou en lijst moeten komen met alle opties? 
4. Workflow: UI is niet heel vriendelijk
5. Workflow: UserTask is geen optie
6. #8: Opslaan mislukt: Internal Server Error