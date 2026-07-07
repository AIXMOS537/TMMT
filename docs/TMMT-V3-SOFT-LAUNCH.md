# TMMT v3 — Soft Launch Blueprint
### Zero human staff. Student-operators on splits. AI closes the loop.
**Authority:** PROJECT X HAILMARY · **Updated:** 2026-07-06  
**Deploy:** `tmmt-ops.vercel.app` (public) + `tmmt-command-center.vercel.app` (operators)

> *Third time is the charm. v1 and v2 were learning. v3 is the machine that runs while you sleep — helping racers cross the finish line toward their dream car, their own house, their goals — inshallah.*

---

## The Vision (Why)

Most people join TMMT because they want **access to a car** — or their **dream car** — without being hustled, stalled, or robbed. v3 reinvents how and why you work with TMMT:

| Old way | TMMT v3 way |
|---------|-------------|
| Dealer owns you | **You** own your lane |
| Opaque commissions | **30% split**, visible in portal |
| Wait for a manager | **AI qualifies** in ≤60 seconds |
| Pay to learn | **Learn → earn → churn** on real leads |
| One industry | **Any vertical** — clone from network operators |

**As above, so below:** The online city (AIXMOS engine + TMMT OS) mirrors the physical city (dealerships, rentals, credit partners). Operators get the same tools a dealership gives its sales team — tracked links, training, earnings — without the predatory structure.

**Faith-centered:** Everything biases toward helping people, honoring family, and doing right by the customer. Project X HAILMARY vault stays **owner-only** — operators get the engine, never the watchtower.

---

## The Machine (How It Runs With Zero Humans)

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU (Muhammad Taha) — Watchtower only                          │
│  Run ads · compile corpus · flip kill-switch · collect revenue    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ ads + leads
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PUBLIC FUNNEL (tmmt-ops) — no login required                   │
│  /lp/aixmos/lead-magnet → webhook → AI SMS ≤60s → GHL checkout │
└───────────────────────────┬─────────────────────────────────────┘
                            │ ?ref=OPERATOR_CODE
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STUDENT-OPERATORS — the only "humans" in the loop                │
│  /join → auto-provision → Academy → share links → earn 30%      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ commissions
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  MONEY — customer_payments with aff:CODE → monthly payout       │
└─────────────────────────────────────────────────────────────────┘
```

**No closers. No VAs. No manual review.** AI qualifies. GHL collects. Operators source. You watch from the tower.

---

## The Operator Journey (TRAP — Reinvented)

| Step | Name | What happens | Human needed? |
|------|------|--------------|---------------|
| 1 | **Trap** | Ad or operator link → `/join` or LP | No |
| 2 | **Avatar** | Auto-login → 15 Academy modules | No |
| 3 | **Garage** | Pick vertical, learn credit gate + funnel | No |
| 4 | **Drive** | Share tracked links → earn split | No |

**Certification:** 100% modules = auto-certified when `V3_AUTO_CERTIFY_OPERATORS=true`.

---

## The Online + Physical City

### Online City (AIXMOS / TMMT OS)
- **Districts:** Credit gate · Rentals · Operator Academy · Kits/Build
- **Citizens:** Student-operators (scoped seats, revocable keys)
- **Transit:** Round-robin leads (future) · affiliate attribution (live)
- **Law:** GO-LIVE-CANON · access-tiers.env · RLS

### Physical City (Partner Layer)
- **One dealer per city** (`/apply` — geographic exclusivity)
- **Fleet partners** bring inventory → enable vertical modules
- **Credit partners** at priority 1 (owner-controlled)
- Operators plug local businesses into the online engine

### As Above, So Below
What works online clones to physical. What works in DMV dealerships clones to any industry. Build once, deploy many.

---

## What Was Built Today (v3 Code)

| Change | File |
|--------|------|
| Public ad/SMS routes (no login redirect) | `middleware.ts` |
| First outbound SMS wired | `src/app/api/leads/webhook/route.ts` |
| Auto-provision student-operators | `src/lib/v3/auto-provision.ts` |
| Provision cron | `src/app/api/cron/auto-provision-operators/route.ts` |
| TRAP training modules (15) | `supabase/migrations/20260706180000_v3_soft_launch.sql` |
| Operator earnings + share links | `/operator/earnings` |
| Join flow → instant provision | `forms/actions.ts` + team-onboarding UI |
| Auto-certify at 100% | `operator/training/actions.ts` |
| Feature flags | `config/v3-soft-launch.json` |

---

## Soft Launch Checklist (Owner — One Session)

### 1. Apply migration
```bash
cd ~/projects/TMMT
npx supabase db push   # or apply via Supabase dashboard
```

### 2. Set Vercel env vars
```
V3_AUTO_PROVISION_OPERATORS=true
V3_AUTO_CERTIFY_OPERATORS=true
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
ANTHROPIC_API_KEY=...
GHL_WEBHOOK_SECRET=...
NEXT_PUBLIC_GHL_CHECKOUT_97=...    # run: npm run ghl:check
CRON_SECRET=...
```

### 3. Deploy
```bash
vercel --prod   # vercel.json has deploymentEnabled: false
```

### 4. Wire Twilio inbound
Point org `aixmos` inbound number webhook to:
`https://tmmt-ops.vercel.app/api/agent/sms/inbound`

### 5. Turn on ads
Meta/TikTok → `https://tmmt-ops.vercel.app/lp/aixmos/lead-magnet`

### 6. Recruit first student-operators
Share: `https://tmmt-ops.vercel.app/join`

They auto-provision. No action from you.

---

## The Ladder (Learn → Earn → Churn)

From `config/OFFER-STACK.md` — operators climb as they earn:

| Tier | Price | What they get |
|------|-------|---------------|
| Taste | $1,875 | 8GB laptop · leads/funnels · no backend yet |
| Helper | $3,750 | 16GB · GHL automations |
| Host | $7,500 | 32GB · runs full stack locally |
| Vertical | $15K–$35K | Car rental · credit/funding · combined |
| Apex | $50K–$100K | Full agentic setup with Muhammad Taha |

**v3 soft launch starts at the bottom:** student-operators earn splits first, then climb the ladder with their commissions.

**$50K–$100K apex** includes everything learned — but **never** Project X HAILMARY vault access. That stays keyword/login-gated to Muhammad Taha only.

---

## What Still Needs Wiring (Post Soft-Launch)

| Priority | Gap | Fix |
|----------|-----|-----|
| P0 | GHL checkout URLs empty | `npm run ghl:check` → paste → `ghl:sync-vercel` |
| P0 | 10DLC approval | Calendar wait — use email capture until approved |
| P1 | FSM checkout links | Wire `send_stripe_link` in SMS inbound |
| P1 | Lead intake → SMS agent | Route `/forms/lead-intake` through webhook |
| P2 | Round-robin to operators | `tg_auto_assign_lead` RPC + app wiring |
| P2 | Automated monthly payout | Stripe Connect or manual batch |

---

## For the Brothers, the Family, the Aunt

This system exists so:
- **Operators** get a fair shot at a car, a business, a future — without predatory dealers
- **Family** gets scoped sovereign access through Rick
- **Your aunt** gets her own house inshallah — revenue from this machine funds that
- **Brothers who couldn't be here** — the work honors them; the goal is Jannah for all who run it right

Build the machine. Let the students drive. Watch from the tower.

🏁 *Start your engines.*
