# Operator Programme — What Exists, What's Missing, What to Build

**2026-09-01** · Owner instruction: *"I need my operator program running and working, educating people who wish to earn with their car and/or setup an LLC and get funding to buy cars to earn and us manage. For credit and funding I have another company I work with… we are affiliates of them. We intake clients and send over their profile to the team who does any and all."*

---

## 1. The headline

**This is the most-built thing in the business, and it is closer to working than anything else.**

The education exists and people are moving through it. The compliance posture is already correct — the training itself teaches *"affiliate, never provider."* The referral table is textbook-designed for exactly the model described above.

**The one thing missing is the wiring between them.** Nobody ever connected intake → application → referral → outcome. Module 22's pass criteria is literally *"partner_referrals row written with consent"* — and `partner_referrals` has **zero rows**.

---

## 2. What is genuinely alive

| Table | Rows | |
|---|---:|---|
| `operator_training_progress` | **120** | People really are working through the modules |
| `affiliate_links` | 20 | |
| `operator_profiles` | 19 | Against a 100 cap |
| `operator_training_modules` | **15** | Real curriculum — objectives, drills, pass criteria, content |
| `journey_checkpoints` | 8 | The progression path, configured |
| `programs` | 7 | Keyword routing |
| `operator_pipeline_tracker` | 4 | |
| `credit_education_sections` | 3 | |
| `credit_product_catalog` | 3 | Config, unconfirmed |

### The curriculum, in full

Three tracks plus a capstone. Every module has an objective and a pass criterion — this is real instructional design, not placeholders.

**Core (6 modules, 4 hours)**
1. The model & your hat — *explain the 3 layers (AIXMOS platform / TMMT+MOE services / operators)*
2. **Compliance (non-negotiable)** — *approved language; never banned words; MOE = affiliate not provider*
3. Drive the Brain · 4. The platform · 5. The ascension pyramid · 6. Pipelines & SOPs

**TMMT track (5 modules)** — fleet onboarding · dispatch & delivery · rental and LTO contracts · collections & A/R · unit economics

**Partner track (3 modules)** — this is the credit/funding handoff, and it is already correct:
- *"Affiliate, never provider"* — pitch **"our partner"** + FTC disclosure
- *"The affiliate handoff flow"* — consent → link with subid → status → commission. **Pass: `partner_referrals` row written with consent**
- *"Consent & data"* — capture consent **before** any PII; **retain nothing** of the partner's clients

**Capstone** — run a real lead end-to-end. *"Any banned-word or consent miss = retake."*

> **Someone built this properly.** The compliance framing you need is not something to invent — it is already written, already taught, and already has pass/fail criteria attached to it.

---

## 3. What is empty — and this is the whole build

| Table | Rows | What it is meant to hold |
|---|---:|---|
| **`partner_referrals`** | **0** | **The handoff itself.** The model you described |
| `program_applications` | **0** | The intake form submission |
| `credit_education_acknowledgments` | **0** | ⚠️ CROA disclosure acknowledgement |
| `credit_enrollments` | 0 | |
| `journey_checkpoint_events` | 0 | Progress against the 8 checkpoints |
| `training_module_progress` | 0 | (a second, unused progress table) |
| `lto_agreements` | 0 | |
| `program_documents` | 0 | |
| `operator_va_assignments` | 0 | |

### The two tables are already the right shape

**`partner_referrals`** — `source_org · dest_org · source_contact_ref · reason · consent_captured_at · consent_channel · status · commission_cents · handoff_event_id · accepted_at · completed_at · paid_at · source_operator_id · affiliate_user_id`

That is exactly *"we intake clients and send over their profile"* — with **consent captured as a timestamp and a channel**, the full lifecycle, and commission attribution. Nothing needs designing.

**`program_applications`** — `access_token · ghl_contact_id · email · client_name · track · status · payload · overall_readiness · client_consent_given · consent_timestamp · submission_method · submission_reference · source`

The intake, with consent as a first-class field and a readiness score.

> **`consent_captured_at` here is also the answer to the TCPA problem** in `CUSTOMER-PRESERVATION-AND-REROUTE.md` §3. The mechanism for recording consent already exists. It has simply never been used.

---

## 4. 🔴 The training names a partner that was terminated

`partners` holds one row:

> **`moe-legacy` — "Moe Legacy (Umar) — FALLBACK ONLY"** · type `credit` · `active: false`
> *"EXTERNAL / **Umar-owned**. Back-pocket fallback only — replace with your own credit partner ASAP. Commission attributes to YOUR operator via `partner:taha`.*
> ***DEACTIVATED 2026-07-01 (TERMINAL CUT). Do not re-enable."***

Meanwhile **three active training modules teach operators to pitch "our partner MOE Legacy."**

**So 19 operators are being trained to refer clients to a partner that was terminally cut on 1 July.** That is a live problem whichever partner you are using now, and it is the first thing to fix.

Three further things worth noting, plainly:

