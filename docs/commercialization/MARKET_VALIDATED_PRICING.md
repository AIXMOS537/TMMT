# MARKET-VALIDATED PRICING

External research pass. Retrieved **2026-09-07**, US market.
Companion to `TECHHAUS_CATALOG.md`. **No prices were changed in code, database,
checkout or contracts by this pass.**

Comparable grades: **A** direct · **B** strong analog · **C** weak context.

---

## 0. THE FINDING THAT REFRAMES EVERYTHING

TechHaus prices have been compared against the wrong market.

| Market | Price | Grade |
|---|---|---|
| Car-rental **software** (SaaS) | **$49–$400/mo**; setup ~**$650**; $4–5/vehicle/mo mid-market | B |
| Fractional **operations** (COO-level) | **$5,000–$12,000/mo**; $6–10k for 10–15 hrs/wk; **$175–$400/hr** | A |

TechHaus's proposed **$3,750/mo** sits *between* them — roughly **10–25× rental
SaaS** and **below the fractional-ops floor**.

**Both readings cannot be right.** The number is only defensible as **managed
operations**. Sold as "rental software", it is indefensible at any price above a
few hundred dollars a month. Sold as "we run your back office", it is arguably
**underpriced**.

> **This is a positioning decision, not a pricing decision — and it is worth more
> than any number in this document.**

---

## 1. RENTALS BACK-OFFICE — $15,000 + $3,750/mo

**Implementation, $15,000.** Market evidence: *"Most small businesses pay
$10,000–$15,000 for a complete implementation including automation setup,
integration, and training."* Custom internal tools run **$20K–$60K**.

| | |
|---|---|
| Market floor | **$10,000** |
| **Recommended test price** | **$12,500–$15,000** |
| Premium | $25,000+ — requires a reference customer and a case study |
| Confidence | **MEDIUM-HIGH** — sits at the top of a well-attested band |

$15,000 is **defensible but at the ceiling** of the small-business band. With zero
references, the top of a band is the hardest place to sell from.

**Recurring, $3,750/mo.** Against fractional ops ($5,000–$12,000) this is
**below floor**. Against rental SaaS it is 10–25× over.

| | |
|---|---|
| If sold as software | overpriced by an order of magnitude — **do not** |
| If sold as managed operations | **underpriced**; floor is ~$5,000 |
| **Recommended founding price** | **$2,500–$3,750/mo** — buy the reference |
| **Standard after proof** | **$5,000–$7,500/mo** |
| Confidence | **MEDIUM** — depends entirely on hours actually delivered |

**VERDICT: SELL NOW.** Only asset with revenue history. Lead with the outcome
("we run your rental back office"), never with the software.

---

## 2. OPERATOR SEAT — $97 vs $297 · RESOLVED

**The decisive external fact: GoHighLevel's own platform tiers are
$97 / $297 / $497.**

The "$97 vs $297" conflict is almost certainly **not a TechHaus pricing decision
at all** — it is GHL's price ladder copied into TechHaus copy. That reframes D-2
entirely: there was likely never a deliberate $297 seat strategy to defend.

Corroborating internal evidence: **5 operator rows carry $97, 14 carry $0, none
carry $297**, and the token ledger can grant only 500 tokens on tag `member-97`.

**Margin note that matters:** if a seat includes a GHL subaccount and TechHaus
holds **Agency Pro at $497/mo with unlimited subaccounts**, the marginal cost per
seat is near zero and the plan pays for itself at **~6 seats**. At $97 with 5
live seats ($485/mo) you are approximately at break-even on the platform fee
alone — before delivering any service.

| Scenario | What it must include to be justified | Verdict |
|---|---|---|
| **$97** | subaccount + one-shot device access — today's entitlement | **Keep. Founding price.** |
| **$197** | + entitlement enforcement, automatic provisioning, support SLA | **Test after wiring** |
| **$297** | + managed service, meaningful AI budget, guaranteed response | **Cannot honour today** |

