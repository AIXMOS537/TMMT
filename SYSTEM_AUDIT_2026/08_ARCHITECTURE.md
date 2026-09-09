# 08 · ARCHITECTURE

## Stack (current, modern)
Next.js **16.2.11** App Router · React **19.2.4** · TypeScript 5 · Tailwind 4 · Supabase (`@supabase/ssr` 0.9) · Zod 4 · Sentry · Mixpanel · Stripe 22 · Twilio 6 · `@anthropic-ai/sdk` 0.104 · Leaflet · Recharts · Vitest 3 · Playwright 1.58

No legacy debt in the dependency set. This is a current, well-chosen stack.

## Layer map
```
┌─ EDGE ─────────────────────────────────────────────────┐
│ middleware.ts (272 lines)                              │
│  · public-path allowlists (3 overlapping functions)    │
│  · Supabase session check                              │
│  · role→tier→home-path routing (lib/auth-roles)        │
│  · host-based tenant resolution (lib/platform/*)       │
│  · rate limiting (lib/rate-limit)                      │
└────────────────────────────────────────────────────────┘
┌─ APP ──────────────────────────────────────────────────┐
│ 105 pages in 12 route groups:                          │
│  (admin) (auth) (command) (executive) (investor)       │
│  (learn) (operator) (partner) (pocket) (program)       │
│  (vendor) + public: /forms /legal /lp /kits /build      │
│ 28 API routes: webhooks · cron · agent · license · ops  │
└────────────────────────────────────────────────────────┘
┌─ DOMAIN (src/lib, 23 sub-domains) ─────────────────────┐
│ agent(29) ghl(21) platform routing intake crm-sync      │
│ credit-dispute offline mission operator workflow …      │
│ queries.ts (646 lines) — the shared data layer          │
└────────────────────────────────────────────────────────┘
┌─ DATA ─────────────────────────────────────────────────┐
│ Supabase Postgres 17 · 168 tables · RLS everywhere      │
│ 1 edge function (intake) · Storage · pg_net · vector    │
└────────────────────────────────────────────────────────┘
┌─ EXTERNAL ─────────────────────────────────────────────┐
│ GoHighLevel (CRM, truth for contacts)                   │
│ Airtable (STILL UPSTREAM — leads verification)          │
│ Stripe · Twilio · ClickUp · Telegram · Anthropic/Ollama │
└────────────────────────────────────────────────────────┘
```

## What is genuinely good
- **`fetchTable()` in `queries.ts:30`.** Its 20-line comment explains that these helpers used to catch their own errors and return `[]` — making a denied RLS policy indistinguishable from an empty table. They now throw. That is exactly the right instinct, documented in place. It is the single best piece of engineering judgement in the repo.
- **Offline-first PWA layer** (`lib/offline`) with cache-read fallback and a dedicated `/offline` route.
- **Compliance as code** — `lib/agent/compliance/` covers banned phrases, quiet hours, area-code timezone, opt-out, disclaimers. Tested.
- **Fail-closed security defaults** — `is_staff_fail_closed`, DNC readability.
- **CI that actually gates** — `verify.yml` runs lint + 472 tests + production build on every PR with no secrets required.

## Architectural problems
1. **🔴 Tenancy is the app's most dangerous abstraction.** Host-based multi-tenancy was wired into middleware on 2026-08-27 (`be9b38ee0`). It has 9 organizations, of which effectively one is real, and it is the direct cause of the current lead outage (P0-1). *It is complexity being paid for daily with no revenue against it.*
2. **🟠 Three overlapping public-path functions** in `middleware.ts` — `isFunnelPublicPath`, `isPublicPath`, `isPitchPublicPath` — with different membership. A route's public/private status requires reading all three. This is exactly where an auth mistake will eventually happen.
3. **🟠 Two middleware files.** `middleware.ts` (root, 16 edits) and `src/middleware.ts` (272 lines, 12 edits). Next.js uses one. See `25_…`.
4. **🟠 No generated database types.** No `createClient<Database>` anywhere → column typos are runtime `undefined`, not compile errors. This has already caused a months-long silent breakage.
5. **🟠 Wrong abstraction boundary between GHL and the app.** Both hold contacts, both can act, sync is bidirectional, and Airtable is a third writer.
6. **🟡 Twelve route groups for one operating business** — `(executive)`, `(investor)`, `(partner)`, `(vendor)`, `(pocket)`, `(program)` mostly serve tables with 0 rows.

## Single points of failure
| SPOF | Consequence |
|---|---|
| `/api/leads/webhook` | **All inbound leads.** Currently failing. |
| `middleware.ts` | Every authenticated route |
| `queries.ts` `fetchTable` | Every admin screen |
| Supabase env vars on Vercel | Caused the 2,197-error outage |
| `swarm-coord` push loop | **Blocks the entire deploy pipeline** |

## Scale assessment
Nothing here is scale-limited. 168 tables at ~22k total rows is trivial for PG17. **The constraint is not capacity — it is that the architecture serves a business that is not currently running.**
