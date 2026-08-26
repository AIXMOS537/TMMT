# TMMT — Audit Harness

How to make an agent (or a person) walk the whole app, watch what breaks, and
hand back a numbered fix queue. Built 2026-08-25.

## The one command

```bash
npm run audit
```

That is three stages, and each is runnable on its own:

| Stage | Command | What it does |
|---|---|---|
| Sign in | `npm run audit:login` | Logs in once with `AUDIT_EMAIL` / `AUDIT_PASSWORD`, saves the session to `audit/.auth/admin.json`. Skips itself (exit 0) when those vars are unset. |
| Crawl | `npm run audit:crawl` | Drives a real Chromium through **every route in `src/app`**, watching console, network, and the rendered DOM. |
| Report | `npm run audit:report` | Turns the raw records into `audit/FINDINGS.md`, grouped and ranked. |

Static gates are separate and much faster — run them first:

```bash
npm run audit:static
```

That is `typecheck` → `lint` → `build`. Build is the release gate; lint is
advisory but currently red (see below).

## Credentials

The signed-in pass needs a **staff** login. Set them in your own shell — they
are never read from a file in the repo:

```bash
export AUDIT_EMAIL='you@example.com'
export AUDIT_PASSWORD='...'
npm run audit
```

On PowerShell:

```bash
$env:AUDIT_EMAIL='you@example.com'; $env:AUDIT_PASSWORD='...'; npm run audit
```

Without them the crawl still runs and still finds things — it just covers
`/login` and the 8 public forms rather than the 23 protected pages.

**The account must pass `is_staff()`** — see finding 3 in the register. A
`customer` / `client` profile signs in fine and then sees every admin page
empty, which looks like a broken app and is actually a role problem.

## What the crawler checks, per route

| Check | Severity | Meaning |
|---|---|---|
| Uncaught exception | 🔴 blocker | React tree threw; user sees a blank page or error boundary. |
| Signed-in crawl bounced to `/login` | 🔴 blocker | Session did not hold. |
| Public route redirected to `/login` | 🔴 blocker | Customers cannot reach a form. |
| HTTP ≥ 500 | 🔴 blocker | Server error. |
| Console error | 🟠 broken | Something failed loudly enough to log. |
| Supabase REST 4xx | 🟠 broken | Page rendered, data did not arrive. |
| Visible `ErrorBanner` | 🟠 broken | The app's own failure surface is showing. |
| Spinner still up after network idle | 🟠 broken | Fetch never settled — stuck, not slow. |
| No `<h1>` | 🟡 warning | Screen-reader and SEO structure. |
| Empty table | ⚪ info | Rendered with no rows — expected on genuinely empty tables. |

Only **blockers** fail the run. A survey that aborts on route 1 tells you
nothing, so everything else is recorded and reported.

## Outputs

```
audit/FINDINGS.md      ← the deliverable. Numbered fix queue, most severe first.
audit/screens/         ← full-page screenshot per route, anon- and authed- prefixed
audit/results/*.ndjson ← raw per-route records
```

Everything but `FINDINGS.md` is gitignored — screenshots and session cookies are
artifacts of a run, not source.

## The route list maintains itself

`e2e/audit/routes.ts` walks `src/app` for `page.tsx` at run time. Add a page,
it gets audited on the next run. Route groups (`(admin)`, `(auth)`) contribute
no URL segment and are stripped; dynamic segments (`[id]`) are skipped because
a made-up param produces a 404 that is noise, not a finding.

## Known trap: dev has no auth gate

`middleware.ts` **does not execute under `next dev`** on Next.js 16.1.6 — proven
by an unconditional redirect at the top of the middleware failing to fire, and
by the probe header never reaching the client. `next build && next start`
redirects correctly (307 → `/login`).

Consequences while this is unfixed:

- Every admin page is reachable signed-out in dev. RLS still protects the data,
  so pages render but come back empty with `permission denied` — **that is the
  gate failing, not the database**.
- The form rate limiter is dead in dev too.
- `e2e/smoke.spec.ts` "unauthenticated user is redirected to login" fails
  against dev and passes against a production build.

So: **judge auth behaviour against `npm run build && npm run start`, never
against `npm run dev`.**

## Using this from an agent

Point Claude Code at the repo and give it the loop:

1. `npm run audit:static` — cheap, deterministic, catches type and build breaks.
2. `npm run audit` — the live crawl.
3. Read `audit/FINDINGS.md`, take item 1, fix it, re-run, confirm the count drops.
4. Commit one finding per commit.

Useful built-ins alongside it:

- `/code-review` — reviews the working diff for correctness and cleanup.
  `/code-review ultra` runs a deeper multi-agent review in the cloud.
- `/security-review` — security-focused pass.
- Supabase MCP — `execute_sql` and `get_advisors` answer schema and RLS
  questions the browser cannot see. Several findings in the register were only
  provable that way.

The crawler sees symptoms; the database and the source explain them. A finding
is not finished until you have both.