**VERDICT: HOLD AT $97.** Remove $297 from public surfaces — not because $97 is
optimal, but because $297 is unfulfillable. Revisit at $197 once entitlements
are enforced.

---

## 3. BUILD LADDER

| Rung | Market band | Verdict |
|---|---|---|
| **$1,875** | small-business AI automation **$1,500–$5,000** | supported |
| **$3,750** | same band | supported |
| **$7,500** | mid-market **$5,000–$20,000** | supported |
| **$15,000** | top of small-business implementation | supported, at ceiling |
| **$25,000** | above small-business band; custom software **$20K–$60K** | needs scope proof |
| **$35,000–$50,000** | platforms **$60K–$180K** — TechHaus is *below* this | defensible **if** scope is genuinely platform-level |

**Six rungs is too many for a business with zero software customers.** Every rung
is a decision the buyer must make and a fulfilment path you must staff.
**Recommend three:** entry (~$3,750), core (~$15,000), full (~$50,000).

---

## 4. THE VEHICLE — resolved by arithmetic, not by market

External research cannot settle this; internal arithmetic can.

A used economy car realistically costs **$8,000–$15,000** acquired, plus tax,
title, registration and insurance.

| Offer | Price | Less car (~$12,000) | Remaining for the build |
|---|---|---|---|
| DB: `Box + Vehicle` | $25,000 | −$12,000 | **$13,000** |
| Doc: vehicle tier | $35,000 | −$12,000 | **$23,000** |

**The $25,000 row is arithmetically incoherent.** It leaves **$13,000** to deliver
a build that costs **$15,000** *without* a car one rung below. You would be
selling a car for negative margin and calling it an upsell.

**RECOMMENDATION: the $35,000 placement is the commercially safe one.** Before
either is quoted, the owner must state acquisition cost, title/registration,
insurance, whether the vehicle is financed, and target gross margin. **Until
then, do not quote a vehicle-inclusive tier at all.**

---

## 5. KITS — $997–$3,497 + $297–$697/mo

Within the small-business automation band ($1,500–$5,000). The **recurring**
component is the weak point: $297–$697/mo maps almost exactly onto GHL's own
$297/$497 tiers, so a buyer who discovers GHL directly sees no margin story.

**Recommendation: BUNDLE.** Sell kits as an on-ramp to an implementation, not as
a standalone product line. Attach **Voice AI** here rather than as its own SKU —
the earlier internal recommendation is externally supported.

---

## 6. SOVEREIGN / PARTNER — $50,000 + $97/agent/mo

No clean public comparable; white-label and partner platforms are almost
universally "contact sales" — **recorded as such, not estimated.**

$50,000 is *below* the custom-platform band ($60K–$180K), so it is not
aggressive **for the scope claimed**. But the scope claimed exceeds the scope
implemented (see `TECHHAUS_CATALOG.md` §5 — SHA-256 described as HMAC,
unverified attestation, advisory kill switch).

**VERDICT: HOLD.** Not because the price is wrong, but because selling it today
means making claims the implementation does not support. Fix the claims or fix
the code before quoting.

---

## 7. DISPATCH

Zero rows in `incidents`, ever. No adoption, no case study, no reference.

**VERDICT: TEST, priced as implementation, not SaaS.** A product with no users
cannot be sold on a per-seat subscription; it can be sold as a custom build for
one design partner, ideally discounted in exchange for a reference.

---

## 8. CONTROL PLANE

No coherent independent buyer exists for a single-owner remote-ops surface.
The orchestration, exactly-once ledger and degraded-mode architecture are real
engineering, but nobody purchases "someone else's internal control plane."

**VERDICT: INTERNAL ONLY / FULL-STACK DIFFERENTIATOR.** External evidence
supports the existing classification. **Do not create a SKU.** Its commercial
value is that it lets one person deliver and operate more client systems than
one person otherwise could — that is margin, not revenue.

