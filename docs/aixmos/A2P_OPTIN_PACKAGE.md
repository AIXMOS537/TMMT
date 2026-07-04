# A2P OPT-IN PACKAGE
### Compliant web form, consent block, and Privacy/Terms language — built to clear campaign review on the first pass.

Use one copy of this per sub-account that sends SMS (swap `{BRAND}` / legal name). Worked **AIXMOS** example at the bottom.

> Carrier rules baked in: consent checkbox **unchecked by default and optional**, **separate** marketing vs. non-marketing checkboxes, **Privacy Policy + Terms** in the footer, and SMS opt-in data **never shared with third parties** (sites that mention sharing data with affiliates/third parties get rejected).

---

## 1. WEB FORM LAYOUT

**Fields:**
- Name
- Email
- Phone *(if required, SMS consent below still stays optional — you cannot force consent to submit)*

**Consent — two separate checkboxes, both empty by default:**

☐ **Account & service texts (non-marketing).**
> I agree to receive account, booking, and service notifications from {BRAND} at the number provided (e.g., confirmations, reminders, updates). Consent is not a condition of purchase. Msg & data rates may apply. Reply STOP to opt out, HELP for help.

☐ **Promotional texts (marketing).**
> I agree to receive marketing and promotional texts from {BRAND} at the number provided. Consent is not a condition of purchase. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.

**Footer (required, every form):**
> By submitting, you agree to our [Privacy Policy]({privacy_url}) and [SMS Terms]({terms_url}).

**Rules to keep it compliant:**
- Neither box is pre-checked; submission can't be blocked on checking either one.
- Marketing and non-marketing are split (above) — never one combined box.
- The form (and the page it's on) must not say you share data with affiliates/third parties.

---

## 2. SMS PROGRAM DISCLOSURE (place near the form / on a dedicated opt-in page)

> **{BRAND} SMS Program.** {BRAND} sends {message types — e.g., booking confirmations, reminders, account updates, and occasional offers} to customers who opt in. Message frequency varies. Message and data rates may apply. Reply **STOP** to cancel at any time; reply **HELP** for help, or contact {support_email}. Carriers are not liable for delayed or undelivered messages.

---

## 3. SMS PRIVACY CLAUSE (must appear in your Privacy Policy — this is the make-or-break line)

> **Mobile information & SMS consent.** No mobile information, phone numbers, or SMS opt-in data will be sold, rented, or shared with third parties or affiliates for marketing or promotional purposes. SMS consent and phone numbers collected for the purpose of SMS are not shared with any third parties. We may share information with service providers strictly to deliver the messaging service (for example, our messaging platform), and these providers are prohibited from using it for any other purpose.
>
> **Categories of data:** We collect your name, contact details, and SMS consent. **Use:** to send the account/service and (if opted in) promotional messages you consented to. **Opt-out:** reply STOP at any time to stop messages.

---

## 4. SMS TERMS SNIPPET (link as your "SMS Terms")

> **{BRAND} SMS Terms of Service.**
> 1. **Program:** By opting in, you consent to receive recurring automated SMS from {BRAND} at the number provided. Consent is not a condition of any purchase.
> 2. **Message types:** {confirmations, reminders, account updates, and — if opted in — promotions}.
> 3. **Frequency:** Varies by activity.
> 4. **Cost:** Message and data rates may apply per your carrier plan.
> 5. **Opt-out:** Reply **STOP** to cancel. You'll get one confirmation, then no further messages.
> 6. **Help:** Reply **HELP** or contact {support_email}.
> 7. **Carriers:** Wireless carriers are not liable for delayed or undelivered messages.
> 8. **Privacy:** See our [Privacy Policy]({privacy_url}). We do not share SMS opt-in data with third parties.

---

## 5. WORKED EXAMPLE — AIXMOS sub-account

**Form footer:**
> By submitting, you agree to our [Privacy Policy](https://aixmos.com/privacy) and [SMS Terms](https://aixmos.com/sms-terms).

**Non-marketing box:**
> ☐ I agree to receive account and service notifications from AIXMOS at the number provided — onboarding confirmations, reminders, and account updates. Consent is not a condition of purchase. Msg & data rates may apply. Reply STOP to opt out, HELP for help.

**Marketing box:**
> ☐ I agree to receive marketing texts from AIXMOS at the number provided. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.

**Disclosure:**
> **AIXMOS SMS Program.** AIXMOS sends onboarding confirmations, account updates, and occasional product offers to customers who opt in. Message frequency varies. Message and data rates may apply. Reply STOP to cancel, HELP for help, or contact support@aixmos.com.

**Sample messages (for the campaign form):**
> "AIXMOS: Hi {name}, your onboarding call is confirmed for {time}. Reply STOP to opt out, HELP for help."
> "AIXMOS: Your account update is ready — {link}. Msg & data rates may apply. Reply STOP to unsubscribe."

---

## 6. DEPLOYMENT NOTES
- [ ] Build this as a real opt-in page on the brand's site (AIXMOS etc.), not just inside GHL.
- [ ] Host a **screenshot of the opt-in form at a public URL**; paste that URL into the campaign's "how do users consent?" field as proof.
- [ ] Privacy Policy + SMS Terms must be **live, linked, and crawlable** before you submit — a missing/invalid site is a top rejection reason.
- [ ] Opt-in page wording must **match** your campaign use-case description and sample messages.
- [ ] **Credit-to-Keys / funding line:** do NOT use the *marketing* box for that vertical. Transactional-only at most, or keep it off SMS entirely — carriers prohibit promotional lending/credit/debt SMS.

*Companion files: LOCKDOWN SWEEP (Namespace + A2P) · AIXMOS IDENTITY STACK · GO GHOST PROTOCOL · Footprint Cleanup Tracker.*
