import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test("login-helper logt zorgmedewerker in en bereikt de werkruimte-start", async ({ page }) => {
  await login(page, TEST_USERS.zorgmedewerker);
  // Zorgmedewerker landt na inloggen op de werkruimte 'Vandaag'.
  await expect(page).toHaveURL(/\/vandaag(\/|\?|$)/);
});

test("account met gekoppelde server-rol toont geen demo-rol-markering", async ({ page }) => {
  // zorg@horizon.nl heeft een echte rol-extensie (zorgmedewerker) uit de seed.
  // De serverrol wint van de demo-rolkeuze, dus het gebruikersblok toont
  // GEEN 'demo-rol'-label en de startpagina is /vandaag.
  await login(page, TEST_USERS.zorgmedewerker);
  await expect(page).toHaveURL(/\/vandaag(\/|\?|$)/);
  await expect(page.getByText("demo-rol")).toHaveCount(0);
});
