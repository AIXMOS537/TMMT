# TMMT-PAY-001

## TASK ID
TMMT-PAY-001

## TITLE
Write `docs/product/TMMT_PAYMENT_ARCHITECTURE.md`: the owner's processor decision and the money model, answering SPEC §11.6 (docs only)

## PM MILESTONE
PM-06 Payments (roadmap "Depends on: `TMMT_PAYMENT_ARCHITECTURE.md` (to be written; processor decision = OWNER DECISION)")

## OBJECTIVE
Put every payment requirement and the evidence in one document the owner can decide from, so PM-06 code starts from a decision instead of a guess.

## WHY (evidence refs)
- SPEC §5.5, §11 (all facts; §11.6 the list to answer), §21.2 V2/V2b/V6, §25.2 (Money gate), §28 **KD-05**, **KD-19**, **KD-20**; READINESS §4, §10.2 #2, §11 ("Payment processor" owner decision); ROADMAP PM-06; SoR §5.7 (no riba; late fees charity-only; ʿarbūn).

## CURRENT BEHAVIOR (file:line)
- Money tables: `customer_payments` 31 (text status; `amout_past_due` typo), `payment_obligation_reconciliation` 31 (all unverified; evidence CHECK), `payments` 0 (`external_id` not unique), `rental_ledger` 3 (entry types), `deal_payments` 0, `credit_payment_schedule` 0 (E3 §1.3).
- Stripe receiver only (`api/agent/stripe/webhook/[slug]`), GHL checkout links (`ghl-offers.ts`), Zelle outside TMMT (E3 §3).
- Date-only overdue sweep (`sweep_overdue_payments`, 25/31 Overdue).

## EXPECTED BEHAVIOR
One document with: the fact base (from SPEC §11, cited); the questions of §11.6 each with ≥2 options and a recommendation (processor: Stripe receiver exists vs GHL checkout is how money is taken today; one money table: `payments` vs `rental_ledger` vs new; unique processor event id; ʿarbūn deposit lifecycle; allocation order with **no interest**; late fee = charity disposition, never revenue or owner split; refunds/failures/disputes; daily reconciliation vs processor; manual "paid" only with named verifier + evidence ref; commissions/tokens only from verified payments; mercy-in-collections policy ⚖️); the migration path for the 31 legacy rows (history, never re-marked Paid); `Decision: PENDING OWNER` per question.

## FILES (in scope)
NEW `docs/product/TMMT_PAYMENT_ARCHITECTURE.md`.

## DATABASE ENTITIES
Referenced only.

## DEPENDENCIES
TMMT-ADR-001 (person/rental canonical), TMMT-RENT-001 (money-gated transitions), TMMT-SEC-002 landed (GHL never Paid).

## CONSTRAINTS
Docs only. No price book (commercial-authority gate). No processor SDK added.

## SECURITY REQUIREMENTS
The document states the evidence rule for every "paid" write and the signature/replay/idempotency requirements for the processor webhook.

## IMPLEMENTATION NOTES
Reuse `payment_obligation_reconciliation`'s CHECK as the model for "verified".

## ACCEPTANCE CRITERIA (testable)
1. Every §11.6 question answered with options + recommendation + `PENDING OWNER`.
2. No-riba rules appear as schema-level constraints in the proposal (CHECKs, not comments).
3. Any spec inconsistency logged in `S2_SPEC_ISSUES.md`.

## TESTS
None (docs). Reviewer checklist: every claim cites SPEC §11 / E3 §3.

## DO NOT CHANGE
Code, schema, data.

## OWNER GATE
Owner decision (the document).
