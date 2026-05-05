# OpenZorg — VVT v1.0 Volwassenheid: Gap-Analyse & Feature Breakdown

**Versie**: 1.1
**Datum**: 2026-05-01
**Branch context**: `plan-2a-execute`
**Doel**: Analyse-document, niet uitvoeringsplan. Geen code-wijzigingen op basis van dit document zonder expliciete uitvoeringsopdracht.

**Wijzigingen v1.0 → v1.1**: §3.5 harde randvoorwaarden toegevoegd (licenties/certificaten/doorlooptijden); Differentiator-pas op §5 (planning-engine, AI, configuratie-export); §8 Tier-systeem gesplitst (Tier 2b "wettelijk verplicht, geen polish" toegevoegd).

---

## §0 — Doel & gebruik

### Wat is dit document?

Dit is een **gap-analyse** tussen de huidige staat van OpenZorg en wat een volwassen VVT-platform (v1.0) inhoudt. Het beschrijft **wat er nog gebouwd moet worden** voordat OpenZorg als volwaardig hoofdsysteem voor een Nederlandse VVT-instelling kan dienen — en doet dat zo dat de cross-sector platform-laag (HIS, klinisch EPD) niet later een rewrite vereist.

### Voor wie?

1. **Claude Code** — leest dit document en synct de Notion-backlog. Mapping naar Notion-velden in §9.
2. **De ontwikkelaar (Kevin)** — gebruikt dit als roadmap-referentie en sprintplanning-input.
3. **Toekomstige bijdragers** — zelfstandige context: alles wat nodig is om de scope te begrijpen staat hierin, geen externe chats of meetings vereist.

### Hoe gebruiken?

- **§1–§3** = visie en huidige staat (lees eenmalig)
- **§4** = epic-view voor roadmap-discussies (kwartaalplanning)
- **§5** = feature-view voor backlog (Notion-import, sprintplanning)
- **§6** = architectuur-checklist bij elke PR (mag deze code-wijziging een VVT-aanname inbouwen?)
- **§7** = hoort niet in v1.0; verwijs naar deze sectie als iets daar valt
- **§8** = strategisch kritisch pad (welke features eerst?)
- **§9** = Notion-mapping, alleen voor Claude Code

### Wat dit document NIET is

