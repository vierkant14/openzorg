import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * Golden path: teamleider (W3-5). Dekt de monitoring-kern: de dashboard-
 * begroeting, een MIC-melding aanmaken via het bestaande formulier, en de
 * oversight-tab "Alle taken" in de werkbak. De melding krijgt een uniek
 * kenmerk (Date.now) zodat de test ook slaagt op een stack waar al eerdere
 * MIC-meldingen bestaan.
 */

/**
 * Levert een betrouwbare zoekterm voor de MIC-cliëntkiezer: leest de eerste
 * cliënt uit de lijst en neemt het eerste naam-token (voornaam) — dat matcht
 * de Medplum-naamzoekopdracht.
 */
async function eersteClientZoekterm(page: Page): Promise<string> {
  await page.goto("/ecd");
  const clientLink = page
    .locator('a[href^="/ecd/"]:not([href="/ecd/nieuw"]):not([href="/ecd/import"]):not([href="/ecd"])')
    .first();
  await expect(clientLink).toBeVisible({ timeout: 15_000 });
  const naam = (await clientLink.innerText()).trim();
  return naam.split(/\s+/)[0] ?? naam;
}

/**
 * Herlaad-poll (patroon uit proces-keten.spec.ts): de AuditEvent-index kan kort
 * naijlen en de MIC-lijst laadt eenmalig bij mount. Herlaad tot het kenmerk in
 * beeld staat (max ~12s).
 */
async function verschijntInLijst(page: Page, kenmerk: string): Promise<void> {
  for (let poging = 0; poging < 6; poging++) {
    if (await page.getByText(kenmerk).first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(2000);
    await page.goto("/mic-meldingen");
  }
  await expect(page.getByText(kenmerk).first()).toBeVisible();
}

test.describe("Golden path: teamleider", () => {
  test("dashboard-begroeting → MIC-melding aanmaken → werkbak alle taken", async ({ page }) => {
    await login(page, TEST_USERS.teamleider);

    // 1. Dashboard toont een begroeting op dagdeel
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { level: 1, name: /Goede(morgen|middag|navond)/ }),
    ).toBeVisible();

    const zoekterm = await eersteClientZoekterm(page);

    // 2. MIC-meldingen: nieuw formulier openen
    await page.goto("/mic-meldingen");
    await expect(page.getByRole("heading", { name: "MIC-meldingen overzicht" })).toBeVisible();
    await page.getByRole("button", { name: /Nieuwe melding/ }).click();
    await expect(page.getByRole("heading", { name: "Nieuwe MIC-melding" })).toBeVisible();

    // Cliënt kiezen (verplicht veld): zoeken en de eerste treffer selecteren
    await page.getByPlaceholder("Zoek op naam...").fill(zoekterm);
    const eersteTreffer = page.locator("ul li button").first();
    await expect(eersteTreffer).toBeVisible({ timeout: 15_000 });
    await eersteTreffer.click();
    await expect(page.getByRole("button", { name: "Wijzig" })).toBeVisible();

    // Beschrijving (verplicht) met uniek kenmerk
    const kenmerk = `MIC-E2E-${Date.now()}`;
    await page.getByPlaceholder("Beschrijf het incident...").fill(kenmerk);

    await page.getByRole("button", { name: /Melding opslaan/ }).click();

    // 3. De melding verschijnt in de lijst
    await verschijntInLijst(page, kenmerk);

    // 4. Werkbak: de oversight-tab "Alle taken" is zichtbaar voor de teamleider
    await page.goto("/werkbak");
    await expect(page.getByRole("heading", { name: "Werkbak" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Alle taken/ })).toBeVisible();
  });
});
