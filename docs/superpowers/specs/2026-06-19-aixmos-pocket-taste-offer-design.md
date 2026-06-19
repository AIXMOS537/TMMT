# AIXMOS Pocket — Cross-Platform "Taste" Offer & Operator Climb — Design Spec

**Date:** 2026-06-19
**Author:** Owner (PROJECT X HAILMARY) + Claude (architecture)
**Status:** DRAFT — blueprint for owner approval before build (per "blueprint first, then build")

---

## Executive Summary

**AIXMOS Pocket** is an installable, cross-platform app (Android, iPhone, Mac, Windows)
that every **$97/mo Credit Guidance member** gets the moment they sign up. It is the
**taste** of the whole AIXMOS ecosystem in their hand — a fenced AIXMOS-lite assistant
plus the learn-earn-churn tools — and it is the **top of the funnel** that turns happy
renters and cold leads into paying members, members into **TMMT operators who earn fast
cash on real sales**, and operators into owners climbing the existing rung ladder
(`docs/OFFER-STACK.md`, $1,875 → $100K) toward their own business or location.

The format is a **Progressive Web App (PWA)** served from the existing Next.js/Vercel
stack — *not* the owner's SSH-to-Mac pocket setup (`docs/IPHONE-ULTIMATE.md`). A
mass-market member has no Mac, no Tailscale, no terminal. The PWA installs to the home
screen from **one link or QR code** on any device, with **zero install friction**, and
its assistant is powered by the **owner's self-hosted brain** (the LiteLLM/Ollama stack —
*not* Anthropic), **metered in TMMT TOKENS** so members pay in the network's own currency.
This is the only architecture that delivers "any and all devices, easily" while keeping
the owner's local-first HAILMARY/AIXMOS brain separate and private — and keeping the
margin inside the network.

> **Brain + currency correction (2026-06-19):** an earlier draft of this spec proposed
> the hosted Claude API. That bleeds margin to a third party and defeats the purpose of
> the local-first stack. The product runs on the **owner's brain** and is metered by the
> existing **TMMT Token Ledger** (`docs/superpowers/specs/2026-06-18-tmmt-token-ledger.md`,
> `src/lib/token-ledger.ts`): $97/mo tops up an org's token stack; each message spends a
> token; owner + first-10 operators are `unlimited`. *No crypto — internal credits only.*
> Where this document below says "Claude API / Haiku," read **"the owner's self-hosted
> brain via `POCKET_BRAIN_URL`, metered in TMMT tokens."**

> **The line that governs this whole spec:** *Public only ever sees AIXMOS.* HAILMARY —
> and the owner's real AIXMOS network brain — are **never sold, never multi-tenant, never
> shipped** (`docs/HAILMARY-CHARTER.md` Art. I; `docs/AIXMOS-CHARTER.md` Art. I;
> `docs/OFFER-STACK.md` Guardrails). What members buy is **AIXMOS Pocket**, a fenced,
> hosted, public-facing product — the "little brother," never the keys.

---

## Goals

- **One link, every device.** Android, iPhone, Mac, Windows install AIXMOS Pocket from a
  single URL/QR — no App Store, no APK, no SSH, no Tailscale, no terminal.
- **The $97/mo membership IS the taste.** Signing up for **Credit Guidance** ($97+/mo)
  unlocks AIXMOS Pocket. The taste sells the climb.
- **Learn → earn → churn → operator.** The app teaches (Operator Academy micro-lessons),
  pays (affiliate/referral = the "fast cash" hook), and graduates members into fenced
  **TMMT operators** with their own scope, then up the rung ladder.
- **Hosted, safe, reliable for daily mass use.** The assistant runs on the **Claude API**
  behind our server — scales to unlimited members, always the latest models, no exposure
  of the owner's private mesh, one server-side key, hard rate limits.
- **Compliance baked in, not bolted on.** Every assistant reply and every screen speaks
  **"credit guidance / coach / plan," never "credit repair / fix / guarantee"** — enforced
  in the system prompt, the UI copy, and a server-side output guard.
