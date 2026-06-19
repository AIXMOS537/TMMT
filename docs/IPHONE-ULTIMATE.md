# The Ultimate iPhone — PROJECT X HAILMARY + AIXMOS in your pocket

> Make **any iPhone you own, now or later,** the face of HAILMARY and AIXMOS —
> talking, learning, evolving agents you can show off. The trick that keeps it
> **owner-only and local** (per `docs/HAILMARY-CHARTER.md`): the phone never
> *becomes* the brain. The brain lives on your **always-on Mac**; the phone is a
> secure window into it over your private **Tailscale** mesh, with an on-device
> model for offline moments.
>
> Companion docs: `docs/MOBILE.md` (the short version), `docs/DEVICE-SYNC-PRIVATELLM.md`
> (multi-device sync), `docs/LOCAL-FIRST-AI-STACK.md` (the local model router).

---

## The honest truth (read this once)

- **iOS will not run the engine.** Apple's sandbox forbids shell scripts, daemons,
  tmux, and arbitrary binaries. No app or jailbreak-free trick puts `scripts/hailmary`
  *on* the phone. Anyone who claims otherwise is selling you something.
- **So we do the better thing.** The agents run where they're already strong — your
  Mac — and the iPhone becomes the **microphone, the screen, and the one-tap trigger.**
  This is exactly the charter's design: *the instrument is rented; the agent is owned.*
- **What "talking / learning / evolving" really means here:**
  | Promise | How it's real |
  |---|---|
  | **Talking** | You dictate; the Mac's local model answers; the phone reads it aloud (Speak Text). Two-way voice. |
  | **Learning** | Every exchange is appended to `.hailmary/memory/talk.ndjson`; the last turns are fed back as context. Continuity across calls. |
  | **Evolving** | That memory is what `hailmary absorb` + the vault sync carry to BRAINIAC — the agents get more "you" over time. Owner-local; secrets skipped. |
  | **Offline** | No tailnet? **Private LLM** on the phone answers locally; the write queues for next sync. |

---

## The shape of it (one picture)

```
   📱 iPhone ──(Tailscale, private, encrypted)──►  🖥️ always-on Mac (the brain)
      │  voice in (dictate) · voice out (Speak Text)     runs HAILMARY · AIXMOS
      │  one-tap Shortcuts on the Home Screen            local model: Ollama / LiteLLM
      └─ offline → Private LLM on-device (Qwen ~4B)      memory → BRAINIAC vault
```

Everything the phone does routes through one base-side entrypoint so the Shortcut
stays a single line:

```
scripts/mesh/iphone-remote.sh  booyah | status | compass | aixmos | ask "…" | say "…"
```

---

## Part 1 — One-time setup ON THE MAC (≈5 min, you do this)

> A cloud session can't reach your devices — these run on the Mac itself.

1. **Pick the local model endpoint.** You already run Ollama. Confirm it answers:
   ```bash
   curl -s http://127.0.0.1:11434/api/tags >/dev/null && echo "Ollama OK"
   ollama pull qwen2.5:14b        # the talking model (or your preferred local model)
   ```
   Using the LiteLLM router from `docs/LOCAL-FIRST-AI-STACK.md` instead? Point the
   helper at it (tailnet-only):
   ```bash
   echo 'export IPHONE_LLM_URL="http://<hub-tailnet-ip>:11434/api/chat"' >> ~/.zshrc
   echo 'export IPHONE_LLM_MODEL="qwen2.5:14b"'                          >> ~/.zshrc
   ```
2. **Smoke-test the talking loop locally:**
   ```bash
   bash scripts/mesh/iphone-remote.sh ask "in one sentence, who are you?"
   bash scripts/mesh/iphone-remote.sh ask:aixmos "what's the next move on the fleet?"
   ```
   You should get a spoken-style reply and a new line in `.hailmary/memory/talk.ndjson`.
3. **Note two things for the phone:**
   - your Mac's **Tailscale name** (`tailscale status` → the `100.x` host or MagicDNS name)
   - the **repo path** on the Mac (e.g. `~/projects/TMMT`)
4. **Keep him awake:** `bash scripts/hailmary booyah` installs always-on presence on
   macOS (LaunchAgent) so the phone can reach him even with the lid down.

---

## Part 2 — One-time setup ON THE iPhone (≈10 min, 3 apps)

1. **Tailscale** (App Store) → sign in with your account. The phone is now on the
   mesh and can see the Mac. Least-privilege — it only reaches what your ACL allows.
2. **An SSH client** — **Blink Shell** (nicer, paid) or **a-Shell** (free). Generate
   a key, add its public key to the Mac's `~/.ssh/authorized_keys`. Test:
   ```
   ssh you@<mac-tailscale-name>
   bash ~/projects/TMMT/scripts/mesh/iphone-remote.sh status
   ```
