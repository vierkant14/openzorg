# Fundering Eerst — Strategische Herijking 2026 H1/H2

**Datum:** 2026-04-13
**Status:** Goedgekeurd ontwerp
**Horizon:** 2 kwartalen (Q2 + Q3 2026)

## Context & aanleiding

OpenZorg staat op v0.2.0. De VVT-kern is op ~70%: 34 ECD-routes, planning, workflow-bridge, multi-tenant via PostgreSQL RLS + Medplum projects. De roadmap wees naar GRZ-module starten in Q3 2026 en naar facturatie/koppelvlakken om een eerste betalende klant live te brengen.

Deze koers is herzien. De achterliggende ambitie blijft groot — *de hele zorg disrupten met een open-source, FHIR-native platform* — maar de eerstvolgende twee kwartalen gaan niet over klanten, marketing of nieuwe modules. Ze gaan over **de fundering aantoonbaar hard maken**.

De redenering: pas wanneer de basis bewezen werkt en bewezen schaalbaar is over sectoren, is een verhaal naar buiten geloofwaardig en is verdere uitbouw (facturatie, koppelvlakken, GRZ volwaardig, GHZ, etc.) verantwoord. Eerder naar buiten gaan met een wankele basis ondergraaft het anti-vendor-lock verhaal dat OpenZorg uniek maakt.

## Doelen

Aan het einde van Q3 2026:

1. Alle bestaande modules (ECD, planning, workflow, facturatie-stub) werken vlekkeloos zonder bekende bugs.
2. Multi-tenant isolatie is aantoonbaar veilig (security-review uitgevoerd en gedocumenteerd).
3. Golden-path E2E-tests draaien groen in CI per rol (zorgmedewerker, beheerder, planner, teamleider).
4. Performance-baseline bestaat met realistische data; top-bottlenecks bekend.
5. De codebase heeft een expliciete kern/sector-scheiding. VVT is *een* sector-module bovenop de kern, niet "de" applicatie.
6. Een tweede sector (GRZ-light) draait op dezelfde kern als levend bewijs van de architectuur.
7. Er bestaat een gedocumenteerd sector-contract en een handleiding "nieuwe sector toevoegen", inclusief realistische tijdsmeting.

## Niet-doelen (expliciet geparkeerd)

Om scope-creep te voorkomen, zijn de volgende zaken bewust *niet* in scope voor 2026 H1/H2:

- Eerste betalende klant, omzet, SaaS go-live
- Facturatie uitbreiden voorbij huidige stub (WLZ/WMO/ZVW-generatie, Vecozo)
- Koppelvlakken: iWLZ, eOverdracht, MedMij, BgZ
- Ontslagmanagement
- Nieuwe sector-modules buiten GRZ-light: GHZ, GGZ, jeugdzorg, huisartsen
- Demo publiek (`demo.openzorg.nl`), landingspagina, manifest, Stichting publiek zichtbaar, persdossier
- Mobile-app, self-service signup
- Marketing, nieuwsbrief, blog

Deze lijst staat hier expliciet zodat afwijkingen tijdens executie een bewust besluit vereisen.

## Aanpak

Twee opeenvolgende kwartalen, elk met één duidelijk doel.

### Q2 2026 (apr–jun) — Functioneel hard

Doel: alles wat er nu in zit doet exact wat het moet, voorspelbaar, getest, veilig.

**Werkstromen:**

1. **Bug-bash per module.** Systematisch alle 34 ECD-routes, 8 planning-routes, workflow-bridge en facturatie-stub doorlopen vanuit het perspectief van een echte zorgmedewerker, beheerder, planner en teamleider. Lijst maken van alles wat stuk, half of verwarrend is. Wegwerken. Volgorde: ECD → planning → workflow → facturatie-stub.

2. **E2E-tests op golden paths.** Playwright-suite per rol op de kernflow: client aanmelden → zorgplan opstellen → rapportage schrijven → MIC-melding → MDO → medicatie. Per rol minimaal één scenario dat altijd groen moet zijn in CI.

3. **Multi-tenant security-review.** Handmatig testen of tenant A op enige manier data van tenant B kan zien — via API, via direct SQL, via Medplum-token-misbruik. RLS-policies verifiëren. Audit-log compleetheidscheck (NEN 7513). Resultaat documenteren als markdown: wat is getest, wat zijn de aannames, wat is bewust niet getest.

4. **Performance baseline.** Meten hoe snel kernpagina's en kern-API's reageren met realistische data: 100 clienten, 1000 rapportages, 500 afspraken, 50 zorgplannen. Top-5 traagste queries identificeren. Niet alles oplossen — wel weten waar je staat. Document met cijfers en methodologie.

