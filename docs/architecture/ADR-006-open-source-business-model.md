# ADR-006: Open Source Business Model & Licentiestructuur

**Status**: Voorstel  
**Datum**: 2026-04-11  
**Auteur**: Kevin + Claude

---

## Context

OpenZorg is gebouwd als open-source ECD-platform voor de Nederlandse zorg. We willen:

1. **De kern open-source** beschikbaar stellen zodat zorginstellingen niet vendor-locked zijn
2. **Commercieel hosting en consulting aanbieden** als betaalde dienst
3. **Transparant zijn** over wat gratis is en wat niet

Dit vereist een heldere scheiding tussen community en commercieel, zowel juridisch (licentie), technisch (codebase), als organisatorisch (entiteiten).

---

## Beslissing

### 1. Twee entiteiten

| Entiteit | Type | Doel |
|----------|------|------|
| **Stichting OpenZorg** | Stichting (non-profit) | Beheert open-source project, community, governance, merknaam |
| **OpenZorg B.V.** | B.V. (commercieel) | Hosting, support, consulting, inrichting, maatwerk |

**Waarom een Stichting?**
- Geen aandeelhouders → kan niet overgenomen worden door een partij die het project wil sluiten
- Geeft vertrouwen aan zorginstellingen dat de kern altijd vrij blijft
- Gangbaar in NL open-source (bijv. Stichting NLnet, Stichting SURF)
- ANBI-status mogelijk → donaties aftrekbaar

**Relatie**: De B.V. is de grootste contributor aan de Stichting. De Stichting beheert de trademark en het open-source project onafhankelijk. De B.V. draagt financieel bij (percentage van omzet of vaste bijdrage per jaar).

---

### 2. Licentiekeuze: EUPL 1.2 (European Union Public License)

| Optie | Voordeel | Nadeel |
|-------|----------|--------|
| MIT/Apache | Maximale vrijheid | Iedereen kan closed-source fork maken, geen copyleft |
| GPL v3 | Sterke copyleft | Compliance complex, afschrikkend voor zorginstellingen |
| AGPL v3 | SaaS-copyleft | Te restrictief voor zorgpartijen die willen integreren |
| **EUPL 1.2** | **EU-recht, copyleft, SaaS-clausule, NL-vertaling** | Minder bekend dan GPL |

**Waarom EUPL?**
- Geschreven voor Europees recht (geldig in alle EU-landen)
- Beschikbaar in alle EU-talen inclusief Nederlands
- Copyleft: wijzigingen aan de kern moeten ook open-source worden gedeeld
- SaaS-clausule: wie OpenZorg als dienst aanbiedt MOET de broncode delen
- Compatibel met GPL, LGPL, Apache (upstream dependencies)
- Aanbevolen door de Europese Commissie voor overheids-/publieke software
- Past bij de Nederlandse zorg (publiek gefinancierd → publieke code)

---

### 3. Technische scheiding: wat is open, wat is commercieel

```
openzorg/                          ← EUPL 1.2 (open-source, Stichting)
├── apps/web/                      ← Frontend (alle zorg-functionaliteit)
├── services/ecd/                  ← ECD backend
├── services/planning/             ← Planning backend
├── services/facturatie/           ← Facturatie backend (basis)
├── packages/shared-*/             ← Gedeelde libraries
├── infra/compose/                 ← Docker Compose (self-hosting)
└── docs/                          ← Documentatie, wiki, ADRs

openzorg-platform/                 ← Proprietary (B.V., NIET open-source)
├── platform/tenant-provisioning/  ← Automatische tenant onboarding
├── platform/billing/              ← Stripe/Mollie integratie, abonnementen
├── platform/monitoring/           ← Centraal monitoring dashboard
├── platform/backup-manager/       ← Geautomatiseerde backups per tenant
├── platform/update-orchestrator/  ← Rolling updates, canary deploys
├── platform/sla-dashboard/        ← SLA monitoring, uptime
└── platform/white-label/          ← Theming, custom domains per klant
```

**Vuistregel**: alles wat een zorginstelling nodig heeft om clienten te verzorgen is open-source. Alles wat nodig is om het als dienst aan te bieden aan meerdere organisaties is commercieel.

| Open-source (Stichting) | Commercieel (B.V.) |
|------------------------|---------------------|
| Client dossier (ECD) | Multi-tenant provisioning |
| Zorgplan, rapportage | Automatische billing |
| Planning & rooster | Centraal monitoring |
| Facturatie (basis) | Backup management |
| Medicatie, vaccinaties | SLA dashboard |
| Workflows (BPMN) | White-label / custom domains |
| RBAC & audit logging | Consulting & inrichting |
| FHIR R4 integratie | Support contracten |
| Self-hosting met Docker | Managed hosting |
| Documentatie & wiki | Training & opleiding |