- **Reuse the funnel we already have.** GHL + Stripe checkout, the `member-97` tag, the
  `/api/webhooks/ghl` → Supabase sync, the operator provisioning path — extended, not
  rebuilt.

## Non-Goals (out of scope for v1)

- **Native iOS/Android apps** (Swift/Kotlin/React Native). PWA first; native is a later
  phase only if push/offline demands it.
- **Selling or shipping HAILMARY or the owner's AIXMOS network brain.** Forbidden by charter.
- **On-device/offline LLM for members.** The owner's local-first model
  (`docs/LOCAL-FIRST-AI-STACK.md`) stays owner/operator-only. Members use the hosted brain.
- **Replacing the rung ladder or USB kits.** AIXMOS Pocket is the *on-ramp* to them
  (`docs/OFFER-STACK.md`, `docs/FLASH-DRIVE-PRODUCT-LINE.md`), not a replacement.
- **New pricing for the build tiers.** The $1,875 → $100K ladder is unchanged; this spec
  only adds the $97/mo membership as the productized cross-platform entry.
- **Automated credit-bureau actions or score guarantees.** Never. Guidance only.

## Constraints

- **Compliance vocabulary is non-negotiable:** "credit guidance" (never "credit repair"),
  no guaranteed outcomes (`docs/sops/CREDIT-GUIDANCE-SOP.md`, `docs/ops-company-policy.md`).
- **Tech stack is fixed:** Next.js 16 App Router, TypeScript strict, Tailwind 4, Supabase
  (RLS on all tables), `@supabase/ssr`, zod-validated server actions, GHL + Stripe for
  payments. New work must follow the patterns in `CLAUDE.md` (route groups, server-action
  writes, `createSSRClient`, ErrorBanner, no writes in `queries.ts`).
- **No secrets to the client.** The Claude API key, Supabase service role, and GHL secret
  live server-side only. The PWA holds a session, nothing else.
- **Members are non-technical** and many arrive on a phone. ≤2 taps from link to a working
  app; ≤1 sign-in (the membership account they already created at checkout).
- **Cost discipline.** A $97/mo product cannot lose money on tokens — default to the
  cheapest capable model, cap usage, cache, and escalate by exception.

---

## The Offer (what a member actually buys)

**SKU: `AXP-97` — AIXMOS Membership + Pocket** — **$97/mo** (compliance: *Credit Guidance
membership*; the app is the member benefit).

| Included | Detail |
|---|---|
| **AIXMOS Pocket app** | Installable PWA on any device; the fenced AIXMOS-lite assistant. |
| **Credit Guidance assistant** | Hosted Claude API, compliance-gated. Plans, education, next steps — **guidance, never repair, never guarantees.** |
| **Operator Academy (taste)** | Micro-lessons: how the network earns, the rung ladder, what an operator does. |
| **Earn hook (fast cash)** | A personal referral link + live earnings tile. Refer → they buy → member earns commission on **real, collected sales only** (`docs/OFFER-STACK.md`). |
| **The Compass** | The protect-first, one-step-toward-God screen (`scripts/compass` ethos), one tap — on every device. |
| **Climb prompts** | In-app nudges toward the next rung ($1,875 taste build → … → operator with own location). |

**Why $97/mo as the taste (not a cheaper one-time):** it puts a *recurring, qualified,
intent-proven* member at the top of the funnel from day one, it already exists in GHL/Stripe
(`member-97`), and it's the exact rung the funnel is built to upsell from (rental → `$97/mo`
→ credit guidance → funding → operator). The "taste" is the *experience inside the app*, not
a discount.

---

## The Climb: learn → earn → churn → operator → owner

