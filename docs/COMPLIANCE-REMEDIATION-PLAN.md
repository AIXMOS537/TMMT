# Compliance Remediation Plan

**2026-09-01** · Owner instruction: *"fix the compliance stuff first."*
Context: the rental operation stopped in June (`STOCKTAKE-RESULT-2026-09-01.md`). Owner states it went wrong and had to stop.

---

## The reframe that decides the order

While a business is running, holding customer data is an **asset** — you need it to operate.

When a business stops, the same data becomes a **liability**. There is no longer an operating reason to hold 304 people's driving licences, and the obligation to protect them does not stop just because the revenue did. Every week it sits there is a week of exposure with no upside.

> **So the priority is not "secure the data." It is "stop holding what you no longer need."**
> Deletion is the only remediation whose risk goes down over time instead of up.

That reorders everything below.

---

## ✅ What was checked and is genuinely fine

Verified live, 2026-09-01. Recording this because the earlier audit implied worse.

| Checked | Result |
|---|---|
| Legacy `anon` JWT key | **Disabled** ✅ |
| Anonymous read of `background_checks`, `people`, `ghl_contacts`, `incoming_leads`, `profiles`, `customer_intake_forms` | **401, blocked** ✅ |
| Anonymous read of `active_customers`, `customer_payments`, `documents`, `insurance`, `contracts`, `former_customers`, `do_not_rent_list`, `waitlist` | **200 with `[]` — RLS returning nothing** ✅ |
| Anonymous write (`POST /waitlist`) | **400, refused** ✅ |
| `org_id_for_host`, `acting_org_id` | Return `null` to anon — harmless ✅ |
| `eval_money_rails` | Token-gated, refused the probe ✅ |
| `submit_customer_intake` | Anon-callable **by design** — it is the public contact form. Well built: input length caps, `search_path` pinned, validation before insert ✅ |

> **Correction to an earlier alarm in this session.** A first probe reported eight tables as
> "readable by anyone." That was a **bug in the test script**, not a finding — it compared a
> response body that still had the status code appended, so an empty `[]` never matched.
> Re-tested against raw response bodies: every one returns empty. **There is no anonymous
> data exposure.** The false alarm is recorded here so nobody re-raises it from the advisor
> counts alone.

**Also disclosed:** probing `submit_customer_intake` created three real rows (a case
`TMMT-2026-00005`, an intake form, and a status-history row). All three were deleted
immediately and the deletion verified. No other production data was written during this work.

**Conclusion: the Supabase database is not the compliance problem.** The problem is in Airtable and Google Drive.

---

## 🔴 P1 — Data you are still holding and no longer need

**This is the one that gets worse with time.**

Airtable `Background Checks`, 304 people:

| Field | Type | Records holding data |
|---|---|---:|
| Driver's License | attachment | **283** |
| Paystub | attachment | **269** |
| Background Check Screenshot | attachment | **206** |
| Proof of Insurance | attachment | **52** |
| Key Details (extracted from screenshot) | AI text | 117 |
| | **Total PII attachments** | **810** |

Plus Airtable `Insurance`: fields named `LOGIN EMAIL` / `LOGIN PASSWORD` / `LOGIN PHONE`. Near-empty in practice (1 email, 0 passwords), but a password field in a shared base invites future misuse.

### Why it is sharper now than it was in June

- **No operating purpose.** The business reason for holding a renter's licence was to rent them a car. There are no cars.
- **The screening vendor was Intelius**, and the SOP says plainly: *"Intelius is NOT an official consumer reporting agency (CRA) — it is for informational screening only."* Using non-CRA data for eligibility decisions is the FCRA exposure; **the records of those decisions are still on file.**
- **Access is unmanaged.** Airtable `Employee Access Rights` has 1 row. Whoever had the base still has the base, including people who no longer work here.

### 🔴 The one thing to get right before deleting anything

**Do not bulk-delete yet.** If there were disputes, insurance claims, unpaid balances, repossessions, or anything that could become a claim, some of these records must be **preserved**, not destroyed — and destroying records once a dispute is foreseeable is a much worse problem than holding them.

`[OPEN — needs the lawyer, and it is the first question to ask]`
**Which records must be retained, for how long, and which can be destroyed now?**

Once answered, the work is mechanical:

| # | Step | Who |
|---|---|---|
| 1 | Ask counsel the retention question above | Owner |
| 2 | Export everything to one encrypted archive, offline, single holder | Owner (I can prepare the export) |
| 3 | Delete the attachments from Airtable once the archive is verified | Owner-gated |
| 4 | Delete the three `LOGIN *` fields outright — nothing needs retaining there | Owner-gated |
| 5 | Cut Airtable access to the current person only | Owner |

