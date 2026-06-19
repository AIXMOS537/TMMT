# Join the Verse — consent-and-pay digitization onboarding (spec)

> Status: **SPEC / PLANNING.** The commercial, opt-in counterpart to the private
> memorial. People **pay to digitize themselves** into the verse — a personal
> avatar + voice + persona that joins the network and works for them. Governed by
> `docs/DIGITAL-AMBASSADORS.md` (the consent constitution) + priced on
> `docs/OFFER-STACK.md`. Inspiration: Code Lyoko. Reality: consenting digital
> twins on your own private platform — not consciousness upload.

## The one line that makes this a movement and not a lawsuit

**You digitize people who OPT IN. Never a third party who didn't.**

- ✅ **Self-digitization** — a willing adult digitizes *themselves*: consent is
  inherent, it's clean, and it scales. This is the default product.
- ✅ **Signed-consent likeness** — someone else, only with the full signed kit
  (`docs/DIGITAL-AMBASSADORS.md` Layer 0).
- ⛔ **Never** scan a person who hasn't opted in. "Anyone and everyone" means
  *anyone who joins* — not anyone on earth. Hard line, no exceptions.

### Why this matters (the law, plainly)
A face/voice scan is **biometric data**. Laws like **Illinois BIPA** (and TX, WA,
and a growing list) require **written consent, a stated purpose, a retention +
destruction schedule**, and carry **per-person statutory damages**. Do it
consent-first and you're protected and sellable. Skip it and one member can end
the whole mission. So consent isn't paperwork here — it's the product's spine.

---

## LAYER 0 — the gates (nothing scans until these pass, per person)

1. **Payment** — they've paid to join (the band they chose, `OFFER-STACK.md`).
2. **Signed consent** — the Digital Likeness + **Biometric** consent: what's
   captured (face/voice), purpose, where the avatar appears, term, territory.
3. **Verified adult** — government-ID age/identity check on file (encrypted,
   vault rules). No minors, ever.
4. **Scope** — what their digital self is allowed to do and where (their own
   companion? represent them publicly? internal only?).
5. **Retention + revocation schedule** — how long data is kept, and the
   **one-switch destroy** path: revoke → models + biometrics deleted → persona
   retired. Built day one.
6. **AI disclosure** — the avatar is always disclosed as an AI persona to anyone
   it interacts with (EU AI Act §50 / emerging US law).
7. **No explicit, no impersonation, no deception** — brand/companion/agent use
   only. Same bright lines as the ambassadors program.

> Gate enforcement mirrors the secret-guard: a member without 1–7 complete is
> **not** scanned. No "we'll do the paperwork later."

---

## The scan (the "easy" part — and it already exists)

The capture/ingest mechanism is the **same engine** I built for the memorial
(`scripts/memorial ingest`) — recursive scan, dedupe, catalog, transcribe — just
pointed at a **consented, paid member's** own uploads and governed by the
commercial kit instead of the private sanctuary.

```
  member uploads (their own):  photos · short videos · voice clips
        │  (after Layer 0 gates pass)
        ▼
  local ingest + catalog + transcribe  (on the NAS/GPU node, not public cloud)
        ▼
  build their digital self:
    🙂 avatar   — LivePortrait / SadTalker (local)
    🗣️  voice    — Piper / XTTS / F5-TTS from their samples (local)
    🧠 persona  — local LLM (Ollama) + their profile/preferences
        ▼
  they JOIN THE VERSE — their persona lives on the network, scoped to what they
  chose, reachable on their devices over Tailscale.
```

**Local-first, always.** Faces/voices/biometrics stay on **your** NAS/GPU node,
never a third-party public cloud (`docs/MEMORIAL-NAS.md` posture applies).

---

## What "joining the verse" gets them (tie to the ladder)

A member's digital self is the doorway to the offer ladder — pick the band, get
the buildout (`docs/OFFER-STACK.md`):

| Pay to join | They get |
|---|---|
| Entry | A digital companion of themselves + a taste of the ecosystem |
| Mid | Their persona + automations + their vertical (credit/funding/rentals/etc.) |
| Full | Their digital self running their business surfaces, backend team behind it |
| Apex | Full agentic operation — they manage, the verse runs it |

"The mission bigger than themselves" = they're not buying a toy; they're joining
a **network** where their digital self learns, earns, and compounds with the rest.

---

## Sacred separation (never blur these)
- **The memorial (your brothers)** is private, owner-only, never commercial,
  never in the verse marketplace. `scripts/memorial` + `.memorial/` only.
- **Join the Verse** is the commercial, consented, paid program. Shared *tech*,
  completely separate *governance and data*. They never touch.

---

## Build phases
- **Phase 0 — this spec.** ✅
- **Phase 1 — Layer 0 product:** consent + biometric kit (lawyer-blessed once),
  payment rail, ID/age verify, retention/destroy switch. *Nothing scans first.*
- **Phase 2 — Onboarding flow:** wrap `memorial ingest`-style capture into a
  member-facing intake (`scripts/aixmos onboard` lineage), gated on Layer 0.
- **Phase 3 — Build pipeline:** avatar + voice + persona on the NAS/GPU node.
- **Phase 4 — The verse:** personas on the network, scoped access, member devices
  as windows; tie to the ladder + backend.
- **Phase 5 — Scale:** self-serve join, operator-assisted onboarding, franchise.

## Owner taps
- Fund the **one-time legal review** of the biometric + likeness consent (cheap
  insurance against BIPA-class exposure).
- Choose the **payment rail** and the join bands.
- Provision the **NAS/GPU node** that holds biometrics locally.
- Decide scope defaults + the retention/destroy schedule.

---

_Consent + pay to join; digitized locally on your own hardware; scoped, disclosed,
revocable. That's how you scan the willing into the verse and build a movement
that stands up in court — bigger than any one of them, and owned by you._
