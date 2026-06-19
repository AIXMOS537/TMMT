# Activate GHL Money Collection — the simple runbook

**For:** PROJECT X · **Date:** 2026-06-18 · **Agency front:** All In One Management
**Truth:** the code rail is ALREADY built (webhooks, payment-sync, checkout-link slots).
What's left is **clicks inside your GHL account** + pasting the live URLs into env. No new code.

---

## ⚠️ STEP 0 — Protect the family FIRST (do this before a dollar moves)
Money collected in GHL deposits to whatever bank account the payment processor points at.
That single setting is 90% of what shields you and your family.
- **Collecting entity:** All In One Management (the agency). Confirm it's the entity on the processor.
- **Deposit account:** a **BUSINESS bank account** for that entity — **never a personal account.**
  (Commingling personal + business is what pierces the veil. Don't.)
- **Firewall the credit lane:** credit-guidance money (Moe / Umar's lane) stays tracked separately
  and does NOT commingle with your software/agency revenue. Keep his lane fenced.
> If any of the above isn't true yet, fix it before going live. This is the protection.

## STEP 1 — Connect a payment processor in GHL (10 min)
GHL → Settings → Payments → Integrations → connect **Stripe** (or your processor).
Confirm the connected account deposits to the Step-0 business account.

## STEP 2 — Create your products / checkout links (20 min)
GHL → Payments → Products. Create one per thing you sell. Start with the live ones:
| Product | Price | Env var to fill (Step 4) |
|---|---|---|
| AIXMOS Membership | $97/mo | `NEXT_PUBLIC_GHL_CHECKOUT_97` |
| Credit Guidance | (your price) | `NEXT_PUBLIC_GHL_CREDIT_GUIDANCE` |
| Operator Apply | (your price) | `NEXT_PUBLIC_GHL_OPERATOR_APPLY` |
| OPS / Command / Dealer kits | per ladder | `GHL_CHECKOUT_OPS_KIT`, `GHL_CHECKOUT_COMMAND_KIT`, `GHL_CHECKOUT_DEALER_BUNDLE` |
| Consult call | (your price) | `GHL_CONSULT_CALL` |
> "Set anyone up for anything they can pay" = each new offer is just one more Product + link here.

## STEP 3 — Wire the 3 workflows + the payment webhook (20 min)
From `docs/runbooks/LANE_WIRING_GHL.md` and `docs/GHL-PIPELINE-SETUP.md`:
1. Create the **tags** (exact spelling) + the **custom field** (LANE_WIRING §1–2).
2. Build **W1** (credit-intent handoff), **W2** (vehicle-intent handoff), **W3** (weekly lane guard).
3. On every workflow that fires money/events, add a **Webhook** step → `POST https://<your-app>/api/webhooks/ghl`
   with header `x-ghl-webhook-secret: <GHL_WEBHOOK_SECRET>` so payments record automatically.

## STEP 4 — Paste the live URLs into env (5 min)
For each checkout link from Step 2, set the matching env var in **Vercel** (source of truth):
`vercel env add NEXT_PUBLIC_GHL_CHECKOUT_97 production` … etc. Also confirm `GHL_API_KEY`,
`GHL_LOCATION_ID`, `GHL_WEBHOOK_SECRET` are set. Then re-pull on the carry Mac:
`vercel env pull .env --environment=production`.

## STEP 5 — Ship + test ONE real purchase (10 min)
- `bash scripts/ship` (owner-gated) to push any link/env changes live.
- Buy the $97 yourself → confirm: money lands in the business account, the GHL webhook fires,
  a payment row appears (your `/payments` admin page), and the member tag is applied.
- That single successful loop = the machine works. Everything else is more Products (Step 2).

## What I CAN'T do from here (and why)
- I have **no GHL connector** in this session → I can't log into your GHL or create products for you.
- Running `ghl-activation-check.mjs` would inject a **fake $97 payment** into your live DB → I won't.
- The processor + bank routing is yours by law (and by protection) — Step 0 is your hand, not mine.

## Once live, the next build (mine)
The TMMT-token ledger (`docs/superpowers/specs/2026-06-18-tmmt-token-ledger.md`) plugs straight
into the GHL `payment_received` webhook → $97 tops up tokens automatically. Say "build the token
ledger" when GHL is collecting.
