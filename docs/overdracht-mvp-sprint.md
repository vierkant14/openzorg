# Overdrachtsrapport — MVP-eindsprint (levend document)

**Gestart**: 2026-07-10 · **Uitvoerder**: Claude (autonoom, in opdracht van Kevin) · **Laatst bijgewerkt**: 2026-07-11 (ochtend)

Spec: `docs/superpowers/specs/2026-07-10-verkoopbare-mvp-vvt-thuiszorg-design.md` · Plannen: `docs/superpowers/plans/2026-07-10-w*.md` · Voortgangsgeheugen: memory `project_state`.

---

## Stand per werkstroom

| Werkstroom | Status | Bewijs |
|---|---|---|
| W0 planning-slice | ✅ Gemerged (PR #15) | CI groen incl. E2E |
| Spec + plannen | ✅ Gemerged (PR #16) | — |
| W1-1 bridge-hardening | ✅ Gemerged (PR #17) | 34 bridge-tests; Flowable-tenancy-integratietest bewees per-tenant deploy/start/query's in CI |
| W1-2 identiteitslaag | ✅ Gemerged (PR #18) | 4 me-route-tests; CI-E2E login-flow |
| W1-3 werkbak + catalogus | 🟡 PR #24 open (verving #19 na Actions-storing) | 39 bridge- + 44 ECD-tests lokaal groen; werkbak-e2e; CI draait |
| W1-4 Processen-hub | 🟡 PR #25 open (stapelt op #24; verving #20) | typecheck/lint groen; admin-processen-e2e |
| W1-5 + W1-6 keten | 🟡 PR #26 open (stapelt op #25; verving #21) | 46 bridge- + 46 ECD-tests lokaal; proces-keten-e2e + fhir-taak-e2e (zelf-seedend) |
| W2-1 reparaties | ✅ Gemerged (PR #22) | dashboard-stub weg, 0 raw-gray, custom-fields gesplitst, CHANGELOG + dit rapport |
| W2-2 dashboard/dedupe | ⬜ Na W1-merges | consumeert useWerkbak + /api/me |
| W3-1 CSV-cliëntimport | 🟡 PR #23 open | 6 route-tests + import-e2e; CI draait |
| W3-2/3 pilotprofiel + golden paths | ⬜ Plan klaar | — |
| W4 live platform | ⬜ Voorbereid (CHANGELOG-concept staat) | **geblokkeerd: Unraid staat uit (bevestigd door Kevin 2026-07-11)** |
| W5 verkooppakket | ⬜ Plan klaar | compliance-kolom voedt uit `docs/compliance/audit-readiness.md` |
| Compliance-dossier | 🟢 Aangemaakt (2026-07-11, op verzoek Kevin) | `docs/compliance/audit-readiness.md` — eerlijke NEN 7510/7513/AVG-status met codebewijs, gaten → backlog-IDs, auditor-documentenregister |

## De 10 procesmanagement-problemen (spec §2.2) — allemaal geadresseerd

| # | Probleem | Oplossing | Waar |
|---|---|---|---|
| 1 | Instanties dubbel kapot | native tenant-instanties + `processInstanceId`-filter + Lopend-tab | PR #17 (backend), #20 (UI) |
| 2 | FHIR-taken onbruikbaar | eigen claim/complete-routes + bron-routing in werkbak | PR #19 |
| 3 | Timer-service start nooit | header/variabelen/idempotentie gefixt + tests | PR #21 |
| 4 | Tenant-isolatie fail-open | fail-closed native tenancy, geen legacy-fallback | PR #17 |
| 5 | Geen auth op bridge | token-verificatie via Medplum + tenant-crosscheck | PR #17 |
| 6 | Claim = rol i.p.v. persoon | /api/me + X-User-Id + persoonlijke claims + audit op persoon | PR #18/#19 |
| 7 | Nul patroonlaag-hergebruik | werkbak/hub/taakformulieren/state-machines op shared-ui | PR #19/#20 |
| 8 | Duplicaat- en drift-UI | Taakwerkbak-sectie weg; proces-catalogus = één bron; redirects | PR #19/#20 |
| 9 | Werkbak niet in nav | nav-item in vandaag/rooster/team + N+1-oversight weg | PR #19 |
| 10 | Schijn-features | DI compleet, canvas-identiteit gefixt, DMN "Experimenteel", guards/triggers eerlijk gelabeld, ensure-deployed, keten-e2e | PR #21 |

## Actieve blokkers

1. ~~GitHub Actions-storing~~ **Opgelost 2026-07-11 ±08:10**: Actions verwerkte ±13 uur geen events (2026-07-10 ±20:55 → 2026-07-11 ±08:10 NL). Belangrijk restant: **PR's die tijdens de storing zijn aangemaakt krijgen blijvend geen webhook-events** (push/reopen op #19-21 deed niets); oplossing was ze sluiten en als verse PR's heropenen (#24/#25/#26). Merge-volgorde: #24 → #25 → #26, daarna is W1 compleet.
2. **Unraid staat uit** (bevestigd door Kevin, 2026-07-11). W4-uitrol wacht; alles is voorbereid — zodra de server aan staat is het W4-plan één sessie werk.

## Besluiten van vandaag die Kevin moet weten (naast spec §7)

- Werkbak-nav verving "Medewerkers" (rooster-werkruimte) en "Cliënten" (team-werkruimte) vanwege de max-5-regel — bevestigen (spec §8 punt 3).
- Herindicatie-signalering uit de timer-service verwijderd (vereist SearchParameter-build; template blijft handmatig startbaar via de hub) — roadmap-item.
- DMN blijft zichtbaar als "Experimenteel" (sandbox); opslaan naar de engine = roadmap.
- De twee `timer.cron`-entries in de trigger-config staan op `enabled:false` met uitleg (werden nooit door de trigger-engine uitgevoerd — schijn-actief).
- Verweesde route `/ecd/[id]/dashboard` (stub "nog niet gemigreerd") verwijderd — het werkgebied Overzicht ís het dashboard.

## Hervat-instructie (voor elke sessie/elk model)

1. Lees memory `project_state` + dit rapport + spec §6 (uitvoeringsprotocol).
2. Check `gh run list --limit 5`: verwerkt Actions weer events? → PR's #19/#20/#21 na groene CI in volgorde mergen; daarna W2-branch rebasen op main en afmaken (dashboard-landingsscherm consumeert `useWerkbak` + `haalMe`).
3. Check Unraid (`ssh -o ConnectTimeout=8 root@192.168.1.10 "echo ok"`): bereikbaar? → W4-plan volgen (release v0.3.0 eerst).
4. Werk de tabel hierboven en memory bij na elke gemergde PR.
