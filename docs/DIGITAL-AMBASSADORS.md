# Digital Ambassadors — consent-first licensed digital talent (spec & plan)

> Status: **SPEC / PLANNING.** No code, no avatars generated yet. This designs a
> program where **real people license their likeness** to appear as digital hosts/
> companions across the business surfaces (car, cabin screen, AR glasses, web).
> Local-first, low/no-cost where possible. Companions: `docs/IN-CAR-AGENT.md`,
> `docs/DEVICE-LOADING.md`, `docs/HAILMARY-CHARTER.md` (the code of conduct).

## What this is (in plain business terms)

A **licensed digital-talent program**: consenting models/creators allow a digital
version of themselves — a "digital ambassador" — to act as a host, guide, or
companion persona inside the system (the in-car Companion, a web concierge, an AR
guide). It's the same model agencies already use for digital doubles and virtual
influencers — done **consent-first and locally**, so the likeness, the data, and
the revenue all stay clean and owner-controlled.

Think: a roster of consented digital hosts that the brain (HAILMARY/AIXMOS) can
"wear" on any screen — each a real person who **opted in, signed, and gets paid**.

---

## LAYER 0 — Consent & likeness (NON-NEGOTIABLE, build this first)

A digital likeness of a real person is legally **their property** (right of
publicity / NIL). Generating one without airtight consent isn't a feature — it's
liability. So nothing in this program runs until Layer 0 is in place per person.

### Bright lines (the program's own guardrails — never crossed)
- **Verified, adult, freely-given consent only.** Government-ID age/identity
  check on file. No minors, ever.
- **No intimate, sexual, or explicit likenesses.** This is a brand-host /
  companion program, not that. Hard stop, no exceptions.
- **No impersonation or deception.** A digital ambassador is always disclosed as
  a digital persona (EU AI Act §50 / emerging US disclosure law). It never
  pretends to be the real person doing/saying something they didn't agree to.
- **Revocable.** Consent can be withdrawn; on withdrawal the likeness + trained
  models + media are **destroyed** and the persona is retired. Build the kill
  path on day one.
