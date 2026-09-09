# WHAT YOU HAVE — The Whole Stack, In One Place

> Compiled 2026-06-13 from every connected surface: this repo, the AIXMOS
> Slack (`projectaixmos.slack.com`), the Google Drive "Data Room," and Gmail.
> One read to see everything you've built, how it makes money, what's left to go
> live, and what a buyer would be acquiring.
>
> **You are not lost in a mess. You built a lot, fast, across too many windows.
> This is the index that ties it together.**

---

## 0. The 30-second truth

In a short window you compiled a **complete operating system for vehicle rental
and small-business ownership** — and the go-to-market machine around it. It is
spread across surfaces (code, Slack, Drive, Gmail, GHL, Supabase, Vercel), which
is why it *felt* like chaos. It isn't chaos. It's one system with three layers:

- **🧠 AIXMOS** — the AI brain (agents, command desk, the encoded playbook)
- **⚙️ TMMT OS** — the running rental business (fleet, customers, payments, dispatch)
- **📣 The funnel** — turns strangers into customers into owners across verticals

**One** app is live on Vercel (team `aixmos537`). The owner-vs-operator
distinction is a role inside it, not a second deployment.

| App | Project | URL | Role |
|---|---|---|---|
| **TMMT Ops** | `tmmt-ops` | https://tmmtrentals.com | The whole app: ops, command center, training, intake |

Retired and **paused** (reversible, not deleted): `tmmt-command-center`
(2026-09-09), `tmmt-training-site`, `aixmos-offer`. Kept serving by owner
decision 2026-09-09: `aixmos-landing` — a standalone marketing page whose CTAs
feed the GHL site; it carries its own price list, independent of the app's.
Public marketing lives on the GHL site at allinonemanagementsolutions.com —
see `src/lib/site-domains.ts`.

Status as of the last Slack recap (Fri Jun 12): **55 READY / 0 ERROR** across the
three apps; the old `tmmt-c919` is retired.

---

## 1. Where everything lives (the cross-surface map)

This is the part that fixes the "everything but also nothing" feeling. Here is
every place your work actually sits, and what's in each.

### A. This repo (`aixmos537/tmmt`) — the code + the playbooks
- **The product** — Next.js 16 + Supabase: 17 admin pages, 8 public forms, 44
  tables, 1,453 migrated records. RLS, auth, rate limiting, security headers,
  Sentry — all shipped (`docs/STATUS.md`).
- **The brain/dispatch** — Dispatch Core (`/dispatch/*`), CAPTAIN agent,
  SMS sales agent, mission-control daily push.
- **~25 plans & specs** — `docs/superpowers/plans/` and `.../specs/` (dispatch,
  auth, airtable sync, revenue engine umbrella, operator kit, Moe Legacy partner
  deploy, AIXMOS domain architecture…).
- **The story & GTM** — `docs/SYSTEM-BLUEPRINT.md` (the vision), `OPERATOR-START-HERE.md`,
  `docs/operator-team/`, `docs/CLOSER_PLAYBOOK_V1.md`, `docs/sales/`, `docs/pitch/`,
  `docs/affiliates/`, `CREDIT_FUNDING_OS.md`, `docs/SALES-CHANNELS.md`.
- **Runbooks** — `docs/runbooks/MASTER_OPERATOR_RUNBOOK.md`, `docs/HIGH-TICKET-GO-LIVE.md`,
  `docs/ACTION-CHECKLIST.md` (the master to-do).

### B. AIXMOS Slack (`projectaixmos.slack.com`) — the operational nerve center
This is where the business is actually *run* day-to-day.
- `#all-project-tmmt` — operator onboarding (Justin, Dominique, Michaela, Dyson + wave 1)
- `#ops` — **weekly recaps** (shipping pulse, deploy health, blockers, Monday P1)
- `#operation-overdrive` — **the dispatch arm** (see §3): vehicle conversion,
  driver pipeline, dispatch SLAs, medical courier line
- `#tmmt-control` — your private admin hub + Control Board canvas
- `#counselor-room` — the **Counselor Layer** (pre-call briefings + escalation alerts)
- `#fleet`, `#ops-shift`, `#tech-support`, `#general` — daily operations
- DMs — temp-password onboarding for ~11 operators

