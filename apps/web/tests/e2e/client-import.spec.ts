import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { TEST_USERS } from "./helpers/test-users";

/**
 * CSV-cliëntimport (W3-1): upload → per-rij-validatie → foutenrapport →
 * geslaagde rijen staan direct in de cliëntenlijst. Dit is de
 * pilotprofiel-belofte "80 cliënten in minuten".
 */
test("beheerder importeert een CSV met één foute rij en ziet een bruikbaar rapport", async ({ page }) => {
  await login(page, TEST_USERS.beheerder);

  const uniek = `Import${Date.now()}`;
  const csv = [
    "achternaam;voornaam;geboortedatum;bsn;straat;huisnummer;postcode;plaats;locatie",
    `${uniek}-Jansen;Piet;1948-03-12;;Dorpsstraat;12;1234 AB;Zorgstad;`,
    `${uniek}-deVries;Anna;1952-11-30;;;;;;`,
    `${uniek}-Fout;Karel;1950-05-05;000000000;;;;;`, // BSN faalt de elfproef
    `${uniek}-Bakker;Jan;1940-01-05;;;;;;`,
  ].join("\n");

  await page.goto("/ecd/import");
  await expect(page.getByRole("heading", { name: "Cliënten importeren" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "import-test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });
  await page.getByRole("button", { name: "Importeren", exact: true }).click();

  // Resultaat: 4 rijen, 3 aangemaakt, 1 fout met rij+veld+melding
  await expect(page.getByText("Aangemaakt")).toBeVisible({ timeout: 20_000 });
  const foutenTabel = page.locator("table");
  await expect(foutenTabel.getByText("elfproef")).toBeVisible();
  await expect(foutenTabel.getByText("4", { exact: true })).toBeVisible(); // foutrij = regel 4

  // Geslaagde import staat in de cliëntenlijst
  await page.goto("/ecd");
  await page.getByPlaceholder(/zoek/i).fill(`${uniek}-Jansen`);
  await expect(page.getByText(`${uniek}-Jansen`).first()).toBeVisible({ timeout: 15_000 });
});
