import { expect, test, type Locator, type Page } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * Het keten-bewijs van W1 (spec §4.5): een zorgpad stroomt van activeren
 * via de automatische trigger naar de werkbak van de juiste rollen, met
 * persoonlijke claims, geconfigureerde formulieren en zichtbare voortgang
 * in de Processen-hub. Vóór W1 was elke schakel hiervan kapot.
 *
 * Zelf-seedend: activeert het intake-zorgpad via de UI en maakt een eigen
 * cliënt aan — geen aparte seed-stap nodig in CI.
 */

const KETEN_ACHTERNAAM = `Ketentest${Date.now()}`;

/**
 * Kaart-locator: alle kaarten (sjablonen, taken, instanties) zijn
 * `div.rounded-xl`-blokken. Op kaartniveau lokaliseren voorkomt dat we in
 * een binnenste flex-div belanden waar de actieknoppen buiten vallen.
 */
function kaart(page: Page, kop: string): Locator {
  return page
    .locator("div.rounded-xl")
    .filter({ has: page.getByRole("heading", { name: kop }) });
}

async function naarWerkbakTab(page: Page, tab: RegExp): Promise<void> {
  await page.goto("/werkbak");
  await expect(page.getByRole("heading", { name: "Werkbak" })).toBeVisible();
  await page.getByRole("tab", { name: tab }).click();
}

test.describe.serial("Proces-keten: intake van activeren tot afronden", () => {
  test("beheerder activeert het intake-zorgpad", async ({ page }) => {
    await login(page, TEST_USERS.zorgmedewerker, { rol: "beheerder" });

    await page.goto("/admin/workflows?tab=sjablonen");
    const intakeKaart = kaart(page, "Intake nieuwe cliënt").first();
    await expect(intakeKaart).toBeVisible({ timeout: 15_000 });

    const activeerKnop = intakeKaart.getByRole("button", { name: /^Activeren/ });
    if (await activeerKnop.isVisible().catch(() => false)) {
      await activeerKnop.click();
    }
    // Na activeren (of als hij al actief was): actief-label op de intake-kaart
    await expect(intakeKaart.getByText(/Actief · v\d+/)).toBeVisible({ timeout: 20_000 });
  });

  test("nieuwe cliënt start automatisch het intake-zorgpad", async ({ page }) => {
    await login(page, TEST_USERS.zorgmedewerker, { rol: "zorgmedewerker" });

    await page.goto("/ecd/nieuw");
    await expect(page.getByRole("heading", { name: /Nieuwe client aanmaken/i })).toBeVisible();

    // FormLabel is niet aan de input gekoppeld — selecteer binnen het veld-blok
    await page.locator('div:has(> label:text-is("Voornaam")) > input').fill("Erik");
    await page.locator('div:has(> label:text-is("Achternaam")) > input').fill(KETEN_ACHTERNAAM);
    await page.locator('div:has(> label:text-is("Geboortedatum")) > input').fill("1948-03-12");

    await page.getByRole("button", { name: /Client aanmaken/ }).click();
    // Aanmaken redirect weg van /ecd/nieuw (naar het dossier of de lijst)
    await expect(page).not.toHaveURL(/\/ecd\/nieuw$/, { timeout: 20_000 });
  });

  test("planner pakt de intake-taak op en keurt goed (geconfigureerd formulier)", async ({ page }) => {
    await login(page, TEST_USERS.zorgmedewerker, { rol: "planner" });

    await naarWerkbakTab(page, /Beschikbaar/);

    const taakKaart = kaart(page, "Aanmelding beoordelen")
      .filter({ hasText: KETEN_ACHTERNAAM })
      .first();
    await expect(taakKaart).toBeVisible({ timeout: 20_000 });
    await expect(taakKaart.getByText("Intake nieuwe cliënt")).toBeVisible();

    await taakKaart.getByRole("button", { name: "Oppakken" }).click();

    // Persoonlijke claim: de taak staat nu onder "Mijn taken", opgepakt door jou
    await naarWerkbakTab(page, /Mijn taken/);
    const mijnKaart = kaart(page, "Aanmelding beoordelen")
      .filter({ hasText: KETEN_ACHTERNAAM })
      .first();
    await expect(mijnKaart).toBeVisible({ timeout: 15_000 });
    await expect(mijnKaart.getByText(/Opgepakt door\s+jou/)).toBeVisible();

    // Afronden met het catalogus-formulier: verplicht Ja/Nee + opmerking
    await mijnKaart.getByRole("button", { name: "Afronden" }).click();
    await mijnKaart.getByRole("button", { name: "Ja", exact: true }).click();
    await mijnKaart.getByLabel("Opmerking").fill("Akkoord — dossier compleet (e2e)");
    await mijnKaart.locator('button[type="submit"]').click();

    // Taak verdwijnt uit Mijn taken
    await expect(mijnKaart).not.toBeVisible({ timeout: 15_000 });
  });

  test("de vervolgstap verschijnt en de hub toont het lopende zorgpad", async ({ page }) => {
    // Beheerder (oversight) ziet zowel de Lopend-tab als Alle taken
    await login(page, TEST_USERS.zorgmedewerker, { rol: "beheerder" });

    await page.goto("/admin/workflows?tab=lopend");
    const instantieKaart = page
      .locator("div.rounded-xl")
      .filter({ hasText: "Intake nieuwe cliënt" })
      .filter({ hasText: "Huidige stap" })
      .first();
    await expect(instantieKaart).toBeVisible({ timeout: 20_000 });
    await expect(instantieKaart.getByText("Intake gesprek plannen")).toBeVisible();
  });

  test("zorgmedewerker rondt de vervolgstap af — zorgpad compleet", async ({ page }) => {
    await login(page, TEST_USERS.zorgmedewerker, { rol: "zorgmedewerker" });

    await naarWerkbakTab(page, /Beschikbaar/);
    const vervolgKaart = kaart(page, "Intake gesprek plannen")
      .filter({ hasText: KETEN_ACHTERNAAM })
      .first();
    await expect(vervolgKaart).toBeVisible({ timeout: 20_000 });

    await vervolgKaart.getByRole("button", { name: "Oppakken" }).click();

    await naarWerkbakTab(page, /Mijn taken/);
    const mijnVervolg = kaart(page, "Intake gesprek plannen")
      .filter({ hasText: KETEN_ACHTERNAAM })
      .first();
    await expect(mijnVervolg).toBeVisible({ timeout: 15_000 });
    await mijnVervolg.getByRole("button", { name: "Afronden" }).click();
    await mijnVervolg.getByLabel("Opmerking").fill("Intake ingepland (e2e)");
    await mijnVervolg.locator('button[type="submit"]').click();
    await expect(mijnVervolg).not.toBeVisible({ timeout: 15_000 });
  });
});
