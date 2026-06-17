import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test.describe("Golden path: zorgmedewerker", () => {
  test("login → client openen → rapportage schrijven → opslaan → zien in lijst", async ({
    page,
  }) => {
    await login(page, TEST_USERS.zorgmedewerker);

    // 1. Naar cliënten-overzicht via sidebar
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /cli[eë]nten/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/ecd(\/|\?|$)/);

    // 2. Eerste cliënt-detaillink openen — match FHIR-id pad /ecd/<uuid>
    // Exclude /ecd/nieuw and de sidebar-link /ecd
    const clientLink = page
      .locator('a[href^="/ecd/"]:not([href="/ecd/nieuw"]):not([href="/ecd"])')
      .first();
    await expect(clientLink).toBeVisible({ timeout: 15_000 });
    await clientLink.click();
    await expect(page).toHaveURL(/\/ecd\/[^/]+$/, { timeout: 15_000 });

    // 3. Naar werkgebied "Rapportage" (TabNav: 5 werkgebieden; Rapportage heeft
    //    één sub-tab dus klikken gaat direct naar /rapportages)
    await page
      .locator('[role="tablist"]')
      .getByRole("tab", { name: "Rapportage", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ecd\/[^/]+\/rapportages$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: /^Rapportages/ }),
    ).toBeVisible({ timeout: 10_000 });

    // 4. De composer staat persistent bovenaan (geen "Nieuwe rapportage"-knop meer)
    const uniekeMarker = `E2E_TEST_${Date.now()}`;

    // Kies type "Vrij" (één textarea, simpelste automatisering)
    await page.getByRole("radio", { name: "Vrij" }).check();

    // Vul het vrije tekstveld via het gekoppelde label
    const tekstVeld = page.getByLabel("Rapportage", { exact: true });
    await expect(tekstVeld).toBeVisible();
    await tekstVeld.fill(uniekeMarker);

    // Opslaan
    await page.getByRole("button", { name: "Opslaan", exact: true }).click();

    // 5. Verifiëren dat de rapportage in de lijst verschijnt
    await expect(page.getByText(uniekeMarker)).toBeVisible({ timeout: 15_000 });
  });
});
