import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  retries: 0,
  use: {
    baseURL: "https://tmmt-command-center.vercel.app",
    headless: true,
  },
});
