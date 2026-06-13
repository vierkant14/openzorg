import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test("zorgmedewerker landt op Vandaag met route, taken en overdracht", async ({ page }) => {
  await login(page, TEST_USERS.zorgmedewerker);
  await page.goto("/vandaag");

  // Paginakop (begroeting) + de drie werkgebieden van de werkruimte-start
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mijn route vandaag" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open taken" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overdracht" })).toBeVisible();
});
