# Toekomstige Modules — Roadmap

## Module Roadmap

| Fase | Module | Doelgroep | Marktomvang | Kern-overlap |
|------|--------|-----------|-------------|-------------|
| **1 (nu)** | VVT | Verpleeghuizen, thuiszorg | €22 mrd | 100% kern |
| **2 (Q3 2026)** | GRZ/Revalidatie | Revalidatiecentra | Onderdeel ZVW | 70% kern |
| **3 (Q4 2026)** | GHZ | Gehandicaptenzorg | €12 mrd | 60% kern |
| **4 (2027)** | GGZ Langdurig | RIBW, beschermd wonen | Onderdeel GGZ | 50% kern |
| **5 (2027)** | Jeugdzorg | Jeugdhulpverlening | €5 mrd | 40% kern |
| **6 (2028)** | Huisartsen | Eerstelijns | €4 mrd | 30% kern |

## Gedeelde Kern (alle modules)

- Clientregistratie, contactpersonen, medicatiebeheer
- Signaleringen, rapportage, documenten, berichten
- Audit trail (NEN 7513), multi-tenant, RBAC
- Workflow engine (Flowable BPMN)

## Module-specifiek

| Module | Unieke componenten |
|--------|-------------------|
| **VVT** | Zorgleefplan (12 leefgebieden), SOEP, MIC, Wzd, iWLZ |
| **GRZ** | Behandelplan (ICF), meetinstrumenten, DBC, CareTeam |
| **GHZ** | Ondersteuningsplan, gedragsanalyse, dagbesteding, groepszorg |
| **GGZ** | Behandelplan, ROM/PROM, crisiskaart, Wvggz, DBC-GGZ |
| **Jeugd** | Gezinsplan, veiligheidsplan, iJW, kindcheck |
| **Huisarts** | HIS-integratie, verwijzingen, lab, ICPC-codering |

## Architectuurprincipe

Eén codebase, configureerbaar per sector. De sector bepaalt:
1. Welk **plan-type** (zorgplan / behandelplan / ondersteuningsplan)
2. Welke **domeinen** (configuurbaar)
3. Welke **meetinstrumenten** (Questionnaire resources)
4. Welke **workflows** (BPMN templates)
5. Welke **codelijsten** (SNOMED subsets per sector)
6. Welke **facturatie-stroom** (WLZ/WMO/ZVW/Jeugdwet/DBC)
