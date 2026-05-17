import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    // Stale reused servers skip updated middleware matchers; reuse only when explicitly requested.
    reuseExistingServer: process.env.PW_REUSE_WEB_SERVER === "1",
  },
});