---

### 4. Commerciele diensten (B.V.)

#### Hosting tiers

| Tier | Doelgroep | Inhoud | Indicatie |
|------|-----------|--------|-----------|
| **Starter** | Kleine VVT (< 50 clienten) | Shared hosting, basis support | ~300/mnd |
| **Professional** | Middelgrote organisatie | Dedicated instance, SLA 99.5%, backup | ~800/mnd |
| **Enterprise** | Grote instelling | Dedicated infra, SLA 99.9%, SSO, maatwerk | Op maat |

#### Consulting diensten

| Dienst | Omschrijving |
|--------|-------------|
| **Inrichting** | OpenZorg configureren voor de organisatie (workflows, formulieren, rollen) |
| **Migratie** | Data overzetten vanuit bestaand ECD |
| **Integratie** | Koppelingen met apotheek, huisarts, CIZ, Vektis |
| **Training** | Gebruikerstraining, admin training, train-de-trainer |
| **Maatwerk** | Custom modules, specifieke rapportages, BI dashboards |

---

### 5. Transparantie naar gebruikers

In de README en op de website:

```markdown
## Open Source & Business Model

OpenZorg is open-source software onder de EUPL 1.2 licentie, beheerd door
Stichting OpenZorg. Je kunt het vrij gebruiken, aanpassen en zelf hosten.

OpenZorg B.V. biedt managed hosting, support en consulting als betaalde
dienst. De B.V. draagt financieel bij aan de Stichting en is de grootste
contributor aan het open-source project.

### Wat is gratis?
Alle zorgsoftware: client dossier, planning, facturatie, workflows,
rapportage. Je kunt OpenZorg zelf hosten met Docker.

### Wat is betaald?
Managed hosting, SLA-garanties, automatische updates, backups,
white-label, consulting en support.

### Waarom dit model?
Zorgsoftware is te belangrijk om achter een slot te zitten. Elke
zorginstelling verdient toegang tot goede software, ongeacht budget.
Het commerciele model zorgt ervoor dat het project duurzaam doorontwikkeld
kan worden.
```

---

### 6. Governance (Stichting)

**Bestuur**: minimaal 3 personen (onafhankelijk van de B.V.)

**Beslissingen**:
- Roadmap: community input via GitHub Discussions + RFC process
- Releases: maandelijks, semantic versioning
- Breaking changes: RFC → community review → bestuursbesluit
- Licentiewijzigingen: alleen met unaniem bestuursbesluit

**Contributor License Agreement (CLA)**:
- Contributors behouden copyright
- Geven Stichting recht om code onder EUPL te distribueren
- Geen copyright assignment (dat schrikt contributors af)

---

### 7. Technische implementatie

**Stap 1 (nu)**: Huidige monorepo wordt het open-source project. Verwijder master-admin/platform-specifieke code naar apart project.

**Stap 2**: Maak `openzorg-platform` private repo aan met:
- Git submodule of npm package dependency op `openzorg`
- Platform-specifieke Docker Compose die base images van openzorg extend
- Eigen CI/CD pipeline

**Stap 3**: Publiceer `openzorg` repo als public op GitHub:
- Voeg EUPL 1.2 LICENSE toe
- Voeg CONTRIBUTING.md toe
- Maak GitHub Discussions aan
- Schrijf self-hosting documentatie

---

## Consequenties

### Positief
- Zorginstellingen kunnen altijd weg bij de B.V. (geen vendor lock-in)
- Community kan bijdragen aan verbetering
- Transparantie bouwt vertrouwen op
- EUPL is juridisch sterk in Nederland
- Self-hosters worden potentiele klanten als ze groeien

### Negatief
- Concurrent kan gratis forken en zelf hosten (maar moet ook open-source blijven door copyleft)
- Meer overhead: twee entiteiten, governance, community management
- Feature-beslissingen worden complexer (community belangen vs. commerciele belangen)
- EUPL is minder bekend dan GPL/MIT bij internationale developers

### Risico's
- **Fork risk**: iemand forkt en biedt goedkoper hosting aan → copyleft beschermt, ze moeten ook alles open-source maken
- **Community verwachtingen**: mensen verwachten dat alles gratis is → helder communiceren wat wel/niet open-source is
- **Stichting overhead**: kost tijd en geld om op te richten → begin simpel, formaliseer later

---

## Actiepunten

- [ ] EUPL 1.2 LICENSE bestand toevoegen aan repo
- [ ] CONTRIBUTING.md schrijven
- [ ] README herschrijven met business model sectie
- [ ] Master-admin/platform code markeren voor toekomstige extractie
- [ ] Stichting oprichten (notaris, KvK)
- [ ] B.V. oprichten (notaris, KvK)
- [ ] Website openzorg.nl registreren/inrichten
- [ ] Self-hosting documentatie schrijven