```
  COLD LEAD / HAPPY RENTER
        │  (GHL: ready-for-aixmos)
        ▼
  $97/mo MEMBER  ── installs AIXMOS Pocket (any device, one link)
        │  LEARN: Operator Academy taste · Credit Guidance assistant
        │  EARN : referral link → commission on real sales (fast cash)
        ▼
  ACTIVE EARNER  ── consistent referrals / engagement
        │  (owner promotes: Supabase app_metadata.role = "va")
        ▼
  TMMT OPERATOR  ── fenced scope (TMMT Ops + Command Center /operator)
        │  climbs OFFER-STACK: $1,875 taste build → $15K rental → $25K credit+funding …
        ▼
  OWNER / LOCATION  ── their own business or location to run (post-setup)
```

- **Learn** = Operator Academy micro-lessons + the assistant teaching by doing.
- **Earn** = referral commissions on **collected** sales (the "fast cash they love").
- **Churn** = healthy velocity: members who earn re-engage and recruit; the app surfaces
  their numbers to keep them moving.
- **Operator** = owner-gated promotion (same path as `docs/OPERATOR-START-HERE.md`): Supabase
  role elevation, fenced access, affiliate code. The operator **never** gets HAILMARY or the
  owner's AIXMOS network — they get AIXMOS Pocket + the granted accounts.
- **Owner** = the existing rung ladder build, ending in their own business/location.

---

## Architecture

### Format decision: PWA, served from the existing app

| Option | Verdict |
|---|---|
| **PWA (installable web app)** | ✅ **Chosen.** One URL → installs on Android (Chrome "Add to Home screen"), iPhone (Safari "Add to Home Screen"), Mac & Windows (browser "Install"). No store review, no APK, instant updates on deploy. Lives in our Next.js/Vercel stack. |
| Native iOS/Android | ❌ v1. Store friction, two codebases, review delays. Revisit only for push/deep-offline. |
| SSH-to-Mac (owner pattern) | ❌ for members. Requires a Mac base + Tailscale; that's the *owner's* setup (`docs/IPHONE-ULTIMATE.md`), not a product. |

**Where it lives:** a new public route group in the existing app, e.g. `src/app/(pocket)/`
served on the public AIXMOS host (`allinonemanagementsolutions.com` /
`tmmt-ops.vercel.app`), with a web manifest + service worker for installability. Auth via
the member's Supabase session (the account created at GHL/Stripe checkout).

### The assistant brain: hosted Claude API (fenced)

- **Model strategy (cost-aware, latest):** **Claude Haiku 4.5** as the daily driver
  (fast, cheapest capable) for routine guidance/Q&A; **escalate to Sonnet 4.6 / Fable 5**
  only for complex plan-building. Models configurable server-side; default to the cheapest
  that meets quality so the $97/mo stays profitable.
- **Server-side only:** a Next.js Route Handler (`/api/pocket/chat`) holds the
  `ANTHROPIC_API_KEY`, builds the system prompt, calls the API, streams the reply. The key
  **never** reaches the client.
- **Fenced + gated:** the handler verifies the caller is an **active member** (`member-97`
  via Supabase RLS / session) before answering. No membership → no assistant.
- **Rate-limited + metered:** per-member request caps (extend `src/lib/rate-limit.ts`),
  per-member monthly token budget, optional Redis/Supabase usage log for cost visibility.
- **Compliance guard (two layers):**
  1. **System prompt** hard-codes the guidance vocabulary, the "no guarantees" rule, and
     the "companion, not a clinician / not a lawyer / not a CRO" boundary.
  2. **Server-side output check** scans the model's reply for forbidden phrases
     ("repair," "fix your credit," "guaranteed," "100%") and rewrites/blocks before it
     reaches the member — defense in depth, logged for audit.

### Why hosted Claude, not our own hub (the safety/reliability call you delegated)

- **Reliable for daily mass use:** managed uptime; no dependency on the owner's Mac/Brainiac
  being awake. A member in another city at 2am still gets an answer.
- **Secure:** the owner's private Tailscale mesh and local models are **never exposed** to
  customers; one rotated server-side key; RLS-gated.
