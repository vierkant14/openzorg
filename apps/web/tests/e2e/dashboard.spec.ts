import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test("dashboard toont begroeting en degradeert zonder foutmeldingen", async ({ page }) => {
  await login(page, TEST_USERS.teamleider);
  await page.goto("/dashboard");

  // Begroeting op dagdeel — de WelkomKop is de paginakop (h1)
  await expect(
    page.getByRole("heading", { level: 1, name: /Goede(morgen|middag|navond)/ }),
  ).toBeVisible();

  // Snelle acties zijn aanwezig; Werkbak staat er voor elke rol
  await expect(
    page.getByRole("navigation", { name: "Snelle acties" }).getByRole("link", { name: "Werkbak" }),
  ).toBeVisible();

  // Laat de datasecties uitladen en controleer dat nergens een fout staat:
  // secties degraderen stil, dus "Fout" mag niet in beeld komen.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page.getByText(/Fout/)).toHaveCount(0);
});
