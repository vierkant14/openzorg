import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * Golden path: beheerder / functioneel beheerder (W3-5). Dekt de inrichtings-
 * kern van de twee beheerder-werkruimtes: de organisatie-werkruimte (de
 * organisatie-boom) en de bouwen-werkruimte (Processen-hub met de sjablonen-
 * galerij en de taakformulieren-catalogus). De sjabloon-kaarten worden op
 * div.rounded-xl-niveau geteld. Slaagt ook op een stack met bestaande data.
 */

/** Sjabloon-kaarten: elke kaart is een div.rounded-xl met een eigen kop (h3). */
function sjabloonKaarten(page: Page) {
  return page
    .locator("div.rounded-xl")
    .filter({ has: page.getByRole("heading", { level: 3 }) });
}

test.describe("Golden path: beheerder", () => {
  test("organisatie-boom → processen-sjablonen → taakformulieren", async ({ page }) => {
    await login(page, TEST_USERS.beheerder);

    // De beheerder heeft twee werkruimtes; de switcher toont Bouwen + Organisatie
    const zijbalk = page.locator("aside");
    await expect(zijbalk.getByRole("link", { name: "Bouwen" })).toBeVisible();
    await expect(zijbalk.getByRole("link", { name: "Organisatie" }).first()).toBeVisible();

    // 1. Organisatie-werkruimte: de organisatie-boom
    await page.goto("/admin/organisatie");
    await expect(page.getByRole("heading", { name: "Organisatie", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Organisatiestructuur" })).toBeVisible();

    // 2. Bouwen → Processen-hub → Sjablonen: de vijf catalogus-kaarten
    await page.goto("/admin/workflows?tab=sjablonen");
    await expect(page.getByRole("heading", { level: 1, name: "Processen" })).toBeVisible();
    await page.getByRole("tab", { name: /Sjablonen/ }).click();
    await expect(page.getByText("Intake nieuwe cliënt")).toBeVisible({ timeout: 15_000 });
    await expect(sjabloonKaarten(page)).toHaveCount(5);

    // 3. Taakformulieren: de catalogus met stappen per zorgpad
    await page.goto("/admin/task-form-options");
    await expect(page.getByRole("heading", { level: 1, name: "Taakformulieren" })).toBeVisible();
    await expect(page.getByLabel("Zorgpad")).toBeVisible({ timeout: 15_000 });
    // De stap-kiezer (aside met "Zorgpad") toont de catalogus-stappen als knoppen
    const stapKnoppen = page.locator("aside").filter({ hasText: "Zorgpad" }).getByRole("button");
    await expect(stapKnoppen.first()).toBeVisible();
  });
});
