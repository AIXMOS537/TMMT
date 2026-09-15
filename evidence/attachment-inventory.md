# Evidence — Phase 2 (Attachment Inventory, pre-extraction)

Run date: 2026-09-15 · Airtable base `appcenWUju039rD7b` · read-only.
Method: filtered count per table, `isNotEmpty` OR-ed across every `multipleAttachments`
field on that table, read from `metadata.totalRecordCount`.

**GATE 2 STATUS: NOT PASSED — extraction has not run and must not run yet.**
Blocked on the counsel retention rule (§4.2). This document satisfies one gate line only:
*"All attachment-bearing tables counted — none left uncounted."*

---

## 1. Records carrying at least one attachment — VERIFIED

| # | Airtable table | Table ID | Records w/ files | Attachment fields |
|---|---|---|---:|---:|
| 1 | Tickets | `tblhfKVanQDgn9plv` | **308** | 1 |
| 2 | Background Checks | `tbl1OFZh3cMXytNZM` | **287** | 4 |
| 3 | Fleet | `tblubnSDZkvsc9L6I` | **41** | 4 |
| 4 | Expenses | `tblu4DFhHglmQMEBj` | **32** | 1 |
| 5 | Fleet Car Inspections | `tbluH4YH2YBuu7FFg` | **16** | 1 |
| 6 | Insurance | `tblU3rRVFuZFU4kPs` | **12** | 2 |
| 7 | Do Not Rent List | `tblE6nOqVcSeGFQCi` | **10** | 1 |
| — | Contracts | `tblyDwuH3fBZmaCTF` | **0** | 2 |
| — | Vehicle Handover | `tblKmdjH0tmKY9Bcl` | **0** | 2 |
| — | Customer Payments | `tblsG1LCDNSeehiLf` | **0** | 1 |
| — | Customer Inspection Photos | `tblbaUFnNFFfalnRc` | **0** | 1 |
| — | Vehicle Onboarding Inspections | `tblqJuzv6YkuAn1kL` | **0** | 2 (table empty) |
| — | Content Pipeline | `tbl19zqT6BirKq8iJ` | **0** | 2 (table empty) |

**Total attachment-bearing records: 706** across 7 tables.

### Records vs files — a distinction the gate depends on

The plan says "636+ attachments". **706 is a count of _records_, not _files_.** An Airtable
attachment field holds an array, so one record can carry several files — a Background Checks
row commonly holds a licence *and* a paystub *and* a screenshot.

**The true file count is UNKNOWN and will remain UNKNOWN until the extractor enumerates the
arrays.** It is necessarily ≥ 706 and, given 4 attachment fields on Background Checks, plausibly
well over 1,000. This matters because Gate 2 requires "manifest count per table equals the
source count" — that reconciliation must be against enumerated **files**, not against this table.

`scripts/extract-attachments.ts --inventory` performs that enumeration without downloading
anything, and should be run first to set the expected file count per table.

---

## 2. Corrections to the plan's §4.1 inventory

The plan's table listed 5 tables as "not counted". All are now counted, and four of its
assumptions did not survive.

### 2.1 Four attachment-bearing tables were missing from the plan

Not named in §4.1, found by walking every `multipleAttachments` field in the base schema:

- **Do Not Rent List — 10 records with driver's licences** (`fldPlsgIMB90K8fVb`)
- **Insurance — 12 records** (`Proof of Insurance`, `Commercial Insurance Policy Number`)
- **Customer Payments — 0** (`Invoice/Receipt Attachment` — field exists, unused)
- **Customer Inspection Photos — 0** (`Vehicle Photos` — field exists, unused)

**Do Not Rent List is the significant one.** Ten driver's licences belonging to people the
business has affirmatively barred. That is the most legally sensitive set in the base: identity
documents attached to an adverse decision, held on people who are by definition not customers
and have no ongoing relationship. It was outside the plan's §4.2 scope statement ("287 records
contain identity documents"). **The correct figure for the retention question is 293 records
holding a driver's licence — 283 in Background Checks plus 10 here.**

### 2.2 Contracts and Vehicle Handover hold zero attachments

