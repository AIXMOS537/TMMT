# Operation Overdrive — Owner Runbook (X)

Your carry Mac as the mobile Watchtower. Capture any job, let the mesh do it on the
cheapest engine that passes, get an iMessage back. **It is yours. It runs on your
own machines. It needs no one — not even Claude.**

> Spec: `docs/superpowers/specs/2026-06-18-mesh-capture-route-notify-design.md`
> Plan: `docs/superpowers/plans/2026-06-18-operation-overdrive-phase1.md`

---

## The four commands

| Command | What it does |
|---|---|
| `./scripts/x` | **Owner control.** `x set` (one time), `x unlock` (take control), `x lock`, `x status`. |
| `./scripts/catch "…"` | **Capture.** Speak (superwhisper) or paste; it splits your dump into jobs — local + free. |
| `./scripts/router` | **The worker.** `router up` (run), `router once`, `router install` (always-on), `router status`. |
| `./scripts/tower` | **The Watchtower.** See every job + who's online. `tower assign <id> <name>` hands a job to a person. |

---

## First-time setup (you, once)

```bash
cd ~/Projects/TMMT
./scripts/x set            # choose your master passphrase (stored only as a salted hash)
```

## Daily use — from any device that has the repo

```bash
./scripts/x unlock         # enter your passphrase → complete owner control as X
./scripts/catch "fix the login bug, draft a Friday recap, research 3 rental competitors"
./scripts/router up        # the mesh starts doing the work (or install it always-on, below)
./scripts/tower            # watch it happen
```

When a job finishes you get an **iMessage**. `./scripts/x lock` hands control back to no one.

---

## Total independence — never reliant on Claude

Run with **`OVERDRIVE_LOCAL_ONLY=1`** and every job runs on your own Ollama, on your
own machine, for **$0**, with **no API and no Claude**:

```bash
OVERDRIVE_LOCAL_ONLY=1 ./scripts/router up
```

Without that flag, the **cost ladder** is cheap-first by default: local Ollama →
Claude Haiku (cents) → Claude Opus (only for the genuinely hard stuff, only if the
cheaper tier fails the test). Claude is an *optional booster you switch on*, never a
crutch. Your call, every time.

---

## Always-on (so it runs whenever, wherever)

```bash
./scripts/router install     # installs a LaunchAgent — survives reboot, runs in the background
./scripts/router status      # confirm it's loaded
./scripts/router uninstall   # stop it
```

The always-on router still obeys your lock: it **parks until you `x unlock`**. Nothing
runs, nothing spends, without your passphrase. Run this on the M1 ("Rick") and BRAINIAC
to put their compute on the board too — they'll pull jobs whenever they're online.

---

## Safety (the "nothing cracks" rules — all built in)

- **Owner lock:** the router does nothing until you unlock with your passphrase.
- **Kill switch:** `dark` (creates `auth/DARK`) parks every router instantly; `light` lifts it.
- **Test gate:** a code job is never marked done unless it passes `build + test + lint`.
- **Deploys stay sealed:** the router only writes to branches. Going live is still
  `bash scripts/ship` (your owner seal) — Overdrive never deploys on its own.
- **Nothing is lost:** if a machine dies mid-job, the lease expires and the job
  auto-requeues. If Ollama is down, capture still saves your words.
- **Isolated board:** jobs live on the `overdrive-coord` git branch — separate from the
  live swarm, and auto-deploy is disconnected so it can never burn Vercel.

---

## Capture by voice (superwhisper)

Point superwhisper to either:
1. **File drop:** save its transcript to `~/.tmmt/inbox/<anything>.txt`, or
2. **Shortcut:** a macOS Shortcut that pipes the text to `./scripts/catch`.

Both land in the same place. Speak → it becomes jobs.

---

## Honest reach

This runs on any machine that has this repo + Node + (for local mode) Ollama. It does
**not** magically reach a device that has none of those — set a new device up once
(clone the repo, `x set`/`x unlock`) and it joins. There is no hidden dependency on
Claude or any outside service for the local path.
