# Feature- vs. roadmap-matrix — OpenZorg VVT + thuiszorg

**Voor**: verkoop / product owner en de geïnteresseerde instelling · **Laatst bijgewerkt**: 2026-07-11
**Doel**: eerlijk onderscheid tussen (a) wat vandaag aantoonbaar werkt, (b) wat gedeeltelijk aanwezig is, en (c) wat op de roadmap staat — inclusief de externe blokkades (licenties, certificaten) met doorlooptijd en kosten-orde.

> **Leesregel.** In de kolom **Werkt nu** staat alleen wat door een geautomatiseerde browsertest in CI of door het acceptatietestplan (`docs/testplan-acceptatie-mvp.md`) is bewezen — met verwijzing. In de kolom **Roadmap** staat bij elk licentie-geblokkeerd item een **R-nummer** dat verwijst naar de harde randvoorwaarden (zie de R-tabel onderaan, overgenomen uit de gap-analyse §3.5). Geen claim zonder bewijs; geen roadmap-belofte zonder blokkade en doorlooptijd.
>
> **Bron van waarheid**: functioneel `docs/superpowers/specs/2026-05-01-openzorg-vvt-volwassenheid-gap-analyse.md`; wat af is `CHANGELOG.md` + `docs/overdracht-mvp-sprint.md`; compliance `docs/compliance/audit-readiness.md`.

---

## De matrix

### 1 · Cliëntdossier

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| Brede cliënt-CRUD: persoonsgegevens, contactpersonen, indicaties, verzekering (Coverage), locatie, foto. BSN-**elfproef** op elke invoerroute incl. import. CSV-bulkimport van cliënten. *Bewijs: `client-import.spec.ts`, testplan §3-F; BSN-validatie audit-readiness §2.5.* | Dossier heeft veel tabs (allergieën, diagnoses, vaccinaties, VBM, MDO, documenten) maar **inhoudelijk dun**. Geen CAK eigen bijdrage, geen alarmering/sleutelbeheer, geen mantelzorg-rolregister, geen Zib-volledigheidsafdwinging. | CAK, alarmering, mantelzorgregister, Zib-compliance-audit (Epic A): **eigen build, M ≈ 3-5 wk**, geen externe blokkade. BSN-verificatie tegen **SBV-Z/GBA** (nu alleen lokale elfproef): **R-02 + R-03**. |

### 2 · Rapportage

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| SOEP- én vrije rapportage schrijven, opslaan, direct terugzien in de lijst. **AI-samenvatting** (lokale Ollama, blijft binnen het netwerk). *Bewijs: `golden-path-zorgmedewerker.spec.ts`, `rapportage-soep.spec.ts`; AI = gap-analyse §5 D-06.* | Doel-koppeling deels aanwezig. **Niet**: gestructureerde zorgmoment-templates, dagstructuur (ochtend/middag/avond/nacht), overdracht-snapshot tussen diensten. | Zorgmoment-templates, dagstructuur, overdracht-snapshot (D-02..D-04): **eigen build, M ≈ 3-4 wk**, geen externe blokkade. NEN 7513-**retentie-automatisering** (D-05/J-07): beleidsafhankelijk, zie compliance-dossier §3. |

### 3 · Zorgplan

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| CarePlan + Goal + ServiceRequest, **SMART-doel-validator**, doel-evaluaties, handtekeningen (cliënt), automatische evaluatietaak die als FHIR-taak in de werkbak landt en afrondbaar is. *Bewijs: `fhir-taak.spec.ts`; CHANGELOG v0.2.0.* | Zorgplan werkt, maar **niet** in de 4-domein-structuur van het Kwaliteitskader; geen versionering, geen concept-status; ZZP-koppeling dun. Herindicatie is **handmatig** startbaar via de Processen-hub (automatische signalering verwijderd — zie overdracht). | 4-domein-zorgleefplan (C-01), formele herindicatie-flow (C-02), ZZP→uren-norm (C-03), versionering (C-07): **eigen build, M ≈ 4-6 wk**, geen externe blokkade. |