- **Scalable + current:** unlimited members without us provisioning GPUs; always the latest
  Claude models. The owner's local LiteLLM/Ollama stack (`docs/LOCAL-FIRST-AI-STACK.md`)
  stays the owner/operator private tier — the right tool for the owner, the wrong dependency
  for a public product.

### Payments & provisioning (reuse what exists)

- **Checkout:** existing GHL + Stripe `member-97` product (`docs/SALES-CHANNELS.md`,
  `NEXT_PUBLIC_GHL_CHECKOUT_97`). One mobile-optimized landing + QR drives it.
- **On payment:** `/api/webhooks/ghl` (already specced) tags `member-97`, upserts the member
  in Supabase, and the welcome flow texts/emails the **one install link**.
- **Access control:** Supabase RLS keys the assistant + member tiles to `member-97`. Lapsed
  membership → app degrades to the upsell/climb screen; assistant locks.
- **Operator promotion:** unchanged owner flow — Supabase `app_metadata.role = "va"`,
  affiliate code, fenced scope (`docs/OPERATOR-START-HERE.md`). The app simply reflects the
  elevated role.

### Data model (additions, all RLS-protected)

- `pocket_members` (or reuse the existing profiles/people row): membership status, install
  state, referral code, earnings summary, academy progress.
- `pocket_usage`: per-member request/token counts for cost control + abuse detection.
- `pocket_referrals`: referral link → signups → **collected** sales → commission owed.
- Reuse existing GHL tags (`tmmt-customer`, `ready-for-aixmos`, `member-97`,
  `credit-guidance-active`) as the funnel state machine.

---

## Compliance (the offer dies without this)

- **Vocabulary, everywhere:** UI copy, assistant replies, academy lessons, referral
  marketing — **"credit guidance," "coach," "plan," "education."** Never "repair," "fix,"
  "delete," "guarantee," "100%," "boost guaranteed."
- **Honest earnings claims:** the referral/earn hook promises commission on **real,
  collected sales only** — never guaranteed income (`docs/OFFER-STACK.md` Guardrails).
- **Boundaries stated in-app:** AIXMOS Pocket is a companion/education tool — **not** a
  credit repair organization, not a lawyer, not a financial advisor; it points members to
  real professionals for regulated work, and the `compass` points to real human help on a
  heavy day.
- **Audit trail:** the server-side output guard logs any blocked/rewritten reply for review.
- **Disclosures:** standard CROA-safe framing reviewed against
  `docs/CREDIT-FUNDING-COMPLIANCE.md` before launch.

---

## Implementation Phases (the plan to build, after approval)

> Full phased plan to be written to `docs/superpowers/plans/2026-06-19-aixmos-pocket-taste-offer.md`
> and executed subagent-driven per `CLAUDE.md`.

1. **Phase 0 — Offer + compliance copy.** Lock SKU `AXP-97`, the install link/QR, and all
   member-facing copy against the compliance vocabulary. (Docs only; no risk.)
2. **Phase 1 — PWA shell.** `src/app/(pocket)/` route group, web manifest + service worker,
   installable on all 4 platforms, Supabase session auth, the home screen with tiles
   (Assistant, Academy, Earn, Compass, Climb). Build gate: installs + loads on iOS Safari,
   Android Chrome, desktop Chrome/Edge.
3. **Phase 2 — Hosted assistant.** `/api/pocket/chat` Route Handler: membership gate →
   Claude API (Haiku 4.5 default) → streamed reply → compliance output guard → usage meter.
   Rate limits + monthly budget. System prompt = the fenced Credit Guidance persona.
4. **Phase 3 — Funnel wiring.** Mobile landing + QR → GHL `member-97` checkout →
   `/api/webhooks/ghl` → Supabase + welcome install link. RLS gates assistant by membership.
5. **Phase 4 — Earn + Academy.** Referral code/link, earnings tile (collected sales only),
   Operator Academy micro-lessons, climb prompts toward the next rung.
