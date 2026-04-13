# Q2-Plan 1: Veiligheidsnet en Unraid Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playwright E2E-framework operationeel met één groene golden-path test in CI, Unraid-deploy aantoonbaar stabiel via smoke-script, eerste bug-bash ronde op de ECD-detailpagina afgerond met findings gedocumenteerd.

**Architecture:** Playwright wordt geïnstalleerd in `apps/web` (de Next.js app), tests in `apps/web/tests/e2e/`, draait tegen de bestaande Docker Compose stack. CI krijgt een nieuwe job die de stack opspint, wacht op healthchecks, Playwright draait, en de stack afbreekt. Unraid-smoke is een shell-script dat alle `/health` endpoints poll't.

**Tech Stack:** Playwright (`@playwright/test`), pnpm, Docker Compose v2, GitHub Actions, bestaande Vitest-suite blijft ongemoeid.

**Spec referentie:** `docs/superpowers/specs/2026-04-13-fundering-eerst-design.md` — Q2 werkstroom 1 (bug-bash) en 2 (E2E-tests).

**Branch:** `fundering-eerst` (al actief).

---

## File Structure

**Aan te maken:**
- `apps/web/playwright.config.ts` — Playwright-configuratie
- `apps/web/tests/e2e/.gitkeep` → eigenlijk: `apps/web/tests/e2e/smoke.spec.ts`
- `apps/web/tests/e2e/helpers/auth.ts` — herbruikbare login-helper
- `apps/web/tests/e2e/golden-path-zorgmedewerker.spec.ts` — eerste golden path
- `scripts/unraid-smoke.sh` — health-check script
- `scripts/wait-for-stack.sh` — wacht-tot-healthy helper voor CI
- `docs/superpowers/findings/2026-04-13-ecd-bugbash-1.md` — bug-bash findings document
- `.github/workflows/ci.yml` — uitbreiding met e2e-job

**Te wijzigen:**
- `apps/web/package.json` — Playwright deps + scripts
- `.gitignore` — Playwright artefacten (`test-results/`, `playwright-report/`)
- `README.md` — sectie "End-to-end tests" en "Smoke testing"

---

## Task 1: Playwright installeren en initiële config

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/playwright.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1.1: Playwright installeren in apps/web**

```bash
pnpm --filter @openzorg/web add -D @playwright/test
pnpm --filter @openzorg/web exec playwright install --with-deps chromium
```

Expected: pakket toegevoegd aan `apps/web/package.json` devDependencies, Chromium binary geïnstalleerd.

- [ ] **Step 1.2: `apps/web/playwright.config.ts` aanmaken**

```typescript
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

Reden voor `workers: 1` en `fullyParallel: false`: één gedeelde demo-tenant, parallelle tests zouden elkaars data kunnen overschrijven. Liever traag en betrouwbaar dan snel en flaky.

- [ ] **Step 1.3: `.gitignore` uitbreiden**

Voeg toe aan `.gitignore`:

```
# Playwright
apps/web/test-results/
apps/web/playwright-report/
apps/web/playwright/.cache/
```

- [ ] **Step 1.4: pnpm-script toevoegen**

In `apps/web/package.json` onder `scripts`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed"
```

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/package.json apps/web/playwright.config.ts apps/web/pnpm-lock.yaml pnpm-lock.yaml .gitignore
git commit -m "test(e2e): install Playwright in apps/web met basis-config"
```

---

## Task 2: Eerste smoke-test (homepage laadt)

**Files:**
- Create: `apps/web/tests/e2e/smoke.spec.ts`

- [ ] **Step 2.1: Failing test schrijven**

`apps/web/tests/e2e/smoke.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

