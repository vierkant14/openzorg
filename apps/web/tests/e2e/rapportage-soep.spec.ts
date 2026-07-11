import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * Lockt de extensie-op-url-fix vast: een SOEP-rapportage met ALLEEN Objectief
 * en Plan ingevuld moet die velden onder de juiste labels (O en P) tonen, niet
 * verschoven naar S/O. Subjectief en Evaluatie blijven leeg.
 */
test.describe("Rapportage: partiële SOEP", () => {
  test("SOEP met alleen O en P → juiste velden onder O en P", async ({ page }) => {
    await login(page, TEST_USERS.zorgmedewerker);

    // 1. Naar cliënten-overzicht via sidebar
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /cli[eë]nten/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/ecd(\/|\?|$)/);

    // 2. Eerste cliënt-detaillink openen
    const clientLink = page
      .locator('a[href^="/ecd/"]:not([href="/ecd/nieuw"]):not([href="/ecd/import"]):not([href="/ecd"])')
      .first();
    await expect(clientLink).toBeVisible({ timeout: 15_000 });
    await clientLink.click();
    await expect(page).toHaveURL(/\/ecd\/[^/]+$/, { timeout: 15_000 });

    // 3. Naar werkgebied "Rapportage" (één sub-tab → direct naar /rapportages)
    await page
      .locator('[role="tablist"]')
      .getByRole("tab", { name: "Rapportage", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ecd\/[^/]+\/rapportages$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /^Rapportages/ })).toBeVisible({
      timeout: 10_000,
    });

    // 4. SOEP-rapportage met alleen Objectief en Plan
    const stamp = Date.now();
    const objectiefMarker = `E2E_SOEP_O_${stamp}`;
    const planMarker = `E2E_SOEP_P_${stamp}`;

    // De composer is persistent zichtbaar; kies type "SOEP"
    await page.getByRole("radio", { name: "SOEP" }).check();

    // Vul ALLEEN Objectief en Plan via de gekoppelde labels
    await page.getByLabel("Objectief", { exact: true }).fill(objectiefMarker);
    await page.getByLabel("Plan", { exact: true }).fill(planMarker);

    await page.getByRole("button", { name: "Opslaan", exact: true }).click();

    // 5. Beide markers staan in de lijst
    const objectiefCel = page.getByText(objectiefMarker);
    const planCel = page.getByText(planMarker);
    await expect(objectiefCel).toBeVisible({ timeout: 15_000 });
    await expect(planCel).toBeVisible({ timeout: 15_000 });

    // 6. Het Objectief-veld staat onder label "O", het Plan-veld onder "P".
    // Elk item is een <div> met een <dt> (afkorting) gevolgd door een <dd>
    // met de tekst. We lopen vanaf de tekst-cel terug naar de rij-<div> en
    // controleren de bijbehorende <dt>.
    const objectiefRij = objectiefCel.locator("xpath=ancestor::div[1]");
    await expect(objectiefRij.locator("dt")).toHaveText("O");

    const planRij = planCel.locator("xpath=ancestor::div[1]");
    await expect(planRij.locator("dt")).toHaveText("P");

    // 7. Negatieve check: er mag geen "S"-cel verschenen zijn voor deze rapportage
    // (Subjectief was leeg). De Objectief-rij is dus de eerste rij van het item.
    const itemDl = objectiefRij.locator("xpath=ancestor::dl[1]");
    await expect(itemDl.locator("dt", { hasText: /^S$/ })).toHaveCount(0);
  });
});
