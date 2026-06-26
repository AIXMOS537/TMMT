# BUILD BRIEF — AIXMOS National Launch

This is the handoff from strategy to build. Read it once, then work `BUILD_PLAN.md`.
Two source strategy reports sit beside this file; they hold the full reasoning. This brief is the decided, compressed version.

---

## The company

TMMT (Muhammad Taha, founder/CEO) is an automotive rental business productized into an app + AI platform (AIXMOS), launching nationally at **$97/month**. Partner **Umar** runs a credit repair + business funding agency that is being merged in as an in-house vertical. The pitch: an operator network where people **learn and earn at the same time**, open to all regardless of starting capital, but protected by firm conduct standards.

## The three things we are building

1. **AIXMOS Core** — make the bespoke stack an installable product: one-command provisioning, a Fleet Economics Command Center dashboard, and the connectors fleet operators actually use.
2. **Credit + Funding Vertical** — Umar's agency as a pipeline inside AIXMOS: intake → credit dispute → business-credit/tradeline → funding desk. Legally gated.
3. **Operator Network** — the $97/mo product: signup/billing, operator portal, commission engine, conduct covenant.

## Decided positioning (do not relitigate in code/copy)

**"The fleet operator's AI command center you actually own — runs on your hardware, approves before it acts, pay once."** We are NOT a horizontal "AI employee" competing with Viktor. We win a vertical: Turo / independent fleet operators first, then widen. Three structural advantages drive every product decision:
- **Sovereignty** — local Ollama inference + self-hosted NAS; data stays on the owner's hardware.
- **Owner-approval gate** — it asks before it acts on messages/money.
- **Own-forever economics** — pay once, no credit-burn meter.

## Decided pricing model (this drives billing code)

Three parts — implement exactly this:
1. **One-time platform license** = the "own forever" headline offer (software, dashboards, Shortcuts, templates).
2. **Local Ollama inference as the zero-marginal-cost default** — most tasks never hit a paid model.
3. **Customer-supplied API keys (BYO-key) for cloud/frontier calls** — the customer pays OpenAI/Anthropic/Cloudflare directly. We NEVER absorb uncapped token costs. Optional flat "managed inference" passthrough add-on (capped, with margin) for non-technical buyers.

The **$97/month** tier is the network subscription (portal + education + Tier-1 referral access), separate from the one-time platform license. Top of ladder is the **$50K partnership** (Tier-3 capital partner). Billing must respect the credit-repair **no-advance-fee** rule (see gates).

## The funding ladder (WS2 product shape)

Rung 1 Personal credit repair (CROA-compliant) → Rung 2 Business credit building (EIN/DUNS, net-30 tradelines) → Rung 3 Business funding desk (0% cards, LOC, SBA/term, equipment; MCA/RBF only after SCC registration) → Rung 4 Community capital (CDFI + Virginia SSBCI partnerships — NOT a self-run fund) → Rung 5 Credit-to-Keys fleet ownership (the destination; feeds core rental revenue).

## Operator economics (WS3 commission engine)

Three tiers, open to all, rewarding effort/skill not gatekeeping on capital:
- **Tier 1 Referral** (zero capital): tracked referrals. Benchmarks: credit repair **$50–$150/referral**; funding **1–3% of funded amount** or **15–25% of origination fee**.
- **Tier 2 Certified** (time/training): delivers consulting under the compliance umbrella; **40–60% revenue share** on personally delivered services.
- **Tier 3 Capital Partner** (capital + skill): bilateral, attorney-reviewed co-investment in fleet/funding deals. The $50K partnership lives here.

**Hard rule for the commission engine:** commissions pay ONLY on real client services/sales delivered to real end clients — **never** for recruiting other operators. Recruitment-driven pay = illegal pyramid (FTC). All earnings claims must be truthful/substantiated.

## Non-negotiables (enforced in `shared/`)

- **Owner-approval gate** on every customer message + financial action. (`shared/owner-approval-gate/`)
- **Compliance gates** hard-block illegal-until-cleared features; launch **Virginia only**. (`shared/compliance-gates/`)
- **CPNs and rented/bought tradelines: permanently banned**, detected and rejected at intake.
- **PII stays on the NAS tier**, never in a cloud LLM context.
- **Never take custody of client funds** — payments flow directly client↔creditor/funder.

## What needs a human (surface as BLOCKED, don't guess)

VA attorney sign-off on the CROA suite; VDACS registration + surety bond; SCC sales-based-financing broker registration (only if doing MCA/RBF); securities counsel (only if ever pooling capital — default is don't); the multi-state matrix before leaving Virginia; real credentials/secrets; final price numbers for the one-time license.
