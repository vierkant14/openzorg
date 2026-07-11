import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * Golden path: planner (W3-5). De planner logt in met een eigen server-rol
 * (geen demo-rolkeuze) en doorloopt de kern van de planningswerkruimte:
 * het rooster openen met de grid, doorschakelen naar de dagplanning, en de
 * werkbak bereiken via de zij-navigatie. Bewijst dat de planner-IA end-to-end
 * werkt op een echte stack — ook als eerdere tests al planning-data maakten.
 */
test.describe("Golden path: planner", () => {
  test("rooster met grid → dagplanning → werkbak via nav", async ({ page }) => {
    await login(page, TEST_USERS.planner);

    // 1. Rooster opent met de rooster-grid (kop + sticky "Medewerker"-kolom)
    await page.goto("/planning/rooster");
    await expect(page.getByRole("heading", { level: 1, name: "Rooster" })).toBeVisible();
    // De grid rendert een "Medewerker"-kolomkop zodra er medewerkers zijn
    await expect(page.getByText("Medewerker", { exact: true })).toBeVisible({ timeout: 15_000 });

    // 2. Dagplanning — pagina rendert zonder foutmelding (role=alert) of 403
    await page.goto("/planning/dagplanning");
    await expect(page.getByRole("heading", { level: 1, name: "Dagplanning" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/geen-toegang/);
    await expect(page.getByLabel("Medewerker", { exact: true })).toBeVisible();
    // Alleen alerts mét inhoud tellen: Next.js injecteert een lege
    // route-announcer met role="alert" bij client-side navigatie.
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);

    // 3. Werkbak is bereikbaar via de zij-navigatie
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Werkbak" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/werkbak$/);
    await expect(page.getByRole("heading", { name: "Werkbak" })).toBeVisible();
  });
});
