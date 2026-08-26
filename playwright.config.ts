import { defineConfig } from "@playwright/test";

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