test("homepage redirects naar login wanneer niet ingelogd", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /inloggen|login/i })).toBeVisible();
});
```

- [ ] **Step 2.2: Stack draaiend krijgen**

```bash
docker compose -f infra/compose/docker-compose.yml up -d --build
```

Wacht 60-90 seconden voor de stack volledig op is. Verifieer:

```bash
curl -sf http://localhost:3000/api/health
curl -sf http://localhost:4001/health
```

Beide moeten `200 OK` geven. Als dat niet zo is — los dat eerst op voordat je verder gaat. **Een test schrijven tegen een kapotte stack is verspilling.**

- [ ] **Step 2.3: Smoke-test draaien**

```bash
pnpm --filter @openzorg/web test:e2e -- smoke.spec.ts
```

Expected: PASS. Als de redirect-assertion faalt (bijv. omdat `/` niet redirect), pas de assertion aan zodat hij overeenkomt met het *werkelijke* gedrag. Een test moet de waarheid vastleggen, niet je verwachting.

- [ ] **Step 2.4: Commit**

```bash
git add apps/web/tests/e2e/smoke.spec.ts
git commit -m "test(e2e): smoke-test homepage redirect naar login"
```

---

## Task 3: Login-helper bouwen via UI-flow

**Files:**
- Create: `apps/web/tests/e2e/helpers/auth.ts`
- Create: `apps/web/tests/e2e/helpers/test-users.ts`

- [ ] **Step 3.1: Test-users registreren**

`apps/web/tests/e2e/helpers/test-users.ts`:

```typescript
export const TEST_USERS = {
  zorgmedewerker: {
    email: "jan@horizon.nl",
    password: "Hz!J4n#2026pKw8",
    expectedRole: "beheerder", // jan is tenant admin in seed
  },
  tweedeTenant: {
    email: "maria@delinde.nl",
    password: "Ld!M4r1a#2026nRt5",
    expectedRole: "beheerder",
  },
} as const;
```

Deze users worden door `infra/scripts/seed.sh` aangemaakt (zie CLAUDE.md tabel "Test Accounts"). Als de seed niet gedraaid is, falen de tests — dat is correct gedrag, niet een test-bug.

- [ ] **Step 3.2: Login-helper schrijven**

`apps/web/tests/e2e/helpers/auth.ts`:

```typescript
import { expect, type Page } from "@playwright/test";

export async function login(
  page: Page,
  user: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(user.email);
  await page.getByLabel(/wachtwoord/i).fill(user.password);
  await page.getByRole("button", { name: /inloggen|aanmelden/i }).click();

  // Login slaagt als we van /login wegnavigeren
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("navigation")).toBeVisible();
}
```

Reden voor UI-flow boven programmatische token-injectie: tests bewijzen ook dat het login-scherm zelf werkt, niet alleen het achterliggende endpoint. Als login-UI breekt, willen we dat weten.

- [ ] **Step 3.3: Helper-test schrijven**

`apps/web/tests/e2e/auth-helper.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test("login-helper logt zorgmedewerker in en bereikt dashboard", async ({ page }) => {
  await login(page, TEST_USERS.zorgmedewerker);
  await expect(page).toHaveURL(/\/(dashboard|$)/);
});
```

- [ ] **Step 3.4: Test draaien**

```bash
pnpm --filter @openzorg/web test:e2e -- auth-helper.spec.ts
```

Expected: PASS. **Als de selectoren `getByLabel(/e-?mail/i)` of `getByRole("button", { name: /inloggen|aanmelden/i })` falen, kijk in `apps/web/src/app/login/page.tsx` welke labels en buttontekst er werkelijk staan en pas de helper aan.** Niet de pagina aanpassen aan de test.

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/tests/e2e/helpers/ apps/web/tests/e2e/auth-helper.spec.ts
git commit -m "test(e2e): login-helper en test-users registreren"
```

---

## Task 4: Golden-path test — zorgmedewerker

**Files:**
- Create: `apps/web/tests/e2e/golden-path-zorgmedewerker.spec.ts`

Dit is de eerste *echte* end-to-end die de kernflow valideert: login → cliënten openen → eerste cliënt openen → rapportage schrijven → opslaan → verifiëren in lijst.

- [ ] **Step 4.1: Test-skelet schrijven (failing)**

