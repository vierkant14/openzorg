import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test("login-helper logt zorgmedewerker in en bereikt de werkruimte-start", async ({ page }) => {
  await login(page, TEST_USERS.zorgmedewerker);
  // Zorgmedewerker landt na inloggen op de werkruimte 'Vandaag'.
  await expect(page).toHaveURL(/\/vandaag(\/|\?|$)/);
});
