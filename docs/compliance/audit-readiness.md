# Compliance & audit-gereedheid — NEN 7510/7513/7516, AVG

**Status**: levend document · aangemaakt 2026-07-11 · eigenaar: Kevin (Stichting OpenZorg / B.V.)
**Doel**: één eerlijke plek die (a) vastlegt welke maatregelen er zijn mét bewijs in code, (b) welke gaten er zijn en waar die op de backlog staan, en (c) wat een auditor gaat opvragen. Dit document overdrijft niets: een claim zonder bewijsverwijzing hoort hier niet te staan.

> **De kern in drie zinnen.** OpenZorg is compliance-bewust gebouwd: logging, toegangsbeheer, tenant-isolatie en sessie-beheer zitten in de architectuur, niet eroverheen geplakt. Maar NEN 7510 is primair een **managementsysteem** (beleid, risicobeoordeling, verbetercyclus) en dat bestaat vandaag niet op papier; certificering (R-07) is een traject van 6-12 maanden dat naast de software loopt. Voor een **pilot** is de technische basis + dit dossier + de Tier-2b-punten hieronder de realistische lat; voor **enterprise-klanten** is certificering de lat.

---

## §1 — Stoplicht-samenvatting

| Domein | Status | Toelichting |
|---|---|---|
| Logging & verantwoording (NEN 7513) | 🟢 basis staat | Audit-log op elke API-call én op taak-transities, mét persoon sinds de identiteitslaag; retentie-beleid ontbreekt nog (🟠) |
| Toegangsbeheer (NEN 7510 §9) | 🟢 basis staat | RBAC-matrix, route-permissies, tenant-isolatie (RLS + Medplum Projects + fail-closed proces-engine), sessie-timeout |
| Authenticatie | 🟡 | Medplum PKCE + token-verificatie op services; MFA en SSO ontbreken (Tier 3, M-01..M-03); wachtwoordbeleid is Medplum-default (M-07) |
| Continuïteit (backup/DR) | 🟡 | Scripts + geteste restore + runbook bestaan; productie-cron en off-host-kopie nog niet actief (M-05) — onderdeel van W4-livegang |
| AVG-rechten (inzage/vergetelheid/portabiliteit) | 🔴 | Nog niet gebouwd (J-01..J-03, Tier 2) — voor een pilot procedureel op te vangen, niet voor productie op schaal |
| Retentie & vernietiging | 🔴 | NEN 7513-retentietermijnen niet geautomatiseerd (J-07/M-06) |
| Veilige e-mail (NEN 7516) | ⚪ n.v.t. (nu) | Berichten zijn intern (Communication-resources); er is geen e-mail-uitwisseling met cliëntdata |
| ISMS / organisatorisch (NEN 7510-kern) | 🔴 | Geen beleidsdocumenten, risicobeoordeling, DPIA, VWO-template (R-08), incidentproces-infosec; MIC dekt zórg-incidenten, niet informatiebeveiligingsincidenten |
| Certificering (NEN 7510, R-07) | 🔴 gepland | 6-12 maanden, €15-30k; start zinvol zodra eerste pilot getekend is |

## §2 — Wat er staat, met bewijs

### 2.1 Logging & verantwoording (NEN 7513)

| Maatregel | Bewijs |
|---|---|
| Elke `/api/*`-call in de ECD-service gelogd (wie, actie, resource-type, pad, duur) — asynchroon, niet-blokkerend | `services/ecd/src/middleware/audit.ts`; keten gemonteerd in `services/ecd/src/app.ts` (tenant → rbac → audit) |
| Taak-transities in de proces-engine gelogd als aparte events: start, claim, unclaim, complete, deploy, annuleren — mét reden bij annuleren | `services/workflow-bridge/src/lib/audit.ts` (action-union), aangeroepen in `routes/taken.ts` en `routes/processen.ts` |
| Audit op **persoon** (Practitioner-referentie), niet op rol | identiteitslaag `services/ecd/src/routes/me.ts` + token-afgeleide identiteit in `services/workflow-bridge/src/middleware/auth.ts`; audit-`userId` = profile-reference |
| AI-interacties gelogd | `services/ecd/src/routes/ai.ts` → `openzorg.audit_log` |
| Audit-log per tenant afgeschermd | `openzorg.audit_log` met row-level security (`infra/postgres/init.sql`) |
| Audit-inzage voor beheer | `/admin/audit`-viewer (`apps/web/src/app/admin/audit/page.tsx`) |
| Import-acties samengevat gelogd (aantallen) | `services/ecd/src/routes/client-import.ts` (action `clients.import`) |

**Gat**: retentie/archivering van de audit-log zelf is niet gedefinieerd (zie §3, J-07).

### 2.2 Toegangsbeheer & scheiding

