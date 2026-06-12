import { expect, test } from "@playwright/test";

test("homepage toont publieke landingspagina wanneer niet ingelogd", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
  await expect(
    page.getByRole("heading", { name: /de hele nederlandse zorg/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Inloggen" }),
  ).toBeVisible();
});

test("login-pagina is bereikbaar vanaf de landingspagina", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welkom terug/i })).toBeVisible();
});
