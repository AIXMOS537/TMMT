# Event Demo Playbook — pull up, shock & awe, walk away with operators

> Status: **GO-TO-MARKET / LIVE-DEMO PLAN.** The room is influencers + credit-
> repair, business-funding, car-rental, and marketing owners — i.e. **your exact
> ladder.** This is how to demo Project X / AIXMOS so it lands, **without** a live
> failure in front of the room. Companions: `docs/OFFER-STACK.md` (pricing),
> `docs/IN-CAR-AGENT.md` (the car wall), `docs/DIGITAL-AMBASSADORS.md`,
> `docs/WATCHTOWER-ROSTER.md`, `scripts/activate-operator.command` (closing).

## The one rule of a live demo
**Nothing on stage depends on the venue Wi-Fi or the cloud.** Your whole edge is
**local-first** — so demo local-first. A demo that runs with the building's
internet unplugged isn't just safe, it's the *proof point* that sells the room.
Rehearse the entire thing in **airplane mode** at least once.

---

## What's actually demoable (honest hardware reality)

| You want to show | Demo it on | Why (the real constraint) |
|---|---|---|
| The agent **talking** in the car | **Voice through the McLaren speakers** (CarPlay/BT) | ✅ works — voice is fully ours |
| The agent **with a face / dashboard** | **A cabin iPad or a laptop**, not the McLaren screen | CarPlay won't render our UI on the native screen (`docs/IN-CAR-AGENT.md`) |
| The **one-word command board** | Laptop (or iPad mirrored to a TV at the booth) | `menu` / `booyah` — instant wow, fully local |
| "It **learns me**" companion | Laptop/iPad with a pre-seeded memory profile | local Ollama + memory; rehearsed, repeatable |

**Translation for the arrival:** the McLaren is the **magnet** (pull up, doors up,
heads turn). The **system demo happens on a laptop/iPad** you carry in — ideally
mirrored to a big screen at the venue. Voice can come through the car for the
"talk to it in the driver's seat" moment. Don't promise an avatar on the McLaren's
own screen — you'll look sharper being the one in the room who *knows the platform
limits cold*.

---

## The shock-and-awe sequence (≈7 minutes, rehearsed)

1. **Arrival (0:00).** Pull up in the 1:1 McLaren. That's the hook — say nothing
   about it. Let it work.
2. **The line (0:30).** "Every one of you loses hours a day to the nitty-gritty.
   I built something that doesn't just automate it — it *learns you* and runs
   beside you. Watch." Open the laptop.
3. **One word (1:00).** Type **`booyah`**. The whole base boots on screen —
   charter, security audit PASS, always-on, mesh online. "That's my entire
   operation coming alive with one word. Local. On my hardware. No cloud."
4. **Talk to it (2:00).** Voice: ask the companion to do a *real* thing live —
   "pull my hottest lead and draft the follow-up," "what's my day look like,"
   "show me the rental pipeline." It answers + acts. (Pre-seed the demo data.)
5. **Their world (3:30).** Switch personas to their vertical:
   - *Credit folks:* "watch it run **credit guidance** intake — compliant
     vocabulary, disclosure first." (Never say "repair" — `moe-brief` rules.)
   - *Funding:* the funding-readiness flow.
   - *Rental owners:* the rentals dashboard / dispatch.
   - *Marketers:* funnels + GHL automations firing.
6. **The kill switch (5:00).** Type **`dark`**. Everything stops. "I can black
   out my entire network from anywhere, and only my word + my phone code brings
   it back." Lift it. Security *is* the flex for this crowd.
7. **Unplug the Wi-Fi (5:30).** Run a command anyway. "Still works. It's mine, it
   lives with me, it can't be taken or leaked." Mic drop.
8. **The offer (6:00).** Transition to the ladder (below).

---

## The offer — speak their ladder, not features

Pull straight from `docs/OFFER-STACK.md`. For *this* room (agency owners /
operators running their own shops), the bands that fit:

| Their profile | Band | The pitch |
|---|---|---|
| Solo creator / wants a taste | **$1,875** | "Start with the laptop you can afford; leads + funnels convert while you climb." |
| Credit-repair / funding agency | **$25K** | "Full **credit-guidance + business-funding** vertical, AIXMOS agents, done." |
| Car-rental company | **$15K** | "Agents of Chaos ready for car rentals + new front-end." |
| Marketing org / multi-vertical | **$35K–$50K** | "Everything combined, backend team runs it, you just manage." |
| Capital-ready investor | **$100K** | "Apex — flash-deployable business, the whole brain, you dominate the industry." |

**The founder hook (scarcity, true):** "Two founding operators got their brain
free until $50K collected — Ayyan and MoeLegacy. That door is essentially closed.
Everyone here starts on the ladder — but early movers from this room get
[your call: priority onboarding / founding-cohort terms]."

---

## Capture every lead (don't lose the room's heat)
- **On the spot:** collect name + email + vertical + the band they reacted to.
  A simple form or a Quo/GHL contact — whatever's fastest.
- **Same day:** for anyone serious, run `scripts/activate-operator.command` with
  their profile to record the grant and kick off provisioning. (It now refuses
  junk/empty profiles — give it real `name:`/`email:`/`machine:` lines.)
- **Compliance for credit folks:** anything you say/show uses **"credit
  guidance," never "credit repair"**; disclosures first; no score/amount
  guarantees. This is also a *selling point* — "we're built compliant."

---

## Pre-event critical path (do these, in order)

**Must-have (or don't demo it live):**
1. **Pick the demo machine** — the laptop that runs the show (32GB ideal). Run
   `booyah` on it; confirm `menu`, voice, `dark`/`light` all work.
2. **Pre-seed demo data** — a fake-but-realistic lead, pipeline, and a memory
   profile so "talk to it" and "pull my hottest lead" look real and repeatable.
3. **Rehearse the 7-minute sequence in airplane mode** end to end, 3x.
4. **Record a 2-minute backup video** of the full demo. If anything glitches
   live, you cut to the video without missing a beat. (Non-negotiable insurance.)
5. **Cabin iPad** (if showing a face/dashboard in the car) — mounted, charged,
   on the mesh, avatar/dashboard loaded.

**Nice-to-have (only if there's runway):**
6. A first **Digital Ambassador** persona on the iPad as the "host" (only if a
   consent kit is signed — `docs/DIGITAL-AMBASSADORS.md` Layer 0; otherwise use
   your own likeness/voice with your consent).
7. Branded one-pager / QR to the offer ladder for handouts.

**Owner-only taps:** pick the demo laptop, approve any spend (iPad, printing),
decide the early-mover offer terms for the room.

---

## What NOT to do (so you don't get burned)
- ❌ Don't rely on venue Wi-Fi for the demo. (Local-first; airplane mode.)
- ❌ Don't promise the avatar on the **McLaren's native screen** — it's a
  platform limit, not a feature you forgot. Owning that makes you credible.
- ❌ Don't show real client data — use seeded demo data only.
- ❌ Don't say "credit repair" to the credit crowd. Ever.
- ❌ Don't free-give owner access. The McLaren proves you're the real one; the
  ladder is how they get in. "No one gets owner. You get the ladder."

---

_The car turns heads; the one word turns it into believers; the kill switch and
the unplugged-Wi-Fi moment close the security-minded; the ladder turns the room
into operators. Rehearsed, local, and yours — pull up and own it._