- Geen uitvoeringsplan. Per feature volgt later een eigen plan via `superpowers:writing-plans`.
- Geen architectuur-document op detailniveau (zie ADR's voor architectuur-beslissingen).
- Geen marketing-/sales-document.

---

## §1 — Strategische frame

### Missie

Open source, FHIR-native, AI-native zorgplatform dat de gesloten markt van Nederlandse zorginformatiesystemen openbreekt — over alle care- en cure-sectoren heen, op één codebase.

### Doelmarkt — volgorde van aanval

1. **VVT** (Verpleging, Verzorging, Thuiszorg) — fundament; **dit is v1.0**
2. **GZ / GGZ** — natuurlijke uitbreiding (langdurige zorg)
3. **Huisartsenzorg (HIS)** — eerstelijns, episodisch model, andere financiering
4. **Klinisch EPD** (ziekenhuis / specialistisch) — DBC's, OK, lab/beeld, opname/ontslag

### Unieke positionering (must-keep differentiators)

- **Open source** (EUPL 1.2) — geen vendor lock-in, transparant, audit-baar
- **FHIR-native vanaf laag 1** — geen eigen datamodellen voor klinische data
- **Drielagen-configureerbaarheid** (kern / uitbreiding / plugin) — instelling beheert eigen workflows, validaties, codelijsten zonder code-wijziging
- **Sector-neutrale architectuur** — elk concept (zorgzwaarte, competenties, diensten, episodes) werkt cross-sector via interfaces
- **AI-native, lokaal** (Ollama) — data verlaat het netwerk niet, AI is wel overal aanwezig
- **BPMN/DMN-driven workflows** — zorgpaden zijn data, geen code
- **API-first multi-tenant** — zelfde API voor UI én externe partijen, vanaf dag 1 multi-tenant met RLS

### Definitie v1.0

**v1.0 = volledige VVT-volwassenheid + cross-sector platform-laag architectureel geborgd.**

Concreet betekent dat:
- Alle epics A–M (zie §2) in scope, behalve Epic G (cliëntportaal/familieportaal/beeldbel) → post-v1.0
- Geen native mobile / offline-modus voor extramurale teams → web-responsive volstaat (post-v1.0 native app)
- Externe koppelingen-subset: SBV-Z, AGB/Vecozo, G-Standaard, iWlz. LSP/Mitz/eOverdracht/apotheek → post-v1.0
- Cross-sector platform-laag (zie §6) moet meegenomen worden tijdens v1.0; niet uitgesteld

### Wat NIET in v1.0

- Cliëntportaal, familieportaal, beeldbel (Epic G in geheel)
- Native mobile app + offline-sync voor extramurale routes
- LSP / Mitz / eOverdracht
- Apotheek-koppeling (TMS / Medimo) — eigen medicatie-module dekt v1.0
- Verzuim-module (extern via AFAS/Visma in v1.0)
- HIS-/EPD-specifieke features
- Internationaal / multi-taal

---

## §2 — Benchmark: wat is een volwassen VVT-platform?

Een marktleider in NL VVT dekt — los van marketing — twaalf functionele epic-domeinen voor v1.0 (Epic G post-v1.0).

| Epic | Domein | Wat erin valt |
|------|--------|---------------|
| **A** | Cliëntdossier | Persoonsgegevens, contactpersonen, indicaties (CIZ/WLZ/Wmo/Zvw/Jw), verzekering & coverage, CAK eigen bijdrage, woonsituatie & locatie, alarmering & sleutelbeheer, zorgaanbieder-relaties |
| **B** | Klinische registratie | Diagnoses (Zib + ICD-10), allergieën (G-Standaard), medicatie (voorschrift + toediening + BEM + dubbele controle + MFB + interactiebewaking), vaccinaties (RIVM-codes), risicoscreenings (Braden/MFES/SNAQ-RC/GDS/MMSE/MoCA/NRS/REPOS/Katz/IADL), wondzorg gestructureerd (EPUAP-classificatie), VBM/Wzd, palliatief, verklaring overlijden, hulpmiddelen-register |
| **C** | Zorgplanning | Zorgleefplan 4 domeinen, SMART-doelen, interventies/acties, MDO-cyclus, herindicatie, evaluaties, handtekeningen cliënt + wettelijk vertegenwoordiger, ZZP-koppeling, zorgplan-versionering |
| **D** | Rapportage | SOEP / vrij / gestructureerd per zorgmoment, koppeling aan doelen/interventies, dagstructuur, overdracht-snapshot, NEN 7513-conform |
| **E** | Operationele planning | Intramuraal (rooster, dienst-config, bezetting), extramuraal (route, reistijd, tijdregistratie via web mobile-friendly), recurring afspraken, wachtlijst, cliënt-medewerker matching op competentie, CAO-VVT/ATW |
| **F** | Personeel & rooster | Medewerkers (Practitioner) met contracten, BIG-/V&V-register sync, competenties, opleidingen/certificaten met vervaldatum, bevoegdheden, urenregistratie + loon-export. Verzuim post-v1.0. |
| ~~G~~ | ~~Cliëntinteractie~~ | **POST-v1.0** — Cliëntportaal, familie-/mantelzorgportaal, beeldbel, push-notificaties |
| **H** | Financieel / declareren | Indicatie → prestatie → declaratie keten, Vektis-bestand-export (AW319/AW320 WLZ), CAK eigen bijdrage, productieregistratie, contracten zorgkantoor, retourbericht-verwerking, iWlz berichtenverkeer |
| **I** | Externe koppelingen (subset v1.0) | SBV-Z (BSN-validatie), AGB/Vecozo, G-Standaard (KNMP), iWlz routerservice. LSP/Mitz/eOverdracht/apotheek/huisarts → post-v1.0 |
| **J** | Compliance & kwaliteit | NEN 7510/7513/7516, AVG (inzage/wijzigen/vergeten/dataportabiliteit), Zib-compliance, kwaliteitsindicatoren CIQI VVT, IGJ-jaarverslag, MIC/VIM-trends, RI&E light |
| **K** | Workflow & taken | Zorgpaden als BPMN-templates (intake, evaluatie, herindicatie, MIC), taakbeheer, notificaties, escalaties, deadlines |
| **L** | Beheer & configuratie | Codelijsten, validatieregels, custom fields, rollen/rechten, feature flags, AI-config, formulier-builder, vragenlijsten, codetabellen-import, configuratie-export/import |
| **M** | Auth & security | SSO (SAML/OIDC), MFA, UZI-server-cert (zorgsysteem-tot-zorgsysteem), audit log met retentie, backup/DR, encryptie at-rest, rate-limiting, sessie-management |

### Wat NIET tot VVT-must-match hoort

- DBC-registratie / OK-planning → klinisch-EPD-territorium (post-v1.0)
- ICPC-driven episodisch dossier → HIS-territorium (post-v1.0)

### Wat WEL meegenomen wordt als architecturele verplichting

Cross-sector platform-laag (zie §6) — de modellen mogen geen VVT-aannames in de kern vastleggen.

---

## §3 — Huidige staat → gap-matrix high-level

**🟢 = solide basis aanwezig | 🟡 = aanwezig maar dun | 🔴 = nagenoeg afwezig | 🟢🟢 = sterk punt**

| # | Epic | Huidige staat | Gap-zwaarte | Hot-spots |
|---|------|---------------|-------------|-----------|
| **A** | Cliëntdossier | 🟢 Brede CRUD (client, contactpersonen, indicaties, verzekering/Coverage, locatie, foto) | 🟡 Medium | CAK eigen bijdrage, alarmering/sleutel, zorgaanbieder-relaties, mantelzorg-register |
| **B** | Klinische registratie | 🟡 Breed gespreid (allergie, diagnose, medicatie, vaccinatie, risico, VBM, wilsverklaring, toediening) maar **inhoudelijk dun** | 🔴 Zwaar | Medicatieveiligheid (BEM/dubbele controle/MFB/G-Standaard), wondzorg-classificatie, meetinstrumenten, zorgleefplan-4-domeinen, palliatief, verklaring overlijden, probleemlijst, hulpmiddelen |
| **C** | Zorgplanning | 🟢 CarePlan + Goal + ServiceRequest + handtekeningen + evaluaties; SMART-validator, automatische evaluatie-taak | 🟡 Medium | Zorgleefplan 4 domeinen, ZZP-koppeling, formele herindicatie-flow, versionering, concept-status |
| **D** | Rapportage | 🟢 SOEP + vrij + signaleringen, AI-samenvatting | 🟡 Medium | Doel-koppeling (deels in branch), gestructureerde zorgmoment-templates, dagstructuur, overdracht-snapshot |
| **E** | Operationele planning | 🟢 Intramuraal sterk (planning-engine, bezetting, dienst-config, herhalingen, drag-drop rooster, CAO-engine) | 🟡 Medium | CAO/ATW edge-cases, competentie-matching, tijdregistratie, routelijst-view, plannings-publicatie & akkoord-flow, verlof-herplanning |
| ~~G~~ | ~~Cliëntinteractie~~ | ⏭️ **POST-v1.0** | — | — |
| **F** | Personeel & rooster | 🟡 Basis (medewerkers, contracten, competenties admin) | 🔴 Zwaar | BIG-/V&V-register sync, urenregistratie/loon-export, opleidingen/certificaten, bevoegdheden-matrix, contract-historie, rooster-audit |
| **H** | Financieel / declareren | 🟡 CRUD (prestaties, declaraties), CSV/PDF export, NZa 2026 productcatalogus | 🔴 Zwaar | **Vektis AW319/AW320**, CAK eigen bijdrage, **iWlz IWMR/AAI/MUC**, productie→declaratie pipeline, contract-management, debiteuren, maand-afsluiting |
| **I** | Externe koppelingen | 🔴 Stub-laag (integraties-route + webhooks/api_keys in DB) | 🔴 Zwaar | **SBV-Z**, AGB/Vecozo, G-Standaard koppeling, iWlz routerservice |
| **J** | Compliance & kwaliteit | 🟡 NEN 7513 audit-log goed (audit-route + viewer), MIC trends-pagina | 🟡 Medium | AVG-flows (inzage/portabiliteit/vergetelheid), CIQI VVT export, IGJ-jaarverslag, retentie-policies, RI&E |
| **K** | Workflow & taken | 🟢 Flowable BPMN-engine + werkbak + DMN-editor + canvas + intake-template | 🟡 Medium | Concrete BPMN-templates voor evaluatie/herindicatie/MIC, notificaties, escalaties, deadlines |
| **L** | Beheer & configuratie | 🟢🟢 **Sterk punt** — codelijsten, validatieregels, custom fields, rollen, feature flags, AI-config, vragenlijsten, state-machines, task-form-options | 🟢 Klein | Formulier-versionering, configuratie-export/import, codelijsten bulk-import |
| **M** | Auth & security | 🟡 Medplum PKCE + RBAC + RLS + audit | 🟡 Medium | SSO (SAML/OIDC), MFA, UZI-server-cert, backup/DR, retentie-policies, wachtwoord-policy |

**Samenvatting**: sterk op **architectuur en configuratie** (L, K, deels A/C/D/E), maar **klinische diepte (B), HR (F), financieel (H) en externe koppelingen (I)** zijn de vier zware muren.

---

## §3.5 — Harde randvoorwaarden v1.0 (licenties, certificaten, doorlooptijden)

Deze sectie maakt de **niet-bouwbare** v1.0-blokkers expliciet. Veel hiervan kost geen ontwikkeluren maar wel kalenderweken, geld of administratieve doorlooptijd. Plan ze parallel aan epic-werk; sommige items hebben aanvraag-doorlooptijden van maanden.

### R-01 — KNMP G-Standaard licentie (Z-Index)

- **Type**: Commercieel + technisch
- **Doorlooptijd**: 4-8 weken (offerte + contract + Vecozo-koppeling)
- **Kosten orde**: €2.000-€8.000/jaar per tenant (afhankelijk van volume + modules)
- **Blokkeert**: B-01, B-02, B-03, B-04, B-14
- **Per**: tenant, niet platform-breed
- **Risico**: Zonder licentie geen medicatieveiligheid; medicatieveiligheid is Tier 1. Sales moet per pilot deze regelen.

### R-02 — Vecozo certificaat + AGB-aansluiting

- **Type**: Administratief + technisch
- **Doorlooptijd**: 6-12 weken (AGB-uitgifte + Vecozo-aanvraag + cert-installatie + acceptatietest)
- **Kosten orde**: €500-€1.500/jaar per AGB-organisatie
- **Blokkeert**: I-01 (SBV-Z), H-01..H-06 (Vektis + iWlz), B-01 (G-Standaard transport)
- **Per**: zorginstelling (AGB-organisatie)
- **Risico**: Single point of progress voor hele declaratie-pijplijn én medicatieveiligheid. Mock-laag bouwen voor parallel doorbouwen.

### R-03 — UZI-server-cert (PKI-overheid)

- **Type**: Administratief
- **Doorlooptijd**: 4-8 weken (CIBG + PKI-overheid procedure)
- **Kosten orde**: ~€500-€1.000 per cert + jaarlijkse rotatie
- **Blokkeert**: M-04, en daarmee alle zorg-tot-zorg-koppelingen (LSP/iWlz/SBV-Z)
- **Per**: zorginstelling
- **Risico**: Niet onderhandelbaar voor productie-pilot. Test-cert (UZI test-CA) wel snel beschikbaar voor dev/test.

### R-04 — iWlz acceptatietest zorgkantoor

- **Type**: Certificeringstraject
- **Doorlooptijd**: 8-16 weken (testbericht-rondes met zorgkantoor + acceptatie)
- **Kosten orde**: gratis maar capaciteitsbeperkt aan zorgkantoor-zijde
- **Blokkeert**: H-04 (IWMR), H-05 (AAI), H-06 (MUC) productie-readiness
- **Per**: zorgkantoor-relatie (1 instelling kan meerdere zorgkantoren hebben)
- **Risico**: Kalenderdoorlooptijd niet versnelbaar. Plan in zodra eerste pilot-instelling getekend is.

### R-05 — Vektis EI-standaard certificering (AW319/AW320)

- **Type**: Certificeringstraject
- **Doorlooptijd**: 4-8 weken (XSD + business-rules + testronde)
- **Kosten orde**: gratis voor open-source
- **Blokkeert**: H-01, H-02 productie-readiness
- **Per**: software-leverancier (eenmalig per release)
- **Risico**: Vektis-spec-versie 2026 vereist; als 2027 verschijnt tijdens v1.0-traject re-certificering nodig.

### R-06 — Operational readiness (backup, on-call, runbook, support-SLA)

- **Type**: Procesueel + organisatorisch
- **Doorlooptijd**: parallel aan ontwikkeling, maar moet vóór go-live klaar
- **Kosten orde**: continu (FTE) — out-of-scope voor v1.0-feature-budget
- **Blokkeert**: productie-go-live, ongeacht welke features af zijn
- **Risico**: Een instelling kan niet zonder 24/7-support voor productie-ECD. Open-source community-model dekt dit niet — commerciële BV-laag (zie ADR-006) moet dit invullen vóór eerste productie-pilot.

### R-07 — NEN 7510 / NEN 7513 / NEN 7516 certificering

- **Type**: Certificeringstraject
- **Doorlooptijd**: 6-12 maanden (audit-voorbereiding + audit + corrigerende maatregelen)
- **Kosten orde**: €15.000-€30.000 per certificering + jaarlijkse hercertificering
- **Blokkeert**: enterprise-acceptatie (niet altijd contract-blokker bij eerste pilot, wél bij grote instellingen)
- **Per**: software-leverancier of hosting-organisatie
- **Risico**: Audit-doorlooptijd onafhankelijk van ontwikkeltempo. Begin documentatie-werk parallel aan v1.0.

### R-08 — Bewerkers­overeenkomst-template juridisch goedgekeurd

- **Type**: Juridisch
- **Doorlooptijd**: 2-6 weken
- **Kosten orde**: éénmalig juridische review-uren
- **Blokkeert**: tenant-onboarding (AVG-vereiste)
- **Per**: platform (eenmalig template, per tenant getekend)
- **Risico**: Template moet afgestemd op Stichting + B.V.-constructie (zie ADR-006).

### Implicatie voor planning

- **Start R-01..R-05 zodra eerste pilot-instelling getekend is** — kalenderdoorlooptijd loopt parallel aan ontwikkeling, niet erna.
- **Mock-laag voor R-02 Vecozo** is verplicht voor parallel doorbouwen op Tier 1 features (B-01, H-01) terwijl certificaat-aanvraag loopt.
- **R-06 (operational readiness)** is geen feature en past niet in §5; staat hier expliciet zodat het niet vergeten wordt bij v1.0-readiness-check.
- Bij elke pilot-onboarding: R-01 (G-Standaard) + R-02 (Vecozo+AGB) + R-08 (BO) verplicht eerst regelen.

---

## §4 — Epic-laag breakdown (roadmap-view)

Per epic: scope voor v1.0, waarom het er moet zijn, totaal-effort.

### Epic A — Cliëntdossier

**Scope v1.0**: Cliënt-master compleet inclusief CAK, alarmering & sleutelbeheer, mantelzorg-register, zorgaanbieder-relaties (huisarts/apotheek/ziekenhuis als referentie). Bestaande CRUD-laag uitbreiden met domein-specifieke kennis (CAK-tarieven 2026, alarmsystemen-referentie).
**Waarom**: Foundation. Zonder solide cliëntdossier geen rest. Indicatie- en verzekerings-data zijn input voor declaratie.
**Effort**: M (3-5 weken)

### Epic B — Klinische registratie

**Scope v1.0**: Medicatieveiligheid-volledigheid (BEM, dubbele controle, MFB, G-Standaard), wondzorg gestructureerd, alle standaard-meetinstrumenten (Braden, MFES, SNAQ-RC, GDS, MMSE, MoCA, NRS, REPOS, Katz, IADL), palliatief, verklaring overlijden, Wzd-volledigheid, ICD-10 + Zib Probleem, hulpmiddelen-register.
**Waarom**: Dit is wat een instelling **verplicht** moet doen voor IGJ-toezicht en NEN-conformiteit. Medicatieveiligheid is non-negotiable in een ECD. Zonder gestructureerde wondzorg en meetinstrumenten kun je geen VVT-instelling overtuigen.
**Effort**: XL (12-16 weken — grootste epic)

### Epic C — Zorgplanning

**Scope v1.0**: Zorgleefplan-4-domeinen-structuur, ZZP→bezetting-koppeling, formele herindicatie-flow (gekoppeld aan K), MDO-cyclus geautomatiseerd, doel-evaluatie-cycli, versionering, concept-status, handtekening cliënt + wettelijk vertegenwoordiger.
**Waarom**: Bestaande zorgplan-laag is al sterk (CarePlan + Goal + ServiceRequest + SMART-validator + automatische evaluatie-taak). Hoofdzaak: structureren naar 4-domeinen-norm en versionering.
**Effort**: M (4-6 weken)

### Epic D — Rapportage

**Scope v1.0**: Doel-koppeling (deels in branch), gestructureerde zorgmoment-templates, dagstructuur (ochtend/middag/avond/nacht), overdracht-snapshot tussen diensten, NEN 7513 retentie. AI-samenvatting al aanwezig en sterk.
**Waarom**: Verslaglegging is de dagelijkse realiteit van zorgmedewerkers. Slechte rapportage-UX = afhaakreden #1.
**Effort**: M (3-4 weken)

### Epic E — Operationele planning

**Scope v1.0**: Intramuraal al sterk; uitbreidingen: CAO-VVT edge-cases, cliënt-medewerker matching op competentie, tijdregistratie web mobile-friendly, routelijst-view voor extramurale teams, plannings-publicatie & medewerker-akkoord-flow, verlof-herplanning, reisuren-registratie.
**Waarom**: Planning is OpenZorg's killer-feature ambitie. Kwaliteit hier is differentiator. Voor extramurale teams is web-responsive met tijdregistratie het minimum.
**Effort**: L (6-8 weken)

### Epic F — Personeel & rooster

**Scope v1.0**: BIG- en V&V-register sync (CIBG-API), urenregistratie + loon-export naar AFAS/Visma, opleidingen/certificaten met vervaldatum-signaal, bevoegdheden-matrix gekoppeld aan competenties + certificaten, contract-historie. Verzuim post-v1.0.
**Waarom**: Wettelijk vereist (BIG/V&V). Loon-export is must-match anders moet boekhouding handmatig overtypen. Certificaten-tracking is veiligheidsissue.
**Effort**: L (6-8 weken)

### Epic H — Financieel / declareren

**Scope v1.0**: Vektis AW319 (WLZ-declaratie) export + AW320 retour-verwerking, CAK eigen bijdrage berekening, iWlz IWMR/AAI/MUC berichtenverkeer, productieregistratie → declaratie pipeline, contracten-management zorgkantoor, debiteurenoverzicht, maand-afsluiting.
**Waarom**: Geen declaratie = geen omzet voor de instelling = geen klant. Dit is de hardste zakelijke deadline.
**Effort**: XL (10-14 weken)

### Epic I — Externe koppelingen (subset)

**Scope v1.0**: SBV-Z (BSN-validatie GBA), AGB/Vecozo (zorgaanbieder + medewerker validatie), G-Standaard (KNMP medicatiedatabank — referentie van Epic B), iWlz routerservice (transport van H-04/05/06). LSP/Mitz/eOverdracht/apotheek post-v1.0.
**Waarom**: Zonder SBV-Z geen geldige cliënt voor declaratie. Zonder Vecozo geen veilig kanaal naar zorgkantoor. Zonder G-Standaard geen medicatieveiligheid. Dit is de minimale set voor "een instelling kan declareren".
**Effort**: L (6-8 weken)

### Epic J — Compliance & kwaliteit

**Scope v1.0**: AVG art. 15 (inzage), 17 (vergeten), 20 (portabiliteit) flows; CIQI VVT kwaliteitsdataset-export; IGJ jaarverslag-data; MIC-trends dashboard uitbreiden; NEN 7513 retentie-policy expliciet implementeren; bewerkers­overeenkomsten-register; RI&E light.
**Waarom**: Wettelijk vereist (AVG, NEN, IGJ). Niet sexy maar showstopper bij audit.
**Effort**: M (4-5 weken)

### Epic K — Workflow & taken

**Scope v1.0**: BPMN-templates voor zorgplan-evaluatie, herindicatie, MIC-afhandeling (intake-template al aanwezig). Notificaties, escalaties bij overschreden deadline, taak-uitstellen.
**Waarom**: BPMN-engine staat (Flowable + canvas + DMN). Nu de templates produceren die de templates uit `services/workflow-bridge/src/lib/templates.ts` aanvullen.
**Effort**: M (3-4 weken)

### Epic L — Beheer & configuratie

**Scope v1.0**: Polishing — formulier-versionering, configuratie-export/import (tenant-cloning), codelijsten bulk-import (CSV), validatie-test-runner verbeteringen.
**Waarom**: Sterk punt al, alleen finishing touches voor enterprise-klant-comfort.
**Effort**: S (1-2 weken)

### Epic M — Auth & security

**Scope v1.0**: SSO via SAML 2.0 + OIDC, MFA (TOTP), UZI-server-cert authenticatie voor zorg-tot-zorg koppelingen, backup/DR-procedure documentatie, retentie-policies expliciet, wachtwoord-policy + complexity, sessie-management.
**Waarom**: Enterprise-klanten eisen SSO + MFA. UZI-server-cert is verplicht voor LSP/iWlz/SBV-Z koppelingen.
**Effort**: M (3-5 weken)

### Epic-totaal

S=1, M=6, L=3, XL=2 → **circa 60-90 weken werk solo**, met parallelisatie van independent epics ~9-15 maanden in een 2-3-persoons team + AI-assistance.

---

## §5 — Feature-laag breakdown (backlog-view)

Per feature een sub-sectie met:
- **Status** = Bestaand-solide / Aan-te-vullen / Nieuw
- **Type** = Must-match (anders weggelachen) / Must-beat (waar we wedstrijd winnen) / Differentiator (alleen wij)
- **Effort** = S (1-3 dagen) / M (1-2 weken) / L (2-4 weken) / XL (>1 maand)
- **Dependencies** = andere feature-IDs of externe systemen
- **Beschrijving** = wat het is en waarom
- **Acceptatiecriteria** = wanneer is het af

### Epic A — Cliëntdossier

#### A-01 — ZIB-compliance audit cliëntvelden

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Alle Zib NL2.0 Patient-velden gemapped op huidige cliënt-resource, verplichte velden afgedwongen via validatieregels.
- **Acceptatiecriteria**:
  - Mapping-document Zib Patient → FHIR Patient + extensions
  - Validatieregels in `kern-validatie.ts` voor verplichte Zib-velden
  - Test op 8 seed-cliënten dat ze Zib-compliant zijn

#### A-02 — CAK eigen bijdrage berekening

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: A-01, H-03
- **Beschrijving**: Per cliënt maandelijks bedrag eigen bijdrage berekend op basis van CAK-tarieven 2026, ZZP-klasse, inkomen-categorie en vermogensbijtelling. Manueel overschrijfbaar bij uitzonderingen.
- **Acceptatiecriteria**:
  - CAK-tarieventabel 2026 in codelijsten
  - Berekening op basis van inkomen + vermogen + ZZP-klasse
  - Overschrijving met motivatie + audit-trail
  - Maandelijkse herberekening automatisch

#### A-03 — Alarmering & sleutelbeheer

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per cliënt registreren wie sleutel(s) heeft (medewerker / familie / sleutelkluis) en welk alarmeringssysteem actief is (Tunstall, Verklizan, etc.). Sleutel-uitgifte/inname-flow met handtekening.
- **Acceptatiecriteria**:
  - Cliënt-resource heeft alarmsysteem-referentie
  - Sleutel-register per cliënt: aantal, locatie, houder, uitgifte-datum
  - Sleutel-inname-flow bij uitschrijving/overlijden

#### A-04 — Zorgaanbieder-relaties (huisarts, apotheek, ziekenhuis)

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Per cliënt referentie naar huisarts (Practitioner of externe AGB), apotheek, behandelend specialist. Pre-werk voor latere LSP/eOverdracht-koppeling.
- **Acceptatiecriteria**:
  - Cliënt heeft `generalPractitioner` (huisarts), `pharmacy`, `treatingSpecialist` referenties
  - Externe partijen via AGB-code referenceerbaar zonder lokaal Practitioner-record
  - Zoekfunctie op AGB-register (post I-02 dependency)

#### A-05 — Verzekering historie

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Coverage-resources behouden bij wijziging van verzekeraar/polis. Peildatum-zoek voor declaratie-historie.
- **Acceptatiecriteria**:
  - Bij verzekering-wijziging wordt oude Coverage `status=cancelled`, nieuwe `status=active`
  - Query: `Coverage waar policyHolder=cliëntId AND date in period`
  - Declaratie-route gebruikt Coverage geldig op zorg-datum, niet huidige

#### A-06 — Inschrijfdatum + uitschrijfdatum + status

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Cliënt heeft expliciete `inschrijfdatum`, `uitschrijfdatum` (optioneel), en status: actief / uitgeschreven / overleden. Status drijft zichtbaarheid in cliëntenlijst en declaratie-eligibility.
- **Acceptatiecriteria**:
  - Patient-extension `openzorg.nl/extensions/cliënt-status`
  - Status-overgangen via state-machine (nieuw → actief → uitgeschreven/overleden)
  - Declaratie-route weigert prestaties buiten in/uitschrijfperiode

#### A-07 — Cliëntfoto met crop

- **Status**: Aan-te-vullen
- **Type**: Must-beat
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Foto-upload met inline crop-functie (bestaand foto-endpoint behouden). Max 5MB, opslag als Binary.
- **Acceptatiecriteria**:
  - Crop-UI in cliëntdossier (vierkant + cirkel preview)
  - Compressie bij upload (max 800x800)
  - Verwijderen-flow

#### A-08 — Mantelzorg-/familieregister

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: contactpersoon-route
- **Beschrijving**: RelatedPerson-resources uitgebreid met rol (mantelzorger/wettelijk vertegenwoordiger/contactpersoon-niet-relevant), contact-frequentie, en autorisatie-recht voor portaal-inzage (post-v1.0).
- **Acceptatiecriteria**:
  - Per relatie: rol-veld (verplicht), wettelijk-vertegenwoordiger-flag
  - Wettelijk vertegenwoordiger zichtbaar in zorgplan-handtekening-flow (C-08)
  - Toestemming-flag voor portaal-inzage gepersisteerd (gebruik post-v1.0)

---

### Epic B — Klinische registratie

#### B-01 — G-Standaard medicatiedatabank koppeling

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: I-03 (Vecozo voor licentie)
- **Beschrijving**: Integratie met G-Standaard (Z-Index van KNMP) voor medicatie-lookup en interactie-database. ATC + NTK + handelsproduct lookup. Dagelijkse Z-Index update.
- **Acceptatiecriteria**:
  - Medicatie-zoek via G-Standaard ATC/HPK/PRK
  - Lokale cache van Z-Index (dagelijkse sync)
  - Lookup-API voor frontend zoekvelden
  - Licentie-administratie (KNMP-contract per tenant)

#### B-02 — BEM (Bewaking elektronisch medicatie)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: XL
- **Dependencies**: B-01
- **Beschrijving**: Bij elke nieuwe MedicationRequest worden via G-Standaard regels gecontroleerd: medicatie-allergie (B-14), contra-indicaties met diagnoses (Condition), dubbele therapie, MFB-interacties, dosering-bovengrens. Voorschrijver krijgt waarschuwingen met override-mogelijkheid.
- **Acceptatiecriteria**:
  - POST /medicatie triggert BEM-controle synchronicieel
  - Conflicten getoond aan voorschrijver met G-Standaard-bron-referentie
  - Override met verplichte motivatie + audit-trail
  - 4 categorieën waarschuwing: blokkeren / ernstig / matig / informatief
  - Test-scenario's voor de 10 meest voorkomende medicatiefouten

#### B-03 — Dubbele controle medicatie-toediening

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: B-01
- **Beschrijving**: Bij toediening van opiaten / cytostatica / hoog-risico-medicatie verplicht een tweede medewerker-handtekening. Configurabel welke medicatie-codes (ATC) dubbele controle vereisen.
- **Acceptatiecriteria**:
  - Configuratie-laag: ATC-codes die dubbele controle vereisen (default-set + tenant-aanpasbaar)
  - Toediening-flow blokkeert opslag tot tweede medewerker bevestigt
  - Audit-trail beide medewerkers + tijdstip
  - Werkt op web mobile-friendly view (tweede medewerker scant QR/loginprompt)

#### B-04 — MFB (Medicatie-FollowUp-Beoordeling)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: B-01, K (workflow)
- **Beschrijving**: 6-maandelijks signaal voor cliënten met polyfarmacie (>5 medicijnen). Gestructureerd review-formulier met G-Standaard MFB-protocol-vragen.
- **Acceptatiecriteria**:
  - Detectie polyfarmacie automatisch (telt actieve MedicationRequests)
  - Werkbak-taak voor verantwoordelijke (apotheker / specialist ouderengeneeskunde)
  - MFB-formulier-template via vragenlijsten (L-laag)
  - Resultaat opgeslagen als Observation met MFB-code

#### B-05 — Wondzorg gestructureerd (EPUAP-classificatie)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: documenten-route (foto's)
- **Beschrijving**: Wondbed-foto met body-map (locatie aanwijzen op anatomisch model), EPUAP-categorie 1-4 (decubitus) of NPUAP-classificatie, wondafmetingen (lengte/breedte/diepte), behandelplan, voortgangsmeting, genezings-curve.
- **Acceptatiecriteria**:
  - FHIR Observation met SNOMED wond-codes
  - Foto-meta met body-map-locatie + datum
  - Voortgangstracking: meerdere observaties chronologisch met grafiek
  - PDF-export wond-status voor specialist

#### B-06 — SNAQ-RC ondervoedingsschaal

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: vragenlijsten
- **Beschrijving**: 4-vraag formulier (gewichtsverlies, eetlust, BMI, slikproblemen), score 0-3, automatisch verwijzing-signaal naar diëtist bij score ≥2.
- **Acceptatiecriteria**:
  - Vragenlijst-template SNAQ-RC seedbaar
  - Score-berekening automatisch
  - Bij score ≥2: signaal in werkbak voor coördinator

#### B-07 — Braden risicoschaal decubitus

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: vragenlijsten
- **Beschrijving**: 6-criteria assessment (sensorisch / vochtigheid / activiteit / mobiliteit / voeding / wrijving), totaalscore, risico-categorie (laag/matig/hoog/zeer-hoog), koppeling aan zorgplan-doel.
- **Acceptatiecriteria**:
  - Braden-template seedbaar
  - Risico-categorisatie automatisch
  - Bij hoog/zeer-hoog: voorgesteld zorgplan-doel "decubitus-preventie"

#### B-08 — MFES valpreventie

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: vragenlijsten
- **Beschrijving**: Multi-Factor Falls Evaluation Schedule, 13-item schaal, voortgangstracking longitudinaal.
- **Acceptatiecriteria**:
  - MFES-template seedbaar
  - Trendgrafiek over tijd

#### B-09 — GDS-5 / GDS-15 depressie

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: vragenlijsten
- **Beschrijving**: Geriatric Depression Scale, korte (5) en lange (15) variant, score-interpretatie, zorgplan-koppeling.

#### B-10 — MMSE / MoCA cognitie

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: vragenlijsten
- **Beschrijving**: Mini-Mental State Examination + Montreal Cognitive Assessment. Gestandaardiseerde scoreformulieren, dementie-risico-categorisatie, herhaalbaar voor longitudinale tracking.

#### B-11 — NRS / REPOS pijnregistratie

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: vragenlijsten
- **Beschrijving**: Numeric Rating Scale 0-10 + REPOS observatie-schaal voor cliënten die zelf niet kunnen aangeven. Dagelijks invulbaar, grafisch overzicht, koppeling aan medicatie-effectiviteit.

#### B-12 — Katz / IADL ADL-scores

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: vragenlijsten
- **Beschrijving**: Katz-6 ADL + Lawton-Brody-IADL, gekoppeld aan zorgzwaarte-indicatie en zorgplan-domein "lichamelijk welbevinden".

#### B-13 — RIVM-vaccinatiecodes uniformeren

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: codelijsten
- **Beschrijving**: Bestaande vaccinatie-route gebruikt RIVM-codetabel als bron, importeerbaar via codelijsten-bulk-import (L-04).
- **Acceptatiecriteria**:
  - RIVM-vaccinatiecodelijst importeerbaar
  - Vaccinatie-formulier toont alleen RIVM-codes (geen vrije tekst)

#### B-14 — Allergie via G-Standaard allergeen-lookup

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: B-01
- **Beschrijving**: Allergie-route gebruikt G-Standaard allergeen-codes (niet vrije tekst), zodat B-02 BEM kan koppelen.

#### B-15 — Palliatieve fase markering + zorgleefplan-aanpassing

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: zorgplan, C-01
- **Beschrijving**: Cliënt heeft palliatieve-fase-flag (terminal, stervensfase, palliatief). Zorgplan switcht naar palliatief-template met comfort-zorg-doelen. Andere monitoring-frequenties.
- **Acceptatiecriteria**:
  - Palliatieve-fase via Patient-extension
  - Zorgplan-template "palliatief" beschikbaar
  - MIC/risicoscreening-frequenties aangepast in palliatieve fase
  - PaTz-rapportage (Palliatieve Thuiszorg) export

#### B-16 — Verklaring overlijden

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: A-06
- **Beschrijving**: Overlijden-registratie (datum/tijd/locatie/oorzaak/wie aanwezig), automatische cliënt-status-update naar "overleden", automatische dossier-archivering-flow (geen actieve afspraken meer).
- **Acceptatiecriteria**:
  - Verklaring-overlijden-formulier
  - Automatische bulk-actie: alle Appointments na sterftedatum geannuleerd, MedicationRequest-status `stopped`
  - Audit-trail
  - Dossier-archivering volgens NEN 7513 retentie

#### B-17 — Wzd / BOPZ Wet zorg en dwang volledigheid

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: bestaande VBM-route
- **Beschrijving**: VBM-protocol volgens Wzd-stappenplan (1-7), MM-registratie, externe deskundige-review-trail, periodieke evaluatie-cyclus.
- **Acceptatiecriteria**:
  - VBM-flow doorloopt Wzd-stappen 1-7 met audit-trail
  - Externe deskundige (Practitioner) review-stap
  - Evaluatie-frequentie configurabel
  - IGJ-vereiste registratie-velden compleet

#### B-18 — Diagnose-codering ICD-10 + SNOMED

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: codelijsten
- **Beschrijving**: Huidige diagnose-route ondersteunt SNOMED in seed; ICD-10 codetabel importeerbaar en gelijkwaardig zoekbaar. Multi-coding (ICD-10 + SNOMED + ICPC voor cross-sector platform-laag).
- **Acceptatiecriteria**:
  - ICD-10-NL codelijst importeerbaar
  - Diagnose kan ICD-10 + SNOMED parallel hebben (FHIR Coding[])
  - Codelijst-picker zoekt over alle codestelsels

#### B-19 — Probleemlijst (Zib Probleem 4.0)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: B-18
- **Beschrijving**: Aparte probleem-lijst (anders dan diagnose) volgens Zib Probleem 4.0; status (active/inactive/resolved), categorie (lichamelijk/psychisch/sociaal), gerelateerde interventies in zorgplan.
- **Acceptatiecriteria**:
  - Condition-resource met Zib Probleem-extensions
  - Probleem-status workflow (active → inactive/resolved)
  - Koppeling probleem ↔ zorgplan-doel

#### B-20 — Hulpmiddelen-register

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per cliënt geregistreerde hulpmiddelen (rolstoel, hoog-laag bed, sondevoeding-pomp, tillift), leverancier, vervaldatum onderhoud, kostencategorie (verzekering/cliënt/instelling).
- **Acceptatiecriteria**:
  - DeviceUseStatement-resource per cliënt
  - Onderhoudsvervaldatum signaal in werkbak
  - Eigendom-categorie (cliënt-eigendom / instelling / verzekeraar)

---

### Epic C — Zorgplanning

#### C-01 — Zorgleefplan 4 domeinen

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: bestaande zorgplan-route
- **Beschrijving**: Zorgplan-template heeft 4-domein-structuur (Woonsituatie / Welbevinden / Lichamelijk / Participatie) conform Kwaliteitskader Verpleeghuiszorg. Doelen kunnen aan domein gehangen worden.
- **Acceptatiecriteria**:
  - CarePlan heeft expliciete 4-domein-categorisatie
  - Doelen krijgen domein-tag
  - UI toont zorgplan met domein-tabs
  - Rapportages kunnen op domein gefilterd

#### C-02 — Herindicatie-flow met workflow-trigger

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: K-03
- **Beschrijving**: 6-maandelijkse herindicatie automatisch BPMN-process: indicatie-vervaldatum-monitoring, taak naar zorgcoördinator, controle of indicatie nog passend is, eventueel CIZ-aanvraag.

#### C-03 — ZZP-koppeling aan zorgplan + zorgzwaarte → uren-norm

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: zorgzwaarte-calculator (al aanwezig), bezetting-engine (al aanwezig)
- **Beschrijving**: Zorgplan heeft expliciete ZZP-klasse-referentie. Planning-engine koppelt minimum-bezetting aan zorgzwaarte-uren-norm.
- **Acceptatiecriteria**:
  - CarePlan-extension `openzorg.nl/extensions/zzp-klasse`
  - Bezettingsprofiel houdt rekening met som-zorgzwaarte op afdeling
  - Validatie: zorgplan-uren ≤ ZZP-norm tenzij motivatie

#### C-04 — MDO-cyclus formeel (kwartaalplanning)

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: bestaande MDO-route
- **Beschrijving**: MDO automatisch ingepland per cliënt (kwartaal-cyclus), deelnemers vooraf bevestigd, agenda-template, notulen-template.
- **Acceptatiecriteria**:
  - MDO-frequentie configurabel per cliënt
  - Automatische Appointment-aanmaak
  - Bevestigings-flow voor deelnemers

#### C-05 — Doel-evaluatie cyclisch (3/6/12 maanden)

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: K
- **Beschrijving**: Per doel evaluatie-frequentie configurabel (3/6/12 maanden), automatische taak in werkbak voor verantwoordelijke.

#### C-06 — Interventies-bibliotheek per zorgleefplan-domein

- **Status**: Nieuw
- **Type**: Differentiator
- **Effort**: M
- **Dependencies**: codelijsten
- **Beschrijving**: Tenant kan eigen interventie-templates aanmaken per domein, hergebruikbaar over cliënten. Speed-up bij zorgplan-aanmaken.
- **Differentiator-rationale**: Drielagen-configureerbaarheid (kern / uitbreiding / plugin) toegepast op interventies. Landelijke bibliotheek (open-source community) + tenant-specifiek + cliënt-specifiek — gelaagd hergebruik dat closed-source concurrenten niet bieden.
- **Acceptatiecriteria**:
  - Interventie-template-resource (Basic met code + beschrijving + frequentie + duur)
  - Picker in zorgplan-aanmaak-flow
  - Tenant-niveau bibliotheek + landelijk-niveau-bibliotheek (codelijsten)

#### C-07 — Zorgplan-versionering

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Elk zorgplan-wijziging maakt nieuwe versie, oude versies inzichtelijk, datum-peilbaar voor audit.
- **Acceptatiecriteria**:
  - Bij CarePlan-update wordt vorige versie als `status=replaced` bewaard
  - History-view per zorgplan met diff
  - Querie: zorgplan op datum X = versie geldig op X

#### C-08 — Zorgplan handtekening cliënt + wettelijk vertegenwoordiger

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: A-08
- **Beschrijving**: Bestaand handtekening-flow uitgebreid met wettelijk vertegenwoordiger-handtekening (verplicht indien Wzd of jonger dan 16).

#### C-09 — Concept-versie zorgplan voor MDO-voorbereiding

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: C-07
- **Beschrijving**: Zorgplan kan in concept-status (alleen zichtbaar voor zorgcoördinator/regiebehandelaar) tot publicatie na MDO.

---

### Epic D — Rapportage

#### D-01 — Rapportage-koppeling aan zorgplan-doel

- **Status**: Bestaand-aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Rapportage kan optioneel aan een Goal gekoppeld worden via FHIR `focus`. (Initiële implementatie aanwezig in branch — uitwerken UI + queries.)
- **Acceptatiecriteria**:
  - Bestaande backend-implementatie (`rapportage.ts` met `goalId`) afmaken met UI doel-picker
  - Filter rapportages-overzicht op doel
  - Doel-evaluatie-view toont gerelateerde rapportages

#### D-02 — Gestructureerde rapportages per zorgmoment

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: vragenlijsten
- **Beschrijving**: Rapportage-template per zorgmoment-type (lichamelijke verzorging / medicatie / sociaal / voeding / mobiliteit), formuliervelden conform 4-domein.
- **Acceptatiecriteria**:
  - 5+ zorgmoment-templates seedbaar
  - Snelle invul-flow voor herhalend zorgmoment
  - Free-text + gestructureerde velden gemixed

#### D-03 — Dagstructuur-rapportage

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: D-02
- **Beschrijving**: Standaard dag-rapportage-template (ochtend/middag/avond/nacht) met doorklik naar individuele rapportages. Eén dag = één overzicht.

#### D-04 — Overdracht-snapshot tussen diensten

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: D-03
- **Beschrijving**: Einde-dienst-snapshot voor opvolger met openstaande zorgvragen, signaleringen, bijzonderheden. PDF + scherm-view.

#### D-05 — Rapportage-archivering NEN 7513

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: J-07
- **Beschrijving**: Rapportages worden bewaard volgens NEN 7513 retentietabel, soft-delete na retentietermijn, audit-trail van verwijderingen.

#### D-06 — AI-samenvatting van rapportages

- **Status**: Bestaand-solide
- **Type**: Differentiator
- **Effort**: — (referentie)
- **Beschrijving**: AI-samenvatting-knop op rapportages-pagina al aanwezig (commit `71524c7`). Polish UX en uitbreiden naar dag-overdracht-samenvatting.

#### D-07 — Rapportage-PDF-export voor familie

- **Status**: Nieuw
- **Type**: Must-beat
- **Effort**: S
- **Dependencies**: A-08
- **Beschrijving**: Maandelijkse cliënt-rapportage als PDF, tenant-logo, gefilterd op familie-relevante onderdelen.

#### D-08 — Rapportage-signaalwoord-detectie

- **Status**: Nieuw
- **Type**: Differentiator
- **Effort**: M
- **Dependencies**: AI-laag
- **Beschrijving**: AI detecteert signaleringen in vrije tekst (val, agressie, achteruitgang, slik-probleem), suggereert MIC of bijwerkings-signalering.
- **Acceptatiecriteria**:
  - Bij rapportage-opslaan: keyword + LLM-classificatie
  - Voorgestelde MIC/signalering met bron-referentie naar rapportage
  - Acceptatie/afwijzing-flow met audit

---

### Epic E — Operationele planning

#### E-01 — CAO-VVT regels in plannings-validatie volledigheid

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: bestaande CAO-engine (`ac7df85`)
- **Beschrijving**: ATW-regels al aanwezig (48u/week, 11u rust, 10u dienst). Uitbreiden met CAO-VVT pauze-regels, weekend-toeslag-detectie, dwingende max 5 nachten, BHV-bezetting, ANW-toeslag.
- **Acceptatiecriteria**:
  - Pauze-regels per dienst-duur
  - Weekend/feestdag-detectie
  - Max-aantal-nachten per medewerker per periode
  - ANW-toeslag-berekening

#### E-02 — Cliënt-medewerker matching op competentie

- **Status**: Nieuw
- **Type**: Must-beat
- **Effort**: M
- **Dependencies**: F-04, F-05, competentie-laag (al aanwezig)
- **Differentiator-rationale**: Andere systemen hebben competentie-filtering, maar de combinatie met de BPMN-driven zorgpad-laag (afgeleide competentie-eisen uit interventie-templates) en hard/soft-filter-configuratie via DMN is uniek positioneerbaar.
- **Beschrijving**: Planner ziet alleen medewerkers met juiste competentie voor zorgvraag (bv. wond-zorg, sondevoeding, palliatief, voorbehouden handelingen). Hard-filter (planning niet mogelijk zonder competentie) versus soft-filter (waarschuwing).
- **Acceptatiecriteria**:
  - Per Appointment afgeleide competentie-eisen
  - Planning-UI filtert/waarschuwt op competentie-mismatch
  - Override-motivatie verplicht

#### E-03 — Tijdregistratie start/eind bezoek (web mobile-friendly)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Medewerker registreert op telefoon bij cliënt (via web-responsive view) aanvang/einde bezoek. Optioneel GPS-controle. Data is hard bewijs voor declaratie en uren-akkoord.
- **Acceptatiecriteria**:
  - Mobile-first UI met grote knoppen "Start bezoek" / "Eind bezoek"
  - Optionele GPS-coördinaat opslag
  - Tijden gekoppeld aan Appointment + ProductieRegistratie
  - Werkt offline met retry-queue (opt-in basis, niet de volle offline-modus)

#### E-04 — Routelijst-view extramuraal

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: E-03
- **Beschrijving**: Medewerker ziet eigen route per dag op telefoon, klikbaar naar dossier per cliënt, navigatie-link naar Maps.

#### E-05 — Plannings-publicatie & medewerker-akkoord-flow

- **Status**: Aan-te-vullen
- **Type**: Must-beat
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Rooster gaat van concept → gepubliceerd → medewerker-akkoord. Bij niet-akkoord moet medewerker reden opgeven.
- **Acceptatiecriteria**:
  - Rooster-status state-machine
  - Medewerker-akkoord-flow per dienst of per week
  - Niet-akkoord met reden + planner-notificatie

#### E-06 — Wachtlijst-prioritering

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Wachtlijst sorteerbaar op urgentie (medisch/sociaal/financieel), wachttijd-monitor, automatische match-suggestie bij vrijkomende plek.

#### E-07 — Recurring afspraken met einddatum + uitzondering

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: bestaande herhaling-route
- **Beschrijving**: Bestaand uitgebreid met einddatum (bij overlijden auto-stop) en uitzondering-dagen (vakantie, opname).

#### E-08 — Verlof / ziekteverzuim → automatische herplanning

- **Status**: Nieuw
- **Type**: Differentiator
- **Effort**: L
- **Dependencies**: F (verlof-light)
- **Beschrijving**: Bij verlof/verzuim worden afspraken van die medewerker automatisch in herplanning-queue geplaatst, planner krijgt alternatief-suggesties.
- **Differentiator-rationale**: Planning-engine `optimaliseer`-modus met constraint-solver die rekening houdt met competenties + CAO + ZZP-norm + cliënt-voorkeuren tegelijk is uniek t.o.v. handmatige herplanning bij Caress/Nedap. Dit is waar de killer-feature-ambitie concreet gemaakt wordt.
- **Acceptatiecriteria**:
  - Detectie verlof/verzuim → bulk-cancel + herplanning-queue
  - Planning-engine in `optimaliseer`-modus stelt alternatieven voor
  - Cliënt-notificatie bij wijziging

#### E-09 — Reisuren-registratie extramuraal

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: E-03
- **Beschrijving**: Tussen 2 cliëntbezoeken automatisch reistijd berekend op basis van adres (Maps-API of intern), opnemen in productieregistratie en CAO-uren.

---

### Epic F — Personeel & rooster

#### F-01 — BIG-register sync (CIBG-API)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per Practitioner BIG-nummer, dagelijks gevalideerd tegen CIBG-API. Rood-flag bij doorhaling/voorwaardelijke registratie.
- **Acceptatiecriteria**:
  - Practitioner-extension `openzorg.nl/extensions/big-nummer`
  - Dagelijkse cron-job: BIG-validatie via CIBG
  - Bij doorhaling: medewerker-status-flag + notificatie HR
  - Audit-trail BIG-status-historie

#### F-02 — V&V-register sync

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per medewerker V&V-registratie-nummer, ditto sync.

#### F-03 — Urenregistratie + loon-export

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: E-03 (tijdregistratie)
- **Beschrijving**: Gewerkte uren per medewerker per week, akkoord-flow, export naar AFAS/Visma als CSV/XML.
- **Acceptatiecriteria**:
  - Wekelijkse uren-totaal per medewerker (regulier/ANW/overwerk/verlof)
  - Akkoord-flow (medewerker bevestigt, leidinggevende fiatteert)
  - AFAS Profit XML-export
  - Visma CSV-export

#### F-04 — Opleidingen + certificaten met vervaldatum

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per medewerker certificaten (BHV, BIG-her, BLS, scholing voorbehouden handelingen, scholing palliatief), vervaldatum, signaal 60 dagen voor verloop.
- **Acceptatiecriteria**:
  - Certificaten-resource per Practitioner
  - Werkbak-signaal 60d voor vervaldatum
  - PDF-bewijs upload (Binary)

#### F-05 — Bevoegdheden-matrix

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: F-04, competentie-laag
- **Beschrijving**: Medewerker mag zorghandeling X alleen als bevoegdheid + niet-verlopen certificaat aanwezig. Hard-check bij bv. medicatie-toediening.

#### F-06 — Contract-historie + functiewijzigingen

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: bestaande contracten-route
- **Beschrijving**: Per medewerker contract-historie, functiewijzigingen met datum, uren-wijzigingen, salaris-schaal (geen bedragen).

#### F-07 — Rooster-historie + audit

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Roosterwijzigingen worden gelogd (wie/wanneer/waarom), terugplaatsing mogelijk binnen 7 dagen.

---

### Epic H — Financieel / declareren

#### H-01 — Vektis AW319 (WLZ-declaratie) export

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: I-03 (Vecozo)
- **Beschrijving**: Maandelijks AW319-bestand genereerbaar, conform Vektis-standaard 2026, validatie voor inzending.
- **Acceptatiecriteria**:
  - AW319-XML generator volgens Vektis EI-standaard
  - Validatie-rapport voor verzending (xsd-schema)
  - Test-bestand vs. productie-bestand
  - Submission-log met reference-ID

#### H-02 — Vektis AW320 (retourbericht) verwerking

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: H-01
- **Beschrijving**: AW320-bestand kan ingelezen worden, status per declaratie geüpdatet (geaccepteerd/gedeeltelijk/afgewezen), reden-codes vertaald naar leesbare melding.
- **Acceptatiecriteria**:
  - AW320-import via UI of cron
  - Per declaratie status-update + reden-code
  - Afwijs-redenen-dashboard

#### H-03 — CAK eigen bijdrage berekening

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: A-02
- **Beschrijving**: Maandelijkse berekening op basis van CAK-tarieven 2026, ZZP-klasse, inkomen/vermogen-categorie, met documentatie van rekenmethodiek voor cliënt-inzage.

#### H-04 — iWlz IndicatieMelding (IWMR)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: I-05 (iWlz routerservice)
- **Beschrijving**: Indicatie-mutatie-bericht naar zorgkantoor conform iWlz 2.4 standaard.

#### H-05 — iWlz Aangifte Inzet (AAI)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: I-05
- **Beschrijving**: Maandelijkse zorginzet-aangifte (geleverde zorg per ZZP).

#### H-06 — iWlz Mutatiebericht Cliënt (MUC)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: I-05, A-06
- **Beschrijving**: Aanmelding/wijziging/uitschrijving cliënt naar zorgkantoor.

#### H-07 — Productieregistratie → declaratie pipeline

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: E-03
- **Beschrijving**: Zorgmoment-registratie (Appointment + tijdregistratie + zorgmoment) → Prestatie → Declaratie automatisch, met hand-controle voor afwijkingen.
- **Acceptatiecriteria**:
  - Geleverde zorg → automatische Prestatie-aanmaak (status=concept)
  - Validatie-laag (codeerbaar / volledige indicatie / coverage geldig)
  - Bulk-actie: prestaties → declaratie (status=concept)
  - Afwijking-rapportage (geleverd vs. gedeclareerd)

#### H-08 — Contracten zorgkantoor management

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per zorgkantoor contract met ingangsdatum, prijsafspraken per ZZP-klasse, plafonds (max-volume per maand), max-volume per cliënt-categorie.

#### H-09 — Coulancebijdrage / eigen-betaling buiten WLZ

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Niet-WLZ-zorg (extraatjes, particuliere zorg) factureren aan cliënt zelf.

#### H-10 — Debiteurenoverzicht

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: H-09
- **Beschrijving**: Openstaande declaraties (privé), herinnering-templates, ouderdomsanalyse 30/60/90/120+.

#### H-11 — Maand-afsluiting financieel

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: H-07
- **Beschrijving**: Maand kan afgesloten worden — geen wijzigingen meer mogelijk in productie van die maand, audit-trail van aansluiting.

---

### Epic I — Externe koppelingen (subset v1.0)

#### I-01 — SBV-Z BSN-validatie tegen GBA

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: I-03
- **Beschrijving**: Bij cliënt-aanmaken BSN gevalideerd via SBV-Z webservice, persoonsgegevens (naam, geboortedatum, geslacht) vergeleken met invoer.
- **Acceptatiecriteria**:
  - SBV-Z WS-call met PKI-overheid-cert
  - Mismatch-detectie + bevestigings-flow
  - Audit-trail BSN-validaties
  - Caching binnen sessie (geen herhaalde calls)

#### I-02 — AGB-validatie zorgaanbieder + medewerker

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: AGB-code zorgaanbieder + medewerker validabel via Vektis-AGB-register (publieke download of API).

#### I-03 — Vecozo-certificaat aanvraag/verlenging

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: M-04 (UZI-server-cert)
- **Beschrijving**: Technische integratie Vecozo voor declaratie-routes (pre-req voor Vektis-export, iWlz, SBV-Z). Procedurele documentatie + technische cert-rotation.

#### I-04 — G-Standaard koppeling

- Verwijzing naar B-01 (zelfde feature).

#### I-05 — iWlz routerservice

- Verwijzing naar H-04, H-05, H-06.

---

### Epic J — Compliance & kwaliteit

#### J-01 — AVG art. 15 cliëntinzage-export

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Cliënt kan via zorgaanbieder volledig dossier-export aanvragen, PDF + machine-leesbaar formaat (FHIR-bundel).
- **Acceptatiecriteria**:
  - Inzage-aanvraag-flow (formeel registreerbaar)
  - Volledige dossier-export als FHIR-Bundle JSON + PDF
  - Audit-trail per inzage

#### J-02 — AVG art. 17 recht op vergetelheid

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: J-07
- **Beschrijving**: Cliënt kan dossier-verwijdering aanvragen, behoud volgens NEN 7513 retentie, anonimisering bij wettelijke termijn.

#### J-03 — AVG art. 20 dataportabiliteit

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: J-01
- **Beschrijving**: Dossier-export naar ander zorgsysteem als FHIR-bundel (gestructureerd, leesbaar door ander ECD).

#### J-04 — CIQI VVT kwaliteitsdataset-export

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: B-meet-instrumenten
- **Beschrijving**: Jaarlijkse CIQI-dataset (kwaliteit van zorg basisset 2026) genereerbaar voor inzending. Indicatoren: decubitus-incidentie, val-incidentie, ondervoeding-prevalentie, etc.

#### J-05 — IGJ jaarverslag-data

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: J-04, J-06
- **Beschrijving**: Rapportage-template voor IGJ jaarverantwoording met automatisch opgehaalde indicatoren.

#### J-06 — MIC-trends dashboard uitbreiding

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: bestaande MIC-trends-pagina
- **Beschrijving**: Bestaand aangevuld met grafieken (val-incidenten per locatie/maand, medicatie-fouten per categorie, oorzaakanalyse).

#### J-07 — NEN 7513 retentie-policy implementatie

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per resource-type retentietermijn, automatische soft-delete na termijn, audit-log van verwijderingen, expliciete retentie-tabel in tenant-config.
- **Acceptatiecriteria**:
  - Retentie-tabel per resource-type (default volgens NEN 7513, override per tenant)
  - Cron-job: dagelijks soft-delete na termijn
  - Audit van auto-deletes
  - UI voor beheer per tenant

#### J-08 — Bewerkers­overeenkomsten-register

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Per externe partij bewerkers­overeenkomst-document, looptijd, contactpersoon, automatische signaal bij verlopen.

#### J-09 — RI&E light (Risico-Inventarisatie)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: vragenlijsten
- **Beschrijving**: Jaarlijks RI&E-formulier per locatie, actiepunten registreerbaar.

---

### Epic K — Workflow & taken

#### K-01 — BPMN-template intake-proces

- **Status**: Bestaand-aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Intake-template aanwezig (commit `d2af857`), uitwerken naar productie-versie met DI-shapes en alle taak-formulieren.

#### K-02 — BPMN-template zorgplan-evaluatie

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: C-05
- **Beschrijving**: 6-maandelijkse evaluatie-flow met taken voor zorgmedewerker, MDO-trigger, herindicatie-check.

#### K-03 — BPMN-template herindicatie

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: A-01 (indicaties)
- **Beschrijving**: Indicatie-vervaldatum-monitoring → CIZ-aanvraag (handmatig nu, post-1.0 elektronisch) → wacht-op-uitkomst → bijwerk-zorgplan.

#### K-04 — BPMN-template MIC-afhandeling

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: bestaande MIC-route
- **Beschrijving**: Melding → triage → onderzoek → maatregelen → afsluiting → trend-koppeling.

#### K-05 — Notificaties + escalaties bij overschreden deadline

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Taken hebben SLA, bij overschrijding escalatie naar leidinggevende, push/email-notificatie.
- **Acceptatiecriteria**:
  - Taak-resource heeft `dueDate` + `slaHours`
  - Cron: detect overdue → escalatie-taak voor leidinggevende
  - Email-template (post-v1.0 push)

#### K-06 — Werkbak-filters (mijn-taken / team-taken / alle)

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Bestaand uitgebreid met sortering op deadline/urgentie/cliënt.

#### K-07 — Taak-uitstellen / herinneringen

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Taak kan tot N dagen uitgesteld, herinnering-instelling, audit van uitstel-redenen.

---

### Epic L — Beheer & configuratie

#### L-01 — Formulier-versionering

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Bij wijziging vragenlijst-template versie-bump, oude responses behouden link naar oude versie.

#### L-02 — Configuratie-export/import (tenant-cloning)

- **Status**: Nieuw
- **Type**: Differentiator
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Tenant-config (codelijsten, validatieregels, custom fields, vragenlijsten, BPMN, DMN, rollen) export als ZIP, import in andere tenant. Speed-up voor onboarding nieuwe instelling.
- **Differentiator-rationale**: Open-source + multi-tenant maakt configuratie-portabiliteit een kernpropositie. Een nieuwe instelling kan starten van een referentie-bundle ("VVT-startpakket-2026") en die bewerken — closed-source concurrenten verdienen aan implementatie-uren juist op deze laag.

#### L-03 — Validatie-test-runner UI verbeteringen

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: bestaande validatie-tests
- **Beschrijving**: Bestaand uitgebreid met test-data-templates per resource-type, regressie-suite per regel.

#### L-04 — Codelijsten beheer-UX (bulk-import CSV, deactiveren)

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Bestaand uitgebreid met CSV-import, bulk-deactiveren, code-uitfasering met einddatum.

---

### Epic M — Auth & security

#### M-01 — SSO via SAML 2.0

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per tenant SAML-IdP configurabel (Azure AD, Okta, ADFS), JIT user provisioning, attribute-mapping naar OpenZorg-rol.

#### M-02 — SSO via OIDC

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: Per tenant OIDC-IdP configurabel.

#### M-03 — MFA voor zorgmedewerkers

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: M
- **Dependencies**: —
- **Beschrijving**: TOTP (Google Authenticator / Authy) verplicht voor alle gebruikers, recovery codes.
- **Acceptatiecriteria**:
  - TOTP-setup-flow met QR-code
  - 10 recovery-codes per gebruiker
  - Force-MFA-policy per tenant configurabel
  - WebAuthn (FIDO2) als optie post-v1.0

#### M-04 — UZI-server-cert authenticatie (zorg-tot-zorg)

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: L
- **Dependencies**: I-03
- **Beschrijving**: SSL-client-cert validatie voor LSP/iWlz/SBV-Z koppelingen, cert-rotatie procedure, multi-cert support per tenant.

#### M-05 — Backup/DR-procedure documentatie

- **Status**: Nieuw
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Documented BCP/DR plan, RPO/RTO geformaliseerd, backup-verificatie wekelijks (restore-test).

#### M-06 — Retentie-policies expliciet

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: J-07
- **Beschrijving**: Per resource-type retentietermijn in tenant-config, audit-log retentie 5 jaar (NEN 7513).

#### M-07 — Wachtwoord-policy + complexity

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Minimum length, complexity, history (laatste 5), expiratie configurabel per tenant.

#### M-08 — Sessie-management (idle timeout, geforceerd uitloggen)

- **Status**: Aan-te-vullen
- **Type**: Must-match
- **Effort**: S
- **Dependencies**: —
- **Beschrijving**: Per tenant idle-timeout (al in tenant-settings), geforceerd uitloggen bij rolwijziging, "alle sessies beëindigen"-knop voor admin.

---

## §6 — Cross-sector platform-laag (architectuur-checklist v1.0)

Items die in v1.0 sector-neutraal moeten blijven, anders is HIS/EPD straks rewrite. Bij elke PR die kern-modellen aanraakt, check tegen deze lijst.

### X-01 — Episode-model naast langdurig-zorg-model

**Eis**: Kern-API ondersteunt zowel langdurig-zorg-traject (huidig VVT-model) als episode-gebaseerd dossier (HIS-stijl), via Encounter + EpisodeOfCare FHIR-resources.

**Implicatie v1.0**: Bij elke nieuwe klinische resource expliciet kiezen of die aan een Episode of een CarePlan-traject hangt — beide moeten kunnen.

### X-02 — Codestelsel-pluralisme

**Eis**: Code-velden ondersteunen multi-coding (SNOMED CT + ICPC-2 + ICD-10 + LOINC + G-Standaard) parallel via FHIR Coding[].

**Implicatie v1.0**: B-18 (diagnose multi-coding) implementeert dit voor diagnose; pattern toepassen op alle code-velden.

### X-03 — Zorgproduct-abstractie

**Eis**: Prestatie-/declaratie-laag werkt met DBC's (2e lijn), Vektis-prestaties (1e lijn/VVT), en M&I-verrichtingen via interface — niet hardcoded VVT-prestaties.

**Implicatie v1.0**: H-01 Vektis-export niet aannemen dat ALLE prestaties WLZ zijn; abstracte ZorgProduct-resource die naar verschillende facturatie-formaten kan.

### X-04 — Lab/beeld order-management abstractie

**Eis**: ServiceRequest-laag uitgebreid met diagnostische orders, voorbereid voor lab/beeld zonder die nu te bouwen.

**Implicatie v1.0**: ServiceRequest-resource niet beperken tot "zorginterventie", category-veld respecteren.

### X-05 — ePrescribing standaard

**Eis**: MedicationRequest workflow voorbereid op verzendbaar e-recept (LSP/Mitz post-v1.0).

**Implicatie v1.0**: Bij B-02 BEM design houdt rekening met latere LSP-verzending: status-machine includeert `dispensed` / `cancelled-by-pharmacy`.

### X-06 — Zorgpaden als data

**Eis**: BPMN/DMN niet hardcoded, alle zorgpaden via configuratie deploybaar (sector-onafhankelijk).

**Implicatie v1.0**: K-01..K-04 templates in BPMN-files in `services/workflow-bridge/bpmn-templates/`, niet als code-paden.

### X-07 — Multi-discipline rooster

**Eis**: Planning-engine niet beperkt tot V&V, maar ook fysio/ergo/psycholoog/HBO-V/specialist via competentie-matching.

**Implicatie v1.0**: E-02 competentie-matching werkt voor elke discipline; competentie-codelijst niet beperkt tot VVT.

### X-08 — Sector-tag op tenant + organisatie + medewerker

**Eis**: Alle entiteiten kunnen sector-tags krijgen (VVT, GGZ, GHZ, HIS, EPD), UI filtert features.

**Implicatie v1.0**: Tenant.sectors al aanwezig (TEXT[]); uitbreiden naar Organization en Practitioner-niveau.

### X-09 — FHIR-extensions namespace per sector

**Eis**: `openzorg.nl/extensions/{sector}/*` met sectorale custom velden, generieke extensions blijven sector-onafhankelijk in `openzorg.nl/extensions/*`.

**Implicatie v1.0**: Bij elke nieuwe extension expliciet beslissen of die generiek (geen sector-prefix) of sector-specifiek (sector-prefix) is.

### X-10 — Generic terminology service

**Eis**: Codelijsten-laag werkt voor elk codestelsel zonder VVT-aannames.

**Implicatie v1.0**: L-laag al sterk; check dat geen VVT-only-aannames in code (bv. "alle codelijsten zijn voor zorgmoment-types").

---

## §7 — Post-v1.0 vooruitblik

Wat valt buiten v1.0 maar moet ooit gebouwd worden. Niet uitgewerkt in deze spec.

### Voor VVT-uitbreiding (v1.1)

- Native mobile app (React Native) met offline-modus voor extramurale routes
- LSP-aansluiting (Nictiz, certificeringstraject)
- Mitz toestemmingsbeheer (cliënt-toestemming voor gegevensdeling)
- eOverdracht / BgZ (Basisgegevensset Zorg)
- Apotheek-koppeling (TMS / Medimo)
- Huisarts-overdracht (eOverdracht-pull)
- Verzuim-module (los van AFAS/Visma-koppeling)
- E-learning + medewerkers-onboarding
- BI / managementdashboard met data-warehouse

### Voor Epic G (cliëntinteractie, v1.2)

- Cliëntportaal "Mijn-omgeving" (dossierinzage, afspraken, berichten, vragenlijsten)
- Familie-/mantelzorgportaal met aparte autorisatie
- Beeldbel/videoconsult (via 3rd-party WebRTC)
- Push-notificaties cliënt + familie
- Vragenlijsten cliënt-ingevuld

### Voor HIS-instap (v2.0)

- ICPC-2-codering volledig (al multi-coding-voorbereid in X-02)
- Episodisch dossier (al voorbereid in X-01)
- NHG-richtlijnen integratie
- Recepten elektronisch via LSP
- HAP-aansluiting (huisartsenpost)
- POH-integratie (praktijkondersteuner)
- Ketenzorg-protocollen (DM2 / COPD / CVRM / GGZ)
- M&I verrichtingen (al voorbereid in X-03)
- Inschrijftarief management
- E-consult
- Zelfmetingen / meet-thuis-koppelingen

### Voor klinisch EPD (v3.0)

- DBC-registratie (al voorbereid in X-03)
- OK-planning
- Lab-orders + uitslagen (HL7v2/v3, Edifact, al voorbereid in X-04)
- Beeldvorming-integratie (DICOM-viewer)
- Verpleegafdelingen, opnames, ontslag-flow
- Decision support / klinische richtlijnen
- ePrescribing volledig (al voorbereid in X-05)
- Zorgactiviteiten (ZA) volgens DBC-Zorgproducten

---

## §8 — Effort summary & strategisch kritisch pad

### Effort-totaal

Telling van features in §5:
- **S** items: ~38 (1-3 dagen elk)
- **M** items: ~46 (1-2 weken elk)
- **L** items: ~14 (2-4 weken elk)
- **XL** items: ~3 (>1 maand elk)

**Realistisch tijdpad voor v1.0**:
- Solo, full-time: **18-24 maanden**
- 2-3 personen team + AI-assistance: **9-12 maanden**
- Met externe partijen voor gespecialiseerde modules (Vektis, iWlz, SBV-Z): **8-10 maanden**

### Strategisch kritisch pad (do-first sequence)

Tier 1 = blokkerend voor instelling-onboarding. Tier 2 = blokkerend voor productie-gebruik. **Tier 2b = wettelijk/veiligheidskritisch — niet onderhandelbaar voor productie, maar onafhankelijk te plannen van Tier 2.** Tier 3 = polish voor enterprise-acceptatie.

**Tier 1 (blokkerend voor onboarding)**:
1. **I-03 Vecozo + M-04 UZI-server-cert** — fundament voor alle zorg-tot-zorg-koppelingen (ook R-02, R-03 randvoorwaarden)
2. **I-01 SBV-Z + I-02 AGB** — anders geen geldige cliënten/medewerkers voor declaratie
3. **B-01 G-Standaard** — fundament voor B-02/B-03/B-04 medicatieveiligheid (R-01)
4. **B-02 BEM + B-03 dubbele controle + B-04 MFB** — wettelijk/professioneel non-negotiable
5. **A-02 + H-03 CAK eigen bijdrage** — financiële volledigheid
6. **H-01 Vektis AW319 + H-02 AW320 + H-04/05/06 iWlz** — declaratie-pijplijn (R-04, R-05)
7. **E-03 tijdregistratie** — productieregistratie-fundament
8. **F-01 BIG-register sync** — wettelijk vereist
9. **F-05 bevoegdhedenmatrix** — veiligheidskritisch (medicatie-toediening-blokkade zonder bevoegdheid)

**Tier 2 (productie)**:
- B-05..B-12 meetinstrumenten + wondzorg
- C-01 zorgleefplan-4-domeinen + C-03 ZZP-koppeling
- D-01..D-04 rapportage-doel-koppeling + templates + dagstructuur + overdracht
- E-01 CAO-volledigheid + E-02 competentie-matching + E-08 verlof-herplanning
- F-03 urenregistratie/loon-export + F-04 certificaten
- H-07 productie→declaratie + H-08 contracten + H-11 maand-afsluiting
- K-02..K-04 BPMN-templates evaluatie/herindicatie/MIC
- J-01..J-03 AVG-flows + J-04 CIQI

**Tier 2b (wettelijk verplicht — geen polish)**:
- **B-16 Verklaring overlijden** — wettelijk + dossier-archivering
- **B-17 Wzd/BOPZ volledigheid** — IGJ-toezicht-blokker bij Wzd-cliënten
- **F-07 rooster-historie + audit** — arbeidsrecht (terugplaatsing-bewijs bij geschillen)
- **J-07 NEN 7513 retentie-policy** — wettelijke termijn-handhaving
- **J-08 bewerkers­overeenkomsten-register** — AVG-vereiste
- **J-09 RI&E light** — Arbo-verplicht voor zorginstelling
- **M-05 backup/DR-procedure** — niet feature maar productie-go-live-blokker
- **M-06 retentie-policies expliciet** — NEN 7513-vereist
- **M-07 wachtwoord-policy + complexity** — NEN 7510-vereist
- **M-08 sessie-management** — gedeeld-werkstation-realiteit zonder dit = AVG-incident

**Tier 3 (echte polish — comfort & enterprise-acceptatie)**:
- M-01/M-02 SSO + M-03 MFA — enterprise-eisen, niet wettelijk-blokker (kan later)
- L-02 configuratie-export — Differentiator maar niet release-blokker
- A-03 alarmering, A-08 mantelzorg-register
- B-15 palliatief, B-19 probleemlijst, B-20 hulpmiddelen
- C-04..C-09 zorgplan-polish
- D-05..D-08 rapportage-polish (D-08 AI-signaalwoord = Differentiator, polish-tier)
- E-04..E-07, E-09 planning-polish
- F-02 V&V-register, F-06 contract-historie
- H-09..H-10 financieel-polish (privé-facturatie + debiteuren)
- J-05/J-06 compliance-polish
- K-05..K-07 workflow-polish
- L-01/L-03/L-04 beheer-polish

### Aanbevolen sprint-grouping

Bundel features met sterke afhankelijkheden in dezelfde sprint:

- **Sprint-blok "Externe fundament"**: I-03 + M-04 + I-01 + I-02 (Tier 1, 2-3 sprints)
- **Sprint-blok "Medicatie veiligheid"**: B-01 + B-02 + B-03 + B-04 + B-14 (Tier 1, 4-5 sprints — grootste blok)
- **Sprint-blok "Declaratie-pijplijn"**: A-02 + H-03 + H-01 + H-02 + H-04..H-06 + H-07 + H-11 (Tier 1+2, 4-5 sprints)
- **Sprint-blok "HR-fundament"**: F-01 + F-02 + F-03 + F-04 + F-05 (Tier 1+2, 3-4 sprints)
- **Sprint-blok "Klinische schalen"**: B-05..B-12 (Tier 2, 2-3 sprints, parallel werkbaar)
- **Sprint-blok "Zorgplan-volwassenheid"**: C-01 + C-03 + C-07 + B-15 + B-19 (Tier 2, 2-3 sprints)
- **Sprint-blok "Rapportage-volwassenheid"**: D-01 + D-02 + D-03 + D-04 (Tier 2, 2 sprints)
- **Sprint-blok "Planning-volwassenheid"**: E-01 + E-02 + E-03 + E-04 + E-05 (Tier 1+2, 3 sprints)
- **Sprint-blok "Compliance"**: J-01 + J-02 + J-03 + J-04 + J-07 (Tier 2, 2-3 sprints)
- **Sprint-blok "Workflow templates"**: K-02 + K-03 + K-04 + K-05 (Tier 2, 2 sprints)
- **Sprint-blok "Security/SSO"**: M-01 + M-02 + M-03 (Tier 3, 2 sprints)

### Quick wins (laaghangend fruit)

- D-01 (rapportage-doel-koppeling) — al deels in branch, snel afronden
- A-04, A-05, A-06, A-07 — kleine cliëntdossier-uitbreidingen, samen 1 week
- E-06, E-07 — wachtlijst + recurring polish, samen 3-4 dagen
- K-06, K-07 — werkbak-polish, samen 3-4 dagen
- L-03, L-04 — config-polish, samen 3-4 dagen
- M-07, M-08 — security-policy-polish, samen 2-3 dagen

---

## §9 — Notion-export hints (voor Claude Code)

Wanneer Claude Code dit document inleest om de Notion-backlog bij te werken:

### Notion DB structuur

Maak (of update) de Notion DB **"OpenZorg Backlog"** met deze properties:

| Notion property | Type | Bron in spec |
|-----------------|------|--------------|
| Feature ID | Title | `### X-NN` heading |
| Titel | Rich text | tekst na ID in heading |
| Epic | Select / Relation | letter uit ID (A/B/C/D/E/F/H/I/J/K/L/M) |
| Status | Select | "Status:" bullet — Bestaand-solide / Aan-te-vullen / Nieuw / Bestaand-aan-te-vullen |
| Type | Select | "Type:" bullet — Must-match / Must-beat / Differentiator |
| Effort | Select | "Effort:" bullet — S / M / L / XL |
| Dependencies | Relation (self) | "Dependencies:" bullet — kommaseparated feature-IDs |
| Beschrijving | Rich text | "Beschrijving:" bullet |
| Acceptatiecriteria | Rich text | "Acceptatiecriteria:" sub-bullets |
| Tier | Select | afgeleid uit §8 — Tier 1 / Tier 2 / Tier 3 |
| Sprint-blok | Select | afgeleid uit §8 sprint-grouping |
| v1.0 scope | Checkbox | true voor alle items in §5; false voor §7-items |

### Maak ook DB **"OpenZorg Epics"**

| Notion property | Type | Bron in spec |
|-----------------|------|--------------|
| Epic ID | Title | letter (A/B/C/D/E/F/H/I/J/K/L/M) |
| Naam | Rich text | epic-naam uit §2/§4 |
| Scope v1.0 | Rich text | "Scope v1.0" alinea uit §4 |
| Waarom | Rich text | "Waarom" alinea uit §4 |
| Effort totaal | Select | S / M / L / XL uit §4 |
| Gap-zwaarte | Select | uit §3 — Klein / Medium / Zwaar |

### Maak ook DB **"OpenZorg Cross-Sector Platform Eisen"**

| Notion property | Type | Bron in spec |
|-----------------|------|--------------|
| ID | Title | X-NN |
| Naam | Rich text | titel |
| Eis | Rich text | "Eis:" alinea |
| Implicatie v1.0 | Rich text | "Implicatie v1.0:" alinea |

### Sync-regels

1. **Idempotent**: feature-IDs zijn stabiel — upsert op ID, geen duplicates
2. **Existing items**: bij status "Bestaand-solide" zonder aanvulling → maak Notion-item maar markeer "Done" (referentie-only)
3. **Dependencies**: relations bidirectional bijwerken
4. **Verwijderingen**: features die NIET in deze spec staan en WEL in Notion staan → niet auto-deleten, vlaggen als "outdated, review"
5. **Updates**: bij wijziging van spec → diff bepalen op feature-niveau, alleen gewijzigde Notion-items updaten

### Sync-frequentie

Eenmalig bij ontvangst van deze spec. Bij latere revisies van deze spec (versie-bump) opnieuw syncen, idempotent.

---

## Bijlage A — Veranderingsgeschiedenis

| Datum | Versie | Wijziging | Door |
|-------|--------|-----------|------|
| 2026-05-01 | 1.0 | Eerste versie — VVT v1.0 gap-analyse + cross-sector platform-eisen | Brainstorming-sessie Kevin + Claude |
| 2026-05-01 | 1.1 | §3.5 toegevoegd (harde randvoorwaarden: licenties, certificaten, doorlooptijden); Differentiator-pas op §5 (planning-engine, AI, configuratie); §8 Tier-systeem gesplitst — Tier 2b "wettelijk verplicht, geen polish" tussen Tier 2 en Tier 3 | Review-pas Kevin + Claude |

---

## Bijlage B — Beslissingen die in dit document zijn vastgelegd

Tijdens de brainstorming-sessie zijn de volgende strategische keuzes gemaakt — voor toekomstige referentie:

1. **Multi-sector ambitie**: OpenZorg moet uiteindelijk groter dan VVT-marktleider, en HIS + klinisch EPD aanvallen. v1.0 = VVT, maar architectuur moet sector-neutraal blijven.
2. **Epic G (cliëntinteractie) → post-v1.0**: portaal/familie/beeldbel uit v1.0-scope.
3. **Mobile + offline → post-v1.0**: web-responsive met tijdregistratie volstaat voor v1.0; native app komt later.
4. **Externe koppelingen-subset v1.0**: alleen SBV-Z, AGB/Vecozo, G-Standaard, iWlz. LSP/Mitz/eOverdracht/apotheek/huisarts → post-v1.0.
5. **Medicatieveiligheid (B-02 BEM, B-03 dubbele controle, B-04 MFB) is non-negotiable v1.0** — eigen volwaardige module.
6. **HR-splitsing**: urenregistratie + BIG/V&V + opleidingen-light in v1.0; volledig verzuim post-v1.0.

---

*Einde document.*
