# API Overzicht

## Overzicht

OpenZorg biedt een REST API die FHIR R4 resources beheert via Hono microservices. Dezelfde API wordt gebruikt door de frontend en is beschikbaar voor externe integraties.

## Authenticatie

Alle API requests (behalve master admin) vereisen drie headers:

| Header | Verplicht | Beschrijving |
|--------|-----------|-------------|
| `Authorization` | Ja | `Bearer <medplum-token>` — Verkregen via Medplum PKCE login |
| `X-Tenant-ID` | Ja | Medplum Project ID van de tenant |
| `X-User-Role` | Ja | Rol van de gebruiker (`beheerder`, `zorgmedewerker`, `planner`, `teamleider`) |

Master admin routes gebruiken een alternatief mechanisme:

| Header | Verplicht | Beschrijving |
|--------|-----------|-------------|
| `X-Master-Key` | Ja | Master admin API key (bijv. `dev-master-key` in development) |

## ECD Service (port 4001)

### Clienten (Patient)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/clients` | `clients:read` | Lijst clienten (zoek, filter, paginatie) |
| `POST` | `/api/clients` | `clients:write` | Client aanmaken |
| `GET` | `/api/clients/:id` | `clients:read` | Client ophalen |
| `PUT` | `/api/clients/:id` | `clients:write` | Client bijwerken |
| `DELETE` | `/api/clients/:id` | `clients:delete` | Client deactiveren (soft delete) |

### Contactpersonen (RelatedPerson)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/clients/:id/contactpersonen` | `clients:read` | Contactpersonen van client |
| `POST` | `/api/clients/:id/contactpersonen` | `clients:write` | Contactpersoon toevoegen |
| `PUT` | `/api/clients/:id/contactpersonen/:cpId` | `clients:write` | Contactpersoon bijwerken |
| `DELETE` | `/api/clients/:id/contactpersonen/:cpId` | `clients:write` | Contactpersoon verwijderen |

### Zorgplan (CarePlan, Goal, ServiceRequest)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/clients/:id/zorgplan` | `zorgplan:read` | Actief zorgplan ophalen |
| `POST` | `/api/clients/:id/zorgplan` | `zorgplan:write` | Nieuw zorgplan aanmaken |
| `PUT` | `/api/clients/:id/zorgplan/:planId` | `zorgplan:write` | Zorgplan bijwerken |
| `POST` | `/api/clients/:id/zorgplan/:planId/doelen` | `zorgplan:write` | Doel toevoegen |
| `PUT` | `/api/clients/:id/zorgplan/:planId/doelen/:goalId` | `zorgplan:write` | Doel bijwerken |
| `POST` | `/api/clients/:id/zorgplan/:planId/doelen/:goalId/interventies` | `zorgplan:write` | Interventie toevoegen |
| `PUT` | `/api/clients/:id/zorgplan/:planId/interventies/:srId` | `zorgplan:write` | Interventie bijwerken |

### Rapportages (Observation)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/clients/:id/rapportages` | `rapportages:read` | Rapportages ophalen (filter, paginatie) |
| `POST` | `/api/clients/:id/rapportages` | `rapportages:write` | Nieuwe rapportage |
| `GET` | `/api/clients/:id/rapportages/:rapId` | `rapportages:read` | Enkele rapportage |
| `PUT` | `/api/clients/:id/rapportages/:rapId` | `rapportages:write` | Rapportage bijwerken |
| `DELETE` | `/api/clients/:id/rapportages/:rapId` | `rapportages:write` | Rapportage verwijderen |

### Medicatie (MedicationRequest)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/clients/:id/medicatie` | `medicatie:read` | Medicatieoverzicht |
| `POST` | `/api/clients/:id/medicatie` | `medicatie:write` | Medicatie registreren |
| `GET` | `/api/clients/:id/medicatie/:medId` | `medicatie:read` | Enkele medicatie |
| `PUT` | `/api/clients/:id/medicatie/:medId` | `medicatie:write` | Medicatie wijzigen |
| `DELETE` | `/api/clients/:id/medicatie/:medId` | `medicatie:write` | Medicatie verwijderen |

### Documenten (DocumentReference + Binary)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/clients/:id/documenten` | `documenten:read` | Documentenlijst |
| `POST` | `/api/clients/:id/documenten` | `documenten:write` | Document uploaden (multipart) |
| `GET` | `/api/clients/:id/documenten/:docId` | `documenten:read` | Document metadata |
| `GET` | `/api/clients/:id/documenten/:docId/download` | `documenten:read` | Document downloaden |
| `DELETE` | `/api/clients/:id/documenten/:docId` | `documenten:write` | Document verwijderen |

### Berichten (Communication)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/berichten` | `berichten:read` | Inbox (ontvangen berichten) |
| `GET` | `/api/berichten/verzonden` | `berichten:read` | Verzonden berichten |
| `POST` | `/api/berichten` | `berichten:write` | Bericht versturen |
| `GET` | `/api/berichten/:id` | `berichten:read` | Bericht ophalen |
| `PUT` | `/api/berichten/:id/gelezen` | `berichten:write` | Markeer als gelezen |
| `PUT` | `/api/berichten/:id/ongelezen` | `berichten:write` | Markeer als ongelezen |
| `GET` | `/api/berichten/ongelezen/count` | `berichten:read` | Ongelezen teller |

