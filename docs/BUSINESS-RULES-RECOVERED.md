# Business Rules Recovered from the Data Room

**2026-09-01** · Source: Google Drive `TMMT DATA ROOM` (`16H38Qbdjfiv20HXTel_steLqGVTHz-Hu`), read-only sweep.

The rules that were missing from the database and the repo are **in Drive**. This document pulls them out, states which are real, and names the contradictions — because there are a lot of them.

> **The one-line summary:** the qualification rules are real and detailed. The money rules exist in **four conflicting versions**. And **there is no evidence anywhere in Drive that TMMT holds an insurance policy** — despite every contract promising one.

---

## 1. Rental qualification — FOUND, and it is real ✅

**`Background Check Qualifications`** · modified 2026-06-04 · operational SOP, unsigned (staff guidance, not a contract).

This is a genuine, detailed screening policy that has been in use. It answers most of `05-OPEN-DECISIONS.md` §1.

**Identity gate.** Full legal name as on licence · DOB · current phone · current address · valid licence uploaded. Verbatim: *"If identity cannot be confidently matched → DO NOT PREQUALIFY"*

**Automatic denial, no escalation** `[STATED — in policy]`

| Category | Disqualifiers |
|---|---|
| **Violent** | Murder / manslaughter · attempted murder · assault (any degree) · domestic violence · kidnapping · armed robbery · sexual offenses — *"Zero tolerance. No exceptions."* |
| **Financial** | Theft, fraud or robbery **≥ $1,000** · auto theft · carjacking · organized retail theft · identity theft or credit fraud |
| **Weapons / drugs** | Illegal firearm possession · weapons trafficking · drug distribution or trafficking · felony drug manufacturing |
| **Driving** | DUI/DWI **within 7 years** · reckless driving · hit and run · driving on suspended/revoked licence · vehicular assault/manslaughter · racing · speeding **20+ mph over** |

**Escalate, don't auto-deny:** 3+ moving violations in 24 months · 2+ at-fault accidents in 36 months · non-violent misdemeanour older than 5 years · simple possession · single theft under $1,000 · traffic violations 5+ years old · any record ambiguity.

**Denial script:** *"Based on internal risk guidelines, we're unable to move forward at this time."*

### 1a. 🔴 The vendor is Intelius, and the document itself says it is not a CRA

Verbatim from the SOP:

> *"Intelius is **NOT** an official consumer reporting agency (CRA) — it is for informational screening only. Final adverse actions should be based on rental policy + insurance eligibility, not the report alone."*

**This needs legal review before anything else in this document.** Using a non-CRA data broker to make eligibility decisions about people is exactly the fact pattern FCRA is written around. The SOP's own workaround — *base the decision on policy, not the report* — is a distinction that has to hold up in practice, and right now the 5-value `eligibility_status` field records only the outcome, never which basis was used.

Note this makes 299 `background_checks` rows a different thing than the audit assumed. `[OPEN]` — is a real CRA needed, and what is the adverse-action process?

### 1b. Still missing from the qualification picture

The SOP is a **criminal and driving record screen only.** It does not cover:

| Missing | Where a partial answer lives |
|---|---|
| Minimum driver rating | **NOT FOUND ANYWHERE.** The "4.8 Uber rating" in the blueprint was an AI's hypothetical — do not build it |
| Minimum trips | **NOT FOUND** |
| Accepted platforms | **NOT FOUND** as a rule. Only keyword routing |
| Income minimum | Handled **by phone, not by rule**: *"our rentals typically start around $300 per week depending on the vehicle. Does that fit what you're looking for?"* Disqualifiers listed as *"Can't afford base pricing · Needs daily rentals only · No license · Wants 'cheap' or 'deals' · Won't commit to appointment"* |
| Service radius | Only the lease's *"100-mile radius, Greater Atlanta Area"* — **which is wrong, see §5** |

---

## 2. The payout formula — FOUND, from two real reports ✅

Folder 05 contains what its filename calls a template but is actually **an issued payout report**, plus a second one at the Drive root. These are the only real money documents in the room.

| Partner | Period | Vehicle | Gross | Insurance | Split | Paid |
|---|---|---|---:|---:|---|---:|
| **Marc** | Feb 2026 | 2013 Corolla, 30 days | $1,000 | $120 | **40/60** | **$480** |
| **Asad** | Mar 2026 | 2009 Corolla, 30 days | $1,280 | $120 | **30/70** | **$776** |
| **Asad** | Mar 2026 | 2010 Camry, 30 days | $1,440 | $120 | **30/70** | **$813** ⚠️ |

**The formula, reverse-engineered and verified:**

