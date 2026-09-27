# TMMT-SEC-002

## TASK ID
TMMT-SEC-002

## TITLE
GHL tags/events must never create a "Paid" payment or grant commission/tokens

## PM MILESTONE
PM-00 Security containment (roadmap item 00-f)

## OBJECTIVE
Contain violation V2/V2b. A GHL webhook may at most record an **unverified** ("Pending") `customer_payments` row. It must never produce `payment_status='Paid'`, a referral commission or a token grant, because GHL is not a payment processor.

## WHY (evidence refs)
- SPEC §11.2, §21.2 **V2/V2b**, §20.3 **SEC-05**, §28 **KD-05**; SoR §5.2 "GHL never sets business state"; ROADMAP 00-f.
- E4 §2(a), E3 §3.2: `shouldRecordPayment` is true for any `REVENUE_TAGS` tag or payment-sounding event. Any `amount` makes the row "Paid". The row has no org column. The downstream commission and token grant fire. Latent today (prod rows with `notes ILIKE '[GHL]%'` = 0), but live once GHL webhooks connect (GHL M6/M10).

## CURRENT BEHAVIOR (file:line)
- `src/app/api/webhooks/ghl/route.ts:136-137`: `if (shouldRecordPayment(body, tags)) paymentResult = await recordGhlPayment(...)`.
- `src/lib/ghl-payment-sync.ts:140-142` `isCollectedPayment` = payment-sounding event OR explicit amount > 0; `:149-153` `shouldRecordPayment`; `:261` `payment_status: amount > 0 && collected ? "Paid" : "Pending"`; insert `:254-268` (no org column).
- `src/app/api/webhooks/ghl/route.ts:145-153`: `grantMonthlyTokensForPayment(...)` is called for **any grant tag, whether or not the payment is collected** (`src/lib/token-ledger.ts:178-205` gates only on the tag and an org resolved by email).
- `src/app/api/webhooks/ghl/route.ts:173-185`: `recordCollectedReferral` fires when `paymentResult.collected` and an affiliate ref is present.

## EXPECTED BEHAVIOR
- A GHL-sourced payment row is always `payment_status='Pending'`. Its notes mark it as unverified GHL-sourced (keep the existing `[GHL]` / `[ref:…]` conventions).
- `recordCollectedReferral` is **never** called from the GHL webhook path.
- `grantMonthlyTokensForPayment` is **never** called from the GHL webhook path.
- The response body reports what was recorded (`recorded`, `verified:false`). No false "collected" claim.
- All other behaviour of the route (CRM dispatch, ClickUp, notes) is unchanged.

## FILES (in scope)
- `src/lib/ghl-payment-sync.ts` (status decision only)
- `src/app/api/webhooks/ghl/route.ts` (remove the two downstream calls from this path)
- Tests: existing `ghl-payment-sync` tests (extend) + NEW/extended route test for `src/app/api/webhooks/ghl/route.ts`

## DATABASE ENTITIES
`customer_payments` (insert shape unchanged except status); `tmmt_token_*` / referral tables are **no longer written** from this path. No schema change.

## DEPENDENCIES
- None blocking.
- **Coordinate:** the GHL router track reviews the webhook-route diff before the PR opens (it owns M6 webhook inbox). Where commission/tokens should come from later is PM-06 ("only from verified payments").

## CONSTRAINTS
- Do **not** fix the `amount_past_due` typo insert (`ghl-payment-sync.ts:275-288`). Fixing it would revive a dead write path (KD-17 belongs to PM-02). Leave it and note it.
- Do not add an org column or change the dedupe (KD-19 → PM-06).
- Do not change `verifyGhlWebhook` or event-id handling (GHL M6).

## SECURITY REQUIREMENTS
- Business state (Paid, commission, tokens) is never derived from a GHL claim.
- The route stays fail-closed on auth.
- No PII in new logs.

## IMPLEMENTATION NOTES
- Simplest change: in `recordGhlPayment`, force `"Pending"` and return `collected:false`. In the route, delete the token and referral blocks, or guard them behind a constant `false` with a comment pointing to PM-06. Prefer deletion + a comment; keep the imports only if they are used elsewhere.
- Check `isCollectedPayment` callers before changing it; it may be used by other tests.

## ACCEPTANCE CRITERIA (testable)
1. A fixture with a `member-97` tag **and** `amount: 97` → one `customer_payments` insert with `payment_status='Pending'`; no referral call; no token grant call.
2. A fixture with an `order.completed` event and an amount → `Pending`, no referral, no tokens.
3. A tag-only fixture (no amount) → `Pending` (unchanged) and **no token grant** (changed).
4. A non-revenue event → no payment insert (unchanged).
5. The full gate passes.

## TESTS (must fail on the pre-fix code)
- `ghl-payment-sync.test.ts`: `GHL amount + revenue tag never records Paid` — fails pre-fix.
- `api/webhooks/ghl/route.test.ts` (vitest, mocked service client + mocked `grantMonthlyTokensForPayment` / `recordCollectedReferral`): `does not grant tokens from a GHL tag` — fails pre-fix; `does not pay referral commission from a GHL event` — fails pre-fix.
- Negative: `unsigned/invalid webhook still 401` (regression).

## DO NOT CHANGE
- `verifyGhlWebhook`, `consumeGhlEventId`, the event-id derivation.
- The `amount_past_due` balance insert (PM-02).
- `src/lib/token-ledger.ts`, the referral module internals.
- The Stripe webhook route.

## OWNER GATE
None for the code (coordinate the GHL track review). Merge = deploy: owner + prod baton.
