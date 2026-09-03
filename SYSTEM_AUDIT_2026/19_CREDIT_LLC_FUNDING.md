# 19 · CREDIT / LLC / FUNDING BUSINESS LINE

## Verdict: 🔵 **The most-built, least-used vertical.** Extensive UI and schema; **zero enrolments.**

| Table | Rows |
|---|---:|
| `credit_enrollments` | **0** |
| `credit_billing_plans` | **0** |
| `credit_payment_schedule` | **0** |
| `credit_education_acknowledgments` | **0** |
| `credit_product_catalog` | 3 |
| `credit_education_sections` | 3 |
| `credit_funding_sessions` | 1 |
| `dispute_clients` | 0 |
| **Dispute engine (9 tables)** | **absent from production** |

## Built
- **11 `/(learn)` routes** — onboarding, consent, questionnaires (personal + business), documents, products, application review, coach, dashboard, status.
- **3 `/(command)/command/credit-dispute` routes** — list, detail, CSV import.
- `src/lib/credit-dispute/` — Metro2 letter generator + advanced templates.
- **Credit engine** — `CREDIT_ENGINE_INFERENCE` routes to Ollama / NVIDIA NIM / template-only; `CREDIT_ENGINE_AUTO_POLISH` polishes drafts; **owner approves before send**.
- Legal pages: `/legal/credit`, `/legal/funding`.
- Checkout links: `NEXT_PUBLIC_GHL_CHECKOUT_LLC`, `_97`, `_3750`.
- `funding_attribution_wire`, `credit_crosssell_004`, `credit_intake_affiliate_ref`.

## 🔴 The structural problem
**`20260707120000_dispute_engine.sql` was never applied to production. None of its nine tables exist.** But three UI routes and a CSV importer were built against them, and `20260831200000_dispute_engine_rls.sql` was written with existence guards so it is a **no-op today**.

**There is a credit-dispute product with a user interface and no database.** *(Correctly identified in `docs/SCHEMA-DRIFT.md`; confirmed here.)*

## ⚠️ Compliance — the gate that matters
Performing disputes on a client's behalf is **regulated credit-repair activity**. TMMT is a **Maryland LLC**, which brings MCSBA licensing + bond requirements and a **prohibition on advance payment**. The repo already reflects awareness of this: `COMPLIANCE_DISCLAIMERS.md`, "guidance only" framing in `.env.example`, `no-credit-repair` / `no-advice` / `no-promises` gates, `copy-compliance.test.ts`, and `credit_education_acknowledgments`.

**This is the single highest-risk line in the business, and it is the one furthest from having a lawyer's sign-off recorded in the repo.** The correct next step is legal review of the *dispute* pathway specifically — not more code. Referral-only ("guidance") is materially different from performing disputes, and the dispute engine crosses that line.

## Connection to the rental business
The intended lifecycle is coherent and is the genuinely good strategic idea in this repo:
```
Rental applicant → cannot qualify → credit/LLC/funding → becomes eligible → rents
Vehicle owner    → LLC → banking → business credit → funding → supplies vehicles
```
`credit_crosssell_004` and `funding_attribution_wire` implement the plumbing. With **81 approved-never-placed** and **759 leads with no status**, the cross-sell has a real audience today.

## Recommendation
1. **Do not apply the dispute engine** until legal review is recorded.
2. Run credit/funding as **referral + guidance** — which is licensed-safe and already built.
3. This vertical needs **customers, not code**. Zero enrolments against this much infrastructure is the clearest "stop building" signal in the audit.