6. **Phase 5 — Operator graduation.** Surface owner-gated role elevation in-app; reflect
   fenced operator scope; hand off to the existing operator path + rung ladder.

Each phase: `npm run build` (primary gate) + vitest where testable + a compliance copy
review. No phase ships member-facing AI without the output guard live.

---

## Success Criteria

1. **One link installs on all four platforms.** A non-technical member, on Android, iPhone,
   Mac, or Windows, goes from the link to a working home-screen app in ≤2 taps, ≤1 sign-in.
2. **The $97/mo unlocks the taste.** Active `member-97` → assistant + tiles live; lapsed →
   assistant locks, climb screen shows. Enforced by RLS, verified by test.
3. **The assistant is fenced + compliant.** No membership → no answer. Every reply passes
   the compliance vocabulary guard; blocked phrases are logged. Zero "credit repair /
   guarantee" language reaches a member in QA.
4. **No secret reaches the client.** Automated scan: no `ANTHROPIC_API_KEY`, Supabase
   service role, or GHL secret in any client bundle.
5. **Cost is bounded.** Per-member rate limit + monthly token budget enforced; usage logged;
   a runaway member cannot blow the unit economics of $97/mo.
6. **The climb is wired.** A member can get a referral link, see (honest) earnings, and the
   owner can promote them to fenced operator without leaving the existing path.
7. **Owner brain stays private.** No customer path reaches HAILMARY, the owner's AIXMOS
   network, the Tailscale mesh, or local models. Audited.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Compliance slip ("repair/guarantee") reaches a member | Two-layer guard (system prompt + server output scan) + copy review gate every phase + audit log |
| Token costs exceed $97/mo margin | Haiku 4.5 default, per-member caps + monthly budget, response cache, escalate-by-exception only |
| Members expect the owner's full local agent | Clear positioning: Pocket = the public AIXMOS taste; the owner's HAILMARY/AIXMOS is not the product (charter) |
| iOS PWA limits (no true push, storage caps) | v1 scope avoids push/deep-offline; revisit native only if needed (Non-Goals) |
| Leaked API key | Server-side only, never in client; rotateable; rate-limited; alert on anomalous spend |
| "Fast cash" overpromise = legal exposure | Earnings = commission on **collected** sales only; honest claims enforced in copy + `docs/OFFER-STACK.md` |
| Charter breach (someone tries to buy HAILMARY) | Fail closed; "public only ever sees AIXMOS"; apex/HAILMARY stays owner-only |

## Open Decisions (need owner sign-off to finalize the plan)

1. **Install link host:** under `allinonemanagementsolutions.com` (public AIXMOS) or a
   short branded domain for the QR? (Recommend the public AIXMOS host + a short redirect.)
2. **Assistant default model:** confirm **Haiku 4.5** as the daily driver with Sonnet/Fable
   escalation, vs. a single mid model. (Recommend Haiku 4.5 default.)
3. **Earn mechanics:** flat referral commission vs. tiered by volume; exact % — your call,
   set against the rung ladder economics.
4. **Membership gating depth:** does the assistant lock immediately on lapse, or a grace
   period? (Recommend short grace + climb screen.)
5. **Academy depth in v1:** 3 taste lessons vs. a fuller track at launch.

---

_Companions: `docs/OFFER-STACK.md` (the rung ladder), `docs/AIXMOS-TMMT-FUNNEL.md` (the GHL
funnel), `docs/SALES-CHANNELS.md` (GHL+Stripe), `docs/OPERATOR-START-HERE.md` (operator
path), `docs/IPHONE-ULTIMATE.md` (the **owner's** local pocket setup — distinct from this
product), `docs/AIXMOS-CHARTER.md` + `docs/HAILMARY-CHARTER.md` (the boundary),
`docs/sops/CREDIT-GUIDANCE-SOP.md` + `docs/CREDIT-FUNDING-COMPLIANCE.md` (compliance)._