`apps/web/tests/e2e/golden-path-zorgmedewerker.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test.describe("Golden path: zorgmedewerker", () => {
  test("login → client openen → rapportage schrijven → opslaan → zien in lijst", async ({
    page,
  }) => {
    await login(page, TEST_USERS.zorgmedewerker);

    // 1. Naar cliënten-overzicht
    await page.getByRole("link", { name: /cli[eë]nten/i }).first().click();
    await expect(page).toHaveURL(/\/ecd($|\?|\/)/);

    // 2. Eerste cliënt in de lijst openen
    const eersteClient = page.getByRole("link").filter({ hasText: /^C-\d{5}/ }).first();
    await expect(eersteClient).toBeVisible({ timeout: 10_000 });
    await eersteClient.click();
    await expect(page).toHaveURL(/\/ecd\/[^/]+/);

    // 3. Naar rapportages-tab
    await page.getByRole("tab", { name: /rapportages/i }).click();

    // 4. Nieuwe rapportage starten
    const uniekeMarker = `E2E test ${Date.now()}`;
    await page.getByRole("button", { name: /nieuwe rapportage|toevoegen/i }).first().click();
    await page.getByLabel(/tekst|inhoud|rapportage/i).first().fill(uniekeMarker);
    await page.getByRole("button", { name: /opslaan|bewaren/i }).click();

    // 5. Verifiëren dat de rapportage in de lijst staat
    await expect(page.getByText(uniekeMarker)).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 4.2: Test draaien — verwacht falen of slagen**

```bash
pnpm --filter @openzorg/web test:e2e -- golden-path-zorgmedewerker.spec.ts --headed
```

`--headed` zodat je live ziet wat er gebeurt. Eerste run faalt vrijwel zeker op één van de selectoren. **Dit is normaal en de hele reden dat we deze test schrijven** — je ontdekt nu welke aannames over de UI niet kloppen.

- [ ] **Step 4.3: Selectoren itereren tot groen**

Voor elke faalde stap: open `apps/web/src/app/ecd/[id]/page.tsx` (5345 LoC, monster) en de relevante componenten. Vind de werkelijke labels, button-teksten, ARIA-rollen. Pas de selectoren in de test aan.

**Verboden: pas geen page-code aan om de test groen te krijgen.** Als de UI verwarrend is (bijv. een button heet "Voeg toe" niet "Toevoegen") — log dat in de bug-bash van Task 8, maar pas in deze stap alleen de test aan.

Itereer tot de hele test groen draait minstens 3x op rij.

- [ ] **Step 4.4: Test in headless mode draaien**

```bash
pnpm --filter @openzorg/web test:e2e -- golden-path-zorgmedewerker.spec.ts
```

Moet ook groen zijn zonder `--headed`.

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/tests/e2e/golden-path-zorgmedewerker.spec.ts
git commit -m "test(e2e): golden path zorgmedewerker (cliënt → rapportage → opslaan)"
```

---

## Task 5: Wait-for-stack helper voor CI

**Files:**
- Create: `scripts/wait-for-stack.sh`

CI moet de Docker Compose stack opspinnen en wachten tot alle services healthy zijn vóór Playwright start. Een vaste `sleep 90` is onbetrouwbaar.

- [ ] **Step 5.1: Script schrijven**

`scripts/wait-for-stack.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ENDPOINTS=(
  "http://localhost:3000/api/health"
  "http://localhost:4001/health"
  "http://localhost:4002/health"
  "http://localhost:4003/health"
  "http://localhost:4004/health"
)

MAX_WAIT=${MAX_WAIT:-300}
INTERVAL=${INTERVAL:-5}
ELAPSED=0

echo "Wachten tot alle services healthy zijn (max ${MAX_WAIT}s)..."

while [ $ELAPSED -lt $MAX_WAIT ]; do
  ALL_HEALTHY=true
  for endpoint in "${ENDPOINTS[@]}"; do
    if ! curl -sf "$endpoint" > /dev/null 2>&1; then
      ALL_HEALTHY=false
      break
    fi
  done

  if [ "$ALL_HEALTHY" = true ]; then
    echo "Alle services healthy na ${ELAPSED}s."
    exit 0
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  echo "  ${ELAPSED}s verstreken, nog niet alle services healthy..."
done

echo "TIMEOUT: niet alle services werden healthy binnen ${MAX_WAIT}s." >&2
echo "Laatste status:" >&2
for endpoint in "${ENDPOINTS[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" || echo "FAIL")
  echo "  $endpoint → $status" >&2
done
exit 1
```

- [ ] **Step 5.2: Executable maken**

```bash
chmod +x scripts/wait-for-stack.sh
```

- [ ] **Step 5.3: Lokaal testen**

Met de stack draaiend:

```bash
./scripts/wait-for-stack.sh
```

Expected: "Alle services healthy na Xs." Exit code 0.

Stop één service (`docker compose stop ecd`) en draai opnieuw — moet timeout geven met duidelijke error per endpoint.

Herstart:

```bash
docker compose -f infra/compose/docker-compose.yml up -d
./scripts/wait-for-stack.sh
```

- [ ] **Step 5.4: Commit**

