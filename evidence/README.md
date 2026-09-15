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
| 4 — Write paths | `write-path-inventory.md` | **NOT PASSED** — repo + Airtable automations inventoried; Zapier/GHL outstanding |
| 5 — Multi-tenant | — | NOT STARTED |
| 6 — Collections | — | NOT STARTED — attorney review is a precondition |

Open change requests: `../CHANGE_REQUEST_001.md` (provenance schema), `../CHANGE_REQUEST_002.md`
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

Everything else is engineering work and is either done or unblocked.

## Tooling

| Script | Purpose | Safe to run? |
|---|---|---|
| `scripts/parity-check.ts` | Row reconciliation, gap explanation, field diff | Yes — read-only |
| `scripts/parity-check.ts --table X --explain-gap` | Prints missing **record IDs only**, no PII | Yes |
| `scripts/extract-attachments.ts --inventory` | Enumerates files without downloading | Yes — read-only |
| `scripts/extract-attachments.ts` | Extraction | **Refuses** without a retention policy + `--org` |

Both run on plain `node` (native TS type-stripping), no build step and no dependencies.