### 4 · Medicatie

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| Medicatie-**registratie**: voorschrift (MedicationRequest), toediening (MedicationAdministration) en medicatie-overzicht (MedicationStatement). *Bewijs: CHANGELOG v0.2.0 (medicatie-module).* | Registreren werkt; **de veiligheidslaag ontbreekt volledig**. Geen interactiebewaking, geen dubbele controle, geen contra-indicatie-signaal. | **Medicatieveiligheid (BEM, dubbele controle, MFB, interactiebewaking) is licentie-geblokkeerd** en bewust buiten de MVP (spec §1): **R-01** KNMP G-Standaard (4-8 wk, €2.000-€8.000/jr per tenant) + **R-02** Vecozo-transport (6-12 wk, €500-€1.500/jr per AGB-org). Eerlijk: vandaag registratie, **geen** geautomatiseerde medicatiebewaking. |

### 5 · Planning — intramuraal

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| Rooster met sleep-en-neerzet, dienst-configuratie, bezettingsprofielen, **planning-engine** (valideer/optimaliseer/genereer), CAO/ATW-basisregels, herhalingen, wachtlijst. *Bewijs: CHANGELOG v0.2.0.* **Kanttekening**: nog géén dedicated e2e — planner-golden-path is W3-roadmap (testplan §5); werkt in product, CI-bewijs in aanbouw. | Kernrooster werkt; **niet** compleet: CAO-VVT edge-cases (pauze/weekend/max-nachten), competentie-matching, publicatie-/medewerker-akkoord-flow zijn dun. | CAO-edge (E-01), competentie-matching (E-02), publicatie/akkoord (E-05): **eigen build, M-L ≈ 6-8 wk**, geen externe blokkade. |

### 6 · Planning — thuiszorg (extramuraal)

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| **Dagplanning** als dagindeling/route langs cliënten aan huis — draagt het thuiszorg-verhaal in demo en pilot. *Bewijs: CHANGELOG v0.2.0 (planning-module); demo-script stap 3.* | Dagplanning toont de route; **niet**: mobiele check-in bij de cliënt, routelijst-app, reistijd-optimalisatie. | Mobiele tijdregistratie (E-03), routelijst-view (E-04), reisuren (E-09): **eigen build, M**, web-responsive; native app is **post-v1.0**. Geen externe blokkade — wel expliciet nog niet af. |

### 7 · Processen & taken *(het best-bewezen domein)*

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| **Werkbak** (persoonlijke inbox, tabs Mijn/Beschikbaar/Alle, catalogus-formulieren, cliënt-links, deadline-urgentie) + **Processen-hub** (Actieve zorgpaden/Sjablonen/Lopend/Geavanceerd). Zorgpad activeren, **automatische start** bij nieuwe cliënt, persoonlijke claim, voortgang per cliënt, annuleren-met-reden, FHIR-taken, **per-tenant fail-closed isolatie**, ensure-deployed, audit op persoon. *Bewijs: `proces-keten.spec.ts`, `admin-processen.spec.ts`, `werkbak.spec.ts`, `fhir-taak.spec.ts`, `flowable-tenancy.spec.ts`; testplan §3-B/C/D/E.* | 5 zorgpad-sjablonen (o.a. intake, zorgplan-evaluatie, MIC-afhandeling). **Niet**: notificaties/escalaties bij deadline-overschrijding (dun); **Beslisregels/DMN** rendert maar is **"Experimenteel"** (opslaan naar engine volgt). | Extra templates, notificaties, escalaties (Epic K): **eigen build, M ≈ 3-4 wk**, geen externe blokkade. DMN werkend maken = roadmap (timebox-besluit spec §4.5). |