```bash
git add scripts/wait-for-stack.sh
git commit -m "ci: wait-for-stack helper poll't alle health-endpoints"
```

---

## Task 6: Unraid smoke-script

**Files:**
- Create: `scripts/unraid-smoke.sh`

Apart van CI moet je *handmatig* tegen de Unraid-box kunnen verifiëren dat alles draait. Dit script gebruikt de Unraid-poorten (1xxxx range) en accepteert een hostname-parameter.

- [ ] **Step 6.1: Script schrijven**

`scripts/unraid-smoke.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

HOST=${1:-192.168.1.10}

ENDPOINTS=(
  "http://${HOST}:13000/api/health|web"
  "http://${HOST}:14001/health|ecd"
  "http://${HOST}:14002/health|planning"
  "http://${HOST}:14003/health|workflow-bridge"
  "http://${HOST}:14004/health|facturatie"
  "http://${HOST}:18103/healthcheck|medplum"
)

echo "Unraid smoke-test tegen ${HOST}"
echo "================================"

FAILED=0
for entry in "${ENDPOINTS[@]}"; do
  url="${entry%%|*}"
  name="${entry##*|}"
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "TIMEOUT")
  if [ "$status" = "200" ]; then
    printf "  ✓ %-20s %s\n" "$name" "$status"
  else
    printf "  ✗ %-20s %s (%s)\n" "$name" "$status" "$url"
    FAILED=$((FAILED + 1))
  fi
done

echo "================================"
if [ $FAILED -eq 0 ]; then
  echo "Alle ${#ENDPOINTS[@]} services healthy."
  exit 0
else
  echo "${FAILED}/${#ENDPOINTS[@]} services niet healthy." >&2
  exit 1
fi
```

- [ ] **Step 6.2: Executable maken**

```bash
chmod +x scripts/unraid-smoke.sh
```

- [ ] **Step 6.3: Tegen Unraid draaien**

```bash
./scripts/unraid-smoke.sh 192.168.1.10
```

Verwacht: alle services groen. **Als services rood zijn, stop met dit plan en los dat eerst op.** Een testable product op Unraid is het hele doel — als de stack daar niet eens draait, heeft de rest geen zin.

Mogelijke fixes als het rood is:
- Stack opnieuw bouwen op Unraid: `docker compose -f docker-compose.unraid.yml up -d --build`
- Logs checken: `docker compose -f docker-compose.unraid.yml logs <service>`
- Healthcheck-config in compose file verifiëren

Documenteer eventuele fixes in commits met prefix `fix(unraid):`.

- [ ] **Step 6.4: README sectie toevoegen**

Voeg toe aan `README.md` (sectie "Deployment" of nieuwe sectie "Smoke testing"):

```markdown
## Smoke testing Unraid

Verifieer in één commando of de Unraid-deploy gezond is:

\`\`\`bash
./scripts/unraid-smoke.sh                   # default host 192.168.1.10
./scripts/unraid-smoke.sh unraid.local       # custom host
\`\`\`

Exit code 0 = alle services healthy. Niet-nul = lijst van wat down is.
```

- [ ] **Step 6.5: Commit**

```bash
git add scripts/unraid-smoke.sh README.md
git commit -m "ops: unraid smoke-script poll't alle service-healthchecks"
```

---

## Task 7: CI-job voor E2E-tests

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 7.1: Bestaande ci.yml lezen**

```bash
cat .github/workflows/ci.yml
```

Noteer de namen van bestaande jobs (lint, typecheck, test, build) zodat je `needs:` correct kunt zetten.

- [ ] **Step 7.2: E2E-job toevoegen**

Voeg onderaan `.github/workflows/ci.yml` een nieuwe job toe (pas `needs:` aan op basis van wat je in 7.1 zag — vermoedelijk `needs: [lint, typecheck, test]`):

```yaml
  e2e:
    name: E2E (Playwright)
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build shared packages
        run: pnpm --filter "@openzorg/shared-*" build

      - name: Start Docker Compose stack
        run: docker compose -f infra/compose/docker-compose.yml up -d --build

      - name: Wait for stack
        run: ./scripts/wait-for-stack.sh
        env:
          MAX_WAIT: 600

      - name: Install Playwright browsers
        run: pnpm --filter @openzorg/web exec playwright install --with-deps chromium

      - name: Run Playwright
        run: pnpm --filter @openzorg/web test:e2e

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 14

      - name: Dump container logs on failure
        if: failure()
        run: docker compose -f infra/compose/docker-compose.yml logs --tail=200

      - name: Tear down stack
        if: always()
        run: docker compose -f infra/compose/docker-compose.yml down -v
```

