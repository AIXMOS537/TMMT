# The Master Key — rotating lock + a phrase only YOU know

> The ultimate owner key. Two factors:
> 1. **A master phrase** only the human (Muhammad Taha) knows — **never stored.**
>    The system keeps only a one-way hash + a blob encrypted *under* the phrase.
>    **Not even X (the system) can reveal it** — it doesn't have it.
> 2. **A rotating TOTP code** from your authenticator (changes every 30s) — the
>    "always moving" part. A stolen file is useless without a live code.
>
> **Unlock needs BOTH.** Tool: `scripts/master-key.sh`. Owner-only — excluded from
> every handoff bundle.

---

## Why this is strong
- **The phrase lives in your head, nowhere else.** We store `sha256(salt + phrase)`
  (a one-way check) and the TOTP secret **encrypted with the phrase** (AES-256,
  PBKDF2 200k). Read the whole repo, the whole disk — you still can't get the phrase
  or a working code. That's the "not even X knows" guarantee, by math.
- **The lock keeps moving.** Even if someone shoulder-surfed a code, it dies in 30s.
  Even if they grabbed the file, they can't decrypt it without the phrase.
- **Both required.** Phrase alone = denied. Code alone = denied. You need the thing
  you *know* + the thing that *rotates*.

## Set it up (once, on a device YOU own)
```bash
bash scripts/master-key.sh seal
```
- Enter your master phrase (twice). Make it long and memorable — **never write it in
  any file, note, or message.** It only ever lives in your mind.
- Choose **(1) generate a new TOTP** → it shows a key + `otpauth://` URI → add it to
  your authenticator app (scan/type). Or **(2)** paste a base32 secret you already have.
- Done. The seal stores only the hash + encrypted blob (`.aixmos/seal/`, gitignored).

## Use it
```bash
bash scripts/master-key.sh unlock   # phrase + current 6-digit code -> UNLOCKED (5 min)
bash scripts/master-key.sh status   # sealed? locked/unlocked? (reveals nothing)
bash scripts/master-key.sh reset    # wipe it (must unlock first)
```
A successful unlock writes a short-lived token (5 min) other owner tools can require
before doing anything sensitive (deploys, secret access, lifting go-dark).

## The rules (so it stays yours alone)
- **Never type the phrase into any AI, chat, file, or note.** Not even here. Only into
  `master-key.sh unlock` on your own device.
- If you ever suspect the phrase leaked: `unlock` → `reset` → `seal` a new one.
- Keep the authenticator backed up (your app's cloud backup) so you don't lose the
  rotating factor.
- The phrase is **unrecoverable by design.** If you forget it, the seal is dead —
  `reset` and start fresh. (That's the price of "no one, not even the system, knows it.")

---

_Owner-only. Excluded from Legacy/handoff bundles. Pairs with the owner-seal +
go-dark. The phrase is the root of trust — and it lives only in X's mind._
