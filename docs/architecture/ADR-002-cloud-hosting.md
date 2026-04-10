# ADR-002: Cloud Hosting Strategy

## Status
Accepted

## Context
OpenZorg's business model is open-core: de software is gratis en open source,
maar hosting, support en compliance-borging zijn betaalde diensten. We moeten
een hosting-architectuur kiezen die:

1. Meerdere zorginstellingen (tenants) kan bedienen op gedeelde infrastructuur
2. Optioneel dedicated infrastructuur per klant biedt voor grote instellingen
3. Data-soevereiniteit garandeert (data in NL/EU, geen vendor lock-in)
4. NEN 7510 certificering niet in de weg staat
5. Kosten-efficient schaalt van 1 tot 100+ tenants
6. Volledig onder eigen beheer blijft (geen managed DB als Supabase)

## Decision

### Twee deployment modellen

**Model A: Shared Infrastructure (standaard)**
- Eén Kubernetes namespace met gedeelde Medplum + PostgreSQL
- Tenant-isolatie via Medplum Projects (API-niveau) en PostgreSQL RLS (DB-niveau)
- Voor kleine en middelgrote VVT-instellingen (50-500 cliënten)
- Kostprijs per tenant laag, operationele overhead minimaal

**Model B: Dedicated Infrastructure (premium)**
- Per klant een eigen Kubernetes namespace met eigen PostgreSQL instance
- Volledige data-isolatie op infrastructuurniveau
- Voor grote instellingen, instellingen die NEN 7510-certificering eisen,
  of instellingen die contractueel fysieke scheiding vereisen
- Hogere kostprijs, maar noodzakelijk voor enterprise-segment

### Cloud-stack

| Component | Keuze | Motivatie |
|---|---|---|
| Orchestratie | Kubernetes (AKS/EKS/GKE) | Cloud-agnostisch, standaard, schaalbaar |
| Database | CloudNativePG operator | PostgreSQL op K8s met automated failover, backups, monitoring |
| Database backup | pgBackRest via CloudNativePG | Point-in-time recovery, versleutelde backups |
| Secrets | External Secrets Operator | Synct met Azure Key Vault / AWS Secrets Manager |
| Ingress | Traefik | Per-tenant subdomain routing, Let's Encrypt TLS |
| Monitoring | Prometheus + Grafana | Open source, standaard in K8s ecosysteem |
| Logging | Loki + Promtail | Lightweight, integreert met Grafana |
| IaC | Pulumi (TypeScript) | Infra as code in dezelfde taal als de applicatie |
| Container registry | GitHub Container Registry | Gratis voor open source, integreert met CI |
| CI/CD | GitHub Actions → ArgoCD | GitOps deployment model |

### Waarom geen Supabase of managed database?

1. **Medplum IS de database-laag** — Supabase zou een onnodige tweede data-laag
   introduceren naast Medplum's eigen PostgreSQL-gebruik
2. **Data-soevereiniteit** — zorginstellingen eisen contractueel dat data in NL/EU
   staat en dat de verwerker volledige controle heeft over de database
3. **NEN 7510** — certificering vereist aantoonbare controle over
   toegangsbeveiliging, logging en backup van de database
4. **Kosten** — bij 50+ tenants is self-managed PostgreSQL op K8s goedkoper
   dan per-project managed database pricing
5. **Geen vendor lock-in** — PostgreSQL is overal beschikbaar

### Tenant routing

```
[klant].openzorg.nl → Traefik ingress
  → tenant lookup (slug → Medplum project ID)
  → Next.js / Hono services met tenant context
  → Medplum API (project-scoped)
  → PostgreSQL (RLS-enforced)
```

### Schaalpad

1. **MVP / Pilot** (nu): Docker Compose op een enkele server
2. **10 klanten**: Kubernetes cluster met Model A (shared)
3. **50+ klanten**: Mix van Model A en Model B, ArgoCD voor GitOps
4. **100+ klanten**: Multi-region, read replicas, dedicated DBA

## Consequences

- We beheren PostgreSQL zelf, wat operationele kennis vereist
- CloudNativePG reduceert dit significant maar is geen zero-ops
- Twee deployment modellen betekenen twee sets Pulumi/Helm templates
- Data-soevereiniteit is een verkoopargument tegenover SaaS-concurrenten
- Cloud-agnostisch: klant kan kiezen tussen Azure (populair bij NL zorg), AWS, of GCP
