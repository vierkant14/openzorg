# OpenZorg — Production-Ready Traject (overkoepelend ontwerp)

**Versie**: 1.0
**Datum**: 2026-06-11
**Status**: Goedgekeurd door Kevin (2026-06-11)
**Relatie**: bouwt voort op `2026-05-01-openzorg-vvt-volwassenheid-gap-analyse.md` (functionele bron van waarheid) en de Notion-backlog (Tier-systeem). Dit document voegt de niet-functionele lagen toe: engineering, ontwerp, deployment.

---

## 1. Doel & kaders

**Doel**: OpenZorg naar het kwaliteitsniveau brengen waarop met vertrouwen een pilot bij een echte VVT-instelling gestart kan worden. Geen kalenderdeadline; kwaliteit is de maatstaf.

**Kaders**:

- **Hosting-keuze uitgesteld**: alles wordt *portable* gemaakt (draait op elke standaard Docker/Kubernetes-infra). De Unraid-server (192.168.1.10) blijft staging-omgeving. Productie-hosting wordt gekozen zodra een pilot concreet wordt.
- **Gap-analyse + Notion blijven leidend** voor functionele scope (Tier 1/2/2b/3). Dit traject herordent niet de functionele backlog, maar bepaalt *hoe* en *in welke verticale slices* die gebouwd wordt.
- **Randvoorwaarden-trajecten** (R-01 G-Standaard, R-02 Vecozo, R-03 UZI) starten pas bij getekende pilot. De **mock-laag** voor deze koppelingen wordt wél gebouwd zodat features niet blokkeren.
- **UX/UI-herziening is volledig**: dagelijkse zorg-flows, configuratie/admin-ervaring, visuele kwaliteit én informatie-architectuur. Geen polish-ronde maar een fundamentele herziening — vandaar Fase 1 vóór de slices.

## 2. Fase 0 — Engineering-fundament (~1-2 weken)

1. **Branch-sanering**
   - `pnpm check-all` groen op `plan-2a-execute`, daarna PR → `main`.
   - Daarna trunk-based: korte feature-branches (< 1 week leven), PR's naar main. Nooit meer 174 commits op een zijtak.
2. **CI/CD — GitHub Actions**
   - Pipeline: lint, typecheck, alle tests (Vitest), forbidden-words, build, Docker-builds.
   - Branch-protectie op `main`: merge alleen met groene CI.
3. **Portable productie-deploy**
   - `docker-compose.prod.yml`: secrets via env (geen credentials in repo), health checks, resource limits, restart-policies.
   - Backup/restore-script voor PostgreSQL met **geteste restore** (een backup zonder geteste restore bestaat niet).
   - Seed-testwachtwoorden expliciet gemarkeerd als dev-only; prod-bootstrap zonder hardcoded credentials.
4. **Release-proces**
   - Versie-tags + CHANGELOG; images naar GitHub Container Registry. Deployen = tag uitrollen.

## 3. Fase 1 — Ontwerp-fundament (~2-4 weken)

1. **IA-herziening eerst**: audit van huidige navigatie (8 secties, ~40 pagina's) tegen werkelijke rollen en hun dagritme. Output: nieuwe navigatiestructuur per rol, principe *taak-gericht* (wat moet deze persoon nú doen) i.p.v. *module-gericht*.
2. **Design-systeem aanscherpen**: OKLCH-token-basis behouden; toevoegen: vaste patronen per schermtype (lijstpagina, dossierpagina, formulier, wizard, admin-tabel), verplichte states (leeg/laden/fout), spacing-ritme, responsive regels tablet/telefoon.
3. **Referentie-implementaties**: per schermtype één scherm dat de standaard zet, vastgelegd als `shared-ui` componenten die elke volgende pagina hergebruikt.
4. **Werkwijze**: design-skills (shape, critique, redesign) met Kevin als reviewer per iteratie.

## 4. Fase 2+ — Verticale slices (doorlopend)

Per module: **redesign + Tier 1-diepte + tests in één slice**; pas door naar de volgende als hij af is.

**Volgorde** (op gebruiksfrequentie door zorgmedewerkers; slechte rapportage-UX = afhaakreden #1 per gap-analyse §4 Epic D):

1. **Rapportage & overdracht** (Epic D)
2. **Cliëntdossier** (Epic A + klinische schalen uit B)
3. **Medicatie** (Epic B medicatieveiligheid, met G-Standaard-mock)
4. **Planning & rooster** (Epic E — killer-feature-ambitie)
5. **Configuratie-ervaring** (Epic L + K)
6. Daarna: HR (F), Financieel (H), Compliance (J), Security/SSO (M)

**Definition of done per slice**:
- Nieuw design toegepast (conform Fase 1-standaarden)
- Relevante Tier 1-features gebouwd
- Mobiel bruikbaar (tablet + telefoon)
- Tests aanwezig
- Notion-status bijgewerkt
- Gemerged naar main (groene CI)

## 5. Governance & werkwijze

- Elke fase en elke slice krijgt een eigen **spec → plan → uitvoering**-cyclus (superpowers brainstorming/writing-plans).
- Notion blijft de backlog-bron; statussen worden per slice bijgewerkt.
- Spec-documenten in `docs/superpowers/specs/`, plannen in `docs/superpowers/plans/` (indien aanwezig) — gecommit.
- Architectuur-checklist gap-analyse §6 geldt bij elke PR (geen VVT-aannames in de kern).

## 6. Buiten scope van dit document

- Functionele feature-specs (volgen per slice).
- Hosting-leverancierskeuze (bewust uitgesteld).
- Compliance-certificeringstrajecten (R-01..R-08; starten bij pilot-tekening).
- Native mobile app / offline-modus (post-v1.0, conform gap-analyse).
