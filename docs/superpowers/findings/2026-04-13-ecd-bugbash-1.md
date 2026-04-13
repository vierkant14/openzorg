# Bug-bash ronde 1: ECD-detailpagina (zorgmedewerker)

**Datum:** 2026-04-13
**Tester:** Kevin
**Scope:** `apps/web/src/app/ecd/[id]/page.tsx` (5345 LoC) en alle tabs/secties die daaronder vallen
**Account:** `jan@horizon.nl` / `Hz!J4n#2026pKw8` (beheerder, maar doorloop als zorgmedewerker)
**Stack:** Unraid `http://192.168.1.10:13000` (of `https://ecd.windahelden.nl`)
**Methode:** elke tab, elke knop, elk formulier als een zorgmedewerker bij Horizon; één client volledig doorlopen

## Severity-definities

- **P0** — datalek, security-fail, data-corruptie, pagina crasht volledig, of een functie die claimt te werken maar dat niet doet
- **P1** — kernflow blokkeert, knop doet niets, save mislukt zonder feedback, verkeerd resultaat getoond
- **P2** — verwarring, slechte UX, inconsistente labels, layout breekt, ontbrekende validatie
- **P3** — cosmetisch, typfout, polish, spacing, kleur

## Hoe loggen

Voor elk issue:

```markdown
### [P?] Korte titel
**Reproductie:**
1. Stap 1
2. Stap 2
3. Stap 3
**Verwacht:** wat had er moeten gebeuren
**Werkelijk:** wat er gebeurde
**Notitie:** (optioneel) waarom dit opvalt, patroon, etc.
```

Schroom niet om kleine dingen te loggen. Patronen ontstaan bij volume.

---

## Reeds gevonden tijdens Task 4 (Playwright golden-path implementatie)

Deze zijn door de subagent ontdekt terwijl die de golden-path test schreef tegen de werkelijke UI. Niet vergeten tijdens de walkthrough — bevestig of ze er nog zijn en voeg eventueel reproductie-stappen toe.

### [P2] Tabs gebruiken `<button>` zonder `role="tab"` of `aria-selected`
**Locatie:** `apps/web/src/app/ecd/[id]/page.tsx` — tab-navigatie boven de content secties
**Probleem:** Screen readers horen alleen "button Rapportages" zonder tab-context. A11y-gat.
**Fix-richting:** render als semantische `<button role="tab" aria-selected="...">` binnen een `role="tablist"` container.

### [P2] Textarea-labels in rapportage-formulier niet gebonden aan het veld
**Locatie:** `RapportageForm` component in `apps/web/src/app/ecd/[id]/page.tsx` (VRIJ + SOEP formulieren)
**Probleem:** `<label>` heeft geen `for`/`htmlFor` attribuut en de `<textarea>` heeft geen matching `id`. Label is alleen visueel, niet programmatisch verbonden. Breekt screen readers én Playwright's `getByLabel`.
**Fix-richting:** `htmlFor` op label + `id` op textarea. Of wrap de textarea binnen de label.

### [P1] Dubbele navigatie-paden in cliëntenlijst-rij
**Locatie:** `apps/web/src/app/ecd/page.tsx` — `<tr>` element
**Probleem:** De rij heeft zowel een `onClick={() => window.location.href=...}` handler als een nested `<a>` met `stopPropagation()`. Twee manieren om te navigeren, fragiel (verschillende gedrag bij Ctrl+click, middle-click, tab-key, etc.).
**Fix-richting:** maak de hele rij een `<Link>` / `<a>`, verwijder de handler.

### [P1] Geen feedback na succesvol opslaan van een rapportage
**Locatie:** `RapportageForm` in ECD-detailpagina
**Probleem:** Na `Opslaan` sluit het formulier zonder enige visuele bevestiging. De gebruiker moet zelf inferren dat de save gelukt is door te zien dat de rapportage in de lijst staat. Bij langzame netwerken nog erger — je ziet niks gebeuren en klikt wellicht opnieuw.
**Fix-richting:** toast/banner "Rapportage opgeslagen" of in-line bevestiging. Disable de opslaan-knop tijdens de request.

### [P3] Cliënt-link CSS-selector te fragiel voor toekomstige routes
**Locatie:** `apps/web/src/app/ecd/page.tsx` — de `<a href="/ecd/{id}">` links
**Probleem:** De E2E-test moet de client-link vinden met een CSS-negatie `:not([href="/ecd/nieuw"]):not([href="/ecd"])`. Zodra er een route als `/ecd/import` of `/ecd/export` bijkomt, matcht de test per ongeluk die link.
**Fix-richting:** voeg `data-testid="client-row-link"` toe aan de links (of wrap de rij in een gemarkeerde container).

---

## Nieuwe findings uit walkthrough

(Hieronder tijdens het klikken invullen)

### Header / cliënt-meta

Gelukt ziet er goed uit, kan alleen de view niet aanpassen (dus extra veld op de header zetten)
p2 - Ik mis een locatie waar de de client zich bevind, mogelijk nog een exact bed? 

