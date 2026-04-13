# VVT/Revalidatie Gap-Analyse

> Laatste update: 2026-04-13
> Vergelijking van het VVT/GRZ-procesonderzoek met de huidige OpenZorg-implementatie.

**Conclusie:** Van de ~25 kernprocessen ondersteunt OpenZorg er ~18 op basisniveau of beter. De kern VVT-module is grotendeels functioneel. GRZ en koppelvlakken zijn nog niet gestart.

## Legenda

| Score | Betekenis |
|-------|-----------| 
| ✅ Volledig | Productiewaardig, alle stappen ondersteund |
| 🔶 Basis | Functionaliteit aanwezig maar incompleet |
| 🔲 Stub | Route/pagina bestaat maar doet weinig |
| ❌ Ontbreekt | Niet geimplementeerd |

## VVT Processen

| Proces | Status | Wat ontbreekt |
|--------|--------|---------------|
| Aanmelding/intake | ✅ | — |
| Indicatieverwerking | 🔶 | Geen iWLZ koppeling |
| Clientregistratie | 🔶 | Verzekering (Coverage), apotheek |
| Zorgplan leefgebieden | ✅ | — |
| Evaluatiecyclus | ✅ | — |
| Handtekening | ✅ | Geen echte digitale handtekening |
| SOEP-rapportage | ✅ | — |
| Overdracht per dienst | ✅ | — |
| Medicatie + dubbele controle | ✅ | Geen interactiecheck |
| MDO | 🔶 | Geen automatische doelbijstelling |
| MIC melding | ✅ | Geen trendrapportage |
| Herindicatie | ✅ | — |
| Signaleringen | ✅ | — |
| Ontslagmanagement | ❌ | Geen workflow, geen eOverdracht |
| Facturatie | ❌ | Geen declaratiebestand-generatie |

## GRZ/Revalidatie

| Proces | Status |
|--------|--------|
| Behandelplan (ICF) | ❌ |
| Meetinstrumenten | ❌ |
| CareTeam | ❌ |
| DBC-registratie | ❌ |

## Koppelvlakken

| Koppelvlak | Status |
|------------|--------|
| iWLZ | ❌ |
| MedMij/PGO | ❌ |
| eOverdracht | ❌ |
| Vecozo | ❌ |
| BgZ | 🔲 |
