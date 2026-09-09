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
    include: ["src/**/*.test.{ts,tsx}", "shared/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    // Array form, and @aixmos/core before @/ — an object alias keyed on "@"
    // does not resolve the workspace package, so any test importing a module
    // that reaches into @aixmos/core failed with "Cannot find package". These
    // mirror the "paths" block in tsconfig.json; keep the two in step.
    alias: [
      {
        find: /^@aixmos\/core$/,
        replacement: fileURLToPath(
          new URL("./packages/aixmos-core/src/index.ts", import.meta.url)
        ),
      },
      {
        find: /^@aixmos\/core\//,
        replacement: fileURLToPath(
          new URL("./packages/aixmos-core/src/", import.meta.url)
        ),
      },
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./src/", import.meta.url)),
      },
      // `server-only` is not an installed package: Next.js aliases it itself —
      // to a throwing stub in the client bundle and to this empty module on the
      // server. Vitest runs in Node (the server side), so it gets the same empty
      // module. Without this, any test that reaches a server module such as
      // src/lib/supabase-service.ts (the one service-role factory, F-14) fails
      // to resolve unless it mocks "server-only" by hand.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(
          new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url)
        ),
      },
    ],
  },
});