### Tab: Zorgplan

Verantwoordelijke behandelaar is vrij text veld geen lookup naar medewerker - p1

Handtekening alleen achteraf toe te voegen, al werkt het ook niet direct - p2

Interventie slaat niet op - p3


### Tab: Rapportages

Werkt is alleen vrij minimaal maar als dit voldoende is - p4

### Tab: Medicatie

Knop stoppen doet niets, geeft bevestiging maar einddatum wordt niet ingevuld - p2
Wijzgen krijg ik 404 not found - p2
Toevoegen van medicatie: Medicatienaam vrij text veld, dosering ook text veld zou of ML, MG of stuks verwachten of mogelijk andere opties. Opslaan werkt wel - p2

### Tab: Vaccinaties

Herhalende vaccin - volgende datum gemakkelijker laten invllen door extra knop toe te voegen wat de datum haalt uit de vacciniatie. Bijvoorbeeld als het vaccin 1 jaar houdbaar is automatisch na 1 jaar laten invullen na akkoord van medewerker. - p3

### Tab: Allergieën

Nieuw toevoegen lukt, verwacht na toevoegen van hoog risico allergie dat de hoofd pagina zich daarop aanpast - p1

### Tab: MIC-meldingen

Ik zie dit tabblad niet - p1

### Tab: MDO

Erg minimaal, deelnemer naam is geen lookup - p1

### Tab: Documenten

JPG upload lijkt te werken kan het alleen niet bekijken - p4

### Tab: Risicoscreening / VBM / Wilsverklaring / overig

Wilsverklaring - vertegenwoordig is vrij veld. Moet of medeewerkr of contact persoon? - p2 
Opslaan lukt niet: type moet een van de volgende zijn: behandelverbod, euthanasieverklaring, volmacht, levenswensverklaring, donorcodicil, bopz-mentorschap, bopz-curatele, bopz-beschermingsbewind
---
VBM: VBM opleggen moet mogelijk alleen door teamleider kunnen? Geen idee - p3

---
Medicatieoverzicht is leeg - p2

---
Extra velden: p2
Krijg deze error: 
#{"resourceType":"OperationOutcome","issue":[{"severity":"error","code":"structure","details":#{"text":"Missing required property"},"expression":["Patient.extension[1].url"]}],"extension":###[{"url":"https://medplum.com/fhir/StructureDefinition/tracing","extension":[{"url":"requestId","valueId":"2d5d91e8-426a-4f2c-bd67-118d977aa856"},{"url":"traceId" "valueId":"7cbdc18f-099e-4c38-a8ef-fe89f686109c"}]}]}

## Patronen / overstijgende observaties

(Na de walkthrough: kijk terug op je lijst. Welke woorden/labels zijn inconsistent? Welke UX-probleem-types komen op meerdere tabs voor? Welke tabs voelen doordacht en welke in elkaar gehackt?)

Veel velden zijn vrije text velden, ik verwacht dat zo min mogelijk vrij text is. Veel moet lookup zin richting of medewerkers, contactpersonen of codelijsten. Zodat het goed te analyseren is in met BI. -p1

---

De werkbak lijkt niet te werken en de workflow is ook niet sterk genoeg. Daar moeten we extra aandacht aan besteden.- p0

## Telling

- **P0:** 1 — werkbak + workflow fundament werkt niet
- **P1:** 6 — ontbrekende/gebroken kernfeatures: MIC-tab ontbreekt, verantwoordelijke behandelaar vrije tekst, allergie hoog-risico niet zichtbaar op header, MDO te minimaal, dubbele navigatie cliëntenrij, geen save-feedback rapportage, én het overstijgende vrij-tekst-patroon dat op meerdere tabs voorkomt
- **P2:** 11 — gebroken saves (wilsverklaring type, Patient.extension FHIR-error, medicatie-wijzigen 404), ontbrekende/stille features (medicatie stop-knop einddatum, medicatieoverzicht leeg, handtekening niet werkend, header niet configureerbaar, geen locatie/bed), vrije-tekst-velden waar lookup hoort (medicatie-naam, dosering-eenheid, wilsverklaring-vertegenwoordiger), tabs zonder `role="tab"`, labels ongebonden
- **P3:** 5 — zorgplan-interventie slaat niet op, rapportage-formulier minimaal, vaccinatie-herhaal-datum UX, VBM permissie-check, JPG document niet bekijkbaar, cliënt-link CSS-selector fragiel

**Totaal: 23 findings** (18 nieuw + 5 uit Task 4). Dit is véél meer dan verwacht voor één monolith-pagina en bevestigt dat bug-bash de juiste stap was vóór fixes.

---

## Aanbeveling voor Q2-Plan 2

### 1. P0 apart: werkbak + workflow engine

"De werkbak lijkt niet te werken en de workflow is ook niet sterk genoeg" — dit raakt het **hele platform**, niet alleen de ECD-detailpagina. Dit is geen bugfix, dit is een architectuur-vraag: is Flowable goed gekoppeld? Draaien de demo-processen daadwerkelijk door? Landen taken op de werkbak en kun je ze afhandelen?

