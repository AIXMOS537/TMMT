# AIXMOS Affiliate Program — Recruitment Kit

**Owner:** Justin (program lead)
**Date:** 2026-06-04
**Goal:** External reps sell the $97 AIXMOS membership on commission. You manage the program, not the reps' day-to-day. Low-input model: one Slack channel, monthly payouts, kit handed out at signup.

---

## 1. The structure (one tier, no MLM)

| Item | Default | Notes |
|---|---|---|
| Product they sell | AIXMOS $97 membership | Not credit guidance directly — that's a back-end upsell handled by your team |
| Commission per sale | **$50 / sale** (≈51%) | High enough to recruit, leaves you $47 for product + back-end |
| Payment cadence | Monthly, 1st of the month | Last month's confirmed sales, less refunds |
| Payment method | Stripe Connect (preferred) or PayPal | Avoids you cutting checks |
| Recruit-a-recruit bonus | **None** | MLM = legal headache + bad reputation. Stay flat. |
| Performance bonus | $200 bonus for any rep who closes 10+ in a month | Optional, simple |
| Lead source | Rep brings their own audience | You do not supply leads. Game-changer for low input. |
| Tracking | Unique referral link per rep | GHL or Rewardful or FirstPromoter |

**Why $50 not $30:** subprime credit / car / money is a saturated niche for affiliates. To recruit good people you need above-average commission. $50 of $97 is generous and gets people to actually promote.

---

## 2. The pitch (use on landing page + recruiting DMs)

**Headline:**
> Get paid $50 every time someone gets their money + credit on track.

**Subhead:**
> AIXMOS pays you for every $97 membership you refer. We handle the coaching, the support, and the back-end. You just send people our way and get paid the 1st of every month.

**Three bullets:**
- **$50 per sale.** Paid monthly, direct deposit.
- **You don't sell, you share.** Your unique link does the work — leads watch our video and check out.
- **Compliant.** We coach, we never promise. You're never on the hook for outcomes.

**CTA:** [Apply to become an AIXMOS Affiliate]

---

## 3. Application form (5 fields)

Build this as a GHL form or Tally form on `aixmos-landing` at `/affiliates`:

1. Full name
2. Email + phone
3. Where will you promote AIXMOS? (TikTok / IG / Facebook / podcast / email list / in-person / other)
4. Approximate audience size or weekly reach
5. Have you sold credit, money, or financial products before? (yes / no — both OK)

**Auto-tag on submit:** `affiliate-applied`. Justin reviews within 48 hr → approve = welcome email + link + Slack invite.

---

## 4. Starter kit (sent automatically on approval)

Email subject: **"You're in. Here's your AIXMOS affiliate kit."**

Attach or link a single PDF: `AIXMOS_Affiliate_Starter_Kit.pdf` containing:

