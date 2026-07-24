/**
 * Template voor een documentatie-run (skill: test-documentatie).
 * Draaien vanuit apps/web:  node <pad-naar-kopie>.mjs
 * Kopieer naar de scratchpad, pas FLOW/BASE/stappen aan.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const BASE = process.env.DOC_BASE_URL ?? "https://ecd.windahelden.nl";
const FLOW = "voorbeeld-flow"; // kebab-case; bepaalt de screenshot-map
const UIT = join(process.cwd(), "..", "..", "docs", "documentatie", "screenshots", FLOW);
mkdirSync(UIT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

let nr = 0;
async function stap(naam, actie) {
  await actie();
  nr += 1;
  const bestand = `${String(nr).padStart(2, "0")}-${naam}.png`;
  await page.screenshot({ path: join(UIT, bestand) });
  console.log(`✓ stap ${nr}: ${naam} -> ${bestand}`);
}

async function login(email, wachtwoord) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/wachtwoord/i).fill(wachtwoord);
  await page.getByRole("button", { name: /inloggen/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 20_000 });
}

// ── Stappen (voorbeeld) ──
await stap("login", async () => {
  await login("beheer@horizon.nl", "Hz!Behr#2026bB3d");
});

await browser.close();
console.log(`Klaar: ${nr} screenshots in ${UIT}`);