### 8 · Beheer & configuratie *(sterk punt)*

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| Codelijsten, validatieregels (**drielagen**: kern/uitbreiding/plugin), custom fields, rollen/RBAC, feature flags, vragenlijsten, state-machines, AI-config, **catalogus-gedreven taakformulieren**, audit-viewer. *Bewijs: testplan §3-G (taakformulieren); CHANGELOG v0.2.0 + W1.* | Sterk, met finishing touches open: **niet** af zijn formulier-versionering, configuratie-export/import (tenant-cloning), codelijsten-bulk-import. | Versionering, export/import, bulk-import (Epic L): **eigen build, S ≈ 1-2 wk**, geen externe blokkade. |

### 9 · Facturatie

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| Basis-registratie: prestaties + declaraties (CRUD), NZa 2026-productcatalogus, CSV/PDF-export. Feature-flagged. *Bewijs: CHANGELOG v0.2.0 (facturatie-basis).* | Registreren werkt; **de keten naar het zorgkantoor werkt niet**. Geen Vektis-bestand, geen iWlz-berichten, geen CAK-berekening. | **Vektis AW319/AW320** = **R-05** (4-8 wk certificering, gratis voor open-source) + **R-02** transport. **iWlz IWMR/AAI/MUC** = **R-04** (8-16 wk acceptatietest zorgkantoor) + **R-03**. CAK eigen bijdrage = eigen build (Epic H, XL ≈ 10-14 wk). Eerlijk: **declareren-naar-zorgkantoor is post-pilot**. |

### 10 · Externe koppelingen

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| API-first architectuur + stub-laag (integraties-route, webhooks en api_keys in de database met RLS). *Bewijs: gap-analyse §3 (Epic I).* | De aansluiting staat klaar, maar **geen enkele productieve externe koppeling is actief**. | **SBV-Z** (BSN/GBA) = **R-02 + R-03**; **AGB/Vecozo** = **R-02** (6-12 wk); **G-Standaard** = **R-01** (4-8 wk); **iWlz-routerservice** = **R-02 + R-03 + R-04**. Sleutel voor álle zorg-tot-zorg-koppelingen: **R-03 UZI-server-cert** (4-8 wk, €500-€1.000/cert + jaarlijkse rotatie). LSP/Mitz/eOverdracht/apotheek = **post-v1.0**. |

### 11 · Security & compliance

| Werkt nu (met bewijs) | Gedeeltelijk (wel / niet) | Roadmap (blokkade · doorlooptijd · kosten) |
|---|---|---|
| PKCE-login (Medplum), **vijf-rollen-RBAC** met route-permissiematrix, **tenant-isolatie in drie lagen** (Medplum Projects + PostgreSQL RLS + fail-closed proces-engine), token-verificatie op de proces-service, **sessie-timeout** (15 min) + nette herlogin bij verlopen sessie, **NEN 7513-audit op persoon** (elke API-call + taak-transities), BSN-elfproef, backup/restore-scripts met **geteste restore**, geen credentials in de repo. *Bewijs: `flowable-tenancy.spec.ts`, `auth-helper.spec.ts`; compliance-dossier §2 met codebewijs.* | Audit staat, **retentie-automatisering** ontbreekt. RBAC staat, **rol-afdwinging uit token** (i.p.v. header) staat nog open. Backup-scripts bestaan, **productie-cron nog niet actief** (wacht op live-server). AVG-inzage/vergetelheid procedureel, niet geautomatiseerd. | **SSO (SAML/OIDC) + MFA = roadmap** (Tier 3, M-01..M-03): eigen build M ≈ 3-5 wk, geen externe blokkade behalve enterprise-eis. AVG-rechten (J-01..J-03) Tier 2. Retentie (J-07/M-06). **NEN-certificering = R-07** (6-12 mnd, €15.000-€30.000 + jaarlijkse hercert.). **Verwerkersovereenkomst = R-08** (2-6 wk juridisch). **Operational readiness/support = R-06** (continu FTE, vóór productie). Details: compliance-dossier §3/§5. |

---

## Harde randvoorwaarden (R-01..R-08)

Overgenomen uit de gap-analyse §3.5. Dit zijn de externe blokkades: ze kosten geen ontwikkeluren maar wél kalenderweken, geld of administratieve doorlooptijd. Ze starten **parallel** aan de pilot, niet erna.

