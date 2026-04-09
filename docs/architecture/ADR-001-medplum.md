# ADR-001: Medplum als FHIR-fundament

## Status

Accepted

## Datum

2026-04-09

## Context

OpenZorg heeft een FHIR R4 server nodig die multi-tenancy, authenticatie, audit logging en Nederlandse FHIR-profielen ondersteunt. We kunnen dit zelf bouwen, een commercieel product gebruiken, of een open source oplossing inzetten.

## Overwogen opties

### Optie 1: Zelf bouwen op basis van HAPI FHIR

- **Voordeel**: Maximale controle
- **Nadeel**: Minimaal 6 maanden extra bouwwerk voor auth, audit, multi-tenancy
- **Nadeel**: Java-stack introduceert een tweede runtime naast TypeScript

### Optie 2: Medplum (self-hosted, open source)

- **Voordeel**: Complete FHIR R4 server in TypeScript, dezelfde taal als de rest van de stack
- **Voordeel**: Ingebouwde multi-tenancy via "projects" (Medplum's tenant-concept)
- **Voordeel**: Authenticatie, audit logging, en subscription support out-of-the-box
- **Voordeel**: Apache 2.0 licentie, volledig open source
- **Voordeel**: Actieve community en regelmatige releases
- **Nadeel**: Afhankelijkheid van upstream project
- **Nadeel**: Nederlandse FHIR-profielen moeten handmatig worden geconfigureerd

### Optie 3: IBM FHIR Server

- **Voordeel**: Enterprise-grade
- **Nadeel**: Java, zwaarder, minder community-gedreven

## Besluit

We kiezen **Medplum (self-hosted)** als FHIR-fundament.

## Motivatie

1. **TypeScript-stack**: Medplum is geschreven in TypeScript, net als de rest van OpenZorg. Dit elimineert context-switching en maakt het mogelijk om Medplum-types direct te hergebruiken.

2. **Multi-tenancy**: Medplum's "project"-concept biedt tenant-isolatie op applicatieniveau. Gecombineerd met PostgreSQL row-level security op database-niveau geeft dit defense-in-depth.

3. **Tijdsbesparing**: Auth, audit logging, FHIR-validatie, en subscription-support zijn beschikbaar zonder eigen bouwwerk. Dit bespaart naar schatting 6+ maanden ontwikkeltijd.

4. **Architectuurprincipe 4.1**: "Voor elk niet-zorgspecifiek probleem wordt een volwassen open source bouwsteen gekozen." Medplum past hier perfect in.

## Consequenties

- We zijn afhankelijk van Medplum upstream voor bugfixes en FHIR-compliance updates.
- Nederlandse FHIR-profielen (zorg-NL) moeten als StructureDefinitions in Medplum worden geladen.
- Medplum's project-model wordt de primaire multi-tenancy grens op API-niveau, aangevuld met PostgreSQL RLS op database-niveau.
- Bij een eventuele migratie weg van Medplum blijft de FHIR-API het contractpunt, niet Medplum-specifieke endpoints.
