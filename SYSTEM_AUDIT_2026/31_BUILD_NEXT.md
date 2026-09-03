# 31 · BUILD THIS FIRST

Ranked by **revenue impact ÷ effort**, with dependencies honoured.

## Rank 1 — 🔴 Fix the lead door (hours)
**Why:** every inbound landing-page lead is being lost right now, invisibly, and the forms say "thank you".
1. Run the three read-only SELECTs (`00_MASTER…` §7).
2. Reconcile org identity: real UUIDs in `tenant-map.generated.ts`, or relax `OrgIdSchema` to accept slugs. One id type, one place.
3. Deploy. **Post a test lead and watch the row land.**
**Blocked by:** Rank 2. **Done when:** a row appears in `incoming_leads`. Not before.

## Rank 2 — 🔴 Unblock deploys (minutes)
Stop the `swarm-coord` loop or add it to `scripts/vercel-ignore.sh`. **20 consecutive blocked deployments means you cannot ship Rank 1.** Do this first in wall-clock terms.

## Rank 3 — 🔴 Work the 81 + 104 (days, zero code)
**81 approved-never-placed** and **104 waitlisted** people. Consented, in GHL, reachable today.
This is the **only item in this report with revenue attached that requires no engineering.** Round-robin through GHL, manually, draft-never-send.
> If exactly one thing happens this month, make it this. The software cannot manufacture demand that these 185 people already represent.

## Rank 4 — 🟠 Monitoring (hours)
An uptime check on `/api/leads/webhook` + `/api/health` that pages a human. **The outage ran 13 days undetected.** This single item prevents recurrence of the #1 finding.

## Rank 5 — 🟠 Pull the 173 missing migrations (hours)
`node scripts/migrations-pull.mjs --dry-run`, review, commit. The script already exists. Without it nothing above can be safely tested.

## Rank 6 — 🟠 Generated database types (hours)
`supabase gen types typescript` in CI + `createClient<Database>`. **This is the fix that prevents the entire class of bug that broke three Interfaces screens** — column typos become compile errors instead of silent `undefined`.

## Rank 7 — 🟠 Close the anon RPC holes (hours)
`REVOKE EXECUTE` from `anon` on the 4 trigger functions and 3 identity helpers. Verify forms still submit.

## Rank 8 — 🟠 Money as a number (days)
`amount_cents integer`; backfill the 32 free-text rows by hand (35 rows — an afternoon). **Unlocks:** revenue reporting, arrears automation, per-vehicle profitability. Nothing financial is automatable until this is done.

## Rank 9 — 🟡 One test: the lead webhook happy path (hours)
`resolveOrgBySlugPublic("aixmos")` → valid org → row inserted. **This test would have caught P0-1 before deploy.** Highest-value single test in the repo.

## Rank 10 — 🟡 Arrears automation (week) — *only after Rank 8*
3-day grace, $25/day, `PAYMENT_ISSUE` on day 4. **The business died of collections, not demand.** This is the software fix for the actual cause of death.

---
## Only when vehicles exist again
| | Item |
|---|---|
| 11 | `bookings` wired up **with a `tstzrange` EXCLUDE constraint** — double-booking prevention before the first reservation |
| 12 | Vehicle state machine with transitions + history |
| 13 | In-form camera capture → Supabase Storage (undocumented damage is direct cash loss) |
| 14 | Real FK from payments to `fleet.id` (today it string-matches vehicle names) |

## Sequencing logic
Ranks 1–2 restore the pipe. Rank 3 monetises what is already in it. Ranks 4–7 stop the bleeding recurring. Ranks 8–10 fix the thing that actually killed the business. Ranks 11–14 wait for cars.

**Nothing in the platform, dealer, dispute or agent backlog appears anywhere in this list.**
