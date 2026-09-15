# Evidence — Phase 0 (Safety)

Run date: 2026-09-15 · Method: read-only queries against Airtable base `appcenWUju039rD7b`
and Supabase project `uapxakmlwnpfsftfeezx`. No production writes were made.

**GATE 0 STATUS: NOT PASSED.** All three items require owner action against third-party
systems. The engineering-side verification each item depends on is complete and recorded below,
so the owner's actions are now unambiguous.

---

## 2.1 Stored credential — P0

### Airtable side — VERIFIED, still exposed

All three columns still exist on `Insurance` (`tblU3rRVFuZFU4kPs`). Confirmed by reading the
table schema, not by assumption:

| Field | ID | State |
|---|---|---|
| LOGIN EMAIL | `fldiWrNKyClzWqUju` | present |
| LOGIN PASSWORD | `fldX30NUSBz5MM8Vd` | present |
| LOGIN PHONE | `fld4QT0cHNr1GoGey` | present |

Values were deliberately not read.

### Supabase side — VERIFIED, and this CONTRADICTS the plan's assumption

The plan says these columns were "previously reported empty — re-verify, do not assume."
Re-verified. They are **not absent, and not entirely empty.**

`public.insurance` carries `login_email`, `login_password`, `login_phone` as `text` columns.
Populated-value counts (counted, never selected):

```sql
select count(*) as total_rows,
       count(*) filter (where login_email    is not null and btrim(login_email)    <> '') as login_email_populated,
       count(*) filter (where login_password is not null and btrim(login_password) <> '') as login_password_populated,
       count(*) filter (where login_phone    is not null and btrim(login_phone)    <> '') as login_phone_populated
from public.insurance;
```

| Column | Populated rows |
|---|---|
| `login_email` | **1** |
| `login_password` | 0 |
| `login_phone` | 0 |
| (total rows) | 24 |

**Finding — CONFLICT resolved in the owner's favour, partially.** The password itself did not
propagate to Supabase; that is the good news and it narrows the blast radius. But the *account
identifier* did. A login email is half of a credential pair and is itself a phishing and
credential-stuffing input. The prior report of "empty" was wrong.

**Consequence for the plan:** §2.1 step 5 is not a confirmation step. It is a second purge
site. The owner's rotation must be followed by clearing **two** systems, not one.

### Revised order of operations

1. **Owner** changes the password at the insurance carrier's site. *(Human action against a
   third-party account — not Claude Code.)*
2. **Owner** confirms the new credential works and is stored in a password manager.
3. Clear the Airtable field value.
4. Drop the three Airtable columns.
5. **NEW —** clear `public.insurance.login_email` (1 row) and drop `login_email`,
   `login_password`, `login_phone` from the Supabase table. Requires a migration and explicit
   per-package authorization (Prime Directive 8).
6. Re-run the count query above and confirm all three read 0 before the columns are dropped.

> **Not done, and deliberately so.** Step 5 is a production DDL write. Per Prime Directive 8 it
> needs the owner's named authorization. The migration is not written yet because writing it
> before rotation happens would invite running it before rotation happens — which is exactly
> the failure mode §2.1 warns about.

### Related exposure found while verifying — VERIFIED

`public.insurance` also holds two `jsonb` columns copied wholesale from Airtable:
`proof_of_insurance_attachment` (6 rows non-empty) and
`commercial_insurance_policy_number` (7 rows non-empty). Their object keys are
`filename, height, id, size, thumbnails, type, url, width` — the native Airtable attachment
shape.

**These are dead pointers, not migrated files.** The `url` values are Airtable signed URLs,
which expire in hours (§4.3). They have long since expired.

This matters for two reasons:
1. It is a **false-positive trap.** A future audit that greps for populated attachment columns
   will conclude Insurance attachments were migrated. They were not.
2. The same pattern likely exists on every table whose Airtable attachment field was copied as
   `jsonb`. Phase 2 must treat a populated `jsonb` attachment column as *evidence of a missing
   file*, never as evidence of a present one.

---

## 2.2 Full offline archive

**GATE ITEM: NOT DONE — owner action.**

Cannot be performed from this environment, and the reason is worth stating plainly rather than
filed as a limitation:

- No `AIRTABLE_PAT` is present in this environment (checked; unset). The PAT that previously
  existed was revoked and purged from git history on 2026-07-22 per `CLAUDE.md`.
- The MCP Airtable connection available here reads records, but "store the archive off the
  working machines" is inherently a human act — an archive that lives only inside an ephemeral
  container is not an archive.

**What the owner does:** Airtable → base → *Export base* (includes attachments), then store the
archive on the UGREEN NAS tier and one offsite copy. Then **open a sample of files and confirm
they render** — the plan is explicit that byte-length is not proof (§4.5), and that applies to
the archive too.

**Sample-and-confirm target (use the Phase 2 inventory below):** at minimum one file from each
of the seven attachment-bearing tables, weighted toward Background Checks.

**This archive is the rollback for every phase that follows. Nothing in Phase 2 should run
until it exists.**

---

## 2.3 True infrastructure cost

**GATE ITEM: NOT DONE — owner action, and it is a production write.**

VERIFIED: `operation_costs` holds 5 rows in both systems (Airtable 5 / Supabase 5 — MATCH).
The plan lists the four named vendors totalling $393.93; the fifth row was not itemised here
because the figures are business data, not engineering state.

Missing vendors named by the plan and still absent: Supabase, Vercel, Airtable, domains,
Google Workspace.

**Why Claude Code did not fill these in:** every one of these numbers is a real current charge
that can only be read off a billing console the owner controls. Prime Directive 5 forbids
inventing business values, and a plausible-looking guessed subscription price is exactly the
kind of number that silently becomes a quoted margin. These are **BUSINESS DATA REQUIRED**,
not estimable.

**What the owner supplies,** per vendor: current monthly charge, billing cycle, and which
account it bills to. Writing them into `operation_costs` is a production write and needs
per-package authorization.

A note on scope: the base already contains a
`Money Command — Bills & Subscriptions` table (`tblSkU7C2BpGY9cGC`, **8 rows** — VERIFIED)
whose stated purpose is exactly this: "single source of truth for every recurring obligation."
It is **UNMAPPED** to Supabase. Before creating new `operation_costs` rows by hand, check
whether these 8 rows already carry the missing vendor figures — Prime Directive 6, reuse before
rebuilding.

---

## Gate 0 checklist

- [ ] Carrier credential rotated, Airtable field cleared, three Airtable columns deleted
- [ ] **(added)** Supabase `login_email` cleared and all three Supabase columns dropped
- [ ] Full base export with attachments archived offline and spot-checked by opening files
- [ ] `operation_costs` reflects true current spend across all vendors

**Gate 0 does not pass on this run.** Phase 1 work below was performed anyway because it is
read-only and non-destructive; it creates no new exposure and it does not depend on Gate 0's
outcome. Nothing that writes, deletes, or extracts has been run.
