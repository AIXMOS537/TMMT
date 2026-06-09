# Phase 9 — Linking the Credit & Funding Form Into the GHL Funnel

The form is live and tested. Until it gets traffic, it produces nothing. The natural source is the $97 enrollment confirmation in GoHighLevel — that's the highest-intent moment in the funnel per `[[project-aixmos-tmmt-funnel]]`.

This is ~5 minutes of GHL UI work.

---

## Canonical URL to use everywhere

```
https://tmmt-ops.vercel.app/forms/credit-funding-intake?utm_source=ghl&utm_medium=email&utm_campaign=post_97_confirmation
```

Variations by surface:

| Surface | Add `utm_medium=` | Add `utm_campaign=` |
| --- | --- | --- |
| Confirmation email | `email` | `post_97_confirmation` |
| Confirmation SMS | `sms` | `post_97_confirmation` |
| GHL "thank you" page | `web` | `post_97_thankyou` |
| TikTok bio link | `social` | `tiktok_bio` |
| Instagram bio link | `social` | `ig_bio` |
| AIXMOS landing footer | `web` | `aixmos_landing` |

These UTM tags flow into the `credit_funding_sessions.channel` column (currently set to `web_form` — update the public form's hidden input later if you want auto-capture; for now they at least appear in your standard URL analytics).

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
> 👉 **[Start your readiness profile →](https://tmmt-ops.vercel.app/forms/credit-funding-intake?utm_source=ghl&utm_medium=email&utm_campaign=post_97_confirmation)**
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

> {{contact.first_name}}, you're in — welcome to TMMT. While we set things up on our side, take 5 min to build your **Funding Readiness Profile** so we know exactly how to prep you next: https://tmmt-ops.vercel.app/forms/credit-funding-intake?utm_source=ghl&utm_medium=sms&utm_campaign=post_97_confirmation — Reply STOP to opt out.

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
