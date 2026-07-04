# One-Shot Across the Board

> One command per machine. Same script everywhere — it knows (or you tell it)
> which device it's on and provisions the right kit. Idempotent: safe to re-run
> anytime to bring a machine back to ready.

## The three machines (your fleet)

| Machine | What to run | What it does |
|---|---|---|
| **Owner carry Mac (M5)** | `bash scripts/one-shot.sh carry` | Owner kit + mesh onboard + one-word commands. Mesh name `carry-mac`. |
| **Owner M1 Mac (home brain)** | `bash scripts/one-shot.sh brain` | Owner kit **+ always-on** (SSH, Tailscale, never-sleep). Mesh name `brainiac-mac`. |
| **Moe Legacy Mac (Umar)** | `bash scripts/one-shot.sh moe` | **Fenced operator** (Red Hood) — never owner. Mesh name `moe-legacy`. |

Anyone else (family/friend) who wants their *own* private, isolated mesh:
`bash scripts/one-shot.sh own`.

## How to run it

On each machine, in Terminal from the repo root:

```bash
bash scripts/one-shot.sh            # asks which machine this is, then provisions
# or name it directly:
bash scripts/one-shot.sh carry      # owner carry M5
bash scripts/one-shot.sh brain      # owner M1 (also offers the always-on setup)
bash scripts/one-shot.sh moe        # Moe Legacy operator (fenced)
```

Once the one-word commands are installed you can also use `tmmt`:

```bash
tmmt setup        # interactive — pick carry / brain / moe / own
tmmt one-shot carry
```

## What each run does (idempotent)

1. Sets this device's **unique mesh name** (only if it doesn't already have one).
2. **Onboards to the mesh** via `swarm-join.sh` — per-device git identity +
   secret-guard hooks (blocks committing `.env`/keys).
3. Pulls **`.env` from Vercel** if missing (`vercel env pull .env
   --environment=production`). Note: build/test/lint and the agent swarm run
   fine **without** `.env` — it's only needed to run the live app.
4. Installs the **one-word commands** (role-aware: owner gets the full kit,
   operator is fenced).
5. **Brain only:** offers the always-on home-brain setup (SSH + Tailscale +
   never-sleep) so the carry Mac can reach it remotely.
6. Owner machines are gated by the **Owner Seal** (`auth/OWNER.seal`); operator
   machines are fenced and can never escalate to owner.

## Fresh machine?

`one-shot.sh` self-heals: if **Node** is missing it installs Homebrew + Node for
you (macOS) or tells you exactly how (Linux), then continues. So on a Mac that
already has the repo, the one command above is genuinely all you run — even if
Node was never installed.

The only thing it can't bootstrap from literally nothing is **git + the repo
itself** (chicken-and-egg — you need git to clone). For a brand-new machine with
nothing on it, run the from-scratch installer once (installs Xcode tools,
Homebrew, git, Node, the Claude CLI, clones the repo, pulls `.env`), then the
one-shot finalizes:

- Owner Macs (carry / M1): `scripts/setup-mac.command` — double-click it, or
  `bash ~/Downloads/setup-mac.command`.
- **Our guest — Moe Legacy:** `scripts/umar-setup.command` — the warm Red Hood
  installer (fenced, never owner). After it clones the repo, `one-shot.sh moe`
  (or just `moe`) is the re-runnable daily entry.

### Guest-friendly by design
Guest machines (`moe`, and `own` for family/friends) **never need the owner's
seal or secrets**. The operator path is fenced and least-privilege; the `own`
path stands up a fully isolated private mesh on the guest's own Tailscale login
that cannot touch anyone else's network. Nothing here can lock a guest out or
demand owner credentials.

See also: `docs/FLEET-ROSTER.md` (device map), `docs/MESH-SWARM.md` (the mesh),
`docs/BRAINIAC-MAC-SETUP.md` (M1 always-on details).
