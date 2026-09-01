# Schema drift: the repo cannot rebuild the database

Measured against `uapxakmlwnpfsftfeezx` on 2026-09-01.

| | |
|---|---|
| Migrations applied in production | **220** |
| Migration files in `supabase/migrations` | **~39** |
| Distinct tables the application code touches | **89** |
| Of those, with no `CREATE TABLE` anywhere in the repo | **49** |

Production's history runs from `20260512183507_document_uploads` to
`20260831194920_program_documents`. The repo holds a small, non-matching subset,
and the filenames do not line up with the applied versions.

## Why this is worse than it looks

**The repo's column lists are not evidence.** Nearly every `CREATE TABLE` in
`supabase/migrations` is `CREATE TABLE IF NOT EXISTS`. Where production already
held a table of that name, the repo's definition was a no-op. So a table being
"in the repo" does not mean the repo describes what production actually has.

**Nothing catches it before a user does.** There is no generated Supabase types
file and no `createClient<Database>` anywhere, so a column that does not exist
is not a compile error — it is `undefined` at runtime, which reads as an empty
value rather than a failure. That is exactly how three of the four Interfaces
screens shipped reading `status` from tables whose column is `vehicle_status` /
`appointment_status` / `contract_status`, showing zeroes and empty kanbans for
months without anything erroring.

## Fixing it

```bash
npm i -D pg
SUPABASE_DB_URL='postgresql://...' node scripts/migrations-pull.mjs --dry-run
```

`--dry-run` lists every applied migration the repo is missing and writes
nothing. Drop the flag to write them. The connection string is the direct
connection or session pooler URI from Supabase → Project Settings → Database;
it is read from the environment and never stored.

The script only ever writes files. It applies nothing, drops nothing, and
leaves existing files alone unless `--force`.

Read the diff before committing: what appears is what production has been
running without the repo knowing.

## What is deliberately not in production

Three migrations sit in `supabase/migrations/_parked/` and are **correctly**
excluded — see that directory's README. They build a parallel `lead_pool`
system that would split-brain against the live lead-routing and operator
engine. Confirmed absent from production: `lead_pool`, `lead_routes`,
`pocket_referral_codes`, `pocket_referral_earnings`.

**But application code still calls them**, which is the actual bug:

| Code | Calls | Consequence |
|---|---|---|
| `src/lib/queries.ts` (`leadPoolFeed`) | `lead_pool_feed` RPC | The operator lead board can never load |
| `src/lib/lead-pool.ts` | `lead_route`, `lead_claim`, `lead_assign`, `lead_cross_refer` | Routing helpers that cannot run |
| `src/lib/referrals.ts` | `pocket_referral_codes`, `pocket_referral_earnings` | Referral codes could not be saved |

Until 2026-09-01 all three failed silently — the reads returned `[]` and
`getOrCreateReferralCode` handed the member a code it had failed to insert.
They now surface the failure instead. **Making them work means porting the code
onto the live system** (`partner_referrals`, `affiliate_links`,
`routing_candidates`, `operator_profiles`), not applying the parked migrations.

Also never applied: `20260707120000_dispute_engine.sql`. None of its nine
tables exist in production. `20260831200000_dispute_engine_rls.sql` is written
with existence guards so it is a no-op today and correct whenever that schema
is applied for real.

## Also missing from the repo

Present in production, created by migrations the repo does not have:
`client_journey`, `organization_licenses`, `audit_events`, `ghl_contacts`,
`incoming_leads`, `operator_training_modules`, `partner_referrals`, and the
whole legacy rentals set (`appointments`, `customer_payments`, `insurance`,
`tickets`, `waitlist`, `expenses`, `former_customers`, and the rest — the repo
has RLS statements for these but never their `CREATE TABLE`).

## The rule going forward

Apply migrations through the repo, not through the dashboard. Every change made
directly against production is a change the next person cannot reproduce, and
this file is what 220-against-39 looks like after four months of it.