### MIC-meldingen (AuditEvent)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/mic-meldingen` | `mic:read` | Lijst MIC-meldingen |
| `POST` | `/api/mic-meldingen` | `mic:write` | Nieuwe melding |
| `GET` | `/api/mic-meldingen/:id` | `mic:read` | Melding ophalen |
| `PUT` | `/api/mic-meldingen/:id` | `mic:write` | Melding bijwerken |

### Medewerkers (Practitioner)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/medewerkers` | `medewerkers:read` | Lijst medewerkers |
| `POST` | `/api/medewerkers` | `medewerkers:write` | Medewerker aanmaken |
| `GET` | `/api/medewerkers/:id` | `medewerkers:read` | Medewerker ophalen |
| `PUT` | `/api/medewerkers/:id` | `medewerkers:write` | Medewerker bijwerken |
| `DELETE` | `/api/medewerkers/:id` | `medewerkers:write` | Medewerker deactiveren |

### Organisatie (Organization)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/organisatie` | `organisatie:read` | Organisatiestructuur (boom) |
| `POST` | `/api/organisatie` | `organisatie:write` | Locatie/afdeling aanmaken |
| `GET` | `/api/organisatie/:id` | `organisatie:read` | Organisatie-eenheid ophalen |
| `PUT` | `/api/organisatie/:id` | `organisatie:write` | Organisatie-eenheid bijwerken |
| `DELETE` | `/api/organisatie/:id` | `organisatie:write` | Organisatie-eenheid deactiveren |

### Configuratie

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/tenant-settings` | (alle rollen) | Tenant-instellingen ophalen |
| `GET` | `/api/admin/custom-fields` | `configuratie:read` | Custom velden lijst |
| `POST` | `/api/admin/custom-fields` | `configuratie:write` | Custom veld aanmaken |
| `PUT` | `/api/admin/custom-fields/:id` | `configuratie:write` | Custom veld bewerken |
| `DELETE` | `/api/admin/custom-fields/:id` | `configuratie:write` | Custom veld deactiveren |
| `GET` | `/api/admin/validation-rules` | `configuratie:read` | Validatieregels lijst |
| `POST` | `/api/admin/validation-rules` | `configuratie:write` | Validatieregel aanmaken |
| `PUT` | `/api/admin/validation-rules/:id` | `configuratie:write` | Validatieregel bewerken |
| `DELETE` | `/api/admin/validation-rules/:id` | `configuratie:write` | Validatieregel verwijderen |

### Audit

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/audit` | `audit:read` | Auditlog raadplegen |

## Planning Service (port 4002)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/afspraken` | `planning:read` | Lijst afspraken (filter op datum, medewerker) |
| `POST` | `/api/afspraken` | `planning:write` | Afspraak aanmaken |
| `GET` | `/api/afspraken/:id` | `planning:read` | Afspraak ophalen |
| `PUT` | `/api/afspraken/:id` | `planning:write` | Afspraak bijwerken |
| `DELETE` | `/api/afspraken/:id` | `planning:write` | Afspraak annuleren |
| `GET` | `/api/beschikbaarheid` | `planning:read` | Beschikbaarheid ophalen |
| `POST` | `/api/beschikbaarheid` | `planning:write` | Beschikbaarheid registreren |
| `GET` | `/api/wachtlijst` | `planning:read` | Wachtlijst ophalen |
| `POST` | `/api/wachtlijst` | `planning:write` | Client op wachtlijst plaatsen |
| `PUT` | `/api/wachtlijst/:id` | `planning:write` | Wachtlijstitem bijwerken |

## Workflow Service (port 4003)

| Methode | Route | Permissie | Beschrijving |
|---------|-------|-----------|-------------|
| `GET` | `/api/templates` | `workflows:read` | BPMN-sjablonen ophalen |
| `POST` | `/api/processen` | `workflows:write` | Proces starten |
| `GET` | `/api/processen` | `workflows:read` | Lopende processen |
| `GET` | `/api/processen/:id` | `workflows:read` | Procesdetails |
| `GET` | `/api/taken` | `workflows:read` | Taakwerkbak |
| `POST` | `/api/taken/:id/claim` | `workflows:write` | Taak claimen |
| `POST` | `/api/taken/:id/complete` | `workflows:write` | Taak voltooien |
| `POST` | `/api/taken/:id/unclaim` | `workflows:write` | Taak terugleggen |

## Master Admin (port 4001)

| Methode | Route | Auth | Beschrijving |
|---------|-------|------|-------------|
| `GET` | `/api/master/tenants` | `X-Master-Key` | Alle tenants ophalen |
| `POST` | `/api/master/tenants` | `X-Master-Key` | Nieuwe tenant aanmaken |
| `GET` | `/api/master/tenants/:id` | `X-Master-Key` | Tenant details |
| `PUT` | `/api/master/tenants/:id` | `X-Master-Key` | Tenant bijwerken |
| `PUT` | `/api/master/tenants/:id/toggle` | `X-Master-Key` | Tenant activeren/deactiveren |

## Foutafhandeling

Alle endpoints retourneren consistente foutresponses:

| Status | Beschrijving |
|--------|-------------|
| 400 | Bad Request — ontbrekende of ongeldige parameters, validatiefout |
| 401 | Unauthorized — ontbrekend of verlopen auth token |
| 403 | Forbidden — onvoldoende rechten voor deze actie |
| 404 | Not Found — resource niet gevonden |
| 500 | Internal Server Error — onverwachte serverfout |

Foutbody formaat:

```json
{
  "error": "Beschrijving van de fout",
  "details": ["Optionele validatiedetails"]
}
```
