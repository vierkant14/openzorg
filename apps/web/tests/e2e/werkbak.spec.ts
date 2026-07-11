import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * Werkbak (W1-3): de pagina zelf werkt voor elke rol — tabs, states en
 * navigatie. De volledige proces-keten (taak oppakken/afronden) wordt in
 * W1-6 bewezen via proces-keten.spec.ts.
 */
test.describe("Werkbak", () => {
  test("zorgmedewerker bereikt de werkbak via de navigatie en ziet tabs", async ({ page }) => {
    await login(page, TEST_USERS.zorgmedewerker);

    const werkbakLink = page
      .getByRole("navigation")
      .getByRole("link", { name: "Werkbak" })
      .first();
    await expect(werkbakLink).toBeVisible({ timeout: 15_000 });
    await werkbakLink.click();

    await expect(page).toHaveURL(/\/werkbak$/);
    await expect(page.getByRole("heading", { name: "Werkbak" })).toBeVisible();

    // Twee tabs voor een zorgmedewerker (geen "Alle taken")
    await expect(page.getByRole("tab", { name: /Mijn taken/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Beschikbaar/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Alle taken/ })).toHaveCount(0);

    // De inhoud rendert: óf een lege staat, óf taakkaarten — nooit een kale fout
    await expect(
      page
        .getByText(/Geen taken beschikbaar|Je hebt geen openstaande taken|Oppakken/)
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("teamleider ziet de oversight-tab \"Alle taken\"", async ({ page }) => {
    await login(page, TEST_USERS.teamleider);

    await page.goto("/werkbak");
    await expect(page.getByRole("heading", { name: "Werkbak" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Alle taken/ })).toBeVisible();
  });
});
