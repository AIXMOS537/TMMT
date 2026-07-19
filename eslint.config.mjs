import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next. Use "**/" prefixes so
  // nested app build output (e.g. aria/.next/**, a separate Next app living
  // inside this repo) is ignored too — flat-config globs are root-relative
  // by default, so ".next/**" alone only matches the repo-root .next dir and
  // silently lets a locally-built nested app's compiled JS get linted,
  // producing thousands of false errors and a false "VERIFY FAILED" that
  // doesn't reproduce in CI (fresh checkout, no nested build present).
  globalIgnores([
    // Default ignores of eslint-config-next:
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
  ]),
  {
    rules: {
      // The `useEffect(load, [])` fetch-on-mount idiom is used intentionally
      // across the admin pages (see CLAUDE.md "Admin Page Pattern") — each such
      // effect calls setState only to populate initial data, the standard React
      // data-loading pattern. This newer React-compiler lint flags it as an
      // error; keep it a warning so it doesn't mask real issues in `npm run lint`.
      "react-hooks/set-state-in-effect": "warn",
      // Standard conventions: a leading underscore marks an intentionally
      // unused binding (args, locals, caught errors), and `ignoreRestSiblings`
      // allows the idiomatic "omit a field via destructuring + ...rest" pattern.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
