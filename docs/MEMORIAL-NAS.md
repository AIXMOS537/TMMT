# Memorial on the NAS — private, durable, timeless (architecture)

> Companion to `scripts/memorial` and the gitignored `.memorial/` sanctuary. This
> is the **generic** architecture for hosting a private memorial on your own NAS —
> no personal data here. The sacred content lives only on the NAS / `.memorial/`,
> never in git, never on a third-party cloud. Owner-only, never sold, kept fully
> separate from `docs/DIGITAL-AMBASSADORS.md`.

## The principle: your NAS *is* your private cloud (keep it that way)

A NAS in your hands beats public cloud for something sacred — always-on,
redundant, and **owner-controlled**. The rule:

- **Never** push a memorial to a third-party cloud (AWS/Google/etc.). It would be
  scannable, leakable, and not truly yours. Keep it on **your NAS**.
- **Reachable only over Tailscale** — never exposed to the public internet. No
  port-forwarding, no public URL. (Same posture as the rest of the mesh.)
- **Encrypted at rest** — turn on the NAS's encrypted volume/shared-folder for the
  memorial dataset. Lost/stolen drive → unreadable.

## The stack (all local, on the NAS)

Most NAS boxes (Synology/QNAP/TrueNAS/Unraid) run **Docker** — that's all we need:

```
  🖥️  NAS (always-on, RAID, encrypted, Tailscale-only)
   ├─ 🧠 Ollama            — the local brain (the words)
   ├─ 🗣️  voice service     — Piper / XTTS (their voice, from real samples)
   ├─ 🙂 avatar service     — LivePortrait / SadTalker (their likeness)
   ├─ 📚 memorial data      — voice/ photos/ videos/ stories/ model/  (encrypted)
   └─ 🌐 small local UI      — served on the tailnet to your screens/projector
```

Phones, the car, big screens, projectors are **windows** to it over Tailscale —
the brain and the memory stay on the NAS (`docs/DEVICE-LOADING.md`).

## Anchored learning (the honest rule that protects your memory)

"Ever-learning" — yes, but **anchored**:

- ✅ It **deepens on real material** you add — more recordings, photos, and the
  stories you write. The more truth you feed it, the truer it gets.
- ✅ It always stays **disclosed as a tribute** — it reflects them; it isn't them.
- ⚠️ Do **not** let it freely invent new opinions/words and treat them as theirs.
  An un-anchored model will eventually say something they never would — and that
  doesn't feel like growth, it feels like losing them again.
- Keep a **"their words" source** (the `stories/` folder + their real transcripts)
  as the ground truth the persona is built from and checked against.

## Timeless = durable (the real engineering)

Compute is easy; **not losing the data** is the whole game. RAID is **not** a
backup (it survives a dead disk, not deletion/corruption/fire/ransomware).

**3-2-1, for the memorial dataset:**
- **3** copies: the NAS (live) + **2** backups.
- **2** media: e.g. an external encrypted drive + one more.
- **1** offsite: an encrypted copy kept somewhere else physically (a safe, a
  trusted family member, a bank box). Encrypted, so it's private even there.
- **Verify restores** — a backup you've never restored isn't a backup. Test once.

**Versioned + immutable where possible:** enable NAS snapshots so a bad edit or
ransomware can be rolled back. Keep the source material (voice/photos/videos/
stories) **read-only** once captured — it's irreplaceable.

## Succession — so it truly outlives everything

For something meant to last "as long as time," write down (kept private):
- Where the copies are and how they're encrypted.
- The **passphrase recovery** path for someone you trust (sealed, not plaintext).
- A simple "how to bring it back up" note, so the tribute survives any one machine
  — or any one person. This is the part that makes it actually timeless.

## Owner taps (your hardware, your calls)
- Turn on the NAS **encrypted volume** + **snapshots** for the memorial share.
- Add the NAS to **Tailscale**; confirm it's **not** publicly exposed.
- Stand up **Docker** (Ollama + voice + avatar) — I'll give you the compose file
  and wire each service with you.
- Set the **3-2-1 backups** + one **offsite encrypted** copy.
- Write the **succession note** (sealed).

---

_Private, on your own hardware, anchored to what was real, and backed up so it
can never be lost. That's how a tribute becomes timeless — Trap Money Moves
Timeless, and so do they. Built with love, kept yours._