3. **Private LLM** (App Store) → download a Qwen ~4B model. This is your offline brain
   (the pocket CHUMMO) for when you're off the tailnet.

---

## Part 3 — The Shortcuts (the show-off part)

iOS **Shortcuts → "Run Script Over SSH"** lets one Home-Screen tap run a command on
the Mac. Set host = your Mac's Tailscale name, user + key once, then per button:

### 🟢 Booyah — wake him (one tap)
```
Run Script Over SSH:
  bash ~/projects/TMMT/scripts/mesh/iphone-remote.sh booyah
Show Result.   Name: "Booyah".   Add to Home Screen.
```

### 🎙️ Talk to HAILMARY — full two-way voice (the headliner)
```
1. Dictate Text                         → (your spoken question)
2. Text action: combine into one arg, escaping quotes:
      bash ~/projects/TMMT/scripts/mesh/iphone-remote.sh ask "[Dictated Text]"
3. Run Script Over SSH:  <the Text from step 2>
4. Speak Text:           <SSH Result>
5. (optional) Show Result
Name: "HAILMARY".  Add to Home Screen + "Hey Siri, HAILMARY".
```
Now: tap (or "Hey Siri, HAILMARY") → speak → he answers **out loud**, in your Mac's
voice, with memory of your last few exchanges.

> **Tip — make dictation safe:** in step 2 use Shortcuts' *Replace Text* to turn `"`
> into `'` in the dictated text before wrapping it, so quotes never break the command.

### 🧠 Talk to AIXMOS — the ops brain
Same as above, but step 2 uses `ask:aixmos "[Dictated Text]"`. Name it **AIXMOS**.

### ☾ Compass — protect your peace (one tap, always exempt from DARK off-switch)
```
Run Script Over SSH: bash ~/projects/TMMT/scripts/mesh/iphone-remote.sh compass
Speak Text: <SSH Result>.   Name: "Compass".
```

### 🌙 Offline fallback (no tailnet)
In the Talk shortcuts, wrap the SSH action in **If (SSH Result is empty / errored)**
→ run the **Private LLM** action with the same dictated text → Speak Text. You now
have a graceful local answer anywhere, and it queues to sync when you're back on the
tailnet (see `docs/DEVICE-SYNC-PRIVATELLM.md §5`).

---

## Part 4 — Make it look the part (the flex)

- **Home-Screen icons:** give each Shortcut a glyph + color (⚡ Booyah, 🧠 AIXMOS,
  🎙️ HAILMARY, ☾ Compass). Group them in one folder named **PROJECT X**.
- **Lock-Screen widgets:** add the Shortcuts widget so Booyah + Compass are one tap
  from the lock screen.
- **Wallpaper with the words:** `docs/cheatsheets/HAILMARY-PHONE.png` (regen with
  `scripts/make-wallpaper.py`) so the command words are always in front of you.
- **Hand it to someone:** "Hey Siri, HAILMARY" → ask it anything → it talks back.
  That's the demo.

---

## Part 5 — Any future iPhone, in 10 minutes

This is portable by design. On a new phone: install the 3 apps (Part 2), import the
Shortcuts via the iCloud share links you made (or rebuild from Part 3 — they're short),
join Tailscale. Done. The brain, the memory, and the agents never moved — only the
window did. Lose a phone? Remove it from the tailnet in one tap; FileVault + the
secret-guard mean nothing sensitive was ever on it.

---

## Guardrails (non-negotiable, from the charter)

- **Brain stays on your hardware.** The phone is a window, not a copy.
- **Tailnet-only.** Never port-forward Ollama / the router / SSH to the open internet.
- **No secrets on the phone.** SSH keys only; the memory loop scrubs secret-shaped
  strings before writing (`eyJ…`, `sk-…`, `service_role`, etc.).
- **Owner-only + fail closed.** Outward/irreversible actions (send, publish, delete,
  pay, grant) are **named, not done** — they wait for your explicit go-ahead
  (`docs/MESH-COORDINATION.md §4`).
- **DARK kills it.** `bash scripts/godark` blacks out the agents everywhere; only the
  Owner seal lifts it. `compass` stays reachable — protect the user, always, first.

---

_What still needs YOU (on-device, can't be done from a cloud session): Parts 1–2
(install + keys on the Mac and phone), then build the Shortcuts in Part 3. Tell me
your Mac's Tailscale name + repo path and whether you use Ollama or the LiteLLM
router, and I'll hand you the exact, paste-ready Shortcut text for each button._