```
partner payout = (gross rental earnings × partner %) − insurance − expenses
```

It checks out exactly on two of three lines. `Marc: (1000 × 60%) − 120 = 480` ✓ · `Asad Corolla: (1280 × 70%) − 120 = 776` ✓

⚠️ **The third line does not compute.** `Asad Camry: (1440 × 70%) − 120 = $888`, but the report says **$813**. A **$75 gap with no stated expense.** Either a deduction went unrecorded or a partner was underpaid. This is precisely the failure mode the missing ledger produces, and it is worth checking whether it repeated.

**Cadence:** monthly. JV v3 §5 verbatim: *"Deductions are ITEMIZED and shared (receipts on request); only actual, agreed expense categories — no vague or hidden deductions."*

**Who pays what** `[STATED — in draft contracts]`

| Cost | Who |
|---|---|
| Insurance | **Partner** — deducted per car per month from payout |
| Routine maintenance, towing, trackers, keys, upkeep | **Partner** (JV v3 §7) — unless on Tier 5 |
| Booking, renters, claims, maintenance coordination, tolls, tickets, cleaning, reporting | **Company** |
| Citations | **Renter**, under the lease |

---

## 3. 🔴 The management fee exists in four conflicting versions

| Version | Modified | Status | Tiers |
|---|---|---|---|
| `TMMT_JV_Tiered_Program.pdf` | 2026-01-18 | Unsigned | 10 / 20 / 30% |
| JV Agreement v2 | 2026-06-04 | **DRAFT** | 10 / 20 / 30% |
| **JV Partner Agreement v3** | 2026-06-04 | **DRAFT — current** | **10 / 20 / 30 / 40 / 50%** |
| `TMMT_FULL_JV_CONTRACT_All_In_One_Tiered.pdf` | 2026-06-04 | Unsigned | same lineage as the first |

**v3 is current** and matches what you told me on 2026-06-04. Verbatim:

> Tier 1 — 10% (partner keeps 90%), basic management, up to 3 vehicles · Tier 2 — 20% (80%), up to 5 · Tier 3 — 30% (70%), up to 10 · **Tier 4 — 40% (60%), full-service** · **Tier 5 — 50% (50%), premium / done-for-you**
> *"(The higher fee must reflect MORE real services delivered — so it stays a fair service fee.)"*

**This confirms the tier-to-service recommendation in `PARTNER-MODEL-RECOMMENDATION.md` §4.2 is already your written policy.** It doesn't need inventing — it needs finishing and putting into the system.

### 3a. The 60% mismatch was already found — by your own contract review

The v2 draft contains this note, and it is the single most useful line in the whole Drive:

> **"[NOTE] Your internal P&L showed a 60% partner payout on some cars, but this contract says 70-90%. Reconcile which deal applies to which partner so records and contracts match."**

So the gap flagged in `PARTNER-MODEL-RECOMMENDATION.md` §3 is **a known, documented, still-unresolved problem** — not a new discovery. It has been sitting open since June.

And it is worse than a paperwork issue: **Marc's real February report is 40/60 — Tier 4, which did not exist in any contract at that time.** He was being paid on a tier that was not yet written down.

### 3b. The insurance deduction has three different values

| Source | Amount |
|---|---|
| JV v2 §5 | *"activation fees and **$70/month**"* |
| JV v3 §6 | **blank** — `$______ /month` |
| Both real payout reports | **$120** |

`[OPEN]` — which is right? Partners are currently being charged $120 against a contract that says $70 or says nothing.

---

## 4. 🔴 There is no TMMT insurance policy in Drive

This is the biggest evidentiary hole found anywhere in this project.

Every JV contract states *"Company maintains commercial insurance."* Partners are charged $120/month for it. **The Drive contains no policy, no declarations page, no certificate of insurance, and no broker agreement for TMMT Auto Services LLC.**

The only insurance document in the entire Drive is an **ID card** — not a declarations page — and it belongs to somebody else:

| Field | Value |
|---|---|
| Carrier | Mobilitas Insurance Company (via Roamly) |
| Named insured | **Urban Fleet Solutions LLC / Overland Indemnity, LLC / Sukul Barua** |
| State | **Connecticut** |
| Vehicle | 2020 Tesla Model Y |
| Period | 2025-07-01 → 2026-07-01 |

**TMMT Auto Services LLC is not the named insured.** Different entity, different state, different person.

**"National Fleet Underwriters"** — the carrier named in the `rental_insurance_products` table — **does not appear anywhere in Drive.** A full-text search returned three hits, all false positives on *"Nationwide Tire & Auto"* from repair invoices. **Treat it as a placeholder until a policy document is produced.**

