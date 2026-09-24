# 6. Customer lifecycle

Sources: Incoming Leads (`tbl4gndUYeiOUWYRR`), Waitlist (`tblaYxS00uU1dBNGX`), Appointments
(`tblAIzg1np4l9fCL3`), Active Customers (`tblFJIhonUvf631uM`), Former Customers
(`tblnU7oicHjc6Vqlp`). Read live 2026-09-15.

---

## 6.1 The intended pipeline

Per the plan §6:

```
Incoming Lead -> Background Check -> Waitlist -> Appointment -> Contracting
              -> Active Customer -> Former Customer     (+ repossession path)
```

The table structure supports it. **The status vocabularies do not** — each stage invented its
own, and they do not line up.

## 6.2 Stage vocabularies as actually encoded — VERIFIED

**Incoming Leads `Status` (`fld930xkWGfScnRGD`) — 12 options:**
`New Lead` · `Qualified` · `Contracting` · `Closed` · `vehicle returned` · `Active customer` ·
`Contacted` · `Follow-Up` · `Not Interested` · `DND` · `Duplicate` · `Converted`

**Waitlist `Status` (`fldK5Hr5poyTlb8Tz`) — 8 options:**
`Waiting` · `Contacted` · `Converted` · `Not Interested` · `Removed` ·
`keep updated on new availability` · `Out of radius` · `Reach out later`

**Active Customers `Status` (`fldF75xdQbWxPDyeu`) — 3 options:**
`Active` · `Removed` · `Contacted`

**Active Customers `Repo Status` (`fld1bLJaes0VnX2Yd`) — 3 options:**
`Not Repossessed` · `In Repossession Process` · `Repossessed`

### The finding: the lead status field became a shadow lifecycle

`Incoming Leads.Status` carries `Active customer` and `vehicle returned` — **two states that
belong to entirely different tables.** A lead record can claim the customer is active while
`Active Customers` holds the authoritative row. Two systems of record for one fact, inside one
base.

Also visible: casing drift (`Active customer`, `vehicle returned` lowercase against
`New Lead`, `Qualified` title case) — the same free-typing artefact as doc 1's `ou`.
And three distinct ways to express "no": `Not Interested`, `DND`, `Closed`.

**`DND` is the one to flag.** A do-not-disturb marker living as one of twelve values in a
general status field is not a suppression mechanism — setting the status to anything else
silently clears it. Phase 6 §8.2 requires the DNC check to **fail closed**; a status option
cannot deliver that. Real suppression belongs in `do_not_contact_numbers` (78 rows), which is
the table with the documented fail-open incident.

**Consistently enforced?** **No.** Overlapping vocabularies, cross-table state duplication, and
a suppression flag that is not a suppression mechanism.

**Disposition: DECISION REQUIRED.** Recommend one canonical `pipeline_stage` vocabulary shared
across tables, with per-table status dropped, and DND moved out of status entirely. **The
canonical stage list is BUSINESS POLICY REQUIRED** — do not derive it by merging the three
lists above.

---

## 6.3 The stage counts do not describe a funnel

VERIFIED row counts:

| Stage | Airtable | Supabase |
|---|---:|---:|
| Incoming Leads | 871 | 885 |
| Background Checks | 304 | 299 |
| Waitlist | 104 | 104 |
| **Appointments** | **1** | **1** |
| Active Customers | 40 | 35 |
| **Former Customers** | **2** | **1** |

**Appointments holds 1 record.** A year of operations that produced 40 active customers
recorded one appointment. The Appointments table — with `Appointment Type`, `Assigned Staff`,
`Confirmed Time Slot`, `Vehicle Preference Confirmed` — was built and effectively never used.

**Former Customers holds 2 records** against 40 active customers, for a business that has now
ceased trading. The offboarding step was not performed.

**Consistently enforced?** **No.** Two of the seven pipeline stages were essentially never
populated.

**Disposition: DECISION REQUIRED.** Is scheduling part of the product (rebuild it properly) or
did the business genuinely not need it (drop the stage)? Shipping an appointments module
validated by one record is shipping an untested feature.

---

## 6.4 The repossession path

`Repo Status` on Active Customers: `Not Repossessed` · `In Repossession Process` · `Repossessed`.

**Rule:** repossession is tracked as a flag on the customer, independent of `Status`.
**Consistently enforced?** **UNKNOWN** — distribution not counted; it would require reading
customer rows.

**Encoded triggers: none. VERIFIED** — nothing connects `Repo Status` to
`Payment Status`, `Payment Reliability Rating` (A/B/C) or `Ticket Balance Status`. What causes a
move into `In Repossession Process` lived entirely in an operator's judgement.

**Disposition: BUSINESS POLICY REQUIRED — and it is Phase 6's day-10 rung.** The delinquency
ladder's final step is "suspension / recovery decision". That is this field. The threshold that
triggers it must be stated by the owner and must route through the owner-approval gate:
repossession is a customer-facing, financial and legal action, and `CLAUDE.md` requires it
terminate at an owner-approval step. **It must never be automated.**

> `Payment Reliability Rating` (A · B · C) exists and has **no encoded definition** — no
> formula, no criteria. What earns a B rather than a C is undocumented. As an input to a
> recovery decision it is **BUSINESS POLICY REQUIRED**.
