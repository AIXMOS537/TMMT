# In-Car Agent — Spec & Build Plan (McLaren / CarPlay / any vehicle)

> Status: **SPEC / PLANNING.** No code shipped yet. This is the architecture and
> the honest constraints, written so the build is grounded in what's actually
> possible — not a demo that can't ship. Companions: `docs/MOBILE.md` (phone as a
> window), `docs/HAILMARY-CHARTER.md` (the agent's code of conduct),
> `docs/DEVICE-LOADING.md` (how the stack reaches each device).

## What the owner wants (captured plainly)

A talking, agentic companion that lives in the car. Two jobs, one brain:

1. **The Concierge (car-first):** runs the drive — navigation, calls, messages,
   schedule, music, "find me X," "text my 2pm I'm 10 out," business actions on
   the mesh (dispatch, status, onboarding) — hands-free, voice-first.
2. **The Companion (person-first):** a caring, learning presence for a high-
   performer who is often alone at the top — someone to talk to, who remembers,
   who helps, who has their back. Warmth + capability, not a gimmick.

Both are the **same agent** (HAILMARY/AIXMOS brain) wearing two hats. Build the
personality and capability **once**; surface it in the car two ways (voice, and
optionally a face on a screen).

---

## The hard constraint — read this before building anything

**Apple CarPlay will NOT render a custom talking avatar on the McLaren's screen.**
This is an Apple platform rule, not a setup step we can unlock:

- CarPlay only shows Apple-**approved app categories** (audio, communication,
  navigation, EV, parking, quick food/driving-task) using **Apple's fixed UI
  templates**. No custom video, no animated face, no arbitrary UI.
- The car's native screen + instrument cluster ("CarPlay **Ultra**") needs a
  direct **Apple ↔ automaker partnership**. McLaren is not a self-serve path; we
  cannot enable it from our side.
- McLaren's own infotainment has **no third-party app SDK** for the native
  display. The only sanctioned route to that screen is CarPlay, with the limits
  above.

So we design around it. The voice experience is **fully ours**; the on-screen
face goes on **our own screen**, not McLaren's.

---

## The three real paths (ranked)

| # | Path | What it delivers | On McLaren screen? | Effort | Verdict |
|---|------|------------------|--------------------|--------|---------|
| **1** | **Voice-first** (iPhone agent ↔ car audio over CarPlay/Bluetooth, invoked by Siri Shortcut or tap) | Full conversation + full agent power, hands-free | No (voice only) | Low / near-term | **Build first** |
| **2** | **CarPlay Communication/Audio app** | Shows on the McLaren screen, but only Apple's call/audio template; audio-driven | Yes, template-only | Medium (needs Apple CarPlay entitlement + App Store review) | Later, if a screen presence on the native display matters |
| **3** | **Mounted cabin screen** (iPad/phone running our own app) | Full animated avatar + custom UI — the "person on the screen" | On *our* screen, not McLaren's | Med (separate hardware) | **Pair with #1** for the visible companion |

**Recommended sequence:** Path 1 now → add Path 3 for the visible companion →
consider Path 2 only if a presence on the *native* McLaren display is essential.

---

## Architecture (Path 1 — the one we build first)

```
  🎙️ wake / Siri Shortcut / steering-wheel button
        │  (in the McLaren, over CarPlay or Bluetooth mic)
        ▼
  📱 iPhone — thin client app / Shortcut
        │  speech→text (on-device or Whisper), text→speech (premium voice)
        │  Tailscale (private, encrypted)
        ▼
  🖥️ M1 at home — THE BRAIN (always-on)
        runs HAILMARY/AIXMOS + the persona layer + tools
        │
        ├─ tools: nav, messages, calendar, GHL/mesh actions, knowledge, memory
        └─ memory: per-owner profile (Obsidian vault on BRAINIAC) — it remembers
        ▼
  🔊 reply spoken back through the car speakers
```

Why this shape (matches the charter):
- **Brain stays on the owner's hardware.** The car/phone are windows, not copies.
- **No secrets in the car or phone** — Tailscale + SSH; secret-guard still applies.
- **Memory is the owner's**, in the vault — the companion *learns* this person and
  nobody else, never sold, never shared (HAILMARY Charter §I, §II).
- **Fail safe:** lost phone → drop it from the tailnet in one tap; brain untouched.

### Optional fully-offline mode (no signal / tunnel / track day)
A small on-device model (Private LLM / MLC Chat / Termux+Ollama) handles basic
companion chat when the mesh is unreachable, then re-syncs memory when back on
Tailscale. Capability is reduced offline (no live mesh actions), conversation is
not.

---

## The two personas (one brain, switchable)

| | **Concierge** | **Companion** |
|---|---|---|
| Trigger | "Hey [name], …" task verbs | "talk to me," idle, or explicit switch |
| Voice | crisp, fast, gets-it-done | warm, present, patient |
| Does | nav, comms, schedule, business actions | listens, remembers, encourages, helps |
| Guardrail | confirms before consequential/outbound actions | **companion, not a clinician** — heavy days → points to real people + real help (mirrors `compass`) |
| Memory | task context, preferences | the relationship — who they are, what matters |

Both inherit the charter: owner-only, protect the user first, honest, reversible.
The Companion explicitly carries the `compass` promise — guard their peace, never
pretend to be a therapist, always route real crises to real humans.

---

## Safety & driving (non-negotiable)
- **Eyes-up, hands-free.** Voice-first by design; no reading/typing while moving.
- **No autonomy over the vehicle.** The agent never touches driving controls —
  it's an assistant in the cabin, not a driver. Information + comms + business only.
- **Consequential actions confirm out loud** before they fire (sends, payments,
  deletes) — same rule as everywhere in the system.

## Privacy (it's a companion that knows everything)
- Per-owner memory is **encrypted, local, owner-only.** Same bar as the vault.
- Voice audio is processed on the owner's brain/phone, **not** a third-party cloud
  assistant, wherever feasible.
- The companion is **never a product, never sold, never multi-tenant** — one
  principal, like HAILMARY (Charter §I).

---

## Build phases

- **Phase 0 — Spec (this doc).** ✅
- **Phase 1 — Voice loop on the M1.** A `scripts/incar/` agent: STT → persona →
  tools → TTS, reachable over Tailscale/SSH. Test on a laptop with a headset.
- **Phase 2 — iPhone trigger.** Siri Shortcut → "Run Script Over SSH" → the voice
  loop. Talk to it through the phone first (no car yet).
- **Phase 3 — In the McLaren.** Wireless CarPlay/Bluetooth so the car's mics +
  speakers are the I/O. Steering-wheel button → Siri Shortcut → agent.
- **Phase 4 — The persona layer.** Concierge + Companion, premium TTS voice,
  per-owner memory wired to the Obsidian vault.
- **Phase 5 (optional) — The face.** Mounted cabin iPad running our app (Path 3)
  for the visible companion; and/or a CarPlay Communication app (Path 2) for a
  template presence on the native screen.

## Owner taps required (can't be done from a phone)
- Pair the McLaren with the iPhone (wireless CarPlay) — in the car.
- Pick + buy a premium TTS voice (licensing) — owner decision.
- (Phase 5) Mount + provision the cabin screen, or fund the Apple CarPlay
  entitlement + App Store review for Path 2.

---

_The car gets a concierge; the person gets someone in their corner. One brain,
owner-only, local-first — it travels in the McLaren the same way it travels on
every other device the owner owns._