Your own Investor Room index already lists this as a known gap: *"[ ] Active fleet list + insurance certificates."*

> **What this means for the open question in `05-OPEN-DECISIONS.md` §2b:** you told me the model is *"help them work with a broker and get their own, or if really needed I have my own companies I sell to qualified people."* Drive supports the **broker/referral** half — there is no TMMT carrier paper. The `tmmt_internal` "Shield" products in the database ($35/$55/$95 weekly) have **no policy behind them in any document found.** Selling those without underwriting paper would be a serious state-insurance problem. This needs an answer before that table is used.

**Roadside is real and named:** AAA Premier + Allstate Roadside, mandatory on JV vehicles, partner pays, screenshots to `operations@tmmtmgmt.com`.

---

## 5. 🔴 The lease template on file is for the wrong state

The Data Room index and the Dealership Pack both point at `Vehicle Lease Agreement - Template.pdf` — a blank, unsigned template that is **superseded** and contains:

- **Georgia law, Fulton County arbitration**, class-action waiver
- **"Greater Atlanta Area, defined as a 100-mile radius"** geographic limit

TMMT operates from **Springfield / Alexandria, Virginia**. Every current draft says *"Commonwealth of Virginia."*

It also contains the riba problem you had corrected: *"Payments shall be applied first to any outstanding late fees, then to accrued interest, and finally to the principal."*

**The current replacement** — `Vehicle Ijārah (Lease) Agreement v3 MULTI-STATE (halal)` — reverses all of it, and is marked **"DRAFT — review with a mufti + a licensed attorney in each state of operation before use. Not yet binding."**

| Term | Old template (still filed as canon) | Ijārah v3 (current draft) |
|---|---|---|
| Interest | applies to accrued interest | *"No interest of any kind"* |
| Late fee | kept | *"donated to CHARITY, never kept"* |
| Repossession | *"without prior notice"* | written notice + 48h cure, *"without breaching the peace (UCC §9-609)"* |
| Early return | 30 days' notice **+ 2 months' penalty + forfeit remaining** | *"paying only rent actually due through the return date"* |
| Deposit | *"non-refundable"*, **amount blank** | ʿarbūn, **amount blank** |
| Mileage | **15,000 miles/term**, overage blank | **blank** |
| Law | Georgia / Fulton County | *"State of ____ (default: Virginia)"* |

⚠️ **Live footgun:** the superseded Deal Picker is still in the folder and still points at the old Lease v2. Whoever grabs the wrong file signs a Georgia contract with an interest clause.

---

## 6. 🔴 The non-compliant marketing script is still live

`Sales Call Script Template` is the **most recently edited document in the Data Room** — modified **2026-06-10** — and it still contains:

> *"earning **$800 to $1,000+ a month** on autopilot"* · *"Secure **$50K+ in funding**"* · *"without lifting a finger"*

The compliant replacement (`★ Credit / Funding Marketing — HONEST + COMPLIANT DRAFT`) was written on 2026-06-04 and describes that exact language as *"likely illegal under US credit-repair law (CROA) and FTC rules."*

**The offending file was edited six days after the fix was written, and still carries the language.** If staff are working from it, that is active exposure. `[RECOMMENDED]` — archive or overwrite it today; it costs nothing.

---

## 7. Rental terms — what is actually settled

| Rule | Answer | Confidence |
|---|---|---|
| **Weekly pricing** | *"Sedans: starting as low as $300/week · SUVs: starting at $450/week."* Real per-car rates $300–$500/week | ✅ Real, in use |
| **Deposit amount** | **BLANK in every template.** There is no deposit policy anywhere in Drive | 🔴 Does not exist |
| **What the deposit covers** | Non-refundable earnest money if the renter walks — explicitly **not** a damage deposit | 🟡 Draft only |
| **Late escalation** | 4 steps then repossession. Day 1: *"our records show we did not receive your weekly payment due yesterday"* → *"we are allowing 48 hours"* → *"escalated to our Fleet Department for repossession."* Separate 24-hour ladder for 3-day rentals, same-night for daily | ✅ Real, in use |
| **Termination trigger** | Old: *"late more then 2 times"* → terminate + repo. v3: written notice + 48h cure first | 🟡 Contradiction |
| **Mileage limit** | 15,000/term in the old template; blank in v3 | 🟡 Unsettled |
| **Min / max period** | No contractual minimum. Sales target *"✅ Ideal: 30+ days."* Real cadences: daily, 3-day, weekly, monthly | 🟡 Practice, not policy |
| **Payment method** | Zelle or bank transfer per contract; Cash App in the actual ledger; Stripe subscription in the lead checklist | 🟡 Three answers |

