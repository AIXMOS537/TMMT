# Owner Voice Vault — where Taha's truth gets built, in private

> **Owner-only. Private by default. Dark until you open the gate.**
> The public only ever meets AIXMOS. This is where *you* — Muhammad Taha (X) —
> draft your own voice and truth, on your own time, with nobody watching until
> you decide. It is not a publishing tool. It is a protected room.
>
> Companion to `docs/OWNER-VOICE-MODEL.md` (how the assistant speaks *with* you)
> and `docs/PROJECT-X-HAILMARY.md` (the command brain behind the curtain).

---

## 1. The promise

- **Nobody sees it but you.** Drafts live in `owner-voice/` — **gitignored**,
  owner-local only, never pushed, never shared (same posture as `.memorial/`).
- **It stays dark until you flip it.** Nothing here goes public, gets sent, or
  gets quoted by any agent without an explicit owner-approval step. Build now,
  decide later.
- **Your time, your call.** "When his time comes and he's ready for it" is the
  whole design. The vault waits as long as you need.

---

## 2. How it works (three states, you control all three)

| State | What it means | Who can see it |
|---|---|---|
| **DRAFT** | You're writing. Raw, unfinished, honest. | You only (local, gitignored) |
| **HELD** | Done writing, not ready. Sealed and waiting. | You only |
| **RELEASED** | You opened the gate — assistant may help publish *this one piece*, the way you approved. | The audience you chose |

Default for everything is **DRAFT**. A piece only becomes RELEASED when *you* say
so, per-piece — never a blanket "publish everything." This is the owner-approval
gate applied to your own voice.

---

## 3. Using it

```bash
# 1. Make your private room (one time, on Brainiac M1 — stays local, never pushed)
mkdir -p owner-voice

# 2. Start a piece from the template
cp docs/templates/voice-draft.template.md owner-voice/2026-06-23-untitled.md

# 3. Write. Or just talk to the assistant — "capture this for the vault" — and it
#    drafts into owner-voice/ for your eyes only.
```

When you're ready (could be days or years): tell the assistant **"release the
piece on X"** and it prepares that one piece for the channel you name — and stops
at the gate for your final yes before anything goes out.

---

## 4. Guardrails (so this stays yours)

- `owner-voice/` is **gitignored** — committing it is blocked by design.
- No agent, swarm node, or operator can read the vault — it never leaves your machine.
- No auto-publish, no auto-send, ever. RELEASED is a deliberate, per-piece act.
- Codeswitch respected (`OWNER-VOICE-MODEL.md`): same truth, delivery fit to the room.
- If in doubt, it stays DRAFT. The gate defaults closed.

---

_The vault is a room, not a megaphone. You decide if and when the door opens._
