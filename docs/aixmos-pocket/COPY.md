# AIXMOS Pocket — Member-Facing Copy (compliance-locked)

> **Phase 0 deliverable** for `docs/superpowers/specs/2026-06-19-aixmos-pocket-taste-offer-design.md`.
> Every string a member can see lives here first and is checked against the
> compliance vocabulary BEFORE it ships in the UI or the assistant.

## The non-negotiable vocabulary

| ✅ Always say | ❌ Never say |
|---|---|
| credit **guidance**, coach, plan, education, readiness | credit **repair**, fix your credit, delete, dispute-for-you |
| commission on **collected** sales, earn as you refer | guaranteed income, passive income, get rich |
| may help, can support, work toward | guarantee, 100%, instant, boost guaranteed |
| companion, education tool | advisor, attorney, credit repair organization |

Sources: `docs/sops/CREDIT-GUIDANCE-SOP.md`, `docs/ops-company-policy.md`,
`docs/CREDIT-FUNDING-COMPLIANCE.md`, `docs/OFFER-STACK.md` (Guardrails).

## App identity

- **Name:** AIXMOS Pocket
- **One-liner:** *Your credit-guidance coach and earn-as-you-learn hub — on every device.*
- **Install:** "Add AIXMOS Pocket to your home screen — works on any phone, tablet, or computer."

## Home screen tiles

| Tile | Member-facing line |
|---|---|
| **Assistant** | "Ask your guidance coach anything — build a plan, learn the next step." |
| **Academy** | "Learn how the network earns. Short lessons, real skills." |
| **Earn** | "Share your link. Earn commission on every sale that's collected. No hype — real money on real sales." |
| **Compass** | "Protect your peace. One small step today." |
| **Climb** | "Ready for more? See your path from member → operator → your own business." |

## The "activate" (non-member) screen

> **Heading:** Start your taste — $97/mo Credit Guidance membership
> **Body:** Get your AIXMOS Pocket coach, the Academy, and your earn-as-you-refer
> link. Learn the system, earn on real sales, and climb toward running your own
> location. Cancel anytime.
> **Button:** Activate membership
> **Fine print:** Membership is credit *guidance* and education — not credit repair,
> and not a promise of any score or income. Earnings are commission on collected
> sales only.

## Assistant system-prompt persona (Phase 2 — recorded here for review)

> You are the AIXMOS Pocket guidance coach. You help members with **credit
> guidance and education** and with learning the AIXMOS network. You are a
> companion and education tool — **not** a credit repair organization, not an
> attorney, not a financial or investment advisor. You never promise score
> changes, outcomes, or income. You speak only of credit **guidance, coaching,
> plans, and education** — never "repair," "fix," "delete," "guarantee," or
> "100%." For anything that needs a licensed professional, you say so and point
> the member to one. You protect the member first; on a heavy day you gently point
> to real human support. Be warm, brief, and practical.

## Earn / referral disclosure (protective — keep verbatim)

> You earn a commission **only on sales that are actually collected and cleared.**
> There is no guaranteed or passive income. You are not paid for sign-ups,
> recruiting, or referrals that don't result in a collected sale. This is a simple,
> single-tier referral reward — not a multi-level program.

_This single-tier, collected-sales-only structure is the protective choice for the
owner (Muhammad Taha): it avoids guaranteed-income and pyramid/MLM exposure._
