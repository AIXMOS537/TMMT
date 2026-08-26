// Signs in once and saves the browser session for the audit crawl.
//
// Credentials come from the environment, never from a file in the repo and
// never from a prompt: set AUDIT_EMAIL and AUDIT_PASSWORD in your shell (or in
// .env.audit.local, which is gitignored) before running. Without them the
// crawler still runs — it just audits the signed-out surface only.
//
//   node scripts/audit-login.mjs

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const STATE = path.join(process.cwd(), "audit", ".auth", "admin.json");

const email = process.env.AUDIT_EMAIL;
const password = process.env.AUDIT_PASSWORD;

if (!email || !password) {
  console.error(
    "AUDIT_EMAIL / AUDIT_PASSWORD not set — skipping the signed-in pass.\n" +
      "The crawl will still audit /login and the 8 public forms."
  );
  process.exit(0);
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');

// The login server action redirects to the dashboard on success and re-renders
// /login with an error on failure, so the URL is the reliable signal.
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});

if (new URL(page.url()).pathname.startsWith("/login")) {
  const banner = await page.locator("div.bg-red-50").first().textContent().catch(() => null);
  console.error(`Login failed — still on /login.${banner ? ` Page said: ${banner.trim()}` : ""}`);
  await browser.close();
  process.exit(1);
}

fs.mkdirSync(path.dirname(STATE), { recursive: true });
await context.storageState({ path: STATE });
await browser.close();

console.log(`Signed in as ${email}. Session saved to audit/.auth/admin.json`);
