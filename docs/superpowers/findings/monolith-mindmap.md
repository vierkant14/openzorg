# Monolith mindmap — apps/web/src/app/ecd/[id]/page.tsx (5345 LoC)

Werkblad voor Task 2/3/4 — wordt aan einde van Task 4 verwijderd.

## Default export: `ClientDetailPage` (regel 205)

Top-level state:
- `client: ClientResource | null` — gefetcht via `ecdFetch('/api/clients/:id')`
- `loading: boolean`
- `error: string | null`
- `activeTab: TabKey` — interne tab-router, default `"dashboard"`
- `editing: boolean` — toggle voor `ClientEditForm`
- `loadClient` — useCallback wrapper

`ecdFetch<T>` returns `{ data, error, status }` (NIET een Response). Belangrijk voor layout.tsx.

## Wat is GLOBAAL (hoort in layout.tsx)

- Client-fetch (`ecdFetch('/api/clients/:id')`)
- Loading / error UI voor client-fetch
- Tab-router state — wordt vervangen door URL-based routing (`/ecd/[id]/{slug}`)
- Profile header rendering (`ClientHeader`)
- Tab-navigatie (`TabNav`)
- Wrapping `AppShell`

## Wat is TAB-SPECIFIEK (blijft in tab-page.tsx na Task 3/4)

Elke `*Tab` component (regels 781..5104) heeft eigen `useState`/`useEffect`/fetches voor zijn eigen FHIR-resources. Allemaal nemen `clientId: string` als prop. Sommigen (Dashboard, ExtraVelden) krijgen ook `client: ClientResource`.

## Gedeelde helpers/types (regel 14-200)

Gebruikt door MEERDERE tabs — moet naar een gedeelde module (bijv. `apps/web/src/app/ecd/[id]/_lib/`):

- Types: `FhirBundle<T>`, `FhirObservation`, `FhirRelatedPerson`, `FhirCarePlan`, `FhirDocumentReference`, `ClientResource`, `FhirGoal`, `FhirServiceRequest`, `FhirMedicationRequest`, `CustomFieldDef`
- Helpers: `formatDate`, `formatDateTime`, `clientNaam`, `clientBsn`, `geslachtLabel`

In Task 2 bewust niet verplaatst — `ClientHeader.tsx` heeft eigen kopie van het minimum (clientNaam, clientBsn, geslachtLabel, formatDate). De monolith blijft z'n eigen kopie houden tot Task 3/4.

## Navigatie-logica

Huidige monolith (regel 442-458): `<nav>` met 17 `<button>`s, elk `onClick={() => setActiveTab(tab.key)}`, actieve state via `border-brand-700 text-brand-700`.

Geen `role="tab"` / `aria-selected` — dit is bugbash P2 dat in Task 2 wordt opgelost via `TabNav.tsx`.

Tab-rendering (regel 461-480): één grote ladder van `{activeTab === "x" && <XTab clientId={id} />}`.

## Tab-key mapping (oud → nieuw slug)

Oude `TabKey` (regel 119) wijkt af van Plan 2A slugs:

| Oude TabKey | Nieuwe slug | Component |
|-------------|-------------|-----------|
| dashboard | dashboard | DashboardTab |
| rapportages | rapportages | RapportagesTab |
| zorgplan | zorgplan | ZorgplanTab |
| contactpersonen | contactpersonen | ContactpersonenTab |
| medicatie | medicatie | MedicatieTab |
| allergieen | allergieen | AllergieenTab |
| vaccinaties | vaccinaties | VaccinatiesTab |
| diagnoses | diagnoses | DiagnosesTab |
| risicoscreenings | **risicoscreening** | RisicoscreeningsTab |
| toediening | toediening | ToedieningTab |
| vragenlijsten | vragenlijsten | VragenlijstenTab |
| mdo | mdo | MdoTab |
| vbm | vbm | VbmTab |
| wilsverklaringen | wilsverklaringen | WilsverklaringenTab |
| medicatie-overzicht | medicatie-overzicht | MedicatieOverzichtTab |
| documenten | documenten | DocumentenTab |
| extra | **extra-velden** | ExtraVeldenTab |

## Andere componenten in de file

Naast 17 *Tab componenten zijn er helpers die ook moeten verhuizen of blijven:
- `PageShell` (regel 490) — wrap in AppShell. Layout.tsx vervangt dit voor sub-routes.
- `ClientEditForm` — used in editing flow. Blijft bij ClientHeader/page.tsx tot Task 3/4.
- `SignaleringenBanner` (regel 439) — globaal boven tabs. In Task 3/4 mogelijk naar layout.tsx.

## Task 2 resultaat

Op `/ecd/C-00001` (base) is GEEN gedragswijziging — de layout.tsx detecteert dat er geen sub-segment is en rendert alleen `{children}`. De oude monolith (page.tsx) draait dan ongewijzigd, met eigen AppShell + header + tab-state.

Op `/ecd/C-00001/{slug}` rendert layout.tsx wel: AppShell + ClientHeader + TabNav + stub-content.
