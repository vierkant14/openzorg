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

    // 3. Naar Rapportages-tab (custom button, niet role=tab)
    // NB tijdens Plan 2A monolith-split: Unraid draait nog pre-split code
    // met interne tab-button. Na merge+deploy updaten we dit naar
    // page.locator('[role="tablist"]').getByRole("tab", { name: "Rapportages" })
    // + URL assertion /\/ecd\/[^/]+\/rapportages$/
    await page.getByRole("button", { name: "Rapportages", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /^Rapportages/ }),
    ).toBeVisible({ timeout: 10_000 });

    // 4. Nieuwe rapportage-formulier openen
    const uniekeMarker = `E2E_TEST_${Date.now()}`;
    await page.getByRole("button", { name: "Nieuwe rapportage" }).click();

    // Kies type "Vrij" (één textarea, simpelste automatisering)
    await page.getByRole("radio", { name: "Vrij" }).check();

    // Vul het vrije tekstveld (enige textarea in het formulier na Vrij-selectie)
    const tekstVeld = page.locator("form").getByRole("textbox").first();
    await expect(tekstVeld).toBeVisible();
    await tekstVeld.fill(uniekeMarker);

    // Opslaan
    await page.getByRole("button", { name: "Opslaan", exact: true }).click();

    // 5. Verifiëren dat de rapportage in de lijst staat
    // Formulier sluit na succesvol opslaan (showForm = false)
    await expect(
      page.getByRole("button", { name: "Nieuwe rapportage" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(uniekeMarker)).toBeVisible({ timeout: 15_000 });
  });
});