- **Scoped.** They consent to *specific uses* (e.g., "in-car host," "web
  concierge") — not a blanket "do anything with my face."

### The consent kit (paperwork, before any capture)
Goes in `docs/deal-kit/` alongside the operator/partner agreements:
1. **Digital Likeness License** — what's licensed, where it appears, term,
   territory, exclusivity, **revocation clause**, **no-explicit clause**.
2. **Compensation schedule** — upfront + per-use/royalty (the ladder, applied to
   talent). They get paid; it's a real deal, not a favor.
3. **ID + age verification record** — stored encrypted, owner-only (vault rules).
4. **Capture consent** — exactly what reference media (photos/voice) is taken and
   how it's stored, used, and deleted.
5. **AI-disclosure acknowledgment** — they understand it's an AI persona and
   agree to the disclosure shown to end-users.

> Until a person has 1–5 complete, they are **not** in the roster and **no**
> avatar/voice model is trained. Enforced like the secret-guard: no exceptions.

---

## The tech stack — local-first, low/no-cost

The whole point: keep faces, voices, and data **on owner hardware** (the M1 / a
GPU node), not scattered across cloud services. Cloud tools are optional polish.

### Face / avatar (talking head from consented reference)
| Tool | Local? | Cost | Notes |
|---|---|---|---|
| **LivePortrait** | ✅ local (GPU) | free / OSS | fast, high-quality portrait animation/reenactment — strong default |
| **Hallo2 / EchoMimic / AniPortrait** | ✅ local (GPU) | free / OSS | audio-driven talking head; good lip-sync |
| **SadTalker / Wav2Lip** | ✅ local (GPU) | free / OSS | lighter, older, very runnable |
| **Higgsfield** | ☁️ cloud | paid credits | cinematic motion / short hero clips — **optional** polish, not the daily driver |
| HeyGen / D-ID / Synthesia | ☁️ cloud | paid | high polish, but likeness leaves your hardware — use sparingly, with consent terms that cover it |

**Recommendation:** **LivePortrait (local)** for the real-time/host work; reserve
**Higgsfield or a cloud avatar** only for occasional cinematic marketing clips,
and only when the license explicitly covers that cloud processing.

### Voice (consent applies here too — voice is likeness)
- **Local & free:** **Piper** (fast TTS), **XTTS/Coqui** or **F5-TTS** (voice
  *cloning* — requires the same signed voice consent as the face), **StyleTTS2**.
- Keep voice models on the GPU node; never ship a cloned voice off-device.

### Brain (already in your stack)
- **Local LLM via Ollama** drives the persona's words; the persona is a
  personality + memory layer on top of HAILMARY/AIXMOS. One brain, many faces.

### Where it runs
- A **GPU node** (a desktop with an NVIDIA card, or the strongest Mac) becomes the
  "render node" on the mesh. Phones/cars/glasses are **windows** to it, per
  `docs/DEVICE-LOADING.md`. Faces/voices never live on carried devices.

---

## The surfaces (where an ambassador appears)

| Surface | How it shows | Reality check |
|---|---|---|
| **Cabin iPad (car)** | full animated avatar | ✅ our screen, full control (`docs/IN-CAR-AGENT.md` Path 3) |
| **McLaren native screen** | ❌ not available | Apple/CarPlay wall — voice-only there |
| **Web / kiosk concierge** | full avatar in browser | ✅ fully ours |
| **AR glasses** | voice + POV assist | see the wall below |

### AR glasses — the honest constraint
You asked about **Meta (Ray-Ban) glasses**. Same kind of wall as CarPlay:
- **Meta's glasses are a closed platform.** There is **no open SDK** to run your
  own agent/avatar *on* them or to get a real-time third-party POV video feed.
  Live streaming is locked to Meta's own apps (IG/WhatsApp).
- **What you CAN do today:** use them as a **Bluetooth headset + capture device** —
  your agent runs on the paired phone, talks through the glasses' speakers/mics,
  and you can pull captured photos/clips (via Meta View) for the agent to analyze
  **after** capture, not as a live open feed.
- **If you want true "be my eyes" with an open agent,** the device that actually
  allows it is **open AR hardware** — e.g. **Brilliant Labs Frame** (open-source,
  real SDK), or Android-based **XREAL/Rokid**. That's the path to a real-time,
  custom, see-through assistant you control end-to-end.

**Recommendation:** glasses-as-headset for the voice companion now (works with the
Meta glasses you may already have); evaluate **Brilliant Labs Frame** if a real
open "eyes of the business" AR agent becomes a priority.

---

## Build phases

- **Phase 0 — this spec.** ✅
- **Phase 1 — Layer 0 paperwork.** Draft the Digital Likeness License + consent
  kit into `docs/deal-kit/`. *Nothing else starts until this exists.*
- **Phase 2 — Render node.** Stand up the GPU node on the mesh; install
  LivePortrait + Piper locally; prove a talking head from a **test/own** likeness
  (yours, with your consent) end-to-end — no real talent yet.
- **Phase 3 — Persona layer.** Wire a persona (personality + memory + voice) onto
  the Ollama brain; one ambassador, one surface (web concierge) first.
- **Phase 4 — First consented ambassador.** Only after a signed kit: onboard one
  real person, scoped to one surface, with the disclosure + revocation path live.
- **Phase 5 — Surfaces.** Roll the roster to the cabin iPad and glasses-as-headset.
- **Phase 6 (optional) — Open AR.** Evaluate Brilliant Labs Frame for true POV.

## Owner taps / decisions (can't be done from a phone)
- Approve/fund the **consent kit** legal review (a lawyer should bless the
  likeness license once — cheap insurance).
- Choose + provision the **GPU render node**.
- Decide compensation terms (the ladder for talent).
- Acquire any AR hardware if going past glasses-as-headset.

---

## Why it's built this way (the charter, applied)
- **Consent + dignity first** — "hit hard, love hard, **hurt no one**"
  (HAILMARY Charter). Every person opted in, paid, disclosed, and can walk away.
- **Local-first** — likeness and voice stay on owner hardware; cloud only with
  explicit license coverage.
- **Owner-only, never-sold** — the roster and its data are the owner's, governed
  like the vault.
- **Reversible** — revocation destroys the models and retires the persona, by
  design, on day one.

_A roster of real, consenting, paid digital hosts the brain can wear on any
screen — built so it protects everyone in it and stands up in court. One step at
a time._
