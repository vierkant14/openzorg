# RBAC & Beveiliging

## Overzicht

OpenZorg gebruikt Role-Based Access Control (RBAC) met vier standaardrollen en 27 permissies. Beveiliging wordt afgedwongen op drie niveaus: backend middleware, frontend navigatie en NEN 7513 auditlogging.

## Middleware chain

Alle `/api/*` routes passeren drie middlewares in vaste volgorde:

### 1. Tenant middleware (`tenant.ts`)
- Extraheert `X-Tenant-ID` header uit het request
- Retourneert 400 als de header ontbreekt
- Slaat `/api/master/*` routes over (master admin gebruikt `X-Master-Key`)
- Maakt tenant context beschikbaar voor volgende middlewares

### 2. RBAC middleware (`rbac.ts`)
- Leest `X-User-Role` header
- Matcht het request pad + HTTP methode tegen de `ROUTE_PERMISSIONS` matrix
- Retourneert 403 bij onvoldoende rechten
- Backwards compatible: laat door als geen rol-header aanwezig (migratiefase)
- Permissiecontrole is gedefinieerd in `packages/shared-domain/src/roles.ts`

### 3. Audit middleware (`audit.ts`)
- NEN 7513 compliant logging
- Async fire-and-forget naar `openzorg.audit_log` tabel in PostgreSQL
- Logt: gebruiker, actie, resource type, pad, duur, tenant, tijdstip
- Wordt uitgevoerd voor alle routes die patiëntdata benaderen

```
Request → [Tenant] → [RBAC] → [Audit] → Route handler → Response
           ↓ 400     ↓ 403     ↓ log
```

## ROUTE_PERMISSIONS matrix

De `ROUTE_PERMISSIONS` array in `shared-domain` koppelt route-patronen aan permissies:

```typescript
// Voorbeeld entries
{ path: '/api/clients',        method: 'GET',  permission: 'clients:read'  },
{ path: '/api/clients',        method: 'POST', permission: 'clients:write' },
{ path: '/api/clients/:id',    method: 'PUT',  permission: 'clients:write' },
{ path: '/api/clients/:id',    method: 'DELETE', permission: 'clients:delete' },
{ path: '/api/mic-meldingen',  method: 'GET',  permission: 'mic:read'      },
{ path: '/api/mic-meldingen',  method: 'POST', permission: 'mic:write'     },
```

## Frontend enforcement

- `AppShell.tsx` filtert sidebar-items op basis van `NAV_PERMISSIONS` en `getUserRole()`
- `ecdFetch()` vangt 403 responses op en redirect naar `/geen-toegang`
- Rol en token worden opgeslagen in localStorage na Medplum PKCE login
- Knoppen en formulieren worden conditioneel getoond op basis van de rol

## NEN 7513 Auditlogging

NEN 7513 is de Nederlandse norm voor logging van toegang tot patiëntgegevens. OpenZorg logt elke interactie met zorgdata.

### Wat wordt gelogd

| Veld | Beschrijving |
|------|-------------|
| `user_id` | Medplum user ID van de ingelogde medewerker |
| `tenant_id` | Tenant (organisatie) identifier |
| `action` | HTTP methode (GET, POST, PUT, DELETE) |
| `resource_type` | Type FHIR resource (Patient, CarePlan, etc.) |
| `resource_id` | ID van de benaderde resource |
| `path` | Volledig API pad |
| `duration_ms` | Duur van het request in milliseconden |
| `timestamp` | Tijdstip van het request (UTC) |
| `ip_address` | IP-adres van de client |

### Opslag

- PostgreSQL tabel: `openzorg.audit_log`
- Row Level Security (RLS): elke tenant kan alleen eigen audit records zien
- Retentie: minimaal 5 jaar (NEN 7513 vereiste)
- Audit records zijn immutable (geen UPDATE of DELETE)

### API

- `GET /api/audit` — Auditlog raadplegen (alleen beheerder)
- Filters: gebruiker, resource type, datum bereik, actie
- Gepagineerd, maximaal 100 records per pagina

## Authenticatie

- Medplum PKCE flow voor login
- Token + projectId + role opgeslagen in localStorage
- Tokens zijn project-scoped (tenant isolatie)
- Master admin routes gebruiken `X-Master-Key` header (geen PKCE)
