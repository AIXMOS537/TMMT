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

## Schema-drift register (silent-fallback family)

Opened 2026-09-16 after C-20 and C-21. Both had the same shape:

**application query → column that does not exist → PostgREST error → caught →
read as a business condition.** C-20: "duplicate check unavailable" read as
"not a duplicate, process it". C-21: "spend check unavailable" read as "over
the cap, refuse".

How the candidates were found: every `.from(table)` chain in `src` was scanned
for selected/filtered column names, and the list was compared with production
`information_schema.columns` (uapxakmlwnpfsftfeezx, 2026-09-16, read-only).
The scanner is regex-based, so every row below was checked by hand; two scanner
hits (`crm_sync_records.status`, `org_responder_links.email`) were false
positives from embedded selects and are not listed.

Priority: **P0** safety or compliance control, **P1** money / customer data
written to the wrong place, **P2** staff tooling broken, **P3** already visible
or parked by design.

| # | Table | Code location | Code expects | Production | Failure mode | Fallback | Business impact | Confirmed | Priority | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| SD-01 | `audit_events` | `src/lib/agent/webhook-replay.ts` `seenWebhookEvent` | `created_at` | only `ts` | 42703 every call | fail OPEN: event processed as unseen | Cal/Stripe replay dedupe never worked (0 such events in prod so far) | yes | P0 | **fixed**, #237 merged |
| SD-02 | `audit_events` | `src/lib/agent/guard.ts` `assertLlmCapNotExceeded` | `created_at` | only `ts` | 42703 every call | fail CLOSED: `LlmCapExceededError` | every AI SMS reply refused; also hid the missing controls below it | yes | P0 | #238, **do-not-merge** until containment #244/#245/#246 reviewed |
| SD-03 | `active_customers` | `src/app/api/webhooks/ghl/route.ts` (`.ilike("email", …)` on active_customers) | `email` | `contact_email` | error ignored, `rows` undefined | falls through to the `incoming_leads` email match | GHL events for an active customer never land in `active_customers.service_notes`; they go to a lead or nowhere | yes | P2 (active_customers is history since SQUARE ONE) | open |
| SD-04 | `vendors` | `src/lib/ops-command/resolve.ts` `resolveVendorByName` | `company_name` | `name`, `contact_name` | error ignored, returns `null` | ops command answers "No vendor matching …" | the ops-command "assign vendor" action can never resolve a vendor | yes | P2 | open |
| SD-05 | `cases` (embedded in `vendor_jobs`) | `src/lib/queries.ts` `getVendorJobsForStaff`, `getVendorPortalJobs` | `cases(case_number, title)` | no `case_number`, no `title` | error | **throws** `QueryError` (visible, not silent) | staff case page vendor jobs and the vendor portal job list fail to load | yes | P2 | open |
| SD-06 | `lead_pool`, `lead_routes`, `pocket_referral_codes`, `pocket_referral_earnings` | `src/lib/lead-pool.ts`, `src/app/(operator)/operator/leads/actions.ts`, `src/lib/referrals.ts` | tables exist | absent (parked on purpose, see above) | error | lead-pool returns "skipped" by design; referrals surface the failure since 2026-09-01 | documented above; port to live tables, do not apply the parked migrations | yes | P3 | known |
| SD-07 | `company_policies` | `src/lib/ops-policy.ts` | table exists | absent | error caught | falls back to the policy file in the repo | none if the file is current; investigate before assuming code or prod is wrong | table absence yes | P3 | investigate |
| SD-08 | `ops_threads`, `ops_messages` | `src/lib/queries.ts`, `src/app/ops-actions.ts` | tables exist (defined in `20260516140000_ops_command_center.sql`) | absent | error | queries throw (visible); `ops-actions` logs | ops threads feature cannot work; migration in repo never applied | table absence yes | P3 | investigate |
| SD-09 | `investor_updates` | `src/lib/queries.ts`, `src/app/(investor)/investor/page.tsx` | table exists | absent | error | throws (visible) | investor page cannot load updates | table absence yes | P3 | investigate |
| SD-10 | `ops_locations` | `src/lib/routing/locations.ts`, `src/lib/routing/ops-locations.ts`, `src/app/api/webhooks/airtable/locations/route.ts` | table exists | absent | error | not triaged | location routing / Airtable location sync | table absence yes | P3 | investigate |
| SD-11 | `dispatch_loads` | `src/lib/routing/execute.ts` | table exists | absent | error | not triaged | dispatch routing execution | table absence yes | P3 | investigate |

**Rule for new rows.** Record the fallback, not just the error: the defect is
never the missing column alone, it is what the code decides when the query
fails. A missing table is not automatically a code bug; check whether a parked
or unapplied migration explains it first.

**Direction.** The same comparison can run in CI against a checked-in snapshot
of production's `information_schema` (C-20's `audit-events-columns.test.ts` is
the single-table version). Not built yet.