1. **Your unique referral link** (auto-generated)
2. **Your $50/sale commission terms** (one paragraph)
3. **What AIXMOS is** (the 30-second pitch — for them to internalize)
4. **The banned words list** (Operations Brain §2 — must read)
5. **5 copy-paste posts** (one each for TikTok caption, IG caption, FB post, DM template, email)
6. **5 copy-paste DMs** for warm outreach
7. **Slack invite link** to the affiliates channel
8. **How payouts work** (1st of the month, Stripe Connect)
9. **Who to ask for help** (Justin's email, response time 24 hr)

The PDF lives in `~/Projects/TMMT/docs/affiliates/` once built. Generate from a markdown source with the pdf-generation skill.

---

## 5. The 5 copy-paste posts (compliance-safe)

### TikTok / IG Reel caption
> Your credit is keeping you stuck. AIXMOS gives you a real plan in 48 hours — coaching, not promises. Link in bio. $97 to start. #creditguidance #financialhealth

### Instagram Story
> Tired of being told no? AIXMOS coaches you through a real plan in 48 hours. Tap the link → it's $97 to get started. Worth it. ⤴️

### Facebook post
> Most people don't know where to start with credit and money. AIXMOS does. $97 gets you a personalized plan in 48 hours from a real coach — no guarantees, no promises, just a clear next step. Link below if you want a look.

### Cold DM (Instagram / Twitter)
> Hey [name], saw your post about [thing]. Not sure if you're open to it, but AIXMOS coaches people through credit + money plans for $97. Real coach, 48-hour turnaround. Here's my link if it speaks to you: [link]. No pressure either way.

### Email to your list
> Subject: A tool I started using for getting my money right
>
> Quick one — I've been recommending AIXMOS to people who are stuck on credit or just don't know where to start. It's $97 for a personalized plan from a real coach, delivered in 48 hours. They coach — they don't promise outcomes — which is why I trust them.
>
> If that sounds like you, here's the link: [your link]
>
> — [name]

---

## 6. Hard banned words (will get the rep terminated)

Reps may NOT use, in any post, DM, ad, or call:
- "Guarantee" / "Guaranteed"
- "You will be approved"
- "We'll get you funded"
- "Fix your credit" / "Credit repair"
- "Remove negative items"
- "100%" / "No risk" / "I promise"

**They MUST use:** coach, guide, plan, help, work with, may be able to.

This is non-negotiable. One violation = warning. Two = removed from program. This protects YOU from CROA (Credit Repair Organizations Act) liability.

---

## 7. Where to recruit affiliates (top 5 sources)

| Source | Why it works |
|---|---|
| Existing AIXMOS members who are also influencers | Already believe in the product |
| Bibbs / Sumaima / Areesha's personal networks | Warm, trustworthy |
| Black/Latinx finance creators on TikTok (10K-100K followers) | Same audience as AIXMOS |
| Real estate agents who work with credit-challenged buyers | Built-in lead source |
| TMMT customers who finished rental successfully | Easy "before/after" testimonial angle |

**Outreach DM to a creator (Justin uses):**
> Hey [name], I run AIXMOS — we coach people on credit + money planning. Your audience is exactly who we serve. I'd love to bring you on as an affiliate — $50 per $97 sale, paid monthly. Want me to send the details?

---

## 8. Management cadence (your job — 30 min/week)

| When | What | Who |
|---|---|---|
| Daily | Glance at affiliate-sale notifications in Slack | Justin |
| Mondays 10 min | Post leaderboard in #affiliates Slack channel | Justin |
| Fridays 20 min | Approve new applications (batch) | Justin |
| 1st of month | Process payouts via Stripe Connect | Justin |
| Quarterly | One Loom video update to all affiliates | Justin |

**That's the entire job.** No 1:1s, no calls, no coaching. If a rep needs hand-holding, they're the wrong rep.

---

## 9. Tracking infrastructure (one-time setup, ~2 hours)

| Component | Tool | Notes |
|---|---|---|
| Unique tracking links | Rewardful ($49/mo) or FirstPromoter ($79/mo) | Integrates with Stripe → auto-attributes sales |
| Affiliate dashboard | Same tool — they get a login | Self-serve, no questions to you |
| Payouts | Stripe Connect (free) | Auto-splits commission on each sale |
| Affiliate Slack channel | `#aixmos-affiliates` on projectaixmos.slack.com | One-way announcements + Q&A |
| Application form | GHL form at aixmos-landing.vercel.app/affiliates | Already part of the AIXMOS app |

---

## 10. First 30 days

| Week | Goal |
|---|---|
| Week 1 | Set up Rewardful + Stripe Connect + Slack channel + application form |
| Week 2 | Build starter-kit PDF + record the welcome Loom |
| Week 3 | Hand-recruit 5 affiliates (Justin's network + Bibbs/Sumaima/Areesha referrals) |
| Week 4 | Launch the public application link on TikTok/IG. Goal: 20 applicants, approve top 10 |

**End of month 1 target:** 10 active affiliates, 20+ tracked sales, $1,000 in commissions paid out.

---

**Status:** ready for Justin to begin Week 1 setup.
