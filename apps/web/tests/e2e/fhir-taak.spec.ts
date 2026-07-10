import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * Werkbak-bron 2 (FHIR-taken): vóór W1 gaven "Oppakken"/"Afronden" op deze
 * taken een 500 via alert() — ze routeerden naar de verkeerde engine. Dit
 * bewijst dat een FHIR-taak in de werkbak echt afrondbaar is.
 *
 * De seed maakt bij elk zorgplan een evaluatie-Task aan; er is er dus
 * minstens één. Zo niet, dan slaat de test over met een duidelijke reden.
 */
test("een FHIR-taak is opneembaar en afrondbaar zonder fout", async ({ page }) => {
  await login(page, TEST_USERS.zorgmedewerker, { rol: "zorgmedewerker" });

  await page.goto("/werkbak");
  await expect(page.getByRole("heading", { name: "Werkbak" })).toBeVisible();
  await page.getByRole("tab", { name: /Beschikbaar/ }).click();

  const fhirKaart = page
    .locator("div", { hasText: "Zorgplan-evaluatie" })
    .filter({ has: page.getByRole("button", { name: "Oppakken" }) })
    .last();

  const aanwezig = await fhirKaart.isVisible().catch(() => false);
  test.skip(!aanwezig, "Geen open FHIR-evaluatietaak in de seed-data — niets te bewijzen");

  await fhirKaart.getByRole("button", { name: "Oppakken" }).click();

  // Geen fout-state; taak verschijnt onder Mijn taken
  await page.getByRole("tab", { name: /Mijn taken/ }).click();
  const mijnKaart = page
    .locator("div", { hasText: "Zorgplan-evaluatie" })
    .filter({ has: page.getByRole("button", { name: "Afronden" }) })
    .last();
  await expect(mijnKaart).toBeVisible({ timeout: 15_000 });

  await mijnKaart.getByRole("button", { name: "Afronden" }).click();
  await mijnKaart.getByLabel("Opmerking").fill("Afgerond in e2e");
  await mijnKaart.locator('button[type="submit"]').click();

  await expect(mijnKaart).not.toBeVisible({ timeout: 15_000 });
});