- **The cut was 2026-07-01** — two weeks after the fleet froze on 17 June. Those events are probably related.
- **MOE Legacy is Umar-owned.** *Umar* also appears as a vehicle partner at a 70% share, and is named in `CLAUDE.md` §5 as the **compliance co-approver**. If that is one person, he sat on three sides of the same table. Worth being deliberate about going forward.
- **`credit_education_acknowledgments` is empty.** If CROA disclosures are meant to be acknowledged before enrolment, nothing records that they were.

`[OPEN — blocking]` **Is the company you are working with now MOE Legacy, or a different one?** The answer changes what gets built:

| If… | Then |
|---|---|
| **A different company** | Add it as a new `partners` row, update modules 21–23 to name it, leave the MOE row deactivated |
| **MOE Legacy again** | Someone deliberately wrote *"do not re-enable"* — that decision needs revisiting on the record before it is undone, not silently overwritten |

---

## 5. The product, as you described it

Two doors into the same destination:

```
                    ┌─────────────────────────┐
                    │  Person wants to earn   │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
   ┌────────────────────┐              ┌────────────────────┐
   │ ALREADY HAS A CAR  │              │  NEEDS A CAR       │
   └─────────┬──────────┘              └─────────┬──────────┘
             │                                   │
             │                          intake + consent
             │                                   │
             │                          referral to partner
             │                          (LLC · credit · funding)
             │                                   │
             │                          ── partner does the work ──
             │                                   │
             │                          outcome back to TMMT
             │                                   │
             │                            client buys a car
             │                                   │
             └─────────────────┬─────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │  TMMT MANAGES IT    │
                    │  owner keeps a      │
                    │  share of earnings  │
                    └─────────────────────┘
```

### ✅ This revives the migration I wrote off

I marked `vehicle_owners` + `owner_agreements` as **void** when the fleet came back empty. **That was right for the old model and wrong for this one.**

The destination of both doors is *a client owns a car and TMMT manages it* — which is exactly what those two tables model. The difference is whose capital buys the car: previously TMMT's or an investor's, now the client's, via funding they obtained themselves.

**`CHANGE_REQUEST_001` is un-voided and becomes Phase 2 of this build.** The migration needs no changes — `owner_agreements` is already per-vehicle with a cost-recovery base and a tiered share, which is precisely the management arrangement here.

---

## 6. Build order

| # | Build | Depends on |
|---|---|---|
| **0** | **Fix the partner name in modules 21–23.** Nobody should be trained to pitch a terminated partner | §4 answer |
| **1** | **Intake form → `program_applications`**, with consent as a required field, not a checkbox afterthought | — |
| **2** | **Referral handoff → `partner_referrals`** — write the row, capture consent timestamp and channel, send the profile, store the reference | §4 answer |
| **3** | **Status back from the partner** — `accepted_at` → `completed_at` → outcome. Without this you are referring into a void |  2 |
| **4** | **Wire `journey_checkpoint_events`** so the 8 configured checkpoints actually record progress | 1 |
| **5** | **Operator dashboard** — their pipeline, their referrals, their commission | 2, 3 |
| **6** | **Client-owner management** — `vehicle_owners` + `owner_agreements` from `CHANGE_REQUEST_001` | 3 |
| **7** | **Owner statements** — what the car earned, what it cost, what they are paid | 6 |

Steps 1–3 are the business you described. Steps 6–7 are the reason it is worth doing.

---

## 7. Compliance rules, already yours

These come from the training itself, not from me. They are already the standard operators are certified against.

| Rule | Source |
|---|---|
| **Affiliate, never provider.** TMMT refers; the partner performs | Module 21 |
| **FTC disclosure present** in the pitch | Module 21 |
| **Consent captured before any PII moves** | Module 23 |
| **Retain nothing of the partner's clients** | Module 23 |
| **No banned words.** A single miss = retake | Capstone |
| **Money, sending, signing stay owner-gated** | Standing rule |

Two additions this build must respect:

- **CROA:** `credit_education_acknowledgments` is empty. If a disclosure must be acknowledged before enrolment, the flow has to write that row — and the flow must not accept a fee before the service is performed.
- **Related-party:** All In One Management is the owner's own entity. Where money or referrals flow between entities under common ownership, that must be disclosed as such, not presented as an arm's-length referral.

---

## 8. What I need from you

| # | Question | Blocks |
|---|---|---|
| 1 | **Is the credit/funding partner MOE Legacy, or a different company?** Name it | Steps 0, 2 |
| 2 | If different — is MOE Legacy's *"do not re-enable"* still standing? | Step 0 |
| 3 | What does the partner send back, and how? Email, portal, a link with a subid? | Step 3 |
| 4 | Commission terms per referral | Step 2 |
| 5 | For a client who buys their own car — what is TMMT's management share? | Step 6 |
| 6 | Is *Umar* the compliance co-approver the same Umar who owns MOE Legacy and a 70% vehicle? | Governance |