**Advies:** Q2-Plan 2 splitsen in 2A (ECD bugfixes — rest van deze lijst) en 2B (werkbak + workflow audit + fix). Plan 2B krijgt z'n eigen bug-bash ronde specifiek voor de werkbak-flow.

### 2. Overstijgend patroon: lookup in plaats van vrije tekst

**Dit is het belangrijkste architecturele inzicht.** Vrije-tekst-velden komen overal voor waar je een lookup verwacht: verantwoordelijke behandelaar, medicatie-naam, dosering-eenheid, MDO-deelnemer, wilsverklaring-vertegenwoordiger. Dit breekt:
- BI / analyse (je kunt niet groeperen op "behandelaar X")
- Datakwaliteit (typo's, varianten: "paracetamol" vs "Paracetamol" vs "para")
- Referentiële integriteit (wie is de behandelaar? Is die nog in dienst?)
- Zoeken en filteren

**Fix-aanpak:** herbruikbare lookup-componenten bouwen vóór individuele fixes:
- `<PractitionerLookup />` — alle medewerker-velden (autocomplete op FHIR Practitioner)
- `<ContactPersoonLookup clientId={...} />` — vertegenwoordiger, contactpersonen
- `<CodeListLookup system="..." />` — medicatie-namen (bij voorkeur G-Standaard), dosering-eenheden (UCUM), relatiecodes, etc.

Eén keer goed bouwen, overal toepassen in plaats van 8 losse fixes. Mogelijk voorbeeld van het "basis architectuur" werk dat je ook terugziet in Q3 (kern/sector-scheiding).

### 3. Module-bugfixes in volgorde van impact

**Eerste P1-batch** (blokkeert kernflow):
- MIC-meldingen tab terugbrengen (ontbreekt volledig)
- Allergie hoog-risico moet zichtbaar zijn op de header/hoofdpagina (patient safety)
- Geen save-feedback op rapportages + dubbele navigatie cliëntenlijst (Task 4-bevindingen)

**Tweede batch — gebroken saves** (P2 maar hoog impact):
- Wilsverklaring type-validatie — hardcode de enum, valideer aan voorkant
- Medicatie wijzigen → 404 — route ontbreekt of is verkeerd gemount
- Patient.extension[1].url missing — FHIR-schema issue bij extra velden; waarschijnlijk een leeg extension-item dat zonder `url` wordt opgestuurd
- Medicatie stop-knop zet einddatum niet — mutation mist een veld

**Derde batch — ontbrekend of leeg**:
- Medicatieoverzicht (MedicationStatement) vullen vanuit MedicationRequest
- Handtekening-flow debuggen: waarom alleen achteraf, waarom werkt hij niet
- Header configureerbaar maken + locatie/bed tonen

### 4. Architecturele split: monolith opbreken

De 5345-LoC `apps/web/src/app/ecd/[id]/page.tsx` is duidelijk doorgegroeid voorbij wat nog werkbaar is. Natuurlijke split-grens zijn **de tabs zelf**. Voorstel (past in Q3 ook als voorbereiding op kern/sector-scheiding):

```
apps/web/src/app/ecd/[id]/
  layout.tsx         ← header, tab-navigatie, client-fetch
  page.tsx           ← overzicht / header content (<500 LoC)
  zorgplan/page.tsx
  rapportages/page.tsx
  medicatie/page.tsx
  vaccinaties/page.tsx
  allergieen/page.tsx
  mic/page.tsx
  mdo/page.tsx
  documenten/page.tsx
  risicoscreening/page.tsx
  wilsverklaringen/page.tsx
  vbm/page.tsx
```

Elke tab wordt een eigen route met eigen file. Shared logic via de layout + hooks. **Deze split moet vóór de bugfixes gebeuren** — anders werk je in een monolith die alleen maar groter wordt, en de tabs kunnen nooit als zelfstandige "sector-module" hergebruikt worden.

### 5. Samenvatting volgorde voor Q2-Plan 2

1. **2A-fase 1**: monolith-split (layout + per-tab files) — geen gedragswijziging, alleen verplaatsing
2. **2A-fase 2**: lookup-componenten bouwen (Practitioner/ContactPersoon/CodeList)
3. **2A-fase 3**: P1-bugs fixen met de nieuwe lookup-componenten
4. **2A-fase 4**: P2 gebroken saves (wilsverklaring, medicatie, FHIR extension)
5. **2A-fase 5**: P2 ontbrekende features (medicatieoverzicht, handtekening, header)
6. **2A-fase 6**: P3's als polish (interventie save, vaccinatie UX, rapportage uitbreiden, JPG viewer)
7. **2B (parallel)**: werkbak + workflow audit — eigen plan, eigen bug-bash

Geschatte doorlooptijd 2A: ~4-6 weken bij deze scope. 2B niet inschatbaar tot er een audit is gedaan.


