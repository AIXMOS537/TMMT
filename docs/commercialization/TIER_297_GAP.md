# $297 TIER — WHAT IS MISSING

**The intended second software tier, traced end to end.**

Verified 2026-09-08 against `origin/master` = `a88d8087` and DB `uapxakmlwnpfsftfeezx`.
Authority: `COMMERCIAL_AUTHORITY.md` A-2 — the tier is **preserved as intended**,
and **not launch-ready**.

> **Nothing was deleted. Nothing was built. This is the gap list.**

---

## THE HEADLINE FINDING — there is no purchase path to block

The concern was a knowingly unfulfillable tier being publicly purchasable. **It is
not purchasable.**

`/forms/operator-apply` renders `ProgramIntakeForm` (`src/app/forms/operator-apply/page.tsx`).
That component contains **zero** references to checkout, Stripe, payment, price
links or `ghlOffer` — verified by grep. It collects name, phone, email, notes and
lane. `submitProgramIntake` (`src/app/forms/actions.ts:683-700`) validates and
records a **lead**, carrying `priceCents: 29700` as lead-value metadata — **not a
charge**.

`29700` appears in exactly one place in all of `src`: that lead-value map. There is
no `member-297` tag, no $297 GHL product, and no grant path anywhere.

**So the risk is not "someone buys something we cannot deliver."** It is
**"someone reads an advertised price and token allowance we cannot honour."** A
truthfulness problem, not a fulfilment failure — and the remedy is smaller and
different.

---

## THE CHAIN

| Stage | State | Evidence |
|---|---|---|
| **Product** | ⚠️ Exists as an **intake form**, not a sellable product | `operator-apply/page.tsx` — title "Operator seat · $297", cost "$297 / month" |
| **Checkout** | ❌ **None.** `operator-apply` resolves to the *application* campaign, which the runbook prices at **$0 (deposit optional)** | `ghl-offers.ts` `operator` → `NEXT_PUBLIC_GHL_OPERATOR_APPLY`; `GHL-COPY-PASTE-PACK.md` row 15 |
| **Payment** | ❌ None. No charge is initiated anywhere in this codebase | Stripe is receipt-only; no `.charges`/`.subscriptions` call sites |
| **Webhook** | ⚠️ Exists and works — but is **tag-driven**, and no $297 tag exists | `api/webhooks/ghl/route.ts:146-158` → `grantMonthlyTokensForPayment` |
| **Entitlement** | ❌ No `packages` row for a $297 tier. And the entitlement system is unwired entirely — "entitlement" appears nowhere in `src` | DB + grep |
| **Token / grant** | ❌ **`TOKEN_GRANT_TAGS` contains `member-97` and nothing else.** The 500 figure is an env-configurable default (`MEMBER_97_MONTHLY_TOKENS`), so **the cap is not the obstacle — the missing tag is.** Raising the variable would hand 2,000 tokens to every $97 member rather than create a tier | `src/lib/token-ledger.ts` |
| **Account / org access** | ⚠️ Invite-gated and manual. `signup_invites` = **0 rows ever**; invites come only from `scripts/invite.mjs` | DB + grep |
| **Feature access** | ❌ No tier gating tied to a package. `profiles.package_id` is null on every row | DB |
| **Renewal** | ❌ Nothing. No organization carries a `stripe_subscription_id` | DB |
| **Cancellation / downgrade** | ❌ Nothing. No downgrade path, no proration, no grant revocation | — |

---

## MINIMUM IMPLEMENTATION TO MAKE $297 SAFELY FULFILLABLE

Smallest honest path. **None of this is authorized by A-2 — A-2 settles the
direction only.** Steps 1 and 3 are owner actions; 2 and 4 are engineering.

| # | Step | Who | Size |
|---|---|---|---|
| 1 | Create a **$297/mo GHL product** with its own purchase tag (e.g. `member-297`), distinct from the `operator-applied` application tag | Owner | minutes |
| 2 | Add that tag to `TOKEN_GRANT_TAGS` with `{ tokens: 2000, tier: 'operator' }`. **This is the core fix — a few lines.** The webhook already grants on any registered tag | Dev | small |
| 3 | Set a new `NEXT_PUBLIC_GHL_CHECKOUT_297` and point a real CTA at it — **with the `NEXT_PUBLIC_` prefix**, which the activation runbook omits on eight other variables | Owner | minutes |
| 4 | Verify end to end on one test purchase: tag fires → tokens granted → idempotent on retry | Dev | small |

**Deliberately out of scope for "safely fulfillable":** renewal, cancellation and
downgrade. Those are subscription-lifecycle work and belong with the deferred
self-serve SaaS programme, not with making one tier honest.

---

## THE INTERIM — do not advertise what cannot be delivered

Until step 2 exists, the public page claims **"$297 / month · 2,000 tokens"** and
the platform can deliver neither the tier nor the allowance.

Because there is no purchase path, the correct interim fix is **copy, not a
kill-switch**. Two options, both small, **neither applied**:

- **Option A — describe it as what it is.** Change the application page to
  "Operator seat · by application" and drop the token claim until the grant exists.
  Honest, keeps the lead flow, no product deleted.
- **Option B — remove the tier from public surfaces** until it is buildable,
  keeping the code and the form.

**Recommended: Option A.** It preserves the intended tier and the lead capture
while removing the claim the platform cannot honour.

> ⚠️ **Both are `src/` changes, so merging either to `master` triggers a production
> deployment** (`scripts/vercel-ignore.sh` returns BUILD for `src/`). Under D-18
> that needs owner authorization. **Not prepared, not applied.**

---

## RELATED, NOT PART OF THIS TIER

`src/app/forms/actions.ts:686` writes `priceCents: 29700` into `incoming_leads` for
every operator application. If the advertised price changes, that figure becomes
wrong lead-value reporting. Tracked in `COMMERCIAL_SYNC_PLAN.md` §1.1.
