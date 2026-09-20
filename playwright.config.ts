import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Load .env.local into the TEST process.
 *
 * Next.js loads .env.local for the app it serves, but a Playwright spec runs in
 * plain Node and never sees it. e2e/internal-ops-fail-closed.spec.ts builds its
 * own Supabase client from NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY, so without this
 * the whole "anonymous cannot read any is_internal_ops-gated table" check dies
 * with "supabaseUrl is required" — a security test that cannot run is not
 * protecting anything.
 *
 * Deliberately hand-parsed rather than using dotenv: dotenv is present in
 * node_modules only as a transitive dependency of something else, and a security
 * check should not silently stop running because an unrelated package dropped it.
 * Existing environment variables always win, so CI can still override.
 */
function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadEnvLocal();

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 0,
  // The audit crawl appends one NDJSON line per route from inside the test
  // process, so it must not run concurrently with itself. Serialising the whole
  // suite keeps that guarantee simple.
  workers: 1,
  use: {
    baseURL: process.env.AUDIT_BASE_URL ?? "http://localhost:3000",
    headless: true,
  },
  projects: [
    // Existing suites keep running as before; `audit` is opt-in via
    // --project=audit so the 106-route crawl never slows an ordinary test run.
    { name: "specs", testIgnore: /audit\.spec\.ts/ },
    { name: "audit", testMatch: /audit\.spec\.ts/ },
  ],
  webServer: {
    command: "npm run dev",
    port: 3000,
    // Stale reused servers skip updated middleware matchers; reuse only when explicitly requested.
    reuseExistingServer: process.env.PW_REUSE_WEB_SERVER === "1",
    timeout: 180000,
  },
});
