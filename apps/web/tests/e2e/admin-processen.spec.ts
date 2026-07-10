import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * Processen-hub (W1-4): vier tabs in domeintaal; de Sjablonen-tab toont de
 * vijf zorgpaden uit de catalogus met "Activeren" of een actief-label.
 */
test.describe("Processen-hub", () => {
  test("beheerder ziet de hub met vier tabs en de sjablonen-galerij", async ({ page }) => {
    await login(page, TEST_USERS.zorgmedewerker, { rol: "beheerder" });

    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Processen" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/workflows/);
    await expect(page.getByRole("heading", { name: "Processen" })).toBeVisible();

    for (const tab of ["Actieve zorgpaden", "Sjablonen", "Lopend", "Geavanceerd"]) {
      await expect(page.getByRole("tab", { name: new RegExp(tab) })).toBeVisible();
    }

    // Sjablonen-tab: vijf catalogus-kaarten in domeintaal
    await page.getByRole("tab", { name: /Sjablonen/ }).click();
    await expect(page.getByText("Intake nieuwe cliënt")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Zorgplan-evaluatie").first()).toBeVisible();
    await expect(page.getByText("MIC-afhandeling")).toBeVisible();

    // Elke kaart heeft óf "Activeren" óf een actief-label — nooit "Deployen"
    await expect(page.getByText("Deployen")).toHaveCount(0);

    // Stappen-preview klapt uit in gewone taal
    await page.getByRole("button", { name: /Bekijk stappen/ }).first().click();
    await expect(page.getByText("Aanmelding beoordelen")).toBeVisible();
  });

  test("oude instanties- en voorbeelden-routes verwijzen door naar de hub", async ({ page }) => {
    await login(page, TEST_USERS.zorgmedewerker, { rol: "beheerder" });

    await page.goto("/admin/workflows/instanties");
    await expect(page).toHaveURL(/\/admin\/workflows\?tab=lopend/, { timeout: 15_000 });

    await page.goto("/admin/workflows/voorbeelden");
    await expect(page).toHaveURL(/\/admin\/workflows\?tab=sjablonen/, { timeout: 15_000 });
  });
});