The plan lists Contracts ("Signatures, addendums") and Vehicle Handover ("Staff and customer
checklists") as uncounted, implying content. Both are **0**.

Combined with Contracts holding only 1 row (parity report §2.2), the conclusion is firm:
**there are no signed rental agreements in Airtable.** Nothing to extract; and the open question
of where the executed agreements actually live is escalated in the parity report.

### 2.3 Vehicle Onboarding Inspections is an empty table

0 records, so 0 attachments. The plan lists it as an extraction target. It is not one.

---

## 3. Per-field breakdown where it bears on the retention rule — VERIFIED

Background Checks (`tbl1OFZh3cMXytNZM`), counted per field:

| Field | Field ID | Records |
|---|---|---:|
| Driver's License | `fldDoihm4BZQpUPPt` | **283** |
| Paystub | `fldjkLKaOLEdcDI4O` | **269** |
| Proof of Insurance | `fldXctgEy97viNJOE` | *(not separately counted)* |
| Background Check Screenshot | `fld4LT3Lw33Eoy2Ny` | *(not separately counted)* |
| **Any of the four** | — | **287** |

Counted per field because these are four different document types with four different likely
retention answers. A single "287 records" figure invites one blanket decision; the owner and
counsel need to be able to say "licences yes, paystubs no."

**269 paystubs is the line item to look at first.** Income-verification documents for people
who are no longer customers are the clearest over-retention candidate in the base — high
sensitivity, no ongoing business purpose, and no obvious regulatory reason to keep them once
the rental relationship ended.

That is a flag for counsel, **not a recommendation and not a decision.** Claude Code implements
the retention rule; it does not write it (§4.2).

---

## 4. The false-positive trap — VERIFIED, and it is live

`public.insurance` holds `proof_of_insurance_attachment` (6 rows) and
`commercial_insurance_policy_number` (7 rows) as `jsonb`, with the native Airtable attachment
shape: `filename, height, id, size, thumbnails, type, url, width`.

**These are expired pointers, not migrated files.** Airtable attachment URLs are short-lived
signed URLs (§4.3); these were copied at the 2026-04-22 migration and died hours later.

Two consequences, both load-bearing:

1. **Any audit that treats a populated attachment column as "migrated" will be wrong.**
   Phase 2 must treat a populated `jsonb` attachment column as evidence of a **missing** file.
2. **`documents`, `vehicle_media` and `program_documents` are all 0 rows** (VERIFIED). That —
   not the `jsonb` columns — is the true state of attachment migration: nothing has moved.

The same `jsonb`-copy pattern should be assumed on every other table whose Airtable attachment
field was copied during the 2026-04-22 run, and checked before any table is declared done.

---

## 5. Gate 2 checklist

- [ ] Retention rule received in writing from counsel and applied — **BLOCKING, owner action**
- [x] All attachment-bearing tables counted — none left uncounted — **13 tables, 706 records**
- [ ] Extraction complete with manifest reconciled per table — **NOT RUN**
- [ ] ≥10 files per table opened and visually confirmed — **NOT RUN**
- [ ] Parent-record linkage spot-checked — **NOT RUN**

### What counsel needs in order to answer

Put in front of them, per document type, the count and the population it belongs to:

| Document type | Count | Population |
|---|---:|---|
| Driver's licences (Background Checks) | 283 | Applicants, most no longer customers |
| Driver's licences (Do Not Rent List) | 10 | Barred individuals, no relationship |
| Paystubs / income verification | 269 | Applicants, most no longer customers |
| Proof of insurance | ≤287 | Applicants |
| Background-check screenshots | ≤287 | Applicants — third-party report output |
| Citations & supporting docs (Tickets) | 308 | Renters; may have live legal/financial exposure |
| Vehicle photos, registrations, inspections (Fleet) | 41 | Company assets — low sensitivity |
| Receipts (Expenses) | 32 | Company records — tax retention likely applies |

The question per row is the one §4.2 names: retain (how long), or destroy now. **Over-retention
of identity documents is its own liability** — the default of "migrate everything because it is
easier" is the outcome the plan explicitly warns against.
