---
name: test-documentatie
description: Draai een productflow end-to-end tegen staging met Playwright (headless), maak per stap een screenshot, en publiceer het bewijs als documentatiepagina in Notion én als markdown in de repo. Gebruik wanneer Kevin gedocumenteerd bewijs wil dat een flow werkt ("test en documenteer X", "maak documentatie met screenshots").
---

# Test & documenteer een flow (screenshots → repo + Notion)

Eén run levert drie dingen op: (1) bewijs dat de flow werkt op een echte omgeving, (2) versiebeheerde documentatie in de repo, (3) een leesbare Notion-pagina met screenshots voor Kevin/klanten.

## Randvoorwaarden

- Staging bereikbaar: `https://ecd.windahelden.nl` (tunnel) of `http://192.168.1.10:13000` (LAN). Check vooraf met een curl naar `/login`.
- Playwright-chromium lokaal: `cd apps/web && npx playwright install chromium` (eenmalig). PATH-fix: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`.
- Notion-MCP verbonden (create-attachment + create-pages).
- Accounts: per-rol testaccounts uit `docs/testplan-acceptatie-mvp.md` §1.
- De repo is publiek → screenshots in de repo zijn via `https://raw.githubusercontent.com/vierkant14/openzorg/main/<pad>` embedbaar in Notion (`source_url` op create-attachment; lokale binaire uploads kunnen niet).

## Werkwijze

1. **Script schrijven** in de scratchpad op basis van `voorbeeld-flow.mjs` (naast deze skill): een standalone node-script met `chromium.launch()` — géén test-runner. Per stap: actie → `stap(naam, beschrijving)` die een genummerde PNG schrijft naar `docs/documentatie/screenshots/<flow-slug>/`. Regels:
   - Draai tegen staging; muteer alleen eigen data (start een eigen proefinstantie/cliënt met herkenbare naam "Docu …"; kaap nooit bestaande taken van testers).
   - Locators: kaartniveau `div.rounded-xl`; herlaad-poll voor fire-and-forget-backendwerk (zie `apps/web/tests/e2e/proces-keten.spec.ts` voor de patronen).
   - Viewport 1280×800; screenshot per stap (geen fullPage tenzij nodig).
2. **Draaien**: `node <script>.mjs` vanuit `apps/web` (playwright zit daar in node_modules). Faalt een stap → fixen of eerlijk rapporteren; nooit een halve run publiceren.
3. **Repo-documentatie**: schrijf `docs/documentatie/<flow-slug>.md` — titel, doel, per stap: kop, beschrijving (PO-taal), `![stap](screenshots/<flow-slug>/NN-naam.png)`, en onderaan datum + omgeving + accountrollen. Commit screenshots + md via de normale PR-flow (CI groen → merge).
4. **Notion-pagina** (ná de merge, zodat raw-URL's bestaan): per screenshot `notion-create-attachment` met `source_url: https://raw.githubusercontent.com/vierkant14/openzorg/main/docs/documentatie/screenshots/<flow-slug>/NN-naam.png` → verzamel `markdown_source`-waarden → `notion-create-pages` onder de pagina **📚 Productdocumentatie** (onder de OpenZorg-root; maak aan als hij ontbreekt) met per stap kop + tekst + `<file src="file-upload://…">`-afbeelding. Vermeld onderaan: gedraaid op <datum> tegen <omgeving>, geautomatiseerd bewijs.
5. **Melden**: geef Kevin de Notion-link + repo-pad; noteer bevindingen (bugs die de run ving) apart.

## Valkuilen

- `notion-create-attachment` kan géén lokale PNG's aan — altijd via de raw-URL-route (dus eerst mergen, dan Notion).
- raw.githubusercontent cachet kort; direct na merge kan een URL heel even 404'en — retry na ~30s.
- Screenshots bevatten testdata (test-BSN's, fictieve namen) — echte persoonsgegevens horen er nooit in.
- Laat de flow-pagina's in domeintaal spreken (dit is óók klantdocumentatie).
