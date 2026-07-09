# AGENTS.md

## Cursor Cloud specific instructions

### What runs here
The **root package `tmmt-app` is the flagship product — TMMT Rentals** (Next.js 16 App Router, port 3000). It is the app you run and test by default. Standard commands live in `package.json` and the README "Quick Start" — don't duplicate them; the relevant ones are `npm run dev`, `npm run build`, `npm run lint`, `npm run test` (Vitest), and `npm run test:e2e` (Playwright, auto-starts the dev server on port 3000).

Secondary, independent apps (only touch them if the task is about them, each has its own deps):
- `apps/engine` — `@aixmos/engine`, port 3001; depends on `packages/aixmos-core` via a `file:` link. `cd apps/engine && npm install`.
- `aria` — Next.js 14 avatar app, port 4200, its own `package-lock.json`. `cd aria && npm install`.

### Non-obvious caveats (read before debugging setup)
- **Supabase is the only hard runtime dependency.** Every other integration (GHL, Stripe, Twilio, Anthropic, ClickUp, Telegram, Slack, Sentry, Airtable) is **fail-open**: a blank env var means that channel is skipped, not an error.
- **`npm install`, `lint`, `test`, and `build` need NO env vars.** The Supabase clients are lazy (`src/lib/supabase*.ts`) and `next build` is deliberately engineered not to require Supabase env, so the CI gate passes without secrets. Only live *data* flows (form submits, admin pages) need Supabase.
- **The repo's `supabase/migrations/*` do NOT create the base 44 tables.** They only `ALTER`/extend already-existing tables (RLS policies, new columns, newer features). The base schema (`incoming_leads`, `fleet`, `appointments`, ...) was created by the one-time Airtable→Supabase migration and is **not** in the repo. Consequences:
  - A fresh `supabase start` will **fail** applying the first RLS migration (`ALTER TABLE incoming_leads ...` on a missing table) and will have no base tables.
  - To exercise data flows locally you must either **point `.env` at the real cloud Supabase project** (three vars in the README / `.env.example`), or **provision the base table(s) you need yourself**. For a quick public-form test, create just the target table (columns come from `src/app/forms/actions.ts`), enable RLS, add the `anon` INSERT policy, and `GRANT insert on <table> to anon` (the RLS policy alone is not enough — the role also needs the table GRANT).
- **`npm run check-env` requires an HTTPS Supabase URL**, so it errors against a local `http://127.0.0.1:54321` stack even though the app itself works fine with that local http URL. Skip `check-env` when using a local stack.
- **`.env` is gitignored** (see `.env.example` / `.env.legacy.example` for the full list of vars) — never commit it.

### Running with data (this environment)
The flagship app is fully runnable in dev mode with a Supabase backend. A local Supabase stack (`supabase start`, needs Docker) works if you first provision the base tables you touch (see caveat above); otherwise put a real cloud project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Public intake forms (`/forms/*`) insert as the `anon` role; admin pages require a logged-in Supabase Auth user.
