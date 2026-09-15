# 7. Handover requirements

Source: Vehicle Handover (`tblKmdjH0tmKY9Bcl`). Read live 2026-09-15.

---

## 7.1 What blocks a handover — the four checkboxes

| Requirement | Field | Type |
|---|---|---|
| Required docs provided | `fldItf25W1pvypuZn` | checkbox |
| Inspection documents provided | `fldaAg72SHia5PvNx` | checkbox |
| Registration documents provided | `fldG1Zvp92I0xo8V6` | checkbox |
| Insurance documents provided | `fldYRodREGpX1jY59` | checkbox |

Plus two status fields:

- `Document Verification Status` (`fldlFbU8YwXHbuSOy`): `Pending` · `Verified` · `Missing`
- `Handover Status` (`fld7b9mtrFF02H3RA`): `Prepared` · `Completed` · `Issue - See Notes`

And two attachment fields: `Handover Checklist (Staff)` (`fldvGGwVdilFMGgQi`) and
`Customer Checklist (Received Documents)` (`fld73G2dwVGSHLi16`).

**Rule:** four document categories must be present, verified, and evidenced by a signed
checklist from both staff and customer, before a vehicle transfers.

**Structurally, this is the best-designed process in the base** — dual-party checklists,
separate verification status, itemised requirements.

---

## 7.2 The finding: it was never used

VERIFIED:

- **Vehicle Handover holds 1 record** (Airtable 1 / Supabase 1 — MATCH).
- **Zero records carry either checklist attachment** — both `Handover Checklist (Staff)` and
  `Customer Checklist (Received Documents)` are empty across the table.

Against **40 active customers** and **21 vehicles still marked `Rented`**, the handover process
ran once and produced no checklist evidence.

**Consistently enforced?** **No — it was essentially never performed as designed.**

This is the clearest instance of the pattern the plan predicted: *"Several were not consistently
enforced — that is a finding, and it is more valuable than the rule itself."* The rule here is
good. The enforcement was absent. **Carrying the rule forward without also building the
enforcement reproduces exactly this outcome at every client.**

### Why it matters beyond tidiness

Handover is the moment custody and liability transfer. Missing checklists mean:

- **No condition baseline.** Damage disputes cannot be adjudicated — there is no agreed record
  of the vehicle's state at handover. (`Customer Inspection Photos` holds **1 record**, and
  `Vehicle Onboarding Inspections` is **empty** — so there is no photographic baseline either.)
- **No proof the customer received documents** they are legally required to carry.
- **No evidence insurance was verified** before the vehicle went out — which, per the Partner
  Acquisition gate (doc 4 §4.4), is the term on which a personal auto policy voids.

---

## 7.3 Nothing enforced the checkboxes

**VERIFIED:** the four checkboxes have no formula, no automation, and no relationship to
`Handover Status`. A record can be `Completed` with all four unticked and
`Document Verification Status = Missing`. There is no equivalent of the Partner Acquisition
`⚠️ Gate Check` formula (doc 4 §4.4) on this table — which is notable, because the pattern
existed in the same base and was not applied here.

**Disposition: DECISION REQUIRED — recommend CARRY FORWARD the requirements and BUILD the gate.**

A concrete proposal for the owner to accept or correct — **INFERRED from the field structure,
not extracted as an existing rule:**

```
handover.status may become 'Completed' only when ALL of:
  required_docs_provided      = true
  inspection_docs_provided    = true
  registration_docs_provided  = true
  insurance_docs_provided     = true
  document_verification_status = 'Verified'
  staff_checklist_attachment    is present
  customer_checklist_attachment is present
AND the linked vehicle may only move Available -> Rented once this is satisfied (doc 5 §5.3)
```

Whether all four document categories are truly mandatory, or some are conditional (e.g.
insurance docs only when the customer carries their own policy — see doc 1 §1.3's
`Own Insurance?`), is **BUSINESS POLICY REQUIRED**.

---

## 7.4 Related: contracts are not here either

Handover links to `Contract` (`fldMMlbpdRo2fi56Y`). **Contracts holds 1 record with zero
signature attachments** (see `evidence/parity-report.md` §2.2).

So the full custody-transfer chain — signed contract → verified documents → dual checklists →
condition photos → vehicle status change — **has no evidence at any link.**

**Disposition: ESCALATED.** Where the executed rental agreements actually live is an open
question for the owner, and it blocks both Gate 1 ("every row reconciled or its absence
explained") and the completeness of the Gate 0 offline archive.
