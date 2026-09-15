# CHANGE_REQUEST_002 — Purge stored carrier credential from Supabase

Status: **PROPOSED — awaiting owner approval.** Not applied.
Raised: 2026-09-15 · Blocks: Gate 0 · Prime Directive 8 · **P0 security**

---

## CURRENT

Plan §2.1 says of the Supabase side: *"Confirm the corresponding Supabase `insurance` columns
are absent or empty. (Previously reported empty — re-verify, do not assume.)"*

Re-verified 2026-09-15. **They are neither absent nor entirely empty.**

`public.insurance` (24 rows) carries `login_email`, `login_password`, `login_phone` as `text`.
Counted, never selected:

| Column | Populated rows |
|---|---:|
| `login_email` | **1** |
| `login_password` | 0 |
| `login_phone` | 0 |

The password did not propagate — the blast radius is narrower than feared. But the account
identifier did, and a login email is half a credential pair and a direct phishing and
credential-stuffing input. **The prior "empty" report was wrong.**

## PROPOSED

Strictly after the owner has rotated the credential at the carrier (§2.1 steps 1–2) and after
the Airtable columns are cleared and dropped (steps 3–4):

1. `update public.insurance set login_email = null where login_email is not null;`
2. Re-run the postcondition count; confirm all three columns read **0**.
3. `alter table public.insurance drop column login_email, drop column login_password, drop column login_phone;`
4. Re-query `information_schema.columns` to confirm the columns are gone.
5. Confirm no application code reads them (grep before dropping).

## WHY

§2.1 assumed one purge site. There are two. Dropping the Airtable columns alone leaves a live
account identifier in a production Postgres table — and closes the ticket while the exposure
persists, which is worse than knowing about it.

## DEPENDENCIES

**Ordering is the whole control here.** Purging before rotating destroys the only record of a
live credential. The sequence is: rotate at carrier → confirm new credential works and is in a
password manager → clear Airtable → drop Airtable columns → **then** this change request.

Also: check whether these columns are referenced anywhere in the app before dropping.

## RISK

**Low.** One populated value across 24 rows, and it is a credential that will already have been
rotated — so the value being destroyed is by then worthless. The columns should never have held
this data.

The real risk is **doing this too early**: if applied before the carrier rotation, the only
record of the current login is gone and account recovery becomes a support call to the carrier.

## ROLLBACK

**There is no rollback for the value, and that is the intent** — the point is destruction.
Recovery is via the password manager the owner populates in §2.1 step 2, which is why that step
is a precondition rather than a nicety.

The column *shape* can be restored (`alter table ... add column login_email text`), but it would
come back empty, and it should not come back at all.
