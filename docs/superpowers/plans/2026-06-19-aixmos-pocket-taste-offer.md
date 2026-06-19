# AIXMOS Pocket — Implementation Plan

**Date:** 2026-06-19
**Spec:** `docs/superpowers/specs/2026-06-19-aixmos-pocket-taste-offer-design.md`
**Status:** DRAFT — awaiting owner approval of the spec before Phase 1 build begins
**Workflow:** subagent-driven per `CLAUDE.md`; `npm run build` is the primary gate each phase.

## Progress (2026-06-19)

- ✅ **Phase 0** — compliance copy (`docs/aixmos-pocket/COPY.md`).
- ✅ **Phase 1** — installable PWA shell (`src/app/(pocket)/`, `/pocket`).
- ✅ **Phase 2** — assistant on the OWNER'S brain (`src/lib/pocket-brain.ts`,
  `/api/pocket/chat`), metered in **TMMT tokens** (not Anthropic), compliance guard.
- ✅ **Phase 3** — top-up: `$97/mo` → token grant wired into `/api/webhooks/ghl`.
- ✅ **Phase 4** — Earn (single-tier, collected-only referrals; `/pocket/earn`) +
  Academy (`/pocket/academy`). Migration `20260619020000_pocket_referrals.sql`.
- ✅ **Phase 5** — operator graduation: role-aware `/pocket/climb` + operator-hub
  hand-off on the home screen.

**Remaining = owner taps only** (no more code to ship the v1 loop): set
`POCKET_BRAIN_URL`/`POCKET_BRAIN_MODEL` to the owner's reachable brain endpoint;
apply migrations `20260619010000` + `20260619020000` to prod via the ship flow;
confirm the GHL `member-97` checkout fires the webhook. Optional tuning:
`MEMBER_97_MONTHLY_TOKENS`, `COST_PER_JOB`, `POCKET_REFERRAL_RATE`.

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

## Tuning knobs (live via Vercel env — no code change)

The engine is built to be tuned. Every lever below reads from env at runtime with
a safe default, so the owner can adjust the ride without recutting a part:

| Env var | Default | What it tunes |
|---|---|---|
| `MEMBER_97_MONTHLY_TOKENS` | `500` | Monthly TMMT stack a $97 member gets (the cost cap) |
| `POCKET_COST_PER_JOB` | `1` | TMMT tokens spent per assistant message |
| `POCKET_REFERRAL_RATE` | `0.20` | Commission on a collected sale (single-tier) |
| `POCKET_BRAIN_MAX_TOKENS` | `600` | Max output length per reply (caps time/cost) |
| `POCKET_BRAIN_TIMEOUT_MS` | `30000` | Brain call timeout (2s–120s) |
| `POCKET_BRAIN_URL` / `_MODEL` / `_KEY` | — | The owner's self-hosted brain endpoint |

Money-safety tunes baked in (master-mechanic pass 2026-06-19): referral earnings
are idempotent even with no transaction ref (`referralDedupeKey` → never double-pay
on a webhook retry); refunds/chargebacks claw back via `clawbackReferral` and the
earnings summary is **net of clawbacks**; membership unlocks off an **active token
account** (so paying members actually get in); the assistant carries short-term
memory (bounded to 6 turns) for continuity without runaway cost.

## New env (server-side only) — the OWNER'S brain, NOT Anthropic

- `POCKET_BRAIN_URL` — the owner's OpenAI-compatible endpoint (LiteLLM router or
  Ollama `/v1/chat/completions`). Must be reachable from where the app runs; for a
  Vercel deploy that means a reachable host (rented GPU box / gateway), not a
  home-only tailnet IP. **No Anthropic key. The brain is the owner's.**
- `POCKET_BRAIN_MODEL` — model name (LiteLLM `model_name` or e.g. `qwen2.5:14b`).
- `POCKET_BRAIN_KEY` — optional bearer for the router (server-side only).
- Cost cap is the **TMMT Token Ledger** (`src/lib/token-ledger.ts`):
  `MEMBER_97_MONTHLY_TOKENS` (the monthly stack) + `COST_PER_JOB` (per message).
- (Reuse `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_GHL_CHECKOUT_97`,
  `GHL_WEBHOOK_SECRET`, Supabase vars.)

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
