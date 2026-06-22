# HAILMARY in your pocket — iPhone & Android

> **Want the full, turnkey iPhone build (two-way voice, one-tap Shortcuts, the
> talking/learning/evolving loop)?** See **`docs/IPHONE-ULTIMATE.md`** — it uses the
> base-side entrypoint `scripts/mesh/iphone-remote.sh`. This page is the short version.

Yes — you can carry HAILMARY. The trick that keeps it **local and owner-only** is
simple: your phone doesn't *become* the brain — it becomes a **secure window into
your brain** (the always-on M1 at home) over your private Tailscale mesh. Nothing
leaves your devices. Optionally, you can also run a small model *on the phone
itself* for fully offline moments.

> Core promise, on every screen: **protect the user first, guard their peace, and
> walk toward God one step at a time.** That's the `compass`. See
> `docs/HAILMARY-CHARTER.md` §VI.

---

## The shape of it (one picture)

```
   📱 phone  ──(Tailscale, private)──►  🖥️ M1 at home (the brain, always-on)
      │                                     runs HAILMARY · AIXMOS · CHUMMO
      └─ type a word: unison · booyah · onboard · compass
      └─ (optional) a tiny on-device model for offline
```

---

## 🍎 iPhone — 3 apps, ~10 minutes

1. **Tailscale** (App Store) — sign in with your account. Now your phone is on the
   mesh and can see the M1. (Least-privilege; it only reaches what you allow.)
2. **a-Shell** *(free)* or **Blink Shell** *(paid, nicer)* — a real terminal on
   iOS. From it you SSH into the M1:
   ```
   ssh ceo.moe@<m1-tailscale-name>
   ```
   then just type: `unison`, `booyah`, `onboard`, `compass`.
3. **Shortcuts** (built-in) — make a **one-tap** button on your home screen:
   - New Shortcut → "Run Script Over SSH" → host = your M1's Tailscale name →
     command = `bash ~/projects/TMMT/scripts/compass`
   - Name it **Compass**, add to Home Screen. One tap = your step for today.
   - Repeat for **Booyah** (`scripts/hailmary booyah`) and **Menu**.

**Fully offline on the phone (optional):** install **“Private LLM”** or **“LLM
Farm”** (on-device models, nothing leaves the phone) for a private chat when
you're off-grid. This is the pocket version of CHUMMO.

---

## 🤖 Android — even more local

1. **Tailscale** (Play Store) — sign in; you're on the mesh.
2. **Termux** (from **F-Droid**, not Play) — a full Linux shell in your pocket:
   ```
   pkg install openssh git
   ssh ceo.moe@<m1-tailscale-name>
   ```
   then type the words. Add **Termux:Widget** for one-tap home-screen buttons.
3. **Fully local on the phone (optional):** Termux can run **Ollama** on many
   Android phones (`pkg install ollama` or the arm64 build) — a real local model
   in your hand, fully offline. Or use the **MLC Chat** app for on-device models.

---

## Make the buttons (one-tap, no typing)

Both phones support home-screen buttons that run one command on the M1:
- **Compass** → `bash ~/projects/TMMT/scripts/compass` — your step toward God
- **Booyah** → `bash ~/projects/TMMT/scripts/hailmary booyah` — wake him
- **Onboard** → `bash ~/projects/TMMT/scripts/aixmos onboard` — a client, on the go
- **Menu** → `bash ~/projects/TMMT/scripts/menu` — the picture board

Set the wallpapers so the words are always in front of you:
`docs/cheatsheets/HAILMARY-PHONE.png` (iPhone) · `HAILMARY-ANDROID.png` (Android).

---

## Why this stays safe (the non-negotiables)

- The **brain stays on your hardware** (the M1). The phone is a window, not a copy.
- Traffic rides **Tailscale** (encrypted, private) — never the open internet.
- **No secrets on the phone.** SSH keys only; the secret-guard still applies.
- The phone can be lost — so the M1 has **FileVault**, and you can remove a phone
  from the tailnet in one tap if it ever goes missing.
- `compass` is a **companion, not a clinician** — if a day is heavy it points you
  to real people and real help. Protect the user, always, first.
