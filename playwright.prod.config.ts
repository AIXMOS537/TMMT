import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.SMOKE_BASE_URL ?? "https://tmmt-ops.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL,
    headless: true,
  },
});
