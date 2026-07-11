import { expect, type Page } from "@playwright/test";

export async function login(
  page: Page,
  user: { email: string; password: string },
  opties?: { rol?: string },
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(user.email);
  await page.getByLabel(/wachtwoord/i).fill(user.password);

  // Demo-rolkeuze: enkel terugval voor accounts zonder gekoppelde server-rol.
  // Per-rol accounts (W3) negeren deze keuze — de serverrol wint na login.
  // De parameter blijft bestaan zodat oudere/legacy-aanroepen blijven werken.
  if (opties?.rol) {
    const rolSelect = page.getByLabel(/^Rol \(alleen voor demo-accounts\)/);
    if (await rolSelect.isVisible().catch(() => false)) {
      await rolSelect.selectOption(opties.rol);
    }
  }

  await page.getByRole("button", { name: /inloggen|aanmelden/i }).click();

  // Login slaagt als we van /login wegnavigeren. Pagina's kunnen meerdere
  // nav-elementen hebben (sidebar + bv. "Snelle acties" op het dashboard) —
  // .first() is de sidebar en volstaat als ingelogd-bewijs.
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("navigation").first()).toBeVisible();
}
