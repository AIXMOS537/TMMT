# Data Retention Policy — DRAFT

**2026-09-01** · `[RECOMMENDED]` throughout. **Requires attorney sign-off before anything is deleted.**

What TMMT holds, why, for how long, and what happens to it afterwards — written for a business that has stopped operating.

---

## 1. The principle

> **Hold a person's information only while there is a reason to. When the reason ends, the information should end with it.**

While TMMT was renting cars, holding a renter's licence had an obvious purpose. **That purpose has ended.** What remains is a duty to protect data that no longer does any work — cost and risk with no upside.

But there is a countervailing rule that comes first:

> **⚠️ Nothing may be deleted while it might be needed as evidence.**
> If a dispute, claim, audit or regulatory question is live *or reasonably foreseeable*, the records must be **preserved**. Destroying records once a dispute is foreseeable is a far more serious problem than holding them too long.

**The second rule outranks the first.** That is why this policy cannot be executed until §3 is answered.

---

## 2. What is actually held

### Airtable — the highest concentration

| Table | What | Volume |
|---|---|---:|
| `Background Checks` | Driver's licences | **283** |
| | Paystubs | **269** |
| | Background-check screenshots | **206** |
| | Proof of insurance | **52** |
| | AI-extracted key details | 117 |
| | | **810 files, 304 people** |
| `Insurance` | `LOGIN EMAIL` / `LOGIN PASSWORD` / `LOGIN PHONE` | 1 email, 0 passwords, 0 phones |
| `Active Customers`, `Former Customers`, `Contracts`, `Customer Payments`, `Do Not Rent List`, `Tickets` | Names, contacts, payments, agreements, citations | — |

**Access control:** `Employee Access Rights` has **one row**. In practice, whoever was given the base still has it — including anyone who has since left.

### Supabase

Contacts, leads, cases, background-check status pointers, payments. RLS verified holding as of 2026-09-01; no anonymous access. The documents themselves are **not** here — Supabase holds only an `airtable_id` pointer. **Airtable is where the sensitive material actually lives.**

### Google Drive

Contracts, payout reports naming individuals, a payment tracking spreadsheet with named customers and outstanding balances, and ~25 unindexed scanned PDFs sitting outside the data room.

### Not held, and worth stating

No card numbers, no bank account numbers, no SSNs were found in any system audited. The sensitive categories are **identity documents, income documents and consumer-report screenshots.**

---

## 3. 🔴 The question that gates everything

**Ask the attorney, before deleting anything:**

1. **What must be retained, and for how long, now that the business has ceased operating?** Consider: tax and accounting records · signed rental agreements · insurance claims · the FCRA questions in `ADVERSE-ACTION-PROCESS.md` · outstanding balances · anything under dispute.
2. **Are any disputes live or foreseeable?** Former renters with balances, former partners on the payout discrepancies, insurance matters.
3. **Do the 24 people declined on `Not Eligible` require their records preserved** pending the adverse-action determination? *(Recommended assumption until told otherwise: **yes**.)*
4. **Does Virginia law add anything** beyond the federal position?

**Until these are answered, the correct action is: archive, restrict access, delete nothing.**

---

## 4. Proposed schedule `[RECOMMENDED]` — activates only after §3

| Category | Keep for | Then | Why |
|---|---|---|---|
| **Driver's licences** | Length of agreement + `[OPEN]` | **Delete** | Identity verification; no purpose survives the rental |
| **Paystubs** | Length of agreement + `[OPEN]` | **Delete** | Income verification; same |
| **Background-check screenshots** | 🔴 **Preserve pending FCRA determination** | Attorney directs | Evidence for the 24 decisions |
| **AI-extracted key details** | Same as the screenshots | Delete with them | Derived from consumer-report data; inherits its status |
| **Signed rental agreements** | Statutory contract period `[OPEN]` | Archive, then delete | Contractual and tax record |
| **Payment records** | Tax retention period `[OPEN]` | Archive | Accounting |
| **Do-not-rent list (12)** | 🔴 Preserve | Attorney directs | May relate to adverse decisions |
| **Contact details (leads, GHL)** | Until consent withdrawn or purpose ends | Delete on request | No operating purpose now |
| **Opt-out / do-not-contact list** | **Keep indefinitely** ✅ | Never delete | Deleting it would lose the record that someone opted out — the one list where retention *is* the protection |
| **Portal login credentials** | **Zero** ❌ | **Delete the fields now** | Never belonged in a business database. Nothing to retain |

> **The opt-out list is the exception that proves the principle.** Everywhere else, holding data is the risk. There, *losing* it is the risk — because the record that someone said "stop contacting me" must outlive everything else.

---

## 5. Sequence — once §3 is answered

| # | Step | Gate |
|---|---|---|
| 1 | Attorney answers §3 | **Blocks everything below** |
| 2 | Run `scripts/export-pii-archive.mjs` in inventory mode — confirm counts, download nothing | Safe, read-only |
| 3 | Run with `--download` to an **encrypted, non-synced** drive. One copy | Owner |
| 4 | Verify the manifest against the inventory | Owner |
| 5 | Delete the `LOGIN *` fields from Airtable `Insurance` — no retention basis exists | Owner-gated |
| 6 | Delete the attachments counsel has cleared. **Leave anything preserved under §3.** | Owner-gated |
| 7 | Cut Airtable access to the current holder only | Owner |
| 8 | Record what was deleted, when, and on whose authority | Owner |

**Step 8 matters more than it looks.** A deletion you cannot evidence looks the same from outside as data you lost track of.

---

## 6. If someone asks for their data

People retain their rights whether or not the business is trading. Requests will most likely come from former renters and the declined applicants.

- **Log it** with the date received.
- **Verify identity** before disclosing anything — a data request is also a social-engineering route.
- **Respond within the applicable window** `[OPEN — attorney confirms which law applies]`.
- **A deletion request does not override a preservation obligation.** Where records must be retained, say so plainly and explain why, rather than either deleting them or ignoring the request.

`[OPEN]` Who handles these now? **This needs a named person and a working email address that will still be monitored in a year.** An unanswered request is worse than a slow one.

---

## 7. What this policy will not do

- It will not delete anything before the attorney answers §3.
- It will not treat the vendor's "we are not a CRA" disclaimer as settling the FCRA question.
- It will not keep credentials under any retention basis. There isn't one.
- It will not delete the opt-out list.

---

## 8. Sign-off

| | |
|---|---|
| Attorney answers §3 | ⬜ |
| Retention periods in §4 confirmed | ⬜ |
| Archive created and verified (§5 steps 2–4) | ⬜ |
| `LOGIN *` fields deleted | ⬜ |
| Airtable access reduced | ⬜ |
| Named contact for data requests | ⬜ |
