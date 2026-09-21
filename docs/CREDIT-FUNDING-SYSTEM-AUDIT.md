# Credit & Funding System — What's Actually Built

**2026-09-01** · Owner: *"already have a designed schema and partly working credit client tracking and funding meter and tracker inside our main TMMT app… they have given us their affiliate link for MyFreeScore… and we also got a Dispute Fox account that it needs to link with."*

Found it. It is real, it is well built — and it does something different from what you described.

---

## 1. What exists

### The app

| Path | What |
|---|---|
| `/command/credit-dispute` | The main console |
| `/command/credit-dispute/import` | **Imports MyFreeScoreNow *and* Dispute Fox reports** |
| `/command/credit-dispute/[id]` | Per-client view |
| `/admin/credit-funding` | Admin surface |
| `/forms/credit-funding-intake` | **The public intake form** |
| `/legal/credit`, `/legal/funding` | Legal pages |

### The engine

| File | What it does |
|---|---|
| `engine/funding-readiness.ts` | **The funding meter.** 0–100 score, five tiers (`not_ready` → `warming` → `almost` → `funding_ready` → `elite`), thresholds at **620 / 680 / 720 / 760**, and it returns blockers, wins and next steps |
| `engine/deep-audit.ts` | Report analysis |
| `engine/protocol.ts` | Round sequencing |
| `letters/generator.ts` | ⚠️ **Generates six kinds of dispute letter** — see §2 |
| `letters/advanced.ts` | Additional letter types |
| `importers/myfreescorenow.ts` | MFSN parser. Notes *"no public API — operators capture report data via affiliate portal"*, and carries an `affiliateRef` field |
| `importers/disputefox.ts` | Dispute Fox JSON + CSV parser |

**The funding meter is genuinely good work.** It is the piece you remembered, and it does what you'd want.

### The database

| Table | Cols | Rows |
|---|---:|---:|
| `credit_funding_sessions` | **45** | 1 |
| `credit_education_sections` | 6 | 3 |
| `money_meter_accounts` | 5 | 1 |
| `dispute_clients` | 9 | **0** |
| `money_meter_events` | 12 | **0** |
| `credit_enrollments` | 13 | **0** |
| `credit_billing_plans` | 18 | **0** |
| `credit_payment_schedule` | 9 | **0** |
| **`credit_education_acknowledgments`** | 5 | **0** |

Plus six migrations: `credit_funding_sessions`, `dispute_engine`, `dispute_engine_rls`, and three for `money_meter`.

**Verdict: extensively built, essentially never run.** One session, zero clients, zero letters, zero enrolments.

---

## 2. 🔴 The contradiction

Your instruction was: **"we intake clients and send over their profile to the team who does any and all."**
Your training says: **"Affiliate, never provider."**

But `letters/generator.ts` exports:

```
generateInitial611()            FCRA §611 dispute to the bureau
generateMethodOfVerification()  MOV demand
generateFactualConfrontation()  factual dispute
generateFurnisher623()          FCRA §623 dispute to the furnisher
generateFdcpaValidation()       FDCPA debt validation
generateCfpbEscalation()        CFPB complaint escalation
recommendRoundSequence()        which letters, in what order
```

And the console describes itself, on screen, as:

> **"AIXMOS in-house — Dispute Fox + MyFreeScoreNow → client_journey → funding handoff"**

### Why this matters, plainly

**Generating dispute letters for a consumer, for a fee, makes you a Credit Repair Organization under CROA.** Not a referrer. Not an affiliate. A provider.

That is a completely different regulatory position, and it brings:

| Requirement | Status |
|---|---|
| Written contract with the statutory CROA disclosures | ⬜ |
| Separate *Consumer Credit File Rights* disclosure, signed before contract | ⬜ |
| **Three-day right to cancel**, in writing | The `dispute_engine` migration has a `cancel_by` column — so it was thought about |
| **No fee before services are fully performed** | ⚠️ `credit_product_catalog` holds $97/mo, $250 down + $250, and $1,000 DFY |
| No untrue or misleading representations | The archived script promised *"$50K+ in funding"* |

