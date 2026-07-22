# TMMT Lead Net — GHL Spec (v1)

> **Goal:** no inbound human ever falls on the floor again. Every call, text, form, or
> DM becomes ONE contact, in ONE pipeline, with a follow-up task that fires on a clock —
> not on a human remembering.
>
> **Channel rules (owner-set):** GHL = ALL customer/money communication.
> Quo (+1 571-450-8727) = the team's support line only — no automation touches it.
> Nothing customer-facing auto-sends until the owner says "autopilot on" for that flow.

## 1. One pipeline, two lanes

Pipeline: **TMMT Leads**
Lanes (tag every contact `lane:rental` or `lane:detail`):

Stages (identical for both lanes):
`New → Contacted → Qualified → Booked/Quoted → Won → Cold (never delete)`

Routing question when unknown (first auto-reply):
> "This is TMMT Auto Services — are you looking to **book a rental** or get a **detail**?"
Reply keywords route the lane; no reply in 24h → default `lane:rental` (the main line).

## 2. Intake — every source lands in the same net

| Source | Wire-up |
|---|---|
| Google Voice voicemails/texts (the historical leak) | Forward `voice-noreply@google.com` notifications into GHL inbound email → parse name+number → create contact `source:google-voice` |
| Facebook | FB lead forms / Messenger → GHL native integration → `source:facebook` |
| Website forms (when Vercel is re-lit) | Supabase `intake` edge function already posts leads — mirror to GHL contact `source:web` |
| Walk-in / phone (team) | Team adds contact in GHL mobile app — 30-second minimum: name, number, lane |
| GHL inbound SMS/calls | Native — just tag lane + source |

**Dedupe rule:** phone number is the identity key. Same number = same contact, always.
(This kills the ClickUp OPS/ADMIN double-logging — see §6.)

## 3. Cadences (automations, DRAFT until owner flips each live)

**Rental lane**
1. **T+0 min** — instant reply: requirements + question:
   "Hi [Name], TMMT Rentals 🚗 — thanks for reaching out! To get you rolling I need: your age,
   a valid license, and the deposit. What dates do you need? I'll check availability now."
2. **T+12 h** no reply — nudge: "Still want to lock in a vehicle? Send your dates and I'll hold one."
3. **T+48 h** — alternative offer: "We've got other dates/vehicles open — want options?"
4. **T+7 d** — move to `Cold`. Cold contacts get the monthly win-back (below). Never deleted.

**Detail lane**
1. **T+0** — "TMMT Auto Detail here — want our Free Vehicle Health Check? Tell me your car + what you're after and I'll send pricing."
2. **T+24 h** — nudge. 3. **T+3 d** — small offer. 4. **T+7 d** — final touch → `Cold`.

**Win-back (both lanes):** 60+ days silent → one monthly personalized text, owner-approved batch.

**Hard guardrails baked into every automation:**
- Honor DND/STOP absolutely (GHL enforces; never override).
- No pricing promises in automation — "let me confirm with the team" language only.
- Anything money/legal/complaint → tag owner, automation stops.
- Every send is a DRAFT queue for owner approval until that specific flow is marked autopilot.

## 4. Tasks — the safety net under the net
Every `New` contact auto-creates a GHL task assigned to the front-desk user, due in 1 hour.
Unclosed task at due time → escalates to owner. This is the piece that was missing when
Nick Bing sat unanswered: **a clock, not a memory.**

## 5. Daily digest (quiet tech)
One Slack post to #front-desk at 9am — new leads by lane, tasks overdue, replies waiting,
holds/quotes expiring. No other noise.

## 6. Decommissions this replaces (out with the old)
- ClickUp **OPS TASKS** + **ADMIN TASKS** "New Lead Alert" firehose (same lead written
  twice, polluted with vendor emails) → turn off the automation feeding them; archive both lists.
- Gmail-as-CRM: Google Voice leads dying in the inbox → auto-forwarded into GHL instead.
- Airtable `incoming_leads` as a lead surface → read-only legacy; GHL is the working pipeline,
  Supabase the system of record.

## 7. Metrics that matter (weekly)
Speed-to-first-touch · leads by lane/source · contact→booked % · cold-resurrection count ·
tasks escalated to owner (target: near zero).

---
**Build order:** 1) pipeline+stages, 2) intake wiring, 3) tasks+digest, 4) cadences in DRAFT,
5) owner reviews live for a week, 6) flip flows to autopilot one at a time.
