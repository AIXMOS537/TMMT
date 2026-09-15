# 1. Eligibility & screening

Source: Background Checks (`tbl1OFZh3cMXytNZM`), 304 Airtable records.
All option lists below read live from the base schema on 2026-09-15 — VERIFIED.

---

## 1.1 The four-signal model

Screening ran on four independent fields. Three share an identical vocabulary; the fourth is
the verdict.

| Signal | Field | Options |
|---|---|---|
| Background check | `Background Check Status` (`fld6hngljUeXAl8Qc`) | Pending · Verified · Failed |
| Insurance | `Insurance Check Status` (`fld8SH39nEAU6p0lo`) | Pending · Verified · Failed |
| Earnings | `Earnings Verification Status` (`flddkSUGoTEA0epXJ`) | Pending · Verified · Failed |
| **Verdict** | `Eligibility Status` (`fld1j6ktvWAjDTy9K`) | see §1.2 |

**Rule:** three independent checks feed a single human-set verdict.
**Encoded in:** four `singleSelect` fields. **No formula, no automation, no rollup connects
them** — VERIFIED: `Eligibility Status` has no formula config.
**Consistently enforced?** **No — there was never a rule to enforce.** The verdict was typed by
a person. The mapping from three signals to one verdict existed only in an operator's head.

> **This is the single most important finding for productization.** The plan asks for "the
> actual decision logic, including the combinations that were treated as borderline". There is
> no encoded decision logic to extract. A client install cannot ship a screening gate derived
> from this base, because the base does not contain one.

**Disposition: DECISION REQUIRED.** The owner must state the intended truth table — what
combination of the three signals produces Eligible, Not Eligible, or manager review. Until
that exists in writing, every client's eligibility gate is undefined. *Do not infer it from
the 304 historical rows; a pattern in past decisions is not a policy.*

---

## 1.2 Eligibility Status — the vocabulary drifted

Six options on the field that decides whether a person may rent a vehicle:

| Option | Assessment |
|---|---|
| `Eligible` | Intended |
| `Not Eligible` | Intended |
| `Need Manager's Review` | Intended — the borderline path |
| `out of radius` | Intended, but a *reason*, not an eligibility state |
| `ou` | **Data-entry artefact** — a truncated `out of radius` |
| `Not found` | Ambiguous — record not found, or person not found? |

**Consistently enforced?** **No — VERIFIED from the schema.** `ou` is a typo that became a
permanent option because Airtable creates a new choice on free typing. Anyone filtering on
`out of radius` silently missed every `ou` record.

**Two distinct concepts are conflated:** `out of radius` and `Not found` describe *why* a
decision was reached; `Eligible` / `Not Eligible` describe *what* it was. A client-facing
system needs `status` and `reason_code` as separate fields.

**Disposition: DECISION REQUIRED.**
- Canonical states — recommend `eligible` / `not_eligible` / `manager_review`.
- Reason codes — **BUSINESS POLICY REQUIRED.** Per `CLAUDE.md`, reason codes are never invented.
- The stray `ou` records need reclassifying before any migration treats them as a real state.

---

## 1.3 "Own Insurance?" — five options for a yes/no question

`Own Insurance?` (`fld6ATelA6miatxNr`) options: `Yes` · `No` · `Y` · `N` · `lno`

**Consistently enforced?** **No — VERIFIED.** Five choices for a boolean, including `lno`
(a slipped keystroke for `no`). Any logic reading `= "Yes"` missed every `Y`.

**Disposition: DECISION REQUIRED — recommend a true boolean** with the historical rows
remapped: `Yes`/`Y` → true, `No`/`N`/`lno` → false. That remap is a data change and needs a
change request; it must not happen silently inside a migration.

---

## 1.4 Documents collected at screening

| Document | Field | Records |
|---|---|---:|
| Driver's License | `fldDoihm4BZQpUPPt` | 283 |
| Paystub | `fldjkLKaOLEdcDI4O` | 269 |
| Proof of Insurance | `fldXctgEy97viNJOE` | ≤287 |
| Background Check Screenshot | `fld4LT3Lw33Eoy2Ny` | ≤287 |

**Rule:** screening collected licence, income evidence, insurance evidence, and a third-party
report screenshot.
**Consistently enforced?** **Partially — VERIFIED.** 283 of 304 records carry a licence; 21 do
not. 269 carry a paystub; 35 do not. Records were advanced without a complete document set.

**Disposition: DECISION REQUIRED** — which documents are *mandatory* to reach Eligible? That
becomes a hard gate in the product. It is also the question that determines the retention rule
scope (Phase 2 §4.2).

> **`Key Details (Extracted from Screenshot)`** (`fldIvE9LEsYirAA51`) is an `aiText` field —
> an AI summary of a background-check screenshot. **An AI-extracted summary of a consumer
> report driving an eligibility decision is FCRA-adjacent.** Flagged for counsel; out of scope
> to resolve here.
