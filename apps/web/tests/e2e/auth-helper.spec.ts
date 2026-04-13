import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

test("login-helper logt zorgmedewerker in en bereikt dashboard", async ({ page }) => {
  await login(page, TEST_USERS.zorgmedewerker);
  await expect(page).toHaveURL(/\/(dashboard|$)/);
});
