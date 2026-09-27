# 10 — Credit Center

Source: SPEC §5.8, §18 (+ E5 §A) · Snapshot 2026-09-21 · canon `4cca6835`

> **CURRENT** = "Journey status (master)" Status column, "Key components", "Open defects" (**credit capability on master**, CODE ON MASTER). **PRESERVED-RESCUED** = T10 AIX-CREDIT-DISPUTE (recovered historical implementation; NEEDS MANUAL REVIEW). **IN-FLIGHT** = everything attributed to C1 (`C:\dev\wt-credit-c1`, uncommitted, dev-only; CODE ON ACTIVE DEV BRANCH) and C2 (the next iteration: customer assertion lifecycle, evidence, review, exact-content approval, sent/response recording, case timeline, ownership isolation — reported by the owner on 2026-09-22 as active on the credit branch; not re-verified by this pack; not on master). C3+ = DESIGN ONLY. The credit track's latest milestone report is authoritative for C-state; never recreate C1/C2 from this pack. **TARGET** = S1–S7 and the customer-facing Credit Center page (PM-16, after S4/S5; DESIGN ONLY). Only the CURRENT column exists in production. The compliance flags are binding now.

> **Owned by the credit track (S0–S7; in-flight Credit C1 in `C:\dev\wt-credit-c1`, uncommitted).** This lane proposes **no** credit schema or engine change and **does not edit** `src/lib/credit-dispute/**` or `src/app/(command)/command/credit-dispute/**`. The flagship adds only a Customer Portal shell page that will host S4/S5 when they exist (PM-16), plus a link from the rental journey to readiness (education only).

## What it is

The owner decided on 2026-09-16 that the credit engine is ACTIVE and part of the rental journey (credit → LTO / drive-to-own). It is real, owner-operated, and **gated shut** by the CROA gate. The customer-facing half does not exist.

## Journey status (master)

| Step | Status | Next owner |
|---|---|---|
| CREDIT REPORT (manual paste/CSV: DisputeFox, MFSN) | EXISTING/PARTIAL | S2 |
| ITEM (`payload.negativeItems`) | EXISTING/PARTIAL | S1/S3 |
| CUSTOMER-ASSERTED ERROR | MISSING on master · in progress in C1 | C1 |
| EXPLANATION (staff `FactualBasis`) | EXISTING/PARTIAL | C1 |
| EVIDENCE | MISSING · C1 adds refs (no bucket/table) | C1 / S4 |
| CASE | EXISTING/PARTIAL · C1 staged `20260922120000_credit_case_foundation_STAGED.sql` (NOT applied) | C1 / S1 |
| REVIEW | EXISTING/PARTIAL · C1 adds transitions | C1 |
| CORRESPONDENCE | EXISTING/PARTIAL, **gated off** (CROA gate refuses storage) | owner + counsel |
| TRACKING / RESPONSE / OUTCOME | MISSING (C1 adds response capture) | S5–S7 |
| FINANCIAL READINESS | EXISTING/PARTIAL (desk business readiness; drive-to-own readiness on `/status/[token]`) | S6, PM-16 |

C1 does **not** add tracking/mailing, outcomes, lender matching or a customer-facing Credit Center.

## Key components (read-only reference)

- Owner desk `src/app/(command)/command/credit-dispute/page.tsx`, gated path `runGatedDisputeProtocol`, server actions guarded by `requireOwner()`.
- `dispute_clients` (JSON `payload`, **no `org_id`**, 0 rows, RLS `is_platform_admin()` only).
- Accuracy policy `policy/dispute-policy.ts` (no letter without a recorded factual basis).
- CROA gate `shared/compliance-gates/gate.ts` + `gates.config.json`: `croa_contracts_attorney_approved=false`, `vdacs_registered_bonded=false`, `no_advance_fee_billing_enforced=false`, `sbf_broker_registered=false`, `multistate_matrix_cleared=false`. Only the first is checked by code.
- Drive-to-own `src/lib/drive-to-own/financing-readiness.ts` + `FinancingReadinessPanel` ("readiness is not approval").
- Public intake `/forms/credit-funding-intake` → `credit_funding_sessions` (1 row; educational; no SSN/DOB; anon INSERT `true`; no rate limit in the action).
- Credit enrollment/billing tables: all 0 rows. There is no billing writer.

## Open defects (credit track owns the fixes)

- `[id]` page calls the **ungated** `runDisputeProtocol` (`[id]/page.tsx:9,40`) (KD-28).
- `upsertDisputeClient` accepts an arbitrary payload (it can inject `disputeRounds`).
- `assertNoCpnOrRentedTradelines` has **no caller**, so the CPN / rented-tradeline ban is unenforced.
- `credit_enrollments_org_all` (`is_staff() OR …`) makes the module check in `credit_enroll_staff` redundant.
- `is_internal_ops()` includes investor → DELETE on credit tables (SEC-19, PM-02).
- `/learn/status` invents `AIX-STUB-` references (KD-38) — the page is the credit/learning **face** (`(learn)` cube), so its honest-placeholder fix is a PM-16a backlog item (ROADMAP PM-16a); the credit track owns any content behind it.

## Compliance flags (⚖️ LEGAL REVIEW) — binding for any copy or feature

1. D-22b perform-vs-refer is **OPEN**. `croa_contracts_attorney_approved` must stay `false` until counsel signs (CROA 15 USC 1679; VA 59.1-335.1 registration and bond).
2. `removalProbability`, "confrontational facts" and `estimateScoreImpact` are score/outcome projections. They stay **owner-only** and never appear in customer copy, `/lp/*`, `/upgrade` or GHL.
3. The CPN / rented-tradeline ban is unenforced (see above).
4. `no_advance_fee_billing_enforced` and `vdacs_registered_bonded` are never checked. The only guard is that no credit billing writer exists. **Do not add one.**
5. Financing readiness is **education only**. Using it to decline or price a rental is FCRA adverse action.
6. Marketing surfaces that import readiness vocabulary (`lp/[org]/[sku]/copy.ts`, `upgrade/page.tsx`, `legal/sms/page.tsx`, `ghl-offers.ts`) need a banned-claims review.
7. **No guaranteed score or financing claims, anywhere.**

## Rescued (credit track decides)

T10 AIX-CREDIT-DISPUTE: application matcher, funding package, and `20260707140000_applications_funding.sql` (which FKs to a non-existent `credit_profiles`). REQUIRES HUMAN REVIEW + ⚖️.
