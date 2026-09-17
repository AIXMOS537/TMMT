# Adverse Action Process — DRAFT

**2026-09-01** · `[RECOMMENDED]` throughout. **Not legal advice. Requires attorney sign-off before use.**

What to do when a background check contributes to turning someone down — and what to do about the ones already turned down.

---

## 1. Why this document exists

TMMT screened rental applicants using **Intelius**. The company's own SOP says, verbatim:

> *"Intelius is **NOT** an official consumer reporting agency (CRA) — it is for informational screening only. Final adverse actions should be based on rental policy + insurance eligibility, not the report alone."*

**82 people were declined.** The recorded reasons:

| Reason | Count | Is it a background-check decision? |
|---|---:|---|
| `out of radius` | **49** | ❌ No — geography |
| `Not Eligible` | **24** | ⚠️ Probably yes |
| `Not found` | **9** | ⚠️ A search failure recorded as an outcome |

So the population that matters is **roughly 24 people**, not 82. That is a manageable number, and it is the reason this is worth doing properly rather than panicking about.

---

## 2. The legal fork — the first question for the attorney

Everything below branches on one determination, and it is **not** a determination this document can make:

> **Were these screenings "consumer reports" within the meaning of the FCRA?**

**If YES** — FCRA's adverse-action machinery applied and was not followed. There are notice obligations, and there may be exposure for the past decisions.

**If NO** — FCRA's specific notice duties may not attach. But that is not a clean escape: a provider that supplies data *used for* eligibility decisions can be treated as a CRA in fact regardless of its own disclaimers, and the disclaimer is evidence the data was known to be unsuitable for the purpose it was put to.

⚠️ **A vendor's terms of service cannot decide this.** Intelius saying it is not a CRA controls Intelius's marketing, not TMMT's obligations. Only the attorney can answer it.

**Ask the attorney in this order:**

1. Were these consumer reports under FCRA?
2. If yes, what is owed to the ~24 people declined on `Not Eligible`, given the business has since ceased operating?
3. Does state law (Virginia, and any other state where applicants lived) add anything?
4. Do the `out of radius` 49 need anything at all? *(Recommended view: no — geography is not a consumer-report decision. Confirm.)*
5. Is a `Not found` result an adverse action, or an incomplete process? *(Recommended view: incomplete process, not a decision.)*

---

## 3. The process, for any future screening

Standard FCRA two-step. Written here so the correct process exists on paper even while operations are stopped.

### Before you screen

- [ ] **Standalone written disclosure.** A document whose only subject is that a report may be obtained. Not inside the rental application, not inside the terms.
- [ ] **Written authorisation** from the applicant.
- [ ] **A certified permissible purpose** on file with the provider.
- [ ] **Use an actual FCRA-compliant CRA.** This is the change that matters most; the rest is procedure around it.

### Step 1 — Pre-adverse action

Sent **before** the decision is final.

| Must include |
|---|
| A statement that the application may be declined based in part on the report |
| **A complete copy of the report relied on** |
| A copy of *A Summary of Your Rights Under the Fair Credit Reporting Act* |
| The CRA's name, address and telephone number |
| How to dispute the accuracy of the report |

**Then wait.** `[RECOMMENDED]` **five business days** so the person has a genuine opportunity to correct an error before the decision closes. Do not send both notices the same day — a waiting period that isn't real isn't a waiting period.

### Step 2 — Final adverse action

Sent after the waiting period, only if the decision stands.

| Must include |
|---|
| That the application was declined |
| The CRA's name, address and telephone number |
| **That the CRA did not make the decision and cannot explain it** |
| The right to a **free copy** of the report from the CRA within **60 days** |
| The right to dispute the report's accuracy directly with the CRA |

### Record for every decision

| Field | Why |
|---|---|
| Applicant, date | Identity |
| Report provider and pull date | Which CRA, when |
| **The specific factor relied on** | Not just "Not Eligible" — *which* disqualifier |
| **Basis: report / policy / insurance / geography** | This is the field that is currently missing entirely |
| Who decided | Accountability |
| Pre-adverse sent, date | Proof |
| Waiting period ended | Proof the wait was real |
| Final adverse sent, date | Proof |
| Dispute raised, outcome | Follow-through |

> **The missing field is "basis."** Today `eligibility_status` records the *outcome* but never *what the decision rested on*. That single gap is why nobody can now say, for any of the 24, whether the report drove the denial or merely accompanied it. **Whatever gets built next must capture basis at the moment of decision.**

---

## 4. The people already declined

`[OPEN — attorney decides]` Whether anything is owed retrospectively, and what.

**Do not send anything yet.** An unprompted letter to 24 former applicants saying a report may have been used improperly is a legal communication with consequences. It might be exactly right. It is not a decision to make without counsel.

What to do now instead:

1. **Preserve the records.** All 24 decisions, their `eligibility_status`, and the associated documents. This is a live reason those Airtable records **must not be deleted yet** — see `COMPLIANCE-REMEDIATION-PLAN.md` P1.
2. **Reconstruct what can be reconstructed** — for each of the 24, what was recorded, when, and by whom.
3. **Take the list to the attorney** with the questions in §2.

---

## 5. What is different because the business stopped

| | |
|---|---|
| No new screening is happening | The forward-looking process in §3 is precautionary, not urgent |
| The 24 past decisions **do not expire** | Ceasing to trade does not discharge an obligation that already attached |
| The records are the evidence | Which is why P1 says **ask about retention before deleting anything** |
| A smaller, closed population | 24 people, fully enumerable. Easier and cheaper to resolve now than to have it surface later |

---

## 6. Sign-off

| | |
|---|---|
| Attorney determination on §2.1 (were these consumer reports?) | ⬜ |
| Attorney direction on the 24 past decisions | ⬜ |
| Forward process (§3) approved | ⬜ |
| A real CRA selected, if screening ever resumes | ⬜ |
| Record schema updated to capture **basis** | ⬜ |