---

## 🔴 P2 — Marketing copy still promising outcomes

`Sales Call Script Template` in the Drive data room. **Last edited 2026-06-10 — the most recently touched document in the room.** Still contains:

> *"earning **$800 to $1,000+ a month** on autopilot"* · *"Secure **$50K+ in funding**"* · *"without lifting a finger"*

The compliant replacement (`★ Credit / Funding Marketing — HONEST + COMPLIANT DRAFT`) was written 2026-06-04 and describes that language as *"likely illegal under US credit-repair law (CROA) and FTC rules."*

**The bad file was edited six days after the fix existed.** So the fix was written and then not adopted.

**Cost to fix: about five minutes.** Nobody should be able to open the wrong one:

| Step | Action |
|---|---|
| a | Rename the old file to `ARCHIVED — DO NOT USE — Sales Call Script (pre-compliance)` |
| b | Move it out of `03_Sales_and_Scripts` into an archive folder |
| c | Rename the compliant draft to drop "DRAFT" so it reads as the live one |

These are edits to the owner's own Google Drive, so they are his to make — **I have not touched them.** Say the word and I will do exactly a/b/c and nothing else.

---

## 🟡 P3 — Contract templates pointing at the wrong state

The Data Room index and Dealership Pack both point at `Vehicle Lease Agreement - Template.pdf`, which contains:

- **Georgia law, Fulton County arbitration**, class-action waiver
- *"Greater Atlanta Area, defined as a 100-mile radius"*
- *"Payments shall be applied first to any outstanding late fees, then to **accrued interest**"* — the riba clause that was already flagged and rewritten

TMMT operates from **Springfield, Virginia**. The halal v3 replacement fixes all of it but is marked *"DRAFT — not yet binding."*

**Live footgun:** the superseded Deal Picker is still in the folder and still points at the old Lease v2. Whoever grabs the wrong file signs a Georgia contract with an interest clause.

Fix: archive the superseded picker and the Georgia template the same way as P2. Lower urgency only because nothing is currently being signed.

---

## 🟡 P4 — Obligations to former partners and customers

The business stopping does not close these out.

| Item | Detail |
|---|---|
| **The $75** | Asad's March payout: `(1440 × 70%) − 120 = $888`, but the report paid **$813**. Unexplained. If it repeated across months, it is a real debt |
| **Insurance charged at $120/month** | Partners were charged this per car. The JV v2 draft says $70; v3 leaves it blank. **And no TMMT insurance policy exists anywhere in Drive** — only an ID card for *Urban Fleet Solutions LLC*, a different company in Connecticut. If partners paid for coverage that cannot be evidenced, that needs answering |
| **Deposits** | Every template leaves the deposit amount blank, and the old lease says *non-refundable*. Any deposit held for a rental that ended when the business stopped needs a decision |
| **`do_not_rent_list`** | 12 people. If it was ever used to justify a denial based on a non-CRA report, the adverse-action question applies to them |

`[OPEN]` — Owner and counsel. Not a software problem, but the software is where the evidence lives.

---

## ⚪ P5 — Housekeeping, cheap, no urgency

- 12 `SECURITY DEFINER` functions carry `anon` EXECUTE. Verified harmless or intentional (§ above), **but** `acting_org_id` and `is_platform_admin` do not need to be anon-callable. Revoking those two is one line and risks nothing.
- 3 functions have a mutable `search_path` (`claim_agent_job`, `finish_agent_job`, `fail_agent_job`).
- 874 duplicate-permissive-policy warnings — RLS policies stacked by successive sessions rather than replaced. Performance, not security.
- `fleet.vin` holds corrupted JSON fragments rather than VINs.

---

## What I can do without you, and what I cannot

| Can do now | Needs your tap | Needs a lawyer |
|---|---|---|
| Prepare the Airtable PII export script (read-only until you run it) | Any Airtable deletion | The retention question (P1) — **ask this first** |
| Draft the adverse-action process document | Any Google Drive edit | Whether past denials need adverse-action notices |
| Revoke `anon` EXECUTE on the two functions that do not need it | Applying that to production | The insurance-charge question (P4) |
| Write the data-retention policy | Cutting Airtable access | Deposit and former-partner obligations |

---

## If you do only one thing

**Ask a lawyer the retention question in P1.** Everything else in this document waits on it, it costs one email, and it is the only item where delay actively increases the risk.

**If you do two:** the P2 rename. Five minutes, no downside, removes a live CROA/FTC problem.
