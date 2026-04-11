# Rollenbeheer

## Wat doet deze module?

Beheert de rollen en permissies binnen OpenZorg (RBAC: Role-Based Access Control). Het systeem heeft vier standaardrollen met in totaal 27 permissies. De permissiematrix bepaalt wat elke rol mag zien en doen in het systeem.

## Functies

### Vier standaardrollen

| Rol | Beschrijving | Typische gebruiker |
|-----|-------------|-------------------|
| **Beheerder** | Volledige toegang tot alle modules inclusief configuratie en gebruikersbeheer | ICT-beheerder, functioneel beheerder |
| **Zorgmedewerker** | Toegang tot clientdossier, zorgplan, rapportage, medicatie | Verpleegkundige, verzorgende IG, begeleider |
| **Planner** | Toegang tot planning, wachtlijst, beschikbaarheid | Roosterplanner, zorgcoördinator |
| **Teamleider** | Leestoegang op alle modules, schrijftoegang op planning en team-gerelateerde modules | Teamleider, afdelingshoofd |

### 27 Permissies

| Permissie | Beheerder | Zorgmedewerker | Planner | Teamleider |
|-----------|:---------:|:--------------:|:-------:|:----------:|
| `clients:read` | V | V | V | V |
| `clients:write` | V | V | - | V |
| `clients:delete` | V | - | - | - |
| `zorgplan:read` | V | V | V | V |
| `zorgplan:write` | V | V | - | V |
| `rapportages:read` | V | V | V | V |
| `rapportages:write` | V | V | - | V |
| `medicatie:read` | V | V | V | V |
| `medicatie:write` | V | V | - | - |
| `planning:read` | V | V | V | V |
| `planning:write` | V | - | V | V |
| `berichten:read` | V | V | V | V |
| `berichten:write` | V | V | V | V |
| `medewerkers:read` | V | V | V | V |
| `medewerkers:write` | V | - | - | V |
| `organisatie:read` | V | V | V | V |
| `organisatie:write` | V | - | - | - |
| `configuratie:read` | V | - | - | - |
| `configuratie:write` | V | - | - | - |
| `workflows:read` | V | V | - | V |
| `workflows:write` | V | V | - | V |
| `documenten:read` | V | V | V | V |
| `documenten:write` | V | V | - | V |
| `mic:read` | V | V | V | V |
| `mic:write` | V | V | - | V |
| `audit:read` | V | - | - | - |
| `tenant:manage` | V | - | - | - |

### Navigatie-permissies
De sidebar in de frontend toont alleen modules waarvoor de gebruiker leesrechten heeft. Dit wordt afgedwongen via `NAV_PERMISSIONS` in `packages/shared-domain/src/roles.ts`.

### Rolbeheer
- Overzicht van medewerkers per rol
- Rol toewijzen of wijzigen (alleen door beheerder)
- Rolwijziging wordt vastgelegd in de auditlog

## Technisch

- **Definitie**: `packages/shared-domain/src/roles.ts`
  - `ROLES` object met de vier rollen en hun permissies
  - `ROUTE_PERMISSIONS` array koppelt API route-patronen + HTTP methoden aan permissies
  - `NAV_PERMISSIONS` object koppelt sidebar-items aan permissies
- **Backend enforcement**: RBAC middleware in `services/ecd/src/middleware/rbac.ts`
  - Leest `X-User-Role` header
  - Matcht het request pad en methode tegen `ROUTE_PERMISSIONS`
  - Retourneert 403 bij onvoldoende rechten
  - Backwards compatible: laat door als geen rol-header aanwezig is
- **Frontend enforcement**: `AppShell.tsx` filtert sidebar-items op basis van `getUserRole()` uit localStorage
  - `ecdFetch()` client redirect automatisch naar `/geen-toegang` bij 403 responses
- **API**: Geen aparte API voor rollenbeheer. Rollen worden beheerd via de medewerkermodule (`PUT /api/medewerkers/:id` met rolwijziging).
- **Permissies**: `medewerkers:write` (voor het wijzigen van rollen)
- **Rollen**: Alleen beheerder kan rollen wijzigen.