- [ ] **Step 7.3: Push en CI observeren**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: e2e job draait Playwright tegen volledige stack"
git push -u origin fundering-eerst
```

Open GitHub Actions in browser, kijk of de e2e-job slaagt. Verwacht: eerste poging faalt waarschijnlijk op iets timing- of seed-gerelateerd.

- [ ] **Step 7.4: CI iteratief groen krijgen**

Voor elke faalde run:
1. Lees Playwright-report (download artifact)
2. Lees container-logs uit de "Dump container logs" stap
3. Identificeer of het een test-bug, een race, of een echte regressie is
4. Fix gericht
5. Push opnieuw

**Geef niet op door de test te disablen.** Een groene CI met een gedisabelde test is erger dan een rode CI — je verliest het signaal én gaat het vergeten.

- [ ] **Step 7.5: Eindcommit als CI groen is**

```bash
git commit --allow-empty -m "ci: e2e-pipeline stabiel groen"
git push
```

---

## Task 8: Eerste bug-bash ronde — ECD-detailpagina

**Files:**
- Create: `docs/superpowers/findings/2026-04-13-ecd-bugbash-1.md`

Doel: systematisch de 5345-LoC `apps/web/src/app/ecd/[id]/page.tsx` doorlopen als een echte zorgmedewerker, alle issues vastleggen. *Niet* fixen tijdens deze ronde — fixen komt in Q2-Plan 2 op basis van deze findings.

Reden voor "eerst loggen, later fixen": als je tijdens het doorlopen al gaat fixen, verlies je overzicht en mis je patronen die je over meerdere bugs heen ziet.

- [ ] **Step 8.1: Findings-document aanmaken**

`docs/superpowers/findings/2026-04-13-ecd-bugbash-1.md`:

```markdown
# Bug-bash ronde 1: ECD-detailpagina (zorgmedewerker)

**Datum:** 2026-04-13
**Tester:** Kevin
**Scope:** `apps/web/src/app/ecd/[id]/page.tsx` (5345 LoC) en alle tabs/secties die daaronder vallen
**Rol:** zorgmedewerker (`jan@horizon.nl`)
**Stack:** lokaal Docker Compose, fresh seed
**Methode:** als zorgmedewerker bij Horizon één client volledig doorlopen, elke knop, elk veld, elke tab, elke flow

## Severity-definities

- **P0** — datalek, security-fail, data-corruptie, of de pagina crasht volledig
- **P1** — kernflow blokkeert, knop doet niets, save mislukt zonder feedback
- **P2** — verwarring, slechte UX, verkeerde labels, layout breekt
- **P3** — cosmetisch, typfout, polish

## Findings

### Header / cliënt-meta

(In te vullen tijdens walkthrough)

### Tab: Zorgplan

(In te vullen)

### Tab: Rapportages

(In te vullen)

### Tab: Medicatie

(In te vullen)

### Tab: Vaccinaties

(In te vullen)

### Tab: Allergieën

(In te vullen)

### Tab: MIC-meldingen

(In te vullen)

### Tab: MDO

(In te vullen)

### Tab: Documenten

(In te vullen)

### Tab: Risicoscreening / VBM / Wilsverklaring / overig

(In te vullen)

## Patronen / overstijgende observaties

(In te vullen na de walkthrough — bijv. "knop X heet op 3 plekken anders", "save geeft nergens visuele bevestiging")

## Telling

- P0: 0
- P1: 0
- P2: 0
- P3: 0

## Aanbeveling voor Q2-Plan 2

(In te vullen na walkthrough — welke bugs eerst, welke architectuur-splits dringen zich op)
```

- [ ] **Step 8.2: Walkthrough uitvoeren**

Lokale stack draaiend, fresh seed:

```bash
docker compose -f infra/compose/docker-compose.yml down -v
docker compose -f infra/compose/docker-compose.yml up -d --build
./scripts/wait-for-stack.sh
```

Wacht tot de seed-container klaar is (`docker compose logs seed`). Open `http://localhost:3000`, login als `jan@horizon.nl`, navigeer naar cliënten, open een client (bv. de eerste), en doorloop **elke tab in volgorde**. Voor elke tab:

