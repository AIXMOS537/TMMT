# Cost & Capacity Plan — don't run out

The one worry answered: **adding employees and operators does NOT burn your
metered tokens.** Here's exactly why, what each thing costs, and the caps to set.

## The realization that solves it

The app calls AI in **one place** (`src/lib/ops-ai.ts`, Claude Sonnet, max 1024
output tokens), and only from **owner + executive** features — the command desk,
ops review, and dispatch refinement. **Operators and regular employees who log in
and use forms/portals trigger ZERO AI calls.** So:

> **Your AI cost is bounded by how much YOU use the command desk — not by how
> many people you onboard.** Add 5 operators or 50 employees; the AI bill barely
> moves.

## Two different "Claudes" — don't confuse them

| | What it is | Who uses it | Cost type |
|---|---|---|---|
| **Claude Code** | Your dev/coding assistant (this) | You + developers only | Your Max plan / API seat |
| **App AI** (Anthropic API key) | Runtime AI inside the app | Owner + exec (command desk, dispatch) | Pay-per-call, ~$0.02/call |

Employees and operators use **neither**. They use a browser login.

## Your stack — flat vs metered

| Tool | What for | Cost | Scales with # of app users? |
|---|---|---|---|
| **Vercel** | Hosts the 3 apps | Pro ~$20/mo (Hobby free but you've outgrown it: commercial + crons) | Barely — Pro includes ~1M function calls + 1TB bandwidth |
| **Supabase** | Database + logins | Free now (≤50K monthly active users, 500MB) → Pro $25/mo when you pass it | Only at **thousands** of users (MAU + DB size) |
| **Anthropic API** | App AI (command desk) | Pay-per-call (~$0.02). ~$1–3/day realistic | **No** — owner/exec only |
| **GHL** | CRM + checkout | Flat (~$97–$497/mo, your plan) | No |
| **ClickUp** | Internal task mgmt | ~$7–12/user/mo — only for staff who use ClickUp directly | No (app users don't need ClickUp seats) |
| **Airtable** | Legacy sync | Can likely retire (data is in Supabase now) | — |
| **Claude Code** | Dev work | Max plan ~$100–200/mo per dev seat | No (not an app cost) |

## Your exact daily cost (formula)

```
Daily ≈ (flat monthly subscriptions ÷ 30)  +  (app AI calls/day × $0.02)  +  (Claude Code dev seat ÷ 30)
```
**Realistic today (~15 users):**
- Flat: Vercel $20 + Supabase $0 + GHL ~$200 + ClickUp (team) ≈ **$220–350/mo → ~$8–12/day**
- App AI: owner does ~20–50 desk calls/day × $0.02 ≈ **$0.50–1/day**
- Claude Code (dev): Max plan ≈ **$3–7/day** (tapers once the build settles)

**≈ $12–20/day total — and ~90% of it is flat subscriptions, not usage.**
Onboarding operators/employees adds **cents**, not dollars.

## The 3 things that *can* actually "run out" — and the cap for each

1. **Claude Code (dev tokens)** — the real one. Heavy coding sessions (like building
   this) burn the most. **Cap:** pick a Max plan tier that fits; once the app is
   built, dev usage drops to maintenance. This is *your* seat, not the app.
2. **Anthropic API (app AI)** — **Cap:** set a hard **monthly spend limit** on the
   API key in console.anthropic.com → Billing → Limits. Even $50/mo is generous
   for owner/exec desk use.
3. **Vercel / Supabase** — only at scale. **Cap:** Vercel → Settings → Spend
   Management (set a $ ceiling + alerts). Supabase → upgrade to Pro only when the
   free MAU/DB limit is hit (you'll get a warning first).

## Scaling plan — what changes as you grow

| Stage | Users | What to do |
|---|---|---|
| **Now → 50** | employees + a few operators | Nothing new. Set the 3 caps above. Vercel Pro. Supabase free is fine. |
| **50 → 1,000** | more operators + customers | Supabase **Pro** ($25). Watch Vercel function usage (still cheap). AI still owner-only = flat. |
| **1,000+** | many customers | Supabase compute add-on; Vercel bandwidth; consider per-dealer isolation (separate projects). |

The point: your architecture put the expensive AI behind owner/exec doors on
purpose. **Headcount is cheap. Only your own command-desk + dev usage meters.**

## Do this now (15 minutes)
1. **console.anthropic.com** → set a monthly spend cap on the app's API key.
2. **Vercel** → Settings → Spend Management → set a ceiling + email alerts.
3. **Assign roles** to the 11 no-role users so they don't all have full staff access.
4. Leave Supabase on free until it warns you (you're far from the limits).