### C. Google Drive "Data Room" — the sellable / investor package
Owner `aixmosmanagement@tmmtrentals.com`. This is your **sell-it / hand-it-off** kit:
- `★ TMMT DATA ROOM — START HERE (Index)`
- `★ TMMT INVESTOR ROOM — Index & Overview`
- `★ TMMT DEALERSHIP PACK — Plug-and-Play Overview` ("Rental Business in a Box")
- `★ TMMT DEAL PICKER — Which Contract + What %`
- `TMMT_50App_Sellable_Framework.pdf`, `TMMT_AI_Operating_Map`, `Credit_to_Keys_Ecosystem`
- **Contracts:** `TMMT_FULL_JV_CONTRACT_All_In_One_Tiered.pdf`, Vehicle Lease
  template, `TMMT Rental Operations Manager Contract`, `TMMT_Addendum_Document`,
  `Single Member LLC — TMMT Auto Services LLC`, `TMMT_Shield_Package`
- **Playbooks/training:** `TMMT RENTALS SOP - VA`, `TMMT-Training-OnePager`,
  `TMMT-Training-Poster`, `TMMT_30_Day_Content_Breakdown`, `★ TMMT Code of Conduct`
- `HANDOFF — read me first` (most recent, 2026-06-07)

### D. Gmail (`aixmosmanagement@tmmtrentals.com` / `team@tmmtrentals.com`)
- Operator welcome/onboarding trail (10+ recipients)
- Department inboxes set up (`support@`, `team@`) — **note:** `management@tmmtrentals.net`
  bounced (domain not found) — fix or drop that address.

### E. Other connected systems
- **GoHighLevel (GHL)** — CRM + checkout; 4 TMMT sub-accounts (Detailing,
  Moving/Cleaning, Rentals, XPRESS)
- **Supabase** — production DB; 3 live tenants seeded (AIXMOS, Moe Legacy, TMMT Rentals)
- **Airtable** — original source of truth (migrated) + Operation Overdrive trackers
- **OneDrive** — `Desktop\IMPORTANT - TMMT PC Kit\` (the local PC kit + credentials)
- *Not found / empty at scan time:* ClickUp (0 results), Zoom (0 recordings/docs),
  SharePoint search API was erroring (Microsoft Graph 500 — retry later).

---

## 2. The product stack by layer

### 🧠 AIXMOS — the brain
- **Agents** — CAPTAIN (dispatch refinement), B3 SMS sales agent (compliance
  suite: STOP/UNSUB, TCPA quiet hours, CFPB disclaimers, banned-phrase filter;
  Sonnet 4.6 + Haiku 4.5 router; per-persona overlay).
- **Mission Control** — daily owner push to Telegram via `/api/mission/generate`
  (free GitHub Actions cron).
- **Counselor Layer** — reads each owner-client, scripts the conversation, flags
  when to escalate ("gloves up"). Lives in `#counselor-room`.
- **Licensing/kill-switch** — `organization_licenses` with a 4-tier kill switch
  (soft / hard / heartbeat / audit), revocable from your laptop via
  `POST /api/license/revoke`.

### ⚙️ TMMT OS — the engine
- 17 admin pages, 8 public intake forms, CSV export everywhere, dashboard KPIs +
  6-month revenue trend chart, password reset, maintenance show/no-show toggle.
- 44 Supabase tables; RLS on all; zod-validated server actions; rate limiting; CSP.
- 78 unit/DOM tests passing; `npm run build` is the CI gate.

### 📣 The funnel — go-to-market
- Public forms (`/forms/lead-intake`, `/forms/affiliates`, `/forms/waitlist`)
- `/kits` (flash-drive / kit offers $97–$2,997) and `/build` (done-for-you
  builds $3,750–$50k) — checkout via GHL.
- Landing template `/lp/[org]/[sku]` for all 5 SKUs.

---

## 3. The verticals — how it makes money

The value ladder (from `SYSTEM-BLUEPRINT.md`): every person enters somewhere and climbs.

```
🚗 Rental → 💳 $97/mo Membership → 📈 Credit Guidance → 🏗️ Build / Kit
front door   recurring (AIXMOS)     the bridge           own their system
                                    ("guidance," never    kits $97–$2,997
                                     "repair")            builds $3,750–$50k
🤝 Affiliate — anyone refers, gets paid on collected sales
```

Revenue lines you can actually turn on:
1. **Rental** — the live TMMT business (proof the playbook works)
2. **$97/mo AIXMOS membership** — recurring, the core annuity
3. **Credit guidance** — the upsell bridge (Moe Legacy vertical)
4. **Kits & builds** — `/kits` + `/build` deposits via GHL
5. **Dealership pack** — license the whole "Rental Business in a Box" to a dealer
6. **Operation Overdrive** — elite life-saving dispatch + dispatch-as-a-service
   for other companies, time-critical medical courier work
7. **Affiliate commissions** — on collected sales
8. **3-tenant revenue engine** — AIXMOS / Moe Legacy / TMMT Rentals seeded with
   active licenses; SMS sales agent + landing pages built

**Money is wired in code; the external accounts are the gap.** (See §4.)

---

## 4. What's left to go live & start collecting (the short list)