1. Klik elk knop / elk tabblad / elke link
2. Vul elk formulier in en sla op
3. Probeer een save met lege velden (validatie?)
4. Probeer iets te bewerken en weg te klikken zonder op te slaan (warning?)
5. Refresh de pagina midden in een actie
6. Open de tab in een tweede browser-tab tegelijk

Voor elk issue: log het in het findings-document met:
- Korte beschrijving (1 regel)
- Severity (P0/P1/P2/P3)
- Reproductie-stappen (genummerd, max 5 stappen)
- Verwacht vs werkelijk
- Eventueel een screenshot in `docs/superpowers/findings/screenshots/`

**Geen issue is te klein.** Schrijf alles op. Patronen ontstaan bij volume.

Tijdsbudget: 90-120 minuten in één zit. Pauze breekt de focus en je gaat issues missen.

- [ ] **Step 8.3: Patronen en aanbeveling invullen**

Na de walkthrough: kijk naar je lijst en zoek patronen.
- Welke woorden/labels zijn inconsistent?
- Welk soort UX-probleem komt op meerdere tabs voor?
- Welke tabs zijn duidelijk in elkaar gehackt en welke voelen doordacht?
- Wat zegt dit over de 5345-LoC-monolith — zit er een natuurlijke split-grens?

Vul de "Patronen" en "Aanbeveling voor Q2-Plan 2" secties in.

- [ ] **Step 8.4: Findings committen**

```bash
git add docs/superpowers/findings/
git commit -m "docs(bugbash): ECD-detailpagina ronde 1 — findings"
```

---

## Task 9: Branch-status en handover naar Q2-Plan 2

- [ ] **Step 9.1: Volledige branch pushen**

```bash
git push
```

- [ ] **Step 9.2: PR aanmaken (optioneel, maar aanbevolen)**

```bash
gh pr create --title "Q2-Plan 1: veiligheidsnet en Unraid smoke" --body "$(cat <<'EOF'
## Summary
- Playwright E2E-framework opgezet in apps/web met één golden-path test (zorgmedewerker)
- CI-job draait Playwright tegen volledige Docker Compose stack
- Unraid smoke-script (`scripts/unraid-smoke.sh`) voor handmatige verificatie
- Eerste bug-bash ronde op ECD-detailpagina afgerond, findings vastgelegd

Ref: spec `docs/superpowers/specs/2026-04-13-fundering-eerst-design.md`, plan `docs/superpowers/plans/2026-04-13-q2-plan-1-veiligheidsnet.md`

## Test plan
- [x] `pnpm --filter @openzorg/web test:e2e` lokaal groen
- [x] CI e2e-job groen op deze branch
- [x] `./scripts/unraid-smoke.sh` groen tegen 192.168.1.10
- [x] Findings-document gevuld met minimaal X issues

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9.3: Sign-off**

Aan het einde van dit plan moet het volgende waar zijn:

- ✅ Playwright draait lokaal en in CI met minimaal 1 golden-path test
- ✅ Unraid smoke-script bestaat en geeft groen tegen de werkelijke Unraid-box
- ✅ Findings-document voor ECD-detailpagina is gevuld met issues + patronen + aanbeveling
- ✅ Branch `fundering-eerst` is gepusht, optioneel met open PR
- ✅ Je weet wat er stuk is en hebt een gefundeerde input voor Q2-Plan 2

Als één van bovenstaande nog niet waar is, **stop hier en los het op** voordat we Q2-Plan 2 schrijven. De volgorde is essentieel: zonder findings-document is Plan 2 weer speculatie.

---

## Wat hierna komt

**Q2-Plan 2: Bug-bash module-rondes en fixes** wordt geschreven *op basis van* `docs/superpowers/findings/2026-04-13-ecd-bugbash-1.md`. Per gevonden P0/P1 issue: een Playwright-regressietest die het bug reproduceert, dan de fix, dan groen. Volgorde van modules: ECD (uit deze ronde) → planning → workflow → facturatie. Elke ronde produceert een nieuw findings-document.

**Q2-Plan 3: Multi-tenant security-review en performance baseline** komt parallel of erna, met als input de bestaande `scripts/test-tenant-isolation.mjs` plus de gevonden RBAC-gaps in planning/facturatie.

Beide plannen worden pas geschreven nadat dit plan is afgerond. Niet eerder. Geen speculatieve plannen.
