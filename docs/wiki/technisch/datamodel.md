# Datamodel

## Overzicht

OpenZorg slaat alle zorgdata op als FHIR R4 resources via Medplum. Dit document beschrijft de mapping van Nederlandse zorgconcepten naar FHIR resources, de gebruikte extensies en de identifier-systemen.

## FHIR R4 Resource mapping

| Nederlands concept | FHIR Resource | API Route | Beschrijving |
|-------------------|---------------|-----------|-------------|
| Client | Patient | `/api/clients` | Clientregistratie met BSN, contactgegevens, indicatie |
| Contactpersoon | RelatedPerson | `/api/clients/:id/contactpersonen` | Familie, mantelzorger, wettelijk vertegenwoordiger |
| Zorgplan | CarePlan | `/api/clients/:id/zorgplan` | Individueel zorgplan met doelen en interventies |
| Doel | Goal | `/api/clients/:id/zorgplan/:planId/doelen` | Zorgdoel binnen een zorgplan |
| Interventie | ServiceRequest | `/api/clients/:id/zorgplan/:planId/.../interventies` | Zorgactiviteit gekoppeld aan een doel |
| Rapportage | Observation | `/api/clients/:id/rapportages` | SOEP-rapportage of vrije notitie |
| Medicatie | MedicationRequest | `/api/clients/:id/medicatie` | Medicatievoorschrift |
| Document (metadata) | DocumentReference | `/api/clients/:id/documenten` | Documentmetadata (titel, categorie, datum) |
| Document (inhoud) | Binary | `/api/clients/:id/documenten/:id/download` | Bestandsinhoud (base64) |
| Afspraak | Appointment | `/api/afspraken` | Geplande afspraak |
| Beschikbaarheid | Schedule + Slot | `/api/beschikbaarheid` | Medewerker beschikbaarheid |
| Wachtlijst | ServiceRequest (draft) | `/api/wachtlijst` | Client op de wachtlijst |
| Bericht | Communication | `/api/berichten` | Intern bericht tussen medewerkers |
| MIC-melding | AuditEvent | `/api/mic-meldingen` | Incident melding |
| Medewerker | Practitioner | `/api/medewerkers` | Zorgmedewerker met AGB-code |
| Organisatie | Organization | `/api/organisatie` | Locatie, afdeling, cluster |

## Identifier-systemen

| Systeem URI | Beschrijving | Voorbeeld |
|------------|-------------|---------|
| `http://fhir.nl/fhir/NamingSystem/bsn` | Burgerservicenummer | `123456789` |
| `http://fhir.nl/fhir/NamingSystem/agb` | AGB-code (medewerker/organisatie) | `01234567` |
| `http://fhir.nl/fhir/NamingSystem/big` | BIG-registratie | `12345678901` |
| `https://openzorg.nl/NamingSystem/clientnummer` | Client identificatie (auto) | `C-00001` |
| `https://openzorg.nl/NamingSystem/kvk` | KvK-nummer | `12345678` |

## Custom extensies

Alle custom extensies gebruiken de base URL `https://openzorg.nl/extensions/`.

| Extensie URL | Resource | Type | Beschrijving |
|-------------|----------|------|-------------|
| `.../role` | Practitioner | string | Gebruikersrol (beheerder, zorgmedewerker, etc.) |
| `.../indicatie-type` | Patient | CodeableConcept | Indicatietype (WLZ, WMO, ZVW, Jeugdwet) |
| `.../indicatie-zorgprofiel` | Patient | string | Zorgprofiel bij indicatie |
| `.../indicatie-besluitnummer` | Patient | string | CIZ besluitnummer |
| `.../indicatie-start` | Patient | date | Startdatum indicatie |
| `.../indicatie-eind` | Patient | date | Einddatum indicatie |
| `.../mic-status` | AuditEvent | code | MIC-meldingstatus (gemeld, in behandeling, afgehandeld) |
| `.../mic-analyse` | AuditEvent | string | Oorzaakanalyse van het incident |
| `.../mic-maatregelen` | AuditEvent | string | Genomen maatregelen |
| `.../custom/*` | Patient (e.g.) | varies | Custom velden per tenant (configuratie module) |

## Relaties tussen resources

```
Patient ──────┬── CarePlan ──── Goal ──── ServiceRequest (interventie)
              ├── Observation (rapportage)
              ├── MedicationRequest
              ├── DocumentReference → Binary
              ├── RelatedPerson (contactpersoon)
              ├── Appointment
              └── Communication (optioneel subject)

Practitioner ─┬── Appointment (participant)
              ├── Observation (performer)
              ├── Communication (sender/recipient)
              ├── CarePlan (author)
              └── MedicationRequest (requester)

Organization ─┬── Organization (partOf - hierarchie)
              ├── Patient (managingOrganization)
              └── Practitioner (koppeling via extensie)
```

## Versioning

Medplum ondersteunt FHIR resource versioning. Elke wijziging aan een resource creëert een nieuwe versie. Dit maakt het mogelijk om:
- De volledige wijzigingshistorie van een client op te vragen
- Medicatiewijzigingen te traceren
- Zorgplanwijzigingen terug te kijken

Versiegeschiedenis is beschikbaar via het standaard FHIR `_history` endpoint.
