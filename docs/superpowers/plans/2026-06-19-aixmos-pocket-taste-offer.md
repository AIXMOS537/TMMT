# AIXMOS Pocket — Implementation Plan

**Date:** 2026-06-19
**Spec:** `docs/superpowers/specs/2026-06-19-aixmos-pocket-taste-offer-design.md`
**Status:** DRAFT — awaiting owner approval of the spec before Phase 1 build begins
**Workflow:** subagent-driven per `CLAUDE.md`; `npm run build` is the primary gate each phase.

---

## Guardrails carried through every phase

- **Public only ever sees AIXMOS.** No phase ships anything that exposes HAILMARY, the
  owner's AIXMOS network, the Tailscale mesh, or local models to a customer.
- **Compliance vocabulary** ("guidance" not "repair"; no guarantees) is a review gate on
  every member-facing string and every assistant reply.
- **No secrets to the client.** Anthropic/Supabase-service/GHL keys stay server-side.
- **Follow existing patterns** (`CLAUDE.md`): route groups, zod server actions,
  `createSSRClient`, RLS, ErrorBanner, no writes in `queries.ts`.

---

## Phase 0 — Offer + compliance copy (docs only, zero risk)

- Lock SKU `AXP-97` ($97/mo Credit Guidance membership + AIXMOS Pocket).
- Draft all member-facing copy (home tiles, assistant intro, academy taste, earn hook,
  climb prompts) and run it through the compliance vocabulary check.
- Define the install link + QR target (Open Decision #1).
- **Gate:** copy review passes; no forbidden terms.

## Phase 1 — PWA shell (installable everywhere)

- New route group `src/app/(pocket)/` on the public AIXMOS host.
- `public/manifest.webmanifest` + icons + a service worker (offline shell, installability).
- Supabase session auth (member account from checkout); `(pocket)/layout.tsx`.
- Home screen tiles: **Assistant · Academy · Earn · Compass · Climb** (locked states for
  non-members).
- **Gate:** installs + loads on iOS Safari, Android Chrome, desktop Chrome/Edge;
  `npm run build` green.

## Phase 2 — Hosted assistant (`/api/pocket/chat`)

- Route Handler holding `ANTHROPIC_API_KEY` server-side; **membership gate first**.
- Claude **Haiku 4.5** default; escalation to Sonnet 4.6 / Fable 5 by config (Open Dec. #2).
- Streamed replies; **compliance output guard** (scan + block/rewrite + audit log).
- Per-member rate limit (extend `src/lib/rate-limit.ts`) + monthly token budget;
  `pocket_usage` logging.
- System prompt = fenced Credit Guidance persona (companion, not a CRO/lawyer/advisor).
- **Gate:** no-membership → no answer; forbidden phrases never reach the client (tested);
  no key in client bundle (scanned).

## Phase 3 — Funnel wiring

- Mobile-optimized landing + QR → GHL `member-97` checkout (`NEXT_PUBLIC_GHL_CHECKOUT_97`).
- `/api/webhooks/ghl`: tag `member-97`, upsert member, fire welcome with the **one install
  link**.
- RLS gates assistant + tiles by membership; lapse → climb/upsell screen (grace per Open
  Dec. #4).
- **Gate:** end-to-end test — pay → tagged → install link → app unlocks; lapse → locks.

## Phase 4 — Earn + Academy (learn → earn → churn)

- `pocket_referrals`: referral code/link, signups, **collected** sales, commission owed.
- Earnings tile (honest: collected sales only); Operator Academy micro-lessons; climb
  prompts toward the next rung (`docs/OFFER-STACK.md`).
- **Gate:** referral attribution correct; earnings reflect collected sales only; copy review.

## Phase 5 — Operator graduation

- Surface owner-gated promotion in-app (reflects Supabase `app_metadata.role = "va"`).
- Reflect fenced operator scope; hand off to `docs/OPERATOR-START-HERE.md` + the rung ladder.
- **Gate:** promoted member sees operator surface; never gains HAILMARY/owner-AIXMOS access.

---

## New data (all RLS-protected)

| Table | Purpose |
|---|---|
| `pocket_members` (or extend profiles/people) | membership status, install state, referral code, academy progress |
| `pocket_usage` | per-member request/token counts (cost control + abuse) |
| `pocket_referrals` | referral → signups → collected sales → commission owed |

Reuse GHL tags as funnel state: `tmmt-customer` → `ready-for-aixmos` → `member-97` →
`credit-guidance-active`.

## New env (server-side only)

- `ANTHROPIC_API_KEY` — the hosted assistant key (never client-exposed).
- `POCKET_MODEL_DEFAULT` / `POCKET_MODEL_ESCALATE` — model selection.
- `POCKET_MONTHLY_TOKEN_BUDGET` — per-member cost cap.
- (Reuse existing `NEXT_PUBLIC_GHL_CHECKOUT_97`, `GHL_WEBHOOK_SECRET`, Supabase vars.)

## Dependencies / owner taps

- Owner confirms the 5 Open Decisions in the spec.
- Owner provisions `ANTHROPIC_API_KEY` in Vercel (production) + local `.env`.
- GHL `member-97` product + checkout link live (mostly exists per `docs/SALES-CHANNELS.md`).
- Compliance copy reviewed against `docs/CREDIT-FUNDING-COMPLIANCE.md` before Phase 3 ships.

## Definition of done

All seven Success Criteria in the spec pass, `npm run build` green, compliance review
signed off, secret scan clean, and a member on each of the four platforms can install,
get a compliant answer, see their referral link, and be promoted to operator — with the
owner's brain provably untouched.
