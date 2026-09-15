# 2. Do-not-rent criteria

Source: Do Not Rent List (`tblE6nOqVcSeGFQCi`), **12 records** (Airtable 12 / Supabase 12 —
MATCH). Options read live 2026-09-15.

---

## 2.1 What lands someone on the list

`Source of Restriction` (`fld0zDZOdFkNHTAb1`): `Background Check` · `Internal Decision` ·
`Legal` · `External Report` · `Customer Feedback` · `Other`

**Rule:** a person is barred for one of six reasons, recorded alongside free-text
`Reason for Restriction` (`fld4OWeZFY7ooGrfp`) and `Date Added` (`fldbklMdnlISU9l0x`).
**Consistently enforced?** **UNKNOWN — not assessable without reading the 12 records,** which
means reading names and restriction reasons. Deliberately not done: 12 rows of adverse
decisions about named individuals is the most sensitive small table in the base, and the
question can be answered by the owner without exporting it anywhere.

**Disposition: DECISION REQUIRED.** `Internal Decision` and `Other` together can absorb any
case, which makes the taxonomy unfalsifiable. For a multi-tenant product each source implies
a different evidentiary standard — `Legal` and `External Report` are externally verifiable;
`Internal Decision` and `Customer Feedback` are not.

---

## 2.2 The AI risk classifier

`Alert Category (AI)` (`fldP46wvutiWZ7XI3`): `High Risk` · `Moderate Risk` · `Low Risk` ·
`Legal Issue` · `Customer Issue` · `Unknown`

**Rule:** an AI-assigned risk category sits on each barred person.
**Consistently enforced?** **UNKNOWN**, and the field name is the problem: it is marked `(AI)`
but is a plain `singleSelect` — **VERIFIED, it has no AI config and no formula.** Either a
human types the AI's answer in, or it is stale. Nothing in the base populates it automatically.

> **Do not carry this field forward as-is into a client product.** An AI-generated risk score
> attached to a named individual, driving a decision to refuse service, is a documented
> discrimination-exposure pattern. It also mixes categories: `High/Moderate/Low Risk` is a
> severity scale, while `Legal Issue` / `Customer Issue` are reasons.

**Disposition: DECISION REQUIRED — flagged for counsel before it ships to any tenant.**

---

## 2.3 Identity documents on the list — not in the plan's inventory

**10 of 12 records hold a driver's licence** (`fldPlsgIMB90K8fVb`) — VERIFIED.

This table was **absent from the plan's §4.1 attachment inventory.** It is arguably the most
sensitive set in the base: identity documents attached to an adverse decision, held on people
who have no ongoing relationship with the business and by definition will not return.

**Disposition: goes to counsel with the Phase 2 retention question.** The corrected
licence-bearing total is **293 records** (283 Background Checks + 10 here), not 283.

---

## 2.4 Rules that do not exist and must be written

The plan asks: *"What lands someone on the list, who can add, whether it is ever reversed."*
The base answers only the first, and only partially.

| Question | Encoded? | Status |
|---|---|---|
| What lands someone on the list | Partially — 6 source categories, free-text reason | Taxonomy needs tightening |
| **Who can add** | **No.** No approver, no `added_by`, no role restriction. | **BUSINESS POLICY REQUIRED** |
| **Is it ever reversed** | **No.** No removal date, no review date, no status. **A do-not-rent entry is permanent by omission.** | **BUSINESS POLICY REQUIRED** |

**Permanence-by-omission is the finding here.** Nothing in the schema lets a person come off
the list, and nothing records who put them on it. For a product sold to other operators, both
are required: an unappealable, unattributed permanent ban list is a liability for every tenant
that runs one.

**Disposition: DECISION REQUIRED on all three.** Recommend the product model carry
`added_by`, `approved_by`, `review_date` and an explicit `active` state — but the *policy*
(who may add, what reverses an entry) is the owner's to set, not Claude Code's to infer.