| Maatregel | Bewijs |
|---|---|
| Vijf-rollen-RBAC met permissiematrix en route-koppeling per HTTP-methode | `packages/shared-domain/src/roles.ts` (`ROLE_PERMISSIONS`, `ROUTE_PERMISSIONS`), afgedwongen in `services/ecd/src/middleware/rbac.ts` |
| Tenant-isolatie in drie lagen: Medplum Projects (FHIR-data), PostgreSQL RLS (platform-tabellen), fail-closed proces-engine (native tenant op deployments/instanties/taken; geen legacy-fallback) | `infra/postgres/init.sql`; `services/workflow-bridge/src/lib/flowable-client.ts` (`verifyTaskTenant` gooit bij ontbrekende/afwijkende tenant) |
| Token-verificatie óók op de workflow-bridge, met tenant-crosscheck (header moet bij het token-project horen) | `services/workflow-bridge/src/middleware/auth.ts` |
| Frontend-navigatie gefilterd op rol + permissies; 403 → nette geen-toegang-pagina | `apps/web/src/components/werkruimtes.ts`, `apps/web/src/lib/api.ts` (403-redirect) |
| Master-admin-laag gescheiden via aparte header-sleutel en eigen tabel | `/api/master/*` + `openzorg.master_admins` |

**Bekende zwakte (eerlijk)**: de rol reist als `X-User-Role`-header die de backend vertrouwt na tenant-check; sinds de identiteitslaag komt de rol uit het Practitioner-profiel (server), maar backend-afdwinging van rol-uit-token (i.p.v. header) staat nog open → zie §3.

### 2.3 Sessies & authenticatie

| Maatregel | Bewijs |
|---|---|
| OAuth2 PKCE-login via Medplum; tokens project-gebonden | login-flow `apps/web/src/app/login/page.tsx`, seed-flow gedocumenteerd in `CLAUDE.md` |
| Sessie-timeout bij 15 min inactiviteit met waarschuwing vooraf (gedeeld-werkstation-realiteit) | `apps/web/src/components/AppShell.tsx` (NEN 7510-gemotiveerd, in code gedocumenteerd) |
| Verlopen sessie → geforceerde herlogin zonder stille fouten | 401-afhandeling in `apps/web/src/lib/api.ts` en `lib/workflow-api.ts` |
| Geen credentials in de repo; productie-secrets via `.env.prod` (verplicht, `:?`-afgedwongen) | `infra/compose/docker-compose.prod.yml`, runbook `docs/deployment-production.md` |
| Testaccounts expliciet dev-only; seeds draaien nooit in productie | runbook-regel + `CLAUDE.md` |

### 2.4 Continuïteit

| Maatregel | Bewijs |
|---|---|
| Backup-script (beide databases + media) en restore-script; restore is daadwerkelijk getest (Fase 0) | `infra/scripts/backup.sh`, `infra/scripts/restore.sh`, runbook |
| Kwartaal-regel "een ongeteste backup is geen backup" in het runbook | `docs/deployment-production.md` |
| Healthchecks op alle services; herstart-beleid in compose | compose-bestanden |

### 2.5 Gegevensvalidatie & integriteit

| Maatregel | Bewijs |
|---|---|
| BSN-elfproef op elke invoerroute (aanmaken, wijzigen, CSV-import) | `packages/shared-domain` (`isValidBSN`), gebruikt in `services/ecd/src/routes/client.ts` en `client-import.ts` |
| Drielagen-validatie (wettelijk kern-laag onveranderbaar; tenant-laag configureerbaar) | `packages/shared-config/src/validation-engine.ts` |
| FHIR R4 als datamodel (geen eigen klinische modellen) — audit-baarheid en portabiliteit | architectuurregel `CLAUDE.md`, hele `services/`-laag |

## §3 — Gaten, prioriteit en eigenaar

Direct gekoppeld aan de bestaande backlog (gap-analyse §8, Tier 2b = wettelijk, geen polish):

