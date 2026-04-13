import { expect, type Page } from "@playwright/test";

export async function login(
  page: Page,
  user: { email: string; password: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(user.email);
  await page.getByLabel(/wachtwoord/i).fill(user.password);
  await page.getByRole("button", { name: /inloggen|aanmelden/i }).click();

  // Login slaagt als we van /login wegnavigeren
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("navigation")).toBeVisible();
}