**And `credit_education_acknowledgments` has zero rows.** Whatever disclosure flow was designed, nothing has ever recorded that a client acknowledged one.

### The good news

**Nothing has run.** Zero dispute clients, zero letters generated, zero enrolments, zero billing plans. **The exposure is prospective, not historical** — which makes this a decision to make now rather than a mess to clean up.

---

## 3. The fork — this is the decision

### Option A — Affiliate only *(matches what you told me, and what you already teach)*

TMMT intakes, gets consent, hands the profile to the partner. **The partner performs the work.** TMMT tracks the referral and its outcome, and earns affiliate commission.

| Keep | Turn off |
|---|---|
| `/forms/credit-funding-intake` — the intake | **`letters/generator.ts` — all six letter types** |
| `funding-readiness.ts` — the meter, as an internal screening view | `letters/advanced.ts` |
| MyFreeScoreNow affiliate link + `affiliateRef` | The "AIXMOS in-house" framing on screen |
| Dispute Fox import — *reading* partner progress | Any TMMT-side dispute workflow |
| `partner_referrals` — the handoff | |

`[RECOMMENDED]`. It matches your instruction, matches the training operators are certified against, keeps TMMT out of CRO status, and **needs no new compliance apparatus.**

> The reason to actively disable the letter generator rather than just not use it: **its availability is what converts a referrer into a provider.** A console that can produce a §611 letter is hard to describe as referral-only.

### Option B — In-house provider

TMMT/AIXMOS performs credit repair itself. The system already largely supports it.

Then, before one letter is sent: CROA contract and disclosures wired to enrolment · three-day cancellation honoured · **fee timing restructured so nothing is collected before performance** · `credit_education_acknowledgments` actually written · all marketing reviewed · state registration and bonding checked.

That is a real business with real obligations. Viable — but it is not what you described, and it needs counsel before any of it runs.

---

## 4. The MyFreeScoreNow / Dispute Fox wiring you asked about

Both importers exist and parse correctly. What is missing is the connection *between* them and the rest.

| # | Build | Notes |
|---|---|---|
| 1 | **Store the MFSN affiliate link as config**, not hardcoded | One row in a config table; operators share the same link with a per-client `subid` so outcomes attribute back |
| 2 | **Wire intake → `program_applications`** | The form exists; it does not write the row. `client_consent_given` + `consent_timestamp` are already columns — use them |
| 3 | **Wire application → `partner_referrals`** | Capture `consent_captured_at`, `consent_channel`, `dest_org`, and the affiliate reference |
| 4 | **Dispute Fox import → status back** | Under Option A this is how you learn what the partner did. Import their progress; do not run the workflow yourself |
| 5 | **Funding meter reads real scores** | `funding-readiness.ts` works — it just has no data. MFSN import feeds it |
| 6 | **Money meter events** | `money_meter_events` is empty; commission per referral belongs here |

⚠️ Module 23 says *"retain nothing of the partner's clients."* Importing full credit reports into TMMT's database is in tension with that. **Decide deliberately what you store**: a readiness tier and a status is very different from a complete tri-bureau report. `[OPEN]`

---

## 5. What I still need

| # | Question | Blocks |
|---|---|---|
| 1 | **Option A or Option B?** | Everything |
| 2 | **The partner's name** — you said a different company from MOE Legacy, but not who | Adding the `partners` row, rewriting training modules 21–23 |
| 3 | Commission terms per referral | The money meter |
| 4 | Do you store their credit reports, or only a readiness tier? | §4 item 4 |
| 5 | Are the three credit products ($97/mo · $250+$250 · $1,000) still real? | Under Option A they may not be TMMT's products at all |

---

## 6. Recommendation

**Take Option A, and disable the letter generator this week.**

You told me the model is intake-and-refer. Your operators are already trained and tested against *"affiliate, never provider."* The letter engine is the one thing in the system that contradicts both — and since it has never been run, switching it off costs nothing and closes the gap entirely.

Everything else here — the funding meter, the importers, the intake form, the referral table — **fits Option A exactly and just needs connecting.**