---

## 9. REFERRAL STRUCTURE — 876 leads

Market evidence (A): **5–15% of initial project value** is the standard for
service-based B2B and consulting referrals. **1–5%** for large, hands-off
introductions. Up to **35%** where the referrer actively closes.

TechHaus's position: warm-but-aged leads, no qualification work performed,
hands-off introduction → the **lower** band.

| Structure | Market observation | Note |
|---|---|---|
| Fixed fee per **qualified** lead | commonly $50–$500 in services | simplest, fastest to paper |
| **% of first collected revenue** | **5–15%** | most common |
| Hands-off intro on large deals | **1–5%** | closest to this situation |
| Tiered by volume | varies | premature at one partner |

**Recommended TechHaus term (NON-BINDING, owner decision):** a **fixed fee per
qualified lead** or **5–10% of first collected revenue**, capped, for a defined
12-month window. Fixed-per-lead is preferable here because it pays regardless of
the partner's close rate — which you cannot observe or audit.

---

## 10. PROOF DISCOUNT

TechHaus has **$0 external software revenue** and **no reference customer at any
price above $577**. Standard practice is to discount for absent proof, then
raise once references exist.

| Stage | Rentals build | Rentals monthly | Seat |
|---|---|---|---|
| **Founding (first 1–3)** | $12,500 | $2,500/mo | $97 |
| **Standard (after 3 references)** | $15,000 | $5,000/mo | $97–$197 |
| **Premium (case study + measured ROI)** | $25,000 | $7,500/mo | $197 |

A skeptical buyer at premium pricing will demand: a paying reference, measured
ROI, an implementation case study, fulfilment history, and uptime evidence.
**TechHaus currently has none of these.** That is the discount, and it is
temporary — the first three customers buy it back.

---

## 11. WHAT $450k–$850k REPLACEMENT VALUE DOES AND DOES NOT MEAN

**It means:** rebuilding this functionality with contract engineers would
plausibly cost that.

**It does not mean:** company valuation, IP sale price, what a customer will pay,
acquisition value, or an ARR multiple. Replacement cost is a **floor on
rebuild-vs-buy**, and only for a buyer who wants exactly this system. With $0
software ARR, no acquirer prices from replacement cost — they price from revenue,
which is currently **$0** recurring.

---

## SOURCES

- [Nomora — car rental software cost](https://www.nomora.io/blog/car-rental-software-cost) · [Car Rental Solutions pricing](https://www.carrentalsolutions.com/pricing.html) · [CarCeo — rental software cost 2026](https://carceo.pro/blog/how-much-does-car-rental-software-cost)
- [GHL Experts — GoHighLevel plans & pricing](https://www.ghlexperts.com/gohighlevel-plans-pricing) · [Weblystudio — GHL agency cost](https://weblystudio.com/guides/gohighlevel-agency-cost/)
- [FractionalCXO — fractional COO cost guide](https://fractionalcxo.to/guides/fractional-coo-cost-guide) · [FractionalChiefs — fractional COO cost](https://fractionalchiefs.com/blog/fractional-coo-cost) · [Fractionus — fractional executive cost US 2026](https://fractionus.com/blog/fractional-executive-cost-us-2026)
- [AI Essentials — AI consultant cost 2026](https://aiessentials.us/blog/how-much-does-it-cost-to-hire-an-ai-consultant-for-my-small) · [Taskip — AI automation agency pricing](https://taskip.net/ai-automation-agency-pricing/) · [Ortemtech — custom software cost small business](https://ortemtech.com/blog/custom-software-development-cost-small-business/)
- [Consulting Success — consulting referral fees](https://www.consultingsuccess.com/consulting-referral-fees) · [ReferralHero — finder's fees](https://referralhero.com/blog/finders-fees) · [Sakas & Company — agency sales referral fees](https://sakasandcompany.com/agency-sales-referral-fees/)
