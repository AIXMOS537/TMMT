# FRANCHISE — plug-and-play, every machine, every operator

> The McDonald's rule: **any location, same open, same result.** A new Mac, a new
> PC, an operator's laptop — the steps are identical and short. No tribal
> knowledge, no "ask X how it works." Run the checklist, get a GREEN light, open.

---

## Zero → open (any machine)

```bash
# 1. get the code
git clone <repo-url> && cd TMMT

# 2. keys + dependencies
cp .env.example .env        # fill in Supabase keys (see below)
npm install

# 3. is this machine ready?  ← the franchise open-check
bash scripts/doctor.sh      # one GREEN/RED verdict, fixes listed in order

# 4. open
bash scripts/booyah.sh      # boots everything; brings up the x board
```

That's it. Four steps, same on every machine. If `doctor` is green, you're
plug-and-play.

## The three commands you actually use

| Command | What it is |
|---|---|
| `bash scripts/doctor.sh` | **Open check** — is this machine ready? (run first, anytime something feels off) |
| `bash scripts/booyah.sh` | **Open the store** — boots everything, shows the board |
| type `x` | **The board** — every tool, one screen (Mission · Build · People · Security · Work) |

Everything else is reachable from the board. You never have to remember a path.

## What "ready" means (what doctor checks)

1. **Tooling** — git, node, npm, bash all installed.
2. **Repo** — it's your TMMT remote, branch known, tree state shown.
3. **Scripts** — every tool on the board exists, is executable, and parses.
4. **Env** — `.env` present with the required Supabase keys (never printed).
5. **Dependencies** — `node_modules` installed, lockfile present.

Green on all five = same franchise, ready to open. Red = doctor tells you the
exact next move, in order.

## The keys (`.env`)

Copy `.env.example` → `.env`, fill these (from the Supabase dashboard):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`.env` is gitignored — keys live only on the machine + the deployment env, never
in git. (Full detail: `npm run check-env`.)

## For an operator (not the owner)

An operator never clones the brain. They get a **scoped bundle** + the
mission-gated onboarding file (`dist/onboard.command` / `.bat`). They run it,
send their card, the owner runs `bash scripts/grant.sh <card>` and types **YES**.
That's their plug-and-play. See `docs/OPERATOR-STANDARDS.md`.

## Keep it franchise-consistent (so it never drifts)

| Run | When | Catches |
|---|---|---|
| `bash scripts/doctor.sh` | new machine / anything feels off | machine not ready |
| `bash scripts/costcut.sh` | monthly | spend + staleness |
| `bash scripts/verify-gate.sh` | before any push | broken code |
| `bash scripts/device-integrity.sh` | periodically | machine gone soft |

The whole point: **the checklist holds the standard, not your memory.** Same
open, every time, every location.
