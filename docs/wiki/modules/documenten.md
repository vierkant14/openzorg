# Documenten

## Wat doet deze module?

Beheert documentuploads en -beheer voor clientdossiers (FHIR: Binary + DocumentReference). Medewerkers kunnen bestanden uploaden die gekoppeld worden aan een client. De daadwerkelijke inhoud wordt opgeslagen als FHIR Binary, de metadata als DocumentReference.

## Functies

### Document uploaden
- **Bestand**: upload via drag-and-drop of bestandsselectie
- **Titel**: handmatig in te vullen of automatisch overgenomen uit bestandsnaam
- **Categorie**: brief, verwijzing, labresultaat, identiteitsbewijs, verklaring, overig
- **Datum document**: wanneer het document is opgesteld (standaard: vandaag)
- **Omschrijving**: optionele toelichting
- **Client**: gekoppeld aan de client vanuit het dossier

**Ondersteunde bestandstypen:**
- PDF (application/pdf)
- Afbeeldingen (image/jpeg, image/png)
- Word (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
- Maximale bestandsgrootte: 10 MB (configureerbaar per tenant)

### Document bekijken
- Inline preview voor PDF en afbeeldingen
- Download voor overige bestandstypen
- Metadata weergave: titel, categorie, uploaddatum, uploader, bestandsgrootte

### Documentenlijst
- Overzicht van alle documenten per client
- Filteren op categorie en datum
- Zoeken op titel
- Sorteren op datum (nieuwste eerst) of titel

### Document verwijderen
- Soft delete: document wordt gemarkeerd als verwijderd maar blijft in het systeem
- Alleen beheerder kan documenten definitief verwijderen

## Technisch

- **FHIR Resources**: Binary (inhoud), DocumentReference (metadata)
- **API**: ECD service op port 4001
  - `GET /api/clients/:id/documenten` — Lijst documenten per client
  - `POST /api/clients/:id/documenten` — Upload nieuw document (multipart/form-data)
  - `GET /api/clients/:id/documenten/:docId` — Document metadata ophalen
  - `GET /api/clients/:id/documenten/:docId/download` — Document inhoud downloaden (Binary)
  - `DELETE /api/clients/:id/documenten/:docId` — Document verwijderen (soft delete)
- **Upload flow**:
  1. Frontend stuurt multipart/form-data met bestand + metadata
  2. Backend maakt eerst een Binary resource aan met de bestandsinhoud (base64)
  3. Backend maakt een DocumentReference aan met metadata en referentie naar de Binary
  4. Response bevat de DocumentReference met Binary-link
- **FHIR mapping**:
  - `Binary.contentType` bevat het MIME type
  - `Binary.data` bevat de base64 encoded inhoud
  - `DocumentReference.subject` verwijst naar Patient
  - `DocumentReference.author` verwijst naar Practitioner (uploader)
  - `DocumentReference.type` bevat de categorie
  - `DocumentReference.description` bevat de omschrijving
  - `DocumentReference.date` is de uploaddatum
  - `DocumentReference.content[0].attachment.url` verwijst naar de Binary resource
  - `DocumentReference.content[0].attachment.title` bevat de bestandsnaam
  - `DocumentReference.content[0].attachment.size` bevat de bestandsgrootte
  - `DocumentReference.status` = `current` (actief) of `entered-in-error` (verwijderd)
- **Permissies**: `documenten:read`, `documenten:write`
- **Rollen**: Beheerder en zorgmedewerker kunnen uploaden en lezen. Teamleider kan lezen en uploaden. Planner kan alleen lezen.

## Configuratie per tenant

| Instelling | Standaard | Beschrijving |
|-----------|-----------|-------------|
| `documentMaxSizeMB` | `10` | Maximale bestandsgrootte in MB |
| `documentAllowedTypes` | `["pdf","jpeg","png","docx"]` | Toegestane bestandstypen |