| R | Onderwerp | Type | Doorlooptijd | Kosten-orde | Blokkeert | Per |
|---|---|---|---|---|---|---|
| **R-01** | KNMP G-Standaard-licentie (Z-Index) | Commercieel + technisch | 4-8 weken | €2.000-€8.000 / jaar | Medicatieveiligheid (BEM, dubbele controle, MFB, allergie-lookup) | tenant |
| **R-02** | Vecozo-certificaat + AGB-aansluiting | Administratief + technisch | 6-12 weken | €500-€1.500 / jaar | SBV-Z, Vektis + iWlz, G-Standaard-transport | zorginstelling (AGB) |
| **R-03** | UZI-server-cert (PKI-overheid) | Administratief | 4-8 weken | ~€500-€1.000 / cert + jaarlijkse rotatie | Alle zorg-tot-zorg-koppelingen (LSP/iWlz/SBV-Z) | zorginstelling |
| **R-04** | iWlz-acceptatietest zorgkantoor | Certificeringstraject | 8-16 weken | gratis (capaciteitsbeperkt aan zorgkantoor-zijde) | iWlz-berichten productie (IWMR/AAI/MUC) | zorgkantoor-relatie |
| **R-05** | Vektis EI-certificering (AW319/AW320) | Certificeringstraject | 4-8 weken | gratis voor open-source | Vektis-declaratie productie | leverancier (eenmalig per release) |
| **R-06** | Operational readiness (backup, on-call, runbook, support-SLA) | Procesueel + organisatorisch | parallel, klaar vóór go-live | continu (FTE) | Productie-go-live, ongeacht welke features af zijn | leverancier / hosting |
| **R-07** | NEN 7510 / 7513 / 7516-certificering | Certificeringstraject | 6-12 maanden | €15.000-€30.000 + jaarlijkse hercertificering | Enterprise-acceptatie (niet altijd eerste-pilot-blokker) | leverancier / hosting |
| **R-08** | Verwerkersovereenkomst-template juridisch getoetst | Juridisch | 2-6 weken | eenmalige juridische review | Tenant-onboarding (AVG-vereiste) | platform (eenmalig, per tenant getekend) |

---

## De pilot-boodschap

Een MVP verkoop je op wat er wél is — vlekkeloos — plus een geloofwaardige, eerlijke roadmap. Concreet voor een pilot:

- **Wat de instelling bij tekening zelf in gang zet** (kalenderdoorlooptijd loopt parallel aan de pilot, niet erna):
  - **R-08 — Verwerkersovereenkomst** (2-6 wk): AVG-vereiste vóór onboarding; wij leveren het template-concept, de instelling tekent.
  - **R-01 — KNMP G-Standaard** (4-8 wk) en **R-02 — Vecozo + AGB** (6-12 wk): nodig zodra medicatieveiligheid en/of declaratie in beeld komen. Start deze aanvragen **op de dag van tekening**, want de doorlooptijd is niet te versnellen.
- **Wat daarna volgt zodra de pilot loopt**: **R-03** (UZI-cert) voor koppelingen, **R-04/R-05** (iWlz/Vektis) voor de declaratie-keten. Een test-UZI-cert is snel beschikbaar voor dev/test.
- **Geen overdrijving** — deze onderdelen zijn nadrukkelijk **roadmap**, geen huidige functionaliteit:
  - Medicatie**veiligheid** (BEM / G-Standaard-interactiebewaking / dubbele controle).
  - **Vektis / iWlz**-declaratie naar het zorgkantoor.
  - **SSO / MFA** en NEN-**certificering**.
  - Mobiele thuiszorg-app (check-in / routelijst).

Voor een **pilot** is de lat: de technische basis die vandaag werkt (dossier, rapportage, zorgplan, planning, processen, beheer) + het compliance-dossier + de Tier-2b-punten. Voor **enterprise-klanten** komt daar NEN-certificering (R-07) bij.

*Prijsstelling en commerciële voorwaarden staan bewust buiten dit document (spec §10) — prijsafspraken: separaat.*