From `docs/ACTION-CHECKLIST.md` and the Jun 9 revenue-engine go-live note. The
two that matter most: **A (lock it to you)** and **C (turn on money)**.

### 🔒 A — Security & access (do first)
- Branch protection on `master`; 2FA; Secret Scanning + Push Protection on all repos
- **P1 from Slack:** batch-`REVOKE EXECUTE` on ~20 anon-callable `SECURITY DEFINER`
  Supabase functions (see Layer-3 audit doc `2b94463`) — before real tenants

### 💰 C — Turn on money collection
- Create GHL deposit products + booking calendar; set `NEXT_PUBLIC_GHL_CHECKOUT_*`
  + `NEXT_PUBLIC_GHL_CONSULT_CALL` env vars in Vercel
- Point GHL payment automation at `POST /api/webhooks/ghl`
- Test one $1 deposit end-to-end → confirm it lands on the admin Payments page
- Flip `/build` and `/kits` live (remove noindex, add funnel links)

### 📡 Revenue-engine external wiring (per tenant, from the Jun 9 note)
1. ⚠️ Pause the broken GHL $203 dunning workflow (today)
2. Add 7 env vars to the Vercel TMMT project
3. Anthropic API credits ($50 starter)
4. Push → deploy → smoke-test
5. **Twilio 10DLC registration — 1–4 week bottleneck, start today**
6. Stripe Payment Links per SKU · Cal.com event link · Meta/TikTok pixel

### 🧹 Hygiene worth doing
- Decide on duplicate repos (`ai-command-center` vs `AIX-Command-Center`, etc.)
- Close/merge the stale PRs (AIX-Command-Center draft #1 open 26 days)
- Fix the `management@tmmtrentals.net` bounce
- Activate Sentry (`NEXT_PUBLIC_SENTRY_DSN`)

> Full ordered checklist with "done when" criteria: `docs/ACTION-CHECKLIST.md`.
> Per-tenant launch detail: `docs/runbooks/MASTER_OPERATOR_RUNBOOK.md`.

---

## 5. The "sell it / hand it off" view (for bidders & buyers)

If the goal is to take this to market and let operators/buyers run it, here is
what the asset *is* and what a buyer acquires.

**What it is:** years of a rental + credit-to-keys playbook encoded into a
production platform, with a proven live business (TMMT) as the reference
deployment, an AI ops layer (AIXMOS) that lets non-technical operators perform
like veterans, and a packaged way to drop the whole thing into a new dealer.

**What a buyer/dealer acquires (the Dealership Pack — already drafted in Drive):**
- **Software** — a branded TMMT OS org (Supabase + Vercel): client/team/admin
  portals, cases, ledger, CRM sync
- **Contracts** — white-label JV (tiered), vehicle lease, ops-manager, addendum, LLC ref
- **Playbooks** — SOPs, lead→customer checklist, sales/call scripts, payment-text
  scripts, background-check qualifications
- **Pricing & payout model** — per-vehicle pricing + partner payout template

**The moat (why this is sellable without giving away the keys):** operators and
dealers get *access to use* (a hosted login, a deployed copy) — never the repo,
the `.env`, the API keys, or the agents. The machine stays the moat.

**To finish the sell package (next session):**
- White-labeled blank-entity versions of each contract (templates, not signed copies)
- A 1-page dealer onboarding checklist
- A price sheet for the pack itself (what a dealer pays)
- A clean valuation/“what’s done vs. what’s left” one-pager drawn from §2–§4

---

## 6. How to explain it (talk tracks)

Full versions in `docs/SYSTEM-BLUEPRINT.md §6`. The one-liner:

> **We turn one person's hard-won playbook into a system anyone can run** — so
> everyday people can start a business, fix their footing, and build wealth,
> while the operators who help them get paid for it. TMMT runs the cars and the
> cash; AIXMOS is the brain that runs TMMT; the funnel turns strangers into
> owners. **4HEPEOPLE.**

---

## 7. The honest gaps (so nothing surprises you)

- **Can't reach from here:** your phone's local storage and iCloud (iMessage,
  Notes, Photos) — no connector exists for those. Everything above is from
  reachable systems.
- **Scan-time empties:** ClickUp and Zoom returned nothing (either unused or a
  different account). SharePoint/OneDrive *search* was erroring on Microsoft's
  side — the OneDrive **PC Kit** is referenced in Slack but I couldn't index it.
- **Payments table empty / Twilio 10DLC not started** — the two real
  time-bottlenecks between "built" and "earning."

---

*This document is the map. `docs/ACTION-CHECKLIST.md` is the to-do.
`docs/SYSTEM-BLUEPRINT.md` is the story. Start at whichever matches the next
hour of your day.*