**Real collection performance** (`Payment tracking spreadsheet`, Oct–Jan): weekly charges of $450 / $430 / $399 against six named customers, with **chronic arrears — one balance reaching $1,459.** That is direct evidence for the "collect more" problem, and it is a *collections* problem, not a pricing one.

---

## 8. Partners and vendors — who is actually named

| Role | Answer |
|---|---|
| **Background check** | **Intelius** — named, in use, **not a CRA** (§1a) |
| **Credit repair** | **All In One Management LLC** — named in the Operations Manager contract as providing credit repair services. **This is the owner's own entity** (see `SYSTEM_OF_RECORD.md` §9a). CROA applies, and so does related-party disclosure |
| **Roadside** | AAA Premier + Allstate Roadside — real, mandatory on JV vehicles |
| **Insurance carrier / broker** | **NOT FOUND** (§4) |
| **Funding partner** | **NOT FOUND.** The strategy memo says the model depends on them and instructs: *"Get the partner agreements in writing"* |
| **Former ops manager** | Tyrone Hicks Jr. — contract marked **RETIRED/superseded**, *"do not reuse it"* |

---

## 9. 🔴 There is no P&L

Searched title and full text for P&L, profit and loss, financial statement, income statement across the entire Drive. **Zero financial statements exist.**

The `$21,884 / $13,130 / $5,400` figures everyone has been quoting come from **one worksheet called `Selling prices for each car.docx`** — a weekly-rate list with a four-line expense block bolted on the end:

```
Total sales: $21,884
EXPENSES
Partner payout (60%): $13,130
Salaries: $5,400
Systems and software: $1,000
Rent: $212.50
```

**Four reasons not to use this number for anything external:**

1. **It is undated.** No period label anywhere. Last touched 2026-05-14.
2. **The 60% is a flat assumption applied to the whole book** — contradicted by the real reports (Marc 60%, Asad 70%) and by the contract tiers (70–90%).
3. **It is not a P&L.** No insurance, maintenance, fuel or repair line — despite $120/car/month insurance appearing in the payout reports.
4. **The car list contradicts itself** — two overlapping tables, one with 14 cars, one with 22.

Sales minus listed expenses = **$2,141.50**, which is not a real margin because the real costs are missing.

Your own Investor Room index agrees, listing as *not yet present*: financials, trailing revenue, unit economics, P&L, cap table, active-rental counts, bank statements — and closing with: ***"Verify every figure before sharing externally."***

⚠️ **Do not put $21,884 in an investor document.**

---

## 10. What this changes

| Doc | Change |
|---|---|
| `05-OPEN-DECISIONS.md` §1 | **Largely answered.** Criminal/driving criteria are real and detailed. Rating, trips, platforms, income and radius remain genuinely open |
| `05` §2b (insurance) | **Escalated.** No TMMT policy exists in Drive; "National Fleet Underwriters" is unevidenced; the `tmmt_internal` products have no paper behind them |
| `05` §3 (splits) | **Answered in shape, open in numbers.** v3's 10/20/30/40/50 ladder is the current written policy; the 60%-vs-70–90% reconciliation is still owed |
| `05` §4 (partners) | Intelius, AAA, Allstate, All In One Management named. Credit partner and funding partner still unnamed |
| `PARTNER-MODEL-RECOMMENDATION.md` §4.2 | **Confirmed** — the tier-to-service ladder is already your written policy, not a proposal |
| `02-CURRENT-STATE-AUDIT.md` §7B | **Sharper.** The FCRA issue is not just storage — it is the use of a non-CRA vendor for eligibility decisions |

## 11. New items for the compliance queue

| # | Item | Why |
|---|---|---|
| C1 | **Intelius is not a CRA** but drives rental eligibility | FCRA. Legal review before more screening runs |
| C2 | **No TMMT insurance policy evidenced**, partners charged $120/mo for it | Contractual and possibly regulatory |
| C3 | **`tmmt_internal` insurance products have no underwriting paper** | State insurance regulation |
| C4 | **Non-compliant marketing script still live**, edited after the fix | CROA / FTC. Fixable today |
| C5 | **Georgia lease template still filed as canon** for a Virginia business | Wrong governing law; also contains the interest clause |
| C6 | **Superseded Deal Picker still present**, points at the wrong lease | Someone will sign the wrong contract |
| C7 | **$75 unexplained payout gap** on Asad's Camry line | Partner may have been underpaid; check for repeats |
| C8 | **All In One Management provides credit repair and is owner-affiliated** | CROA + related-party disclosure |