| Gat | Backlog-ID | Zwaarte | Realistische route |
|---|---|---|---|
| Retentie-beleid + geautomatiseerde handhaving (dossiers én audit-log) | J-07 / M-06 | Tier 2b | Beleidstabel (welke data, welke termijn) → soft-delete-jobs; eerst beleid op papier (dit dossier, §4) |
| AVG-rechten: inzage-export, vergetelheid, portabiliteit | J-01..J-03 | Tier 2 | Voor pilot: procedurele afhandeling (handmatige export door beheer, gedocumenteerd); bouwen vóór brede productie |
| Wachtwoordbeleid expliciet (complexiteit, rotatie) | M-07 | Tier 2b | Medplum-configuratie vastleggen + beleid in §4-documenten |
| Backup-cron actief op productie + off-host-kopie | M-05 | Tier 2b | Onderdeel W4-livegang (Unraid staat nu uit — zodra aan: cron + rsync-doel) |
| Rol-afdwinging uit token i.p.v. header (verwijderen demo-rolkeuze) | ME-01-vervolg (W3-2 plan) | Hoog | Gepland: seed-rollen → login zonder rolkeuze → backend leest rol server-side |
| Encryptie-at-rest expliciet regelen/vastleggen | M-05-verwant | Middel | Host-keuze (LUKS/ZFS-encryptie of managed disk); vastleggen in §4-hostingdocument |
| Informatiebeveiligings-incidentproces (naast zorg-MIC) | J-09-verwant | Tier 2b | Procedure-document (§4); meldplicht datalekken AVG erin |
| Verwerkersovereenkomst-template juridisch getoetst | R-08 | Blokker per tenant | Juridische review (2-6 wk); template-concept kan uit dit traject volgen |
| ISMS: beleid, risicobeoordeling, verbetercyclus | R-07-voorwerk | Certificerings-blokker | Documentenset §4 opbouwen; daarna pre-audit |
| Pentest / kwetsbaarheidsscan door derde partij | nieuw (COMP-01) | Vóór productie-pilot | Extern inplannen zodra pilot concreet; bevindingenproces via incidentprocedure |

## §4 — Wat een auditor opvraagt (documentenregister)

Status per document; ✅ = bestaat in repo, 🔨 = concept mogelijk uit dit traject, 🔴 = moet nog geschreven/belegd worden (deels organisatie, niet code).

| # | Document | Status | Waar / actie |
|---|---|---|---|
| 1 | Informatiebeveiligingsbeleid (directieverklaring, scope) | 🔴 | Kevin/BV — sjabloon kan uit dit traject |
| 2 | Risicobeoordeling + behandelplan (per dreiging: maatregel of acceptatie) | 🔴 | Start vanuit §2/§3 van dit dossier |
| 3 | Toegangsbeleid + rollenmatrix | 🔨 | Matrix bestaat in code (`roles.ts`); beleidstekst eromheen schrijven |
| 4 | Logging- & monitoringbeleid (wat, waarom, retentie, inzage) | 🔨 | §2.1 als basis; retentiebesluit nodig (J-07) |
| 5 | Back-up- & herstelbeleid incl. testverslagen | 🔨 | Runbook bestaat; testverslag-formaat toevoegen (datum/backup-id/uitkomst — eerste entry staat in het overdrachtsrapport-format) |
| 6 | Incidentprocedure informatiebeveiliging + datalek-meldproces | 🔴 | Nieuw; koppelen aan bestaande MIC-discipline |
| 7 | Verwerkersovereenkomst-template (AVG art. 28) | 🔴 | R-08, juridisch toetsen |
| 8 | DPIA voor het platform | 🔴 | Verplicht gezien aard van de gegevens (gezondheid, BSN) |
| 9 | Verwerkingsregister | 🔴 | Per tenant + platform |
| 10 | Autorisatieprocedure (in-/uitdienst, functiewijziging) | 🔴 | Organisatorisch, per zorginstelling + platform-beheer |
| 11 | Leveranciers-/subverwerkerslijst (hosting, Medplum, Flowable, Ollama — allemaal self-hosted: sterk verhaal) | 🔨 | Kort document; self-hosted-architectuur is hier een pluspunt |
| 12 | Continuïteitsplan (uitval host, RTO/RPO) | 🔴 | Na hosting-besluit (W4/post-W4) |
| 13 | Wijzigingsbeheer | 🔨 | Bestaat de facto: PR-verplichting, verplichte CI-checks, branch-protectie, CHANGELOG — beschrijven volstaat |
| 14 | Bewustwording/training personeel | 🔴 | Organisatie (pilot-instelling + platform) |

## §5 — Route naar certificering (realistisch)

1. **Nu (dit traject)**: dit dossier actueel houden per release; documenten #3/#4/#5/#11/#13 als concept opstellen (kunnen grotendeels uit bestaande repo-feiten).
2. **Bij pilot-tekening**: R-08 (VWO) juridisch regelen; DPIA uitvoeren; pentest inplannen; Tier-2b-technische gaten (J-07, M-05..M-08) inbouwen.
3. **Certificeringstraject NEN 7510 (R-07)**: pre-audit → corrigeren → audit; 6-12 maanden, €15-30k; pas zinvol met een draaiende pilot en belegde organisatie-rollen.
4. **NEN 7516** wordt relevant zodra er e-mail-uitwisseling van cliëntgegevens komt (nu niet in scope).

## §6 — Onderhoud van dit dossier

- Bij elke release (CHANGELOG-bump): §2-bewijstabel controleren op verplaatste bestanden en nieuwe maatregelen toevoegen.
- Bij elke gedichte §3-rij: regel verplaatsen naar §2 mét bewijsverwijzing.
- Restore-tests: datum + uitkomst aantekenen (§4-#5).
- Dit dossier is de bron voor de compliance-kolom in de verkoop-roadmap-matrix (W5).
