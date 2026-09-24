# Linked-record integrity — read-only audit

**Capability:** `TMMT-AIRTABLE-CAPABILITY-MATRIX.md` §4.1 — "Linked records" (P1, no owner
decision required). Acceptance test: *FK integrity test per relationship*.

**Method:** read-only SQL against production (`uapxakmlwnpfsftfeezx`), system catalogs and
`count(*)` only. No business rows, no PII, and nothing was mutated.
**Date:** 2026-09-24.

---

## 1. Columns shaped like foreign keys that carry no FK constraint — VERIFIED

A catalog sweep found `%_id` columns without a FK constraint across 30+ `public` tables
(`incoming_leads` 8, `deals` 6, `ghl_form_submissions` 6, `vehicle_events` 6, …).

**The raw count materially overstates the problem, and must not be quoted on its own.** A large
share of those columns are **external-system identifiers**, which are *correctly* unconstrained
because the referent does not live in this database:

| Pattern | Example columns | Correct to have no FK? |
|---|---|---|
| Airtable record ids | `airtable_id`, `airtable_record_id` | **Yes** — foreign system |
| Stripe | `stripe_customer_id`, `stripe_payment_intent_id`, `stripe_connect_account_id` | **Yes** |
| GoHighLevel | `ghl_contact_id`, `ghl_opportunity_id`, `ghl_pipeline_id` | **Yes** |
| ClickUp / Telegram | `clickup_task_id`, `telegram_chat_id` | **Yes** |

What remains as genuine internal references (`org_id`, `profile_id`, `booking_id`, `case_id`,
`vehicle_id`, `customer_id`, `lead_id`) is a smaller set. **Counting unconstrained `%_id`
columns is not a measure of broken integrity** — the orphan test below is.

---

## 2. Orphan test on `org_id` — VERIFIED, ZERO orphans

`org_id` is the column data isolation depends on (CLAUDE.md: *each operator's data is walled
off*), so it was tested first: does every non-null `org_id` point at a real `organizations` row?

| Table | Rows | `org_id` set | Orphans |
|---|---:|---:|---:|
| `incoming_leads` | 893 | 893 | **0** |
| `tickets` | 308 | 308 | **0** |
| `background_checks` | 299 | 299 | **0** |
| `customer_payments` | 31 | 31 | **0** |
| `cases` | **4** | **0** | 0 (vacuous) |
| `bookings` | 0 | 0 | 0 (vacuous) |
| `payments` | 0 | 0 | 0 (vacuous) |

**No orphaned `org_id` exists anywhere in the tested set.** Referential integrity is being held
by application code, not by the database — which is the gap the matrix records, not a live
breakage. Adding the constraints would make that guarantee structural; it is a schema change and
therefore needs an owner-authorised change request, so it was NOT applied here.

---

## 3. FINDING — `cases` has rows but no tenant on any of them ⚠️ VERIFIED

`cases` holds **4 rows with `org_id` NULL on every one**. This is the distinction CLAUDE.md
insists on: *UNKNOWN means uncounted — it never means empty.* `bookings` and `payments` really
are empty (0 rows); `cases` is not.

Why it matters: a NULL tenant column cannot enforce isolation. Any query filtering
`where org_id = $tenant` returns none of these 4 rows, and any query that forgets the filter
returns all of them. Both failure modes are silent.

This is **INFERRED as a risk, not confirmed as a breach** — 4 rows may predate the tenancy model
or belong to the owner org. Establish intended behaviour before backfilling: writing an `org_id`
into these rows is a data change and a guess about who owns them.

**Deliberately not done here:** no backfill, no constraint, no policy. The same rule the matrix
applies to the seven RLS-enabled-no-policy tables applies here — *do not "fix" this without
establishing intended behaviour first.*

---

## 4. Count drift since the parity report — VERIFIED

`incoming_leads` was **871** in `evidence/parity-report.md` (2026-09-16) and is **893** today
(+22). The database is live and being written to, exactly as §9.3 of the matrix warns.

**Consequence:** every count in the parity report is a snapshot with a date on it, not a
standing fact. Re-run `scripts/parity-check.ts` before any gate decision that depends on a count.

---

## 5. What this does and does not establish

| Claim | Tag |
|---|---|
| No orphaned `org_id` in the 7 tested tables | **VERIFIED** |
| FK constraints are absent on genuine internal references | **VERIFIED** |
| Integrity is currently held by application code | **INFERRED** (no orphans found, no constraint exists) |
| `cases` has 4 rows with no tenant | **VERIFIED** |
| Whether those 4 rows *should* have a tenant | **UNKNOWN** — owner decision |
| Orphan state of `profile_id` / `booking_id` / `vehicle_id` / `case_id` | **UNKNOWN — uncounted**, not clean |

Row 6 is the honest limit of this audit: only `org_id` was tested. The other internal
references remain **uncounted**, which is not the same as clean.
