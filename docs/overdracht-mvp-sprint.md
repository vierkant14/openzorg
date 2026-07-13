# Overdracht — MVP-eindsprint (eindstand)

**Sprint**: 2026-07-10 t/m 2026-07-11 · **Uitvoerder**: Claude Fable 5 (autonoom, in opdracht van Kevin), bouw-subagents op Opus · **Status**: bouw compleet — dit document is de overdracht aan het volgende model (Opus) en aan Kevin.

**Leesvolgorde voor een vers model**: (1) dit document, (2) de spec `docs/superpowers/specs/2026-07-10-verkoopbare-mvp-vvt-thuiszorg-design.md` (§6 = uitvoeringsprotocol, §8 = open punten Kevin), (3) memory `project_state`, (4) `CLAUDE.md`.

---

## 1 · Eindstand: wat is af (15 PR's, alles op `main`)

| Werkstroom | Inhoud | PR's | Bewijs |
|---|---|---|---|
| W0 planning-slice | 7 planning-pagina's genormaliseerd | #15 | CI+E2E |
| Spec + plannen | verkoopbare-MVP-spec + W1-W5-plannen | #16 | — |
| **W1 procesmanagement-revamp** | tenant-native bridge (fail-closed) · token-verificatie · identiteitslaag /api/me · proces-catalogus (Laag 1⊕2) · werkbak-revamp (persoonlijke inbox) · Processen-hub in domeintaal · FHIR-taken claim/complete · timer-fixes+idempotentie · BPMN-DI · canvas-opschoning · DMN "Experimenteel" | #17 #18 #31 | 46 bridge- + 49 ECD-tests; zelf-seedende **proces-keten-e2e** + fhir-taak-e2e; alle 10 spec-§2.2-problemen opgelost |
| **W2 alles-werkt** | 3 laatste niet-genormaliseerde pagina's · dashboard-landingsscherm (begroeting/taken/acties/signalen/feed) · dedupe 12→0 lokale states · zorgplan 872→7 bestanden · audit op persoon | #22 #33 #34 | dashboard-e2e; grep-bewijzen in PR's |
| **W3 pilotprofiel** | CSV-cliëntimport (I-05-light) · per-rol accounts + rol-extensies (demo-label weg) · seed-pilotprofiel (4 locaties, 80 cliënten vía de import) · pilot-inrichtingsdraaiboek · golden paths planner/beheerder/teamleider | #23 #35 #36 | import-e2e; golden-path-e2e ×4 rollen; invite-flow bewezen op verse CI-stack |
| **W5 verkooppakket** | demo-script · feature-roadmap-matrix (eerlijk, met R-nummers/doorlooptijden) · pilot-onboarding-runbook · README-sectie | #37 | forbidden-words; claims verwijzen naar e2e/testplan |
| Compliance | `docs/compliance/audit-readiness.md` (eerlijke NEN/AVG-stand met codebewijs) | #27 | — |
| PO-testplan | `docs/testplan-acceptatie-mvp.md` (30 scenario's A-H) | #32 | — |

**E2E-dekking op de verse CI-stack (elke PR):** smoke · auth (serverrollen, geen demo-label) · vandaag · golden paths zorgmedewerker/planner/beheerder/teamleider · werkbak · admin-processen · **proces-keten (kroonscenario)** · fhir-taak · client-import · rapportage-soep · flowable-tenancy (isolatie-guard) · dashboard.

**De 10 procesmanagement-problemen uit spec §2.2 zijn allemaal opgelost** (details en per-probleem-verwijzing: PR #31-beschrijving); de keten-e2e ving daarbovenop twee vooraf onbekende productiebugs (zorgmedewerker kon geen cliënt aanmaken; Medplum-invite-500).

## 2 · Wat nog open staat

| # | Wat | Eigenaar | Hoe |
|---|---|---|---|
| 1 | **W4 live platform** | model + Kevin | **Geblokkeerd: Unraid staat uit.** Zodra aan: volg `docs/superpowers/plans/2026-07-10-w4-live-platform.md` letterlijk (release v0.3.0 taggen → GHCR → prod-compose in aparte map → Cloudflare-hostname → bootstrap zónder seed → backup-cron + geteste restore). **Extra sinds het plan: zet in de server-`medplum.config.json` de `appBaseUrl` op de publieke web-URL** (anders crasht de invite/onboarding-flow — geleerd in W3-2). GHCR-packages mogelijk nog privé (Kevins token mist packages-scope). |
| 2 | **Kevins acceptatie-testronde** | Kevin → model | Testplan A-H; bevindingen met testnummer melden; model fixt per bevinding (branch → PR → CI). Verse seed nodig voor de nieuwe accounts: `docker compose down -v && docker compose up -d --build`. |
| 3 | Spec §8 open punten | Kevin | domeinnaam live · nav-ruilen (rooster: Medewerkers→Werkbak, team: Cliënten→Werkbak) bevestigen · beheerder-IA · deploy.yml-opruiming (zit in W4-plan Task 2) |
| 4 | Notion-backlog bijwerken | model | workflow-cluster-items + ME-01 + I-05-light afvinken; Notion-MCP werkt weer sinds 2026-07-11-avond; eindsprint-overzicht staat in Notion (zie memory `reference_notion`) |
| 5 | Roadmap-restjes uit de sprint | later | herindicatie-autosignalering (bewust verwijderd; handmatig starten kan via de hub) · DMN-opslaan · assignee-námen in werkbak (nu "jou/collega") · E-03/E-04 mobiel · timer-cron-entries staan eerlijk op `enabled:false` |

## 3 · Werkwijze voor het vervolg (Opus)

- **Protocol**: spec §6 — branch vanaf main → (TDD waar logica) → typecheck/lint/test lokaal (PATH-fix: `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`) → PR → **CI incl. E2E groen** → merge. Geen lokale Docker in de agent-shell (Docker Desktop is er wel, voor Kevins handmatige test); CI is de stack-verificatie.
- **Kevins voorkeur**: bouwen via subagents met strak recept (bestanden, contracten, verificatie-eisen, rapport-format); hoofdsessie ontwerpt, reviewt (steekproef op het grootste risico), merget en houdt het status-artifact bij: https://claude.ai/code/artifact/c192660b-739d-4968-823c-a0cee13ca1d9 (zelfde bestandspad herpubliceren → zelfde URL; bron-HTML in de sessie-scratchpad, bij verlies opnieuw opbouwen).
- **Reviewen zonder de werkboom te storen** (terwijl een agent bouwt): `git worktree add <scratchpad-pad> <branch>` → fix/commit/push → `git worktree remove`.
- **Limieten-protocol** (Kevin): pauzeren op een PR-grens — alles gepusht, memory + dit document bij — en later naadloos verder.

## 4 · Valkuilen & lessen (bespaart het volgende model uren)

1. **Medplum-config**: de gemounte `infra/medplum/medplum.config.json` is de énige config-bron — `MEDPLUM_*`-env-vars worden genegeerd. `appBaseUrl` is verplicht voor de invite-API.
2. **GitHub Actions-storing-playbook**: krijgen PR's geen checks (webhook-events weg), niet blijven her-pushen — `gh workflow run CI --ref <branch>` (workflow_dispatch zit sinds deze sprint in ci.yml) en de run watchen; check-runs landen op de branch-SHA. PR's die tijdens een storing zijn aangemaakt kunnen blijvend event-dood zijn → sluiten en vers heropenen.
3. **E2E-lessen**: kaartlocators op `div.rounded-xl`-niveau (binnenste divs missen de knoppen) · unieke testdata-namen ín de test genereren, niet op module-niveau (serial-retry = duplicaat) · pagina's verversen niet vanzelf na fire-and-forget-backendwerk → herlaad-poll (`wachtOpTaakkaart` in proces-keten.spec) · `getByRole("alert")` matcht ook Next.js' lege route-announcer → filter `hasText: /\S/` · login-helper: `getByRole("navigation").first()`.
4. **RBAC-hulpdata**: optionele neven-fetches op pagina's `{ stil403: true }` meegeven (ecdFetch) — anders blokkeert de generieke 403-redirect de hele pagina voor rollen zonder die permissie.
5. **Flowable**: alles per tenant (native tenantId; "Activeren" = deploy voor díe tenant); taken/instanties zonder tenant zijn een bug (fail-closed). De catalogus-test bewaakt catalogus↔BPMN-templates.
6. **Windows-shell**: node staat niet op het sessie-PATH (fix per commando); Python is beschikbaar voor scripted edits; PowerShell én Git Bash werken, elk met eigen syntax.

## 5 · Accounts & omgevingen

- Testaccounts (per-rol, met serverrollen): `CLAUDE.md` → Test Accounts, of testplan §1.
- Staging Unraid: `ssh root@192.168.1.10`, repo `/mnt/user/appdata/openzorg`, web :13000, tunnel ecd.windahelden.nl — **server staat momenteel uit**.
- CI: `.github/workflows/ci.yml` — 5 checks; E2E draait de volledige compose-stack + seed; `workflow_dispatch` als vangnet.

*Laatst bijgewerkt: 2026-07-11 (avond) — einde Fable-sprint, overdracht aan Opus.*
