# Quo — Keep, or Replace? (2026 evaluation)

**Date:** 2026-06-16
**Short answer: KEEP Quo.** It is not overpriced for what it does, and the one
thing you depend on — programmatic/automated texting — is a *strength* of Quo,
not a weakness. No alternative meaningfully beats it without you giving
something up. Nobody here is telling you to lose it.

---

## The single most important finding

**Quo is the rebrand of OpenPhone.** The company renamed OpenPhone → "Quo"
(sites now read "Quo, formerly OpenPhone", domain `quo.com`; the AI assistant is
"Sona"). So everything written about OpenPhone applies to Quo. That also means
your automation is sitting on a mature, well-documented platform — not a fragile
niche tool.

It's a cloud business-phone system: shared team inbox, multiple numbers assigned
to teammates, two-way SMS/MMS, VoIP calling, AI call summaries + transcripts,
missed-call tracking, shared contacts, **and a real developer API + MCP
integration** (the same MCP we used to try to text John Lopez).

## Pricing (2026, corroborated from multiple third-party sources)

> Note: `quo.com/pricing` returned HTTP 403 to automated fetching, so these are
> well-corroborated secondary figures, consistent across sources — not scraped
> from Quo directly. Verify the exact number in your own account.

| Tier | Annual | Monthly | Notable |
|---|---|---|---|
| Starter | ~$15/user/mo | ~$19 | 1 number/user, unlimited US/CA call+text, voicemail transcription |
| **Business** | ~$23/user/mo | ~$33 | **AI call summaries + full transcripts**, IVR, CRM integrations, analytics |
| Scale | ~$35/user/mo | ~$47 | higher limits / advanced |
| Extra number | +$5/number/mo | | |
| API / automated texts | ~$0.01 per SMS segment | | A2P 10DLC registration also applies (~$19.50 once + ~$1.50–3/mo) |

Heads-up: **full call transcripts require the Business ($23) tier**, not Starter.

## The alternatives, honestly

| Product | Price | SMS | Calls | Transcripts | API / automation | The catch |
|---|---|---|---|---|---|---|
| **Quo (OpenPhone)** | $15 / $23 | ✅ | ✅ | ✅ (Business) | ✅ REST **+ MCP**, $0.01/seg | transcripts gated to $23 tier |
| **Dialpad** | $15 / $25 | ✅ | ✅ | ✅ (Pro, strong AI) | ✅ REST (20 req/s cap) | SMS overage $0.008; intl SMS Pro+ only |
| **RingCentral** | $20–$35 | ✅ | ✅ | ✅ (Ultra $35) | ✅ full REST | transcription gated to top tier; enterprise-heavy |
| **Google Voice** | $10–$30 + Workspace | ✅ (US) | ✅ | voicemail only | ❌ **no API** | cannot automate texts — dealbreaker for you |
| **Grasshopper** | ~$26 flat (all users) | ✅ | ✅ | ❌ | ❌ no real SMS API | cheap for many seats, but no automation/AI |
| **TextMagic** | ~$0.049/SMS | ✅ | limited | ❌ | ✅ API | ~$40 per 1,000 texts; not a team phone |
| **Sakari** | $25/mo (~12.5k segs) | ✅ | limited | ❌ | ✅ strong API + CRM | SMS-marketing tool, not a calling phone |
| **Twilio (DIY)** | pay-as-you-go | ✅ | ✅ | add-on | ✅ **most powerful API** | you build the inbox/UI yourself |

Rough per-message: Twilio ~$0.008/msg + carrier surcharge ~$0.003–0.005; Dialpad
overage $0.008; Quo API $0.01/seg; Sakari ~$0.03; TextMagic ~$0.049. (Ranges
where sources disagreed — treat as estimates, not quotes.)

## So is Quo still necessary?

Yes — because it bundles four things that are annoying and costly to assemble
separately: a shared multi-number team inbox, native calling, AI transcripts,
**and** real automation (REST + MCP), at a competitive $15–$23/user. The only
categorically cheaper paths each cost you something:

- **Twilio DIY** — pennies per message, but you build and maintain your own
  inbox/UI/team app. Cheaper bytes, far more engineering.
- **Sakari / TextMagic** — cheaper bulk SMS, but they drop calling and the
  shared phone experience.
- **Dialpad / RingCentral** — match Quo on price but gate transcripts/AI to
  higher tiers and have heavier API limits.
- **Google Voice / Grasshopper** — cheapest, but no usable automation API at
  all. Non-starters for how you work.

## Recommendation

1. **Keep Quo as your team's day-to-day phone + automation layer.** It's the
   right tool and it's MCP-native, which is rare and valuable.
2. **Only** consider offloading *high-volume automated outbound* to **Twilio**
   (or Sakari) **if** your automated-message volume grows enough that $0.01/seg
   becomes a real monthly line item. That's a "later, if/when" optimization —
   a hybrid (Quo front-end + Twilio for bulk blasts), not a replacement.
3. Immediate unrelated fix: the John Lopez texts failed because the Quo
   workspace is **out of prepaid credits** (HTTP 402). Top up credits and the
   automation works again — that was never a Quo-quality problem.

---

*Sources: quo.com + support.quo.com; openphone.com/product/api; CallRail,
GetVoIP, KrispCall, CloudTalk, Retell reviews (2026); twilio.com/sms/pricing;
GetApp/Capterra (Sakari/TextMagic); mcpmarket.com & pipedream (Quo/OpenPhone
MCP). Full URL list captured in the research pass on 2026-06-16.*
