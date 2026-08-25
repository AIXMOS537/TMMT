# AGENTS.md — TMMT / AIXMOS

## Learned User Preferences
- Dual agentic Macs (Carry + M1) are always brain-connected; never ask Taha to re-explain YTD context that lives in vault, BRAIN-FEED, AGENTS.md, or CEO-BRIEF-TODAY — pick up mid-task from FLEET-INBOX/digests.
- Margarita mode: Taha markets, records, lives, taps gates; overseas VAs and operators run scoped desks; army loops use cc/oc only (never Desktop Max/fable).
- Continuity canon: `~/Brain/vault/00-Dashboard/MARGARITA-MODE-FOREVER.md` · `EMPIRE-MESH-OS-FOREVER.md`.


- Muhammad Taha operates in ZERO-HUMAN mode permanently: never ask him to type suggestions, opinions, or clarifications; never present multiple-choice menus unless a legal/money/signature gate requires an explicit tap.
- Taha's only job is market, record videos, and live life — the army does everything else.
- Route all code work to M1 (Rick); Carry handles owner gates only.
- Prefer local-first AI (Ollama/Brainiac) before any paid API.
- Chain of Trust: draft never send · track never pay · stage never sign.
- Surface ONLY owner gates on Desktop `★ OWNER-GATES-ONLY.txt` — nothing else needs Taha.
- When Taha says "go" or anything emotional/frustrated/blank: run go-zero-human logic — sync, dispatch army, hammer agents, report status, move to next P0. No questions.
- Ultimate Lazy OS canon: `~/Brain/vault/00-Dashboard/ULTIMATE-LAZY-OS.md` — plugins teach the army; Taha only says `go`, records, markets, taps gates.

## Learned Workspace Facts

- Chain of command: Taha → Carry (Watchtower) → M1 Rick (execute) → Brainiac-7 (Gateway) → Office Forge.
- Devices: Carry M5 · M1 Max · Brainiac-7 · Office PCs · Family VIP · AIXMOS public (no vault).
- Continual Learning plugin mines transcripts into this file (`## Learned User Preferences` / `## Learned Workspace Facts`).
- Cursor SDK (`@cursor/sdk`) is available for programmatic agents (cron/CI/webhook) — never prod-deploy without Owner Seal.
- HyperFrames local plugin: HTML → MP4 content factory; drafts only, never auto-post.
- ChatPRD + Forge: spec → implement → work order → PR without Taha writing tickets.
- Cloud agents: repo `AIXMOS537/TMMT`; self-hosted worker `macbook-pro-3`; secrets staged at `~/.config/tmmt/cursor-cloud-agent.env`.
- Owner gates only: money · legal/contracts · prod deploy · master keys · live customer send · sovereignty flags.

## Cursor Cloud specific instructions

Cloud agents run on **AIXMOS537/TMMT** (Next.js 15, Supabase, GHL webhooks).

### Bootstrap (first run on a fresh VM)

1. `npm install` (Node 22 / npm 10; the update script runs this automatically).
2. `npm run lint`, `npm run test`, `npm run build`, and `npm run dev` all work with only **placeholder** Supabase values in `.env.local` — no real secrets needed for dev-readiness. The Supabase client is instantiated lazily, so the build never crashes on missing env; only DB-backed request paths fail at runtime.
3. Real end-to-end (login, admin pages, public form writes) needs real Supabase secrets set in **Dashboard → Cloud Agents → Environments → TMMT → Secrets** (or self-hosted worker `macbook-pro-3` reading local `.env.local`). `npm run check-env` only passes against a **reachable** Supabase, so it fails with placeholders — expected.

### Environment notes (verified 2026-07-09)

- **Environment is repo-managed** via `.cursor/environment.json` (highest priority — overrides the dashboard/snapshot wizard). Its `install` command (the dashboard "update script" equivalent) is idempotent and safe whether an agent is bound to TMMT directly (installs `.`) or a multi-repo root (installs each `repos/*`). Bind cloud-agent environments to **`aixmos537/TMMT`**; environment names must be lowercase slugs (no spaces), e.g. `project-x-hailmary`.

- **Backend is remote Supabase.** The base table schema (`fleet`, `incoming_leads`, `customers`, …) is NOT in `supabase/migrations/` — those migrations only add RLS/partner/workflow objects on top of an out-of-repo Airtable-origin schema. So `supabase start` (local stack) would fail applying migrations against tables that don't exist. Don't rely on local Supabase; use real remote secrets for DB flows.
- **No-backend smoke:** `GET /api/health` → `{ok:true}` and the public **`/try`** page (a 100% client-side scripted engine demo — no Supabase/keys) both work with placeholder env; good for confirming the dev server renders and is interactive.
- `build` uses **webpack** (`next build --webpack`); `dev` uses Turbopack.
- The `scripts/credit-engine-smoke.sh` / `scripts/credit-engine-az.sh` referenced below are **not present** in the current repo — guard for their existence before running.

### Dev server

```bash
npm run dev
# http://localhost:3000
```

### Verify before PR

```bash
npm run lint
npm run test
npm run build
```

### Credit engine (workstream 2)

- Import smoke: `bash scripts/credit-engine-smoke.sh`
- Full A–Z: `bash scripts/credit-engine-az.sh`
- Compliance: credit/funding is **guidance only** — never auto-send dispute letters; owner-approval gate required for outbound.

### Do not

- Commit `.env`, `.env.local`, or paste secrets into git.
- Enable CROA-gated features or remove compliance gates.
- `git push --no-verify` past secret scanners.
- Deploy to production without owner approval.

### Self-hosted (Rick / Carry)

When triggered with `worker=macbook-pro-3`, tool calls run on the mesh Mac; local Ollama at `OLLAMA_URL` is preferred for PII paths.

## Mixpanel analytics

TMMT uses **Mixpanel** (`mixpanel-browser`) for product analytics. Sentry remains error monitoring only.

| Item | Location |
|------|----------|
| SDK init + helpers | `src/lib/analytics.ts` |
| Provider (auth identity, UTM) | `src/components/AnalyticsProvider.tsx` (mounted in `src/app/layout.tsx`) |
| Token env var | `NEXT_PUBLIC_MIXPANEL_TOKEN` in `.env.local` / Vercel |

Init options match Mixpanel dashboard snippet: **`autocapture: true`** (clicks, page views, rage clicks) and **`record_sessions_percent: 100`** (session replay). Uses `mixpanel-browser` npm package — not the CDN `<script>` tag — so the token stays in env vars.

### Identity

- `identify(user.id)` + `people.set()` on Supabase `SIGNED_IN` and session restore
- `reset()` on `SIGNED_OUT`
- No self-serve signup — use `user_signed_in` (not `sign_up_completed`)

### Core events (Quick Start)

| Event | When |
|-------|------|
| `user_signed_in` | Supabase auth `SIGNED_IN` |
| `lead_intake_submitted` | Lead intake form success (`/forms/lead-intake`) |
| Autocapture events | `$mp_click`, page views, etc. (via `autocapture: true`) |

### Adding events

Use `trackEvent(name, properties)` from `@/lib/analytics`. Event names: `snake_case`. Register super properties with `registerAttribution()` for UTMs. For server actions, prefer client-side tracking on form success or add server-side HTTP API later.

### CSP

`next.config.ts` allows `https://cdn.mxpnl.com` in `script-src` (session recorder) and `https://api.mixpanel.com` / `https://api-js.mixpanel.com` in `connect-src`.

