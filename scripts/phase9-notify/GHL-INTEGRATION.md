# Phase 9 — Linking the Credit & Funding Form Into the GHL Funnel

The form is live and tested. Until it gets traffic, it produces nothing. The natural source is the $97 enrollment confirmation in GoHighLevel — that's the highest-intent moment in the funnel per `[[project-aixmos-tmmt-funnel]]`.

This is ~5 minutes of GHL UI work.

---

## Canonical URLs

Two short aliases ship with Phase 9 — both 308-redirect to the long form URL with a baseline UTM:

| Short URL | Default UTM | Use for |
| --- | --- | --- |
| `https://tmmt-ops.vercel.app/funding` | `utm_campaign=funding_alias` | General-purpose share — emails, SMS, bio links |
| `https://tmmt-ops.vercel.app/credit` | `utm_campaign=credit_alias` | When "credit" is the more natural word in the copy |

For surface-specific attribution, append your own UTM params — they override the baseline:

```
https://tmmt-ops.vercel.app/funding?utm_source=ghl&utm_medium=email&utm_campaign=post_97_confirmation
```

Suggested matrix:

| Surface | `utm_source` | `utm_medium` | `utm_campaign` |
| --- | --- | --- | --- |
| Confirmation email | `ghl` | `email` | `post_97_confirmation` |
| Confirmation SMS | `ghl` | `sms` | `post_97_confirmation` |
| TikTok bio link | `tiktok` | `social` | `tiktok_bio` |
| Instagram bio link | `ig` | `social` | `ig_bio` |
| AIXMOS landing footer | `aixmos` | `web` | `aixmos_landing` |

(UTMs land in the page URL and standard analytics tools. The `credit_funding_sessions.channel` column currently logs `web_form` — wire UTMs into the form's hidden input later if you want them in the database too.)

---

## Email copy — post-$97 confirmation

> Subject: Your TMMT enrollment is in — here's the next 5 minutes
>
> Hi {{contact.first_name}},
>
> Welcome. Your $97 enrollment is confirmed and you're moving forward.
>
> While we get everything in motion on our side, here's the most useful next step you can take **right now**: take 5 minutes to build your **Funding Readiness Profile**.
>
> It's a short, educational walkthrough — no credit pull, no application, no SSN. We just learn where you stand and send you the right next steps for your situation.
>
> 👉 **[Start your readiness profile →](https://tmmt-ops.vercel.app/funding?utm_source=ghl&utm_medium=email&utm_campaign=post_97_confirmation)**
>
> The faster we know where you are, the faster we can prep you to qualify for what's next.
>
> Talk soon,
> The TMMT Team
>
> *Educational only. Not credit repair. No score guarantee. Disclosures: tmmt-ops.vercel.app/legal/credit*

(Remove the emoji line if you want; everything else stays compliant.)

---

## SMS copy — post-$97 confirmation

> {{contact.first_name}}, you're in — welcome to TMMT. While we set things up on our side, take 5 min to build your **Funding Readiness Profile** so we know exactly how to prep you next: https://tmmt-ops.vercel.app/funding?utm_source=ghl&utm_medium=sms — Reply STOP to opt out.

160-character envelope; UTM-tagged short link if you want to shorten via your GHL link shortener.

---

## GHL workflow editor — exact steps

1. Open https://app.gohighlevel.com → your TMMT sub-account → **Automation** → **Workflows**.
2. Find the workflow triggered by your $97 product purchase (it's the one referenced by `NEXT_PUBLIC_GHL_CHECKOUT_97`).
3. Open the workflow and find the "Confirmation Email" action (or add one if absent).
4. **Edit the email body** — paste the email copy above. The `{{contact.first_name}}` merge tag should already work in your account.
5. Add a parallel **SMS** action set to fire 30 seconds after the email so the lead has both channels.
6. **Save → Publish.**

If you don't have a confirmation email step yet:
- Add **Send Email** action → from `team@tmmtrentals.com` (or whatever's configured) → subject + body from above.
- Add **Send SMS** action → body from above → **delay 30s** after the email.

Don't forget: the existing $203 dunning workflow per `[[project-ghl-203-dunning-misfire]]` is still PUBLISHED and needs a 30s manual pause if you don't want it firing on this batch. Unrelated to Phase 9 but worth checking while you're in the workflow editor.

---

## Optional: bidirectional webhook later

When you want submitted profiles to also push into GHL as a custom pipeline contact tag:

1. The handoff fan-out is already wired in `src/lib/notify.ts` → just add a `notifyGHL` function that POSTs to a custom GHL workflow webhook URL.
2. New env var: `GHL_HANDOFF_WEBHOOK_URL`.
3. In GHL: create an inbound webhook → assign tag `phase9-handoff-requested` → trigger workflow that drops the contact into the funding-prep pipeline.

Defer until you actually see meaningful volume in `/credit-funding` admin.

---

## Verification

Once you've published the GHL workflow:

1. From a test contact in GHL, trigger a fake $97 purchase (or use **Test Workflow** in the workflow editor).
2. Confirm the email + SMS land in your test inbox / phone.
3. Click the link in the email → form opens → submit with handoff checked.
4. You should see a Slack ping in your TMMT channel AND a Telegram DM from your bot within ~5s.
5. The row appears at https://tmmt-ops.vercel.app/credit-funding with a "Requested" badge.

End-to-end loop closed.
