import { expect, test } from "@playwright/test";

test("homepage redirects naar login wanneer niet ingelogd", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expect(page.getByRole("heading", { name: /welkom terug/i })).toBeVisible();
});
