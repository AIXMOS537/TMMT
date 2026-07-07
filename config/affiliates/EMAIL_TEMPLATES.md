# Affiliate Program — Email Templates

**Owner:** Justin
**Use:** wire these into GHL workflows triggered by affiliate-program tags. Replace bracketed variables with merge fields.

All copy stays inside the Operations Brain compliance vocabulary — no "guarantee," no "approved," no "fund," no "fix your credit."

---

## 1. Application received (auto-send on form submit)

**Trigger:** Tally form submit → GHL webhook → tag `affiliate-applied`
**From:** justin@allinonemanagementsolutions.com
**Subject:** Got your AIXMOS affiliate application

> Hey [first_name],
>
> Got your application. We review every Friday — you'll hear back within 48 hours.
>
> If you're approved, you'll get:
> - Your unique referral link
> - The AIXMOS Affiliate Starter Kit (PDF)
> - An invite to our #aixmos-affiliates Slack channel
>
> If you have questions in the meantime, just reply to this email.
>
> — Justin
> Director of Ops, AIXMOS

---

## 2. Approved (sent after Justin's Friday review)

**Trigger:** manual tag `affiliate-approved` added by Justin
**From:** justin@allinonemanagementsolutions.com
**Subject:** You're in — here's your AIXMOS affiliate link

> Hey [first_name],
>
> Welcome to the AIXMOS Affiliate Program. Here's everything you need:
>
> **Your referral link:** [affiliate_link]
> **Your dashboard:** [rewardful_dashboard_url] — track clicks, signups, and earnings in real time
> **Starter kit:** [starter_kit_pdf_url]
> **Slack channel:** [slack_invite_url]
>
> Pay is $35 per $97 sale, deposited on the 1st of every month. Proven top performers (10+ sales/mo) tier up to $45–$50.
>
> Read the starter kit first — it has the 5 posts, 5 DMs, and the language standards you have to follow. Most affiliates make their first sale inside week 1 if they post twice in week 1.
>
> Questions? Reply or post in the Slack channel.
>
> — Justin

---

## 3. Not approved (sent after Friday review)

**Trigger:** manual tag `affiliate-declined` added by Justin
**From:** justin@allinonemanagementsolutions.com
**Subject:** AIXMOS affiliate application — update

> Hey [first_name],
>
> Thanks for applying. We're not bringing on new affiliates that match your situation right now — usually it's because the audience size or fit isn't where we need it for this program to make sense for both sides.
>
> A few options if you still want to work together:
> 1. **Become an AIXMOS member yourself** — $97 for a personalized money + credit plan. [membership_link]
> 2. **Refer warm contacts informally** — text us a name and number, we'll Venmo you $20 for any that close.
> 3. **Reapply in 90 days** if your audience grows or situation changes.
>
> No hard feelings either way. Thanks for thinking of us.
>
> — Justin

---

## 4. Monthly payout notification (auto-send on the 1st)

**Trigger:** Stripe Connect payout completed → webhook → tag `payout-sent`
**From:** justin@allinonemanagementsolutions.com
**Subject:** Your AIXMOS payout for [month] — $[amount]

> Hey [first_name],
>
> Your payout for [month] just landed: **$[amount]** for [count] sales.
>
> Top sellers this month:
> [leaderboard_top_3]
>
> See the full breakdown in your dashboard: [rewardful_dashboard_url]
>
> Next payout: [next_payout_date].
>
> Keep posting.
>
> — Justin

---

## 5. Inactive nudge (60 days, 0 sales — auto)

**Trigger:** affiliate is approved 60+ days, has 0 tracked sales → tag `affiliate-inactive-nudge`
**From:** justin@allinonemanagementsolutions.com
**Subject:** Anything we can do to help?

> Hey [first_name],
>
> Saw you haven't posted yet — totally fine, life happens. Just checking: is there something blocking you? A few common ones:
>
> - Not sure what to post → grab any of the 5 templates in the starter kit, post once this week
> - Don't trust the product → if you want to try AIXMOS at member cost first, reply and I'll comp it
> - Don't have time → no problem, we'll keep your account active for another 90 days then archive it
>
> Reply if any of these is the thing. If none of it lands, no worries — we'll archive your account in 30 days and you can reactivate any time.
>
> — Justin

---

## 6. Compliance violation warning (manual, sent by Justin)

**Trigger:** Justin sees an affiliate post using banned words
**From:** justin@allinonemanagementsolutions.com
**Subject:** AIXMOS affiliate — quick compliance note

> Hey [first_name],
>
> Saw your recent post: [link or screenshot description].
>
> The phrase "[banned_word_or_phrase]" can't appear in any AIXMOS-related promotion. It's not a style thing — it's a legal one (CROA, FTC). One slip is fine if you fix it. A second one inside 30 days means we have to remove your account.
>
> Approved replacements:
> - Instead of "guarantee" → "coach you through"
> - Instead of "we'll get you approved/funded" → "we'll give you a plan and work with partners"
> - Instead of "credit repair" → "credit guidance"
> - Instead of "100%" → drop the number, just describe what we do
>
> Take down or edit the post when you can. Reply to confirm you saw this.
>
> — Justin
