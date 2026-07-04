# PLAN.md — do this next

> Catch-up deliverable · STEP 5 · 2026-06-28 · branch `claude/catchup-aixmos-tmmt-5wv942`
> An ordered, realistic path across everything, written to get you from "built" to
> "collecting" without touching anything gated or live. Cross-refs use STATUS.md item #s.

---

## The 3 that matter most (finish these first)

1. **Turn on money collection (non-gated, ~1 day).** Everything technical is done —
   the funnel pages and in-app checkout are wired; they just need your real GHL links
   and products. Paste 4 URLs into `AIXMOS/public/ghl-config.js` (STATUS #9) **and**
   create the GHL deposit products + set `NEXT_PUBLIC_GHL_CHECKOUT_*` in Vercel, point
   the GHL automation at `/api/webhooks/ghl`, and run one **$1 end-to-end test**
   (STATUS #10). *This is the shortest line to the first dollar — and to affording more
   Claude.* Owner-only because it's money + a live surface.

2. **Lock the platform to you (security, ~½ day, owner-only).** Branch protection on
   `master`, 2FA everywhere, Secret Scanning + Push Protection (STATUS #30), and the
   Supabase P1 `REVOKE EXECUTE` on the ~20 anon-callable `SECURITY DEFINER` functions
   **before** any real tenant touches it (STATUS #31). Do this before scaling operators.

3. **Close the owner-approval gap (decision + ~1 day build).** The approval *primitive*
   exists, but persistence, the approve/reject endpoint, and the `.claude/hooks/`
   PreToolUse hook that CLAUDE.md says is the "real gate" are **missing** (STATUS #29).
   Until that's wired, the gate is a library, not an enforced choke point. Decide the
   persistence (Supabase `gated_actions`) and reinstall the hook. This protects
   everything downstream (SMS, charges, disputes, payouts).

---

## Ready for your approval right now

- **`catchup/staged-diffs/01-ghl-cta-fallback.patch`** — graceful CTA fallback so
  placeholder buttons capture leads via `apply.html` instead of dead-clicking. Review;
  `git apply` if you like it. (See `catchup/staged-diffs/README.md`.)
- **Already applied & committed (safe, green-verified):** the lint/type fix
  (`web/build-page/catalog.buildpage.ts`) — took lint from 1 error to 0.

## Applied automatically this session (no approval needed — all re-verified green)

- Type fix that cleared the only lint error. tsc ✅ · tests 190/190 ✅ · build ✅.
- Four catch-up docs (this file + ARCHITECTURE / HEALTH / STATUS) — additive only.

---

## Ordered backlog (after the top 3)

**Non-gated build work — safe to do in-repo, biggest leverage first:**
4. **WS1 Fleet Economics dashboard** (STATUS #16, ~L) — React dashboard on Airtable
   `appcenWUju039rD7b`. High owner value; no legal exposure. Best first "real build."
5. **WS1 Stripe read-connector** (#12, ~M) — feed the dashboard real revenue/utilization.
6. **WS3 $97 signup + platform-license SKU** (#18, ~L) — *needs your final price first*,
   then the Stripe subscription + one-time SKU are straightforward.
7. **WS3 commission engine** (#20, ~L) — build against the existing `Commission` schema;
   it already omits any recruitment trigger (correct). Every payout routes to the gate.
8. **WS1 provisioning installer** (#17, ~XL) — the big one; sequence last of the builds.

**Blocked on a human input (not legal — just a decision/credential):**
- Turo import method (#14) · QuickBooks scope (#15) · final license price (#18) ·
  covenant legal review (#21) · Twilio 10DLC start (#13, ⏰ 1–4wk — start early).

---

## Gated — and why (do NOT enable; leave for you + Umar)

All of WS2 credit/funding stays dark behind `false` legal gates
(`shared/compliance-gates/gates.config.json`). This is correct and by design:

| Area | Gate holding it | Clears when |
|------|-----------------|-------------|
| CROA intake + disclosures (#22) | `croa_contracts_attorney_approved`, `vdacs_registered_bonded` | VA attorney signs CROA suite; VDACS reg + surety bond posted |
| Dispute engine (#23) | `croa_contracts_attorney_approved` | same attorney sign-off |
| Billing on credit path (#26) | `no_advance_fee_billing_enforced` | proven never-charge-before-service + tests |
| Funding desk MCA/RBF (#24) | `sbf_broker_registered` | VA SCC broker registration (cards/LOC/SBA/equipment can launch **without** this) |
| Any pooled fund (#27) | `securities_counsel_cleared_fund` | default = never build; use CDFI/SSBCI referral |
| Non-VA launch (#28) | `multistate_matrix_cleared` | per-state legal review |
| CPN / rented tradelines | `cpn_and_rented_tradelines_blocked` = **`true` forever** | never — permanent ban, detected + rejected at intake |

Also owner/legal-only, kept out of scope this session per the ground rules:
Operation Overdrive courier licensing (#34), CROA marketing-copy disclosures (#35),
and anything touching promotional SMS (A2P 10DLC), profit-share/convertible-note
instruments, or live Slack/GHL/DNS surfaces.

---

## How to keep it green

After any change, re-run the baseline (HEALTH.md): `npx tsc --noEmit` · `npm run test`
· `npm run build` · `npm run lint` · `bash scripts/doctor.sh --quick`. If a ✅ turns ❌,
revert that change. The compliance-gate posture (`python3 shared/compliance-gates/check.py`)
must always report "Virginia-only, legal gates closed, CPN block active."

---

*Then stop and pick up at #1. The machine is built; this is the turn-it-on list.*
