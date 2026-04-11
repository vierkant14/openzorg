# Bijdragen aan OpenZorg

Welkom! OpenZorg is een open source zorgplatform voor de Nederlandse VVT-sector.
We waarderen elke bijdrage, van bugfixes tot nieuwe functionaliteit.

## Hoe bij te dragen

1. **Fork** de repository op GitHub
2. Maak een **feature branch** aan vanaf `main`:
   ```bash
   git checkout -b feat/mijn-feature
   ```
3. Maak je wijzigingen en commit volgens de [commit conventie](#commit-conventie)
4. Push je branch en open een **Pull Request** naar `main`

## Code standaarden

- **TypeScript strict** -- geen `any` tenzij echt onvermijdelijk
- **ESLint** moet foutloos passeren (`pnpm lint`)
- **Forbidden words check** -- de CI controleert op merknamen van concurrenten (zie `CLAUDE.md`). Gebruik deze woorden nooit in code, comments of documentatie
- Schrijf tests voor nieuwe functionaliteit (Vitest voor unit tests)
- Gebruik bestaande patronen uit de codebase als voorbeeld

## Commit conventie

We volgen [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <korte beschrijving>

[optionele body]
```

**Types:**
- `feat` -- nieuwe functionaliteit
- `fix` -- bugfix
- `docs` -- documentatie
- `chore` -- onderhoud, dependencies, CI
- `refactor` -- code herstructurering zonder gedragsverandering
- `test` -- tests toevoegen of aanpassen

**Voorbeelden:**
```
feat(planning): add shift-swap endpoint
fix(auth): resolve token refresh race condition
docs: update API examples in README
```

## Pull Request proces

1. Zorg dat **CI groen** is (lint, tests, forbidden words check)
2. Vul het PR-template in met een duidelijke beschrijving
3. Een **maintainer** reviewt je PR
4. Na goedkeuring wordt de PR gemerged via squash-merge
5. Grote wijzigingen? Open eerst een issue of discussie om het ontwerp te bespreken

## Gedragscode

We verwachten van alle deelnemers:

- **Respectvol** communiceren, ook bij meningsverschillen
- **Inclusief** zijn -- iedereen is welkom ongeacht achtergrond of ervaring
- **Constructief** feedback geven
- Geen intimidatie, discriminatie of ongewenst gedrag

Overtredingen kunnen gemeld worden via GitHub Discussions of rechtstreeks bij de maintainers.

## Licentie

OpenZorg is gelicenseerd onder de **EUPL 1.2** (European Union Public Licence).

Door bij te dragen ga je akkoord dat je bijdrage onder dezelfde licentie valt.
Je **behoudt het copyright** op je eigen bijdragen.

## Contact

- **GitHub Discussions** -- voor vragen, ideeen en ontwerpdiscussies
- **Issues** -- voor bugs en feature requests

Bedankt voor je bijdrage!