5. **Architectuur-opruim waar het pijn doet.** Files of modules die te groot zijn opdelen, dubbele logica weghalen, boundaries tussen `ecd`/`planning`/`workflow` scherper. Geen refactor om refactor — alleen waar het Q3-werk in de weg gaat zitten. Vuistregel: geen file >500 LoC zonder duidelijke reden.

**Q2 is klaar wanneer:**
- Geen bekende bugs in de kernmodules
- Playwright golden-path suite groen in CI
- Security-review document bestaat
- Performance-baseline document bestaat
- Geen onverklaarde grote files

### Q3 2026 (jul–sep) — Architecturaal bewezen

Doel: aantonen dat de kern meerdere sectoren kan dragen zonder grote refactor. Bewijslast voor "denk groot, hele zorg disrupten".

**Werkstromen:**

1. **Kern/sector-boundary trekken.** Expliciet scheiden wat generiek is (clienten, medewerkers, rapportages, planning, audit, RBAC, multi-tenant, FHIR-proxy, validatie-engine) en wat sector-specifiek is (zorgplan-leefgebieden, evaluatiecycli, indicaties, meetinstrumenten, sector-workflows). VVT herstructureren als *een* sector-module bovenop de kern, niet als de hoofd-applicatie.

2. **Sector-plugin contract definitief.** Een helder, gedocumenteerd, code-niveau interface dat beschrijft wat een sector-module moet leveren: configuratie, routes, navigatie-items, validatie-regels, FHIR-extensions, workflow-templates. Eén pagina functionele beschrijving + een TypeScript interface in een shared package.

3. **GRZ-light als levende proof.** Niet de volledige GRZ-module, maar genoeg om het contract te bewijzen: revalidatie-doelen, één meetinstrument (FIM of USER), behandelplan-skelet, ontslagcriteria. Doel = bewijs van concept, niet productie-compleetheid.

4. **Documentatie "nieuwe sector toevoegen".** Een echte handleiding, geschreven *terwijl* GRZ-light gebouwd wordt. Inclusief realistische tijdsmeting: hoeveel uur kostte het werkelijk om GRZ-light vanaf nul toe te voegen, gegeven het contract?

**Q3 is klaar wanneer:**
- Kern-package en sector-packages duidelijk gescheiden in de monorepo
- Sector-contract gedocumenteerd in code en in markdown
- VVT en GRZ-light draaien beide naast elkaar in dezelfde tenant-stack
- Handleiding "nieuwe sector toevoegen" bestaat met tijdsmeting
- Demonstreerbaar: *"hier is VVT, hier is GRZ-light, beide op dezelfde kern, GRZ-light toegevoegd in N dagen"*

## Sector-keuze: GRZ-light

Voor het architectuur-bewijs in Q3 kiezen we GRZ-light, niet GHZ of huisarts. Reden: GRZ stond al op de bestaande roadmap, heeft de meeste overlap met VVT en dus de beste kans om binnen één kwartaal werkend te zijn. Het is de minst overtuigende proof van flexibiliteit (omdat het op VVT lijkt), maar wel de meest realistische binnen de tijdsbudget. Een sterker bewijs (GHZ of huisarts) is interessant maar mag de kerntijdslijn niet in gevaar brengen — dat schuift door naar 2027.

## Risico's

1. **Bug-bash blijkt een bodemloze put.** Mitigatie: time-box per module. Wat na de tijdsbudget niet opgelost is, wordt issue, geen blocker.
2. **Kern/sector-refactor breekt onverwacht veel.** Mitigatie: pas beginnen *na* Q2's E2E-tests, zodat regressies meteen zichtbaar zijn.
3. **GRZ-light scope-creep.** Mitigatie: lijst expliciet vooraf wat in/uit scope is, herzie alleen met goede reden.
4. **Geen klant, geen omzet over heel 2026.** Mitigatie: dit is een bewuste keuze van de oprichters, vastgelegd in dit document. Pas op het moment dat de financiële situatie verandert moet deze keuze opnieuw worden gewogen.
5. **Externe druk om eerder naar buiten te gaan** (LinkedIn, vakpers, "wanneer komt het uit?"). Mitigatie: verwijs naar dit document. Verhaal naar buiten begint pas in 2027, maar dan met bewijs.

## Wat hierna komt (2027 en verder)

Pas wanneer Q2 en Q3 2026 succesvol zijn afgerond is de fundering klaar om er bovenop te bouwen. De volgende fasen (2027) zijn dan in willekeurige logische volgorde:

- Verhaal naar buiten: demo publiek, landingspagina, manifest, Stichting zichtbaar, persdossier
- Facturatie uitbouwen + koppelvlakken (iWLZ, Vecozo) richting eerste betalende klant
- GRZ-light uitbouwen tot volwaardige GRZ-module
- Volgende sector (GHZ, GGZ of huisarts)

Dit ligt expliciet *buiten* de scope van dit document.
