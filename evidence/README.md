# evidence/

A gate is passed by producing its named artifact here — not by believing the work is done
(Prime Directive 2). Every claim carries a tag:

| Tag | Meaning |
|---|---|
| **VERIFIED** | Read live from the named system, with the query or count shown |
| **INFERRED** | Reasoned from verified facts; not itself observed |
| **REPORTED** | Asserted by a person or an earlier document; not independently confirmed |
| **UNKNOWN** | Uncounted. Never means empty. |
| **CONFLICT** | Two sources disagree; named as such rather than silently resolved |

## Gate status — as of 2026-09-15

| Gate | Artifact | Status |
|---|---|---|
| 0 — Safety | `phase0-report.md` | **NOT PASSED** — 3 owner actions outstanding |
| 1 — Parity | `parity-report.md` | **3 of 4 lines passed.** All 31 tables counted; field-level sample diff not run (bulk PII read) |
| 2 — Attachments | `attachment-inventory.md` | **NOT PASSED** — inventory complete (706 records); extraction blocked on counsel |
| 3 — Business logic | `../docs/business-rules/` | **2 of 3 lines passed.** 7 documents written; owner decisions outstanding |
| 4 — Write paths | `write-path-inventory.md` | **NOT PASSED** — repo + Airtable automations inventoried; Zapier/GHL outstanding; **15 script bodies uncaptured** (`automation-logic-capture.md`) |
| 5 — Multi-tenant | — | NOT STARTED |
| 6 — Collections | — | NOT STARTED — attorney review is a precondition |

Open change requests: `../docs/CHANGE_REQUEST_003.md` (provenance schema), `../docs/CHANGE_REQUEST_004.md`
(purge credential from Supabase). Neither applied.

## Read these first

1. **`write-path-inventory.md` §1** — 8 Airtable automations are live and one emails customers.
   It is dormant only because no payment is currently due. **Disable them before any
   corrective edit or re-import**, which is earlier than the plan sequences it.
2. **`phase0-report.md` §2.1** — the carrier credential is exposed in **two** systems, not one.
   The plan assumed Supabase was clean. It is not.
3. **`parity-report.md` §2.2** — there are no signed rental agreements in Airtable. Where the
   executed contracts actually live is an open question that blocks Gate 1 and makes the Gate 0
   archive incomplete by construction.

## What blocks the critical path

Airtable cannot be cancelled until Gates 2 and 4 both pass. Both are blocked on a human:

1. **Counsel retention rule** (Gate 2) — 706 attachment-bearing records; **293 hold a driver's
   licence** (not 283 — the Do Not Rent List was missing from the plan's inventory).
   `scripts/extract-attachments.ts` refuses to run until the rule exists.
2. **Carrier credential rotation** (Gate 0) — only the owner can change it at the carrier.
3. **Zapier / GHL console access** (Gate 4) — cannot be enumerated from here.
4. **Where the signed contracts live** (Gate 1) — owner knowledge.
5. **15 `customScript` bodies** (Gate 4) — capturable only from the live Airtable UI, and only
   while the subscription is active. `automation-logic-capture.md`.

Everything else is engineering work and is either done or unblocked.

## Findings added 2026-09-22

- **The three eligibility screening signals were NEVER recorded.** VERIFIED on both sides:
  `Background Check Status`, `Insurance Check Status` and `Earnings Verification Status` are
  populated on **0** records in Airtable (of 304) and **0** in Supabase (of 299). Both sides
  agree at zero, so this is **not** a migration failure — the three-signal model was designed
  and never used. 233 decisions were made outside the system with only the verdict recorded.
  **No truth table can be derived from this data even in principle**; the owner must design the
  policy rather than recall it.
- **CORRECTION — `ou` is not a migration blocker.** VERIFIED: **zero** records carry it
  (`out of radius` has 49, matching Supabase exactly). The 2026-09-16 claim that rows needed
  reclassifying before migration was wrong. The option remains selectable, so it stays a
  forward-looking entry hazard only.
- **Partner splits are 19 decisions, not 36.** Of the 36 vehicles with no `partner_percentage`:
  **10 are company-owned** (three spellings of TMMT — one batch answer), **7 have no partner
  name** (4 look like duplicate rows), and **19 belong to 12 partners**. Also: two stored
  partner names are the same pair of people recorded in opposite order — likely one
  partnership entered twice. Partners are referenced by letter in the decision pack, not by
  name (CLAUDE.md: no third-party data in git).
- **CR-003 is written and staged** at
  `supabase/migrations/_staged/20260922000000_attachment_provenance_STAGED.sql`, with seven
  postcondition queries and rollback SQL. `db push` ignores `_staged/`, so it cannot
  self-apply. Awaiting owner authorization.
- **All open owner decisions are now in `docs/decisions/OWNER-DECISION-PACK.md`.**

## Findings added 2026-09-16

- **Concurrent production activity.** `g01_dnc_normalize_20260916` remediated **71
  `exec_va_tasks` rows at 19:10:39 UTC on 2026-09-16** (rollback table captured prior state);
  `agent_job.lease_expired` fired twice at 19:35/19:40 UTC. Another operator or scheduled
  process is active. **No Airtable-exit gate state changed** — credential columns,
  `documents`/`vehicle_media` at 0 rows, Incoming Leads 871 and `GHL Contact ID` 0 all
  re-verified unchanged. Re-check state before mutating; never reset/rebase/force-push over it.
- **7 tables have RLS enabled with zero policies.** Five look deliberate (backups,
  service-role-only). Two are flagged **INFERRED risk** because 0 rows + no policy is the
  `outreach_touches` fail-closed signature: `ghl_webhook_events` (0) and `signup_invites` (0).
  Verify intended behaviour before adding any policy. Detail:
  `TMMT-AIRTABLE-CAPABILITY-MATRIX.md` §9.2.
- **Stale finding retired.** `SYSTEM_AUDIT_2026/06_AIRTABLE_PARITY.md` claims 3 of 4 Interfaces
  screens read a non-existent `status` column. Verified fixed — all four read
  `payment_status` / `contract_status` / `appointment_status` / `vehicle_status`.
- **Airtable automation logic is an exit-preservation gate, not a documentation task.**
  8 automations contain **15 `customScript` bodies**; `get_automation` returns `inputs: {}` for
  every one, and Airtable's base export covers records/attachments but **not automation
  definitions**. **Gate 0's offline archive does not preserve them** — cancellation destroys
  them. One automation is deployed (A1, runs two scripts on every new lead); another (A2) has a
  script as its *only* node. The two `aiGenerate` prompts **were** recoverable and are preserved.
  Register + 14-field capture schema: `automation-logic-capture.md`.
  **No cancellation gate may pass while unrecoverable automation logic remains uncaptured.**
- **Build verified GREEN** (2026-09-16): `npm ci`, `tsc --noEmit`, `npm run build` all exit 0.
  `scripts/` is inside the normal typecheck scope; no tsconfig exclusion is needed.

## Tooling

| Script | Purpose | Safe to run? |
|---|---|---|
| `scripts/parity-check.ts` | Row reconciliation, gap explanation, field diff | Yes — read-only |
| `scripts/parity-check.ts --table X --explain-gap` | Prints missing **record IDs only**, no PII | Yes |
| `scripts/extract-attachments.ts --inventory` | Enumerates files without downloading | Yes — read-only |
| `scripts/extract-attachments.ts` | Extraction | **Refuses** without a retention policy + `--org` |

Both run on plain `node` (native TS type-stripping), no build step and no dependencies.
