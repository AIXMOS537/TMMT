# Middleman Bolt-Ons — Sprint 1

**Owner:** CEO
**Executors:** Justin (#5, #9), Dominique (#14)
**Date:** 2026-06-04
**Goal:** Three new revenue lines wired into the existing GHL funnel without hiring or building. Each one slotted into a stage that already has the team's attention.

---

## #5 — Secured-Card / Credit-Builder CPA

**Slot:** GHL stage `member-97` (24 hr after $97 charge clears)
**Owner:** Sumaima drops link in welcome SMS; Areesha follows up at intake call
**Payout:** $15 – $80 per funded account (varies by issuer)
**Compliance:** safe — these are tools we recommend, not approvals we promise

### Partners to sign up with (in priority order)

| Partner | Where to apply | Approx. CPA | Notes |
|---|---|---|---|
| OpenSky Secured Visa | openskycc.com → partners | $40–80 / funded | No credit check — best fit for our base |
| Self.inc (credit builder) | impact.com → "Self Financial" | $10–15 / funded | Pairs with the AIXMOS plan well |
| Credit Strong | creditstrong.com/partners | $15–30 / funded | Subscription credit-builder loan |
| Mission Lane Visa | direct affiliate inquiry on missionlane.com | $40+ / funded | Unsecured option for thin-file |
| Chime Credit Builder | impact.com → "Chime" | $50 / funded | Stricter approval — apply but expect review |

**Apply under the AIXMOS EIN.** Do NOT use the TMMT EIN — Two-Hats rule (Operations Brain §2).

### GHL workflow tweak

Add to the existing `member-97` workflow:

```
Trigger:        Tag added: member-97
Wait:           24 hours
Action 1 SMS:   (template below) — send via Sumaima's number
Action 2 Tag:   affiliate-secured-card-sent
Wait:           7 days
Condition:      tag affiliate-secured-card-clicked NOT present
Action 3 Email: (template below) — second nudge, email only
```

On the affiliate link itself, use a UTM-tagged redirect (`/r/secured-card`) that fires a GHL inbound webhook → adds tag `affiliate-secured-card-clicked`. That tag is the attribution signal for the wait-7d branch and for monthly payout reconciliation.

### SMS draft (Sumaima)

> [firstname], it's Sumaima with AIXMOS. Quick first move most of our members make in week one — a starter card that reports to all 3 bureaus. Here's the one we recommend: [link]. Reply here with any questions.

### Email draft (Areesha — subject line: "The first move every AIXMOS member makes")

> Hey [firstname],
>
> Now that your AIXMOS plan is in motion, here's the first practical step most members take in week one: open a starter card or credit-builder account that reports to all three bureaus.
>
> A few tools we recommend — pick the one that fits your situation:
>
> 1. **OpenSky Secured Visa** — no credit check, $200 deposit. [Link]
> 2. **Self Credit Builder** — small monthly payment, builds savings + credit at the same time. [Link]
> 3. **Mission Lane Visa** — unsecured option if your file is thin. [Link]
>
> Pick one. Apply this week. Add it to your AIXMOS plan tracker — your coach will check on it during your next call.
>
> — Areesha, AIXMOS Client Care

**Banned words check:** no "guarantee," "approved," "we'll get you," "no risk." ✅

---

## #9 — Funding White-Label Partner

**Slot:** GHL stage `credit-guidance-active` → `funding-prep` (the handoff stage that already exists)
**Owner:** Justin closes the warm calls
**Payout target:** $500 – $2,000 per closed funding deal
**Compliance:** safe — partner does the underwriting promise, AIXMOS positions as the coach who refers

### Targets to outreach this week

1. **Fund&Grow** — public affiliate program, pays per funded client
2. **Seek Capital** — has a partner program + white-label tier for high-volume referrers
3. **Credit Suite** — sells coaching/program licenses; viable for white-label under AIXMOS brand

Send the same email to all three. Pick the one that responds fastest and offers the cleanest pay-per-funded structure.

### Outreach email template

**Subject:** AIXMOS — active credit-guidance pipeline seeking funding partner

> Hi [team],
>
> I run AIXMOS — a credit-guidance and money-coaching membership ($97 entry, sister company to TMMT Rentals in Northern Virginia). We have a steady pipeline of clients who complete the guidance phase ready for business credit and funding, and we'd rather route 100% of that handoff to one partner than scatter it.
>
> Two options I'd like to explore:
>
> 1. **Affiliate / referral** — straight pay-per-funded-deal
> 2. **White-label** — your offering presented under the AIXMOS brand, with you doing fulfillment
>
> Either way I want a clean per-deal structure and one named partner contact.
>
> 15 minutes this week? Tuesday or Thursday between 10–3 ET works on my side.
>
> — [CEO name]
> AIXMOS / All In One Management Solutions
> allinonemanagementsolutions.com

### GHL workflow tweak (once partner is signed)

```
Trigger:        Tag added: funding-prep
Action 1:       Internal Slack notify to Justin (#funding channel)
Action 2:       Send client the partner's intake link (after Justin's call, not before)
Action 3 Tag:   funding-partner-referred + partner-name-{xxx}
```

**Why call-first, link-second:** Justin needs to qualify and warm the client before the partner sees them, otherwise the partner conversion rate drops and the relationship sours.

---

## #14 — GHL Sub-Account Reseller

**Slot:** outside the funnel — runs in parallel as a recurring revenue line
**Owner:** Dominique sells, provisions, and supports
**Payout:** $197/mo per sub-account, ~$0 marginal cost (we already pay the agency tier)
**Target:** 10 accounts by end of quarter = ~$1,970/mo recurring

### Target list (Dominique builds from her own network)

- Local barbershops / salons
- Auto mechanic shops (especially the ones already aware of TMMT)
- Tax preparers (Q1 spike → year-round retention play)
- Detailers and mobile-service trades
- Realtors / small brokerages

### Sales script (use as-is for in-person or DM)

> "Hey [name] — you know how missed leads kill small businesses? I run the same system that texts back every TMMT inquiry within 5 minutes and books them automatically. I can plug your shop into it. $197/month, no setup fee, no tech person needed — I have you texting back missed calls within a week. Want me to set it up?"

### Provisioning checklist (Dominique, ~15 min per account)

1. Create GHL sub-account under the AIXMOS agency
2. Clone the "TMMT default" snapshot (calendars, missed-call-text-back, basic pipeline)
3. Port their existing business number into Twilio **or** buy a new GHL number
4. Send them the login + a 10-minute Loom walkthrough
5. Send invoice via Stripe — recurring $197/mo
6. Tag client record in Airtable / Supabase as `ghl-reseller-active`

**Do NOT customize per client beyond the snapshot.** Customization = ops cost. Anything beyond the default = $97/hr add-on or upsell to a custom build, billed separately.

---

## Tracking & weekly review

Add to the Friday 3 PM CEO Review stoplight (Operations Brain §5):

| New line | This week | Last week | Status |
|---|---|---|---|
| Secured-card CPA referrals sent | | | |
| Secured-card CPA funded (paid) | | | |
| Funding partner deals submitted | | | |
| Funding partner deals closed ($) | | | |
| GHL sub-accounts active | | | |
| GHL sub-account MRR | | | |

---

## Out of scope for this sprint (deferred)

The other 12 bolt-ons in the original deck (SR-22 insurance, BHPH referral, tradeline broker, tax-prep, apartment finder, business banking, roadside, Snap/Acima, solar, white-label coach licenses, personal-loan affiliate, debit-card CPA) — all valid, all easy, but pick them up only after these three have one full month of attribution data.

The discipline is: ship three, measure, then add the next three. Do not light up all fifteen and lose attribution.

---

**Status:** ready for Justin + Dominique review at next 1:1.
