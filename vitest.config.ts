import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests run in a plain Node environment — the seeded suites cover pure
// logic (formatting, CSV, auth tiers, mission builder). Component/DOM tests can
// add jsdom + @testing-library later. Playwright E2E lives separately in e2e/.
export default defineConfig({
  test: {
    // Default to node; component tests opt into jsdom via a per-file
    // `// @vitest-environment jsdom` docblock (see *.test.tsx).
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
