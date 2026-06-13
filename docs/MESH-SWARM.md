# Mesh Agentic Swarm — many machines, many agents, in sync

Run a **swarm of Claude Code agents in parallel** on every machine you've got —
the **carry Mac**, a **Surface**, any number — and keep them all in sync without
ever colliding. Git is the only moving part. Any machine that can reach GitHub
can join the mesh; no server, no special networking (works over plain internet
or your Tailscale mesh alike).

## How it works (the three ideas)

1. **Git is the sync layer.** Every machine pushes/pulls the same repo
   (`AIXMOS537/TMMT`). `scripts/sync-machine.sh` does the safe handshake
   (stash → rebase → push) — never force-pushing, never merging.
2. **A shared task board** lives on a remote-only branch, `swarm-coord`
   (file `board.tsv`). Any machine can `add` and `claim` tasks. Claims are
   **atomic** — if two machines grab at the same instant, one wins and the other
   retries, so a task is never worked twice.
3. **Each task runs in its own git worktree** — a separate checkout in
   `../TMMT-swarm/<id>` on branch `swarm/<machine>/<id>`. Agents edit different
   files in different folders, so a swarm never steps on itself. Each agent runs
   in its own **tmux** window (Mac/Linux/WSL) or **Windows Terminal** tab (Surface).

```
                 GitHub (origin)
        ┌──────────────┼───────────────┐      swarm-coord = shared task board
   carry-mac        surface          mini       (every machine, atomic claims)
      │ │              │ │              │
   t1  t2           t3  t4            t5      ← one Claude agent per task
      │                │                │
 ../TMMT-swarm/1 …  ../TMMT-swarm/3 …   …     ← isolated worktrees + branches
```

The naming is per-machine, so the mesh scales to as many computers as you want —
just give each a unique name.

## One-time setup — ONE command per device

Any new device joins the mesh and "learns what the mesh knows" with a single
command. It's idempotent and non-destructive — safe to re-run.

```bash
git clone https://github.com/AIXMOS537/TMMT.git ~/Projects/TMMT   # first time only
cd ~/Projects/TMMT
bash scripts/swarm-join.sh                 # interactive — asks for a unique name + git email
#   or non-interactive:
bash scripts/swarm-join.sh --name carry-mac --email you@personal.example
```

`swarm-join` does everything:
1. checks tooling for your OS and tells you what to install
2. sets this device's **unique mesh name** (`.swarm/machine`, git-ignored)
3. sets a **per-repo git commit identity** — important because your machines are
   on **different accounts** (see below); this keeps the audit trail honest
4. installs the **secret-guard git hooks**
5. makes sure `.env` is present (pulls from the key flashdrive on a Mac)
6. installs dependencies
7. **registers the device on the mesh** and runs the security doctor

### Per-OS notes

| OS | Notes |
|---|---|
| **macOS** (carry Mac / work Mac) | `brew install tmux` for the best swarm view. `.env` comes off the key flashdrive (`scripts/bootstrap-carry-mac.sh`). |
| **Linux / WSL** | `sudo apt install tmux`. Full tmux experience. Best choice for a Surface. |
| **Windows native** (Surface, Git Bash) | Install **Git for Windows** + **Windows Terminal**. No tmux, so agents open in WT tabs. Symlinks are usually blocked, so the swarm copies `.env` and runs `npm install` per worktree (first launch slower, then fast). |

> **Different accounts per machine (by design).** carry-mac and work-mac are on
> separate accounts for privacy/isolation. Two requirements:
> 1. **Each account must have push access** to `AIXMOS537/TMMT` (so it can write
>    the shared board + its `swarm/<machine>/*` branches). `swarm-doctor` checks
>    you can reach origin.
> 2. **Set a distinct git identity per repo** (swarm-join does this) so commits
>    are attributable to the right account. Nothing is shared between accounts
>    except the repo itself — secrets never travel through git.

> **Secrets:** the swarm provides each worktree your `.env` (symlink on Mac/Linux,
> copy on Windows) so agents can build. Keep `.env` current — it rides the **key
> flashdrive** (`CONTINUE-ON-CARRY-MAC.md`). `.env` and worktrees are never committed,
> and the pre-commit/pre-push hooks block them even if you try.

## Daily flow (same on every machine)

```bash
npm run sync:machine                                   # 1) always sync first
bash scripts/swarm.sh add "Wire Sentry DSN (E2)"       # 2) fill the shared backlog
bash scripts/swarm.sh add "Email notifications (Gap #10)"
bash scripts/swarm.sh up 2                             # 3) claim 2 + launch 2 agents HERE
#   carry-mac: up 2  ·  surface: up 2   → 4 agents across the mesh
tmux attach -t swarm        # Mac/Linux/WSL: watch agents (Ctrl-b n/p, Ctrl-b d to detach)
                            # Surface: each agent is a Windows Terminal tab
bash scripts/swarm.sh status                           # 5) whole board, every machine
gh pr create --base master --head swarm/carry-mac/4    # 6) review finished work as a PR
bash scripts/swarm.sh clean                            # 7) remove finished worktrees
```

Agents auto-run `swarm.sh done <id>` when finished (push their branch + mark the
board DONE).

## Command reference

| Command | What it does |
|---|---|
| `swarm-join.sh` | **Onboard this device** (tooling, identity, hooks, deps, register, audit) |
| `swarm-doctor.sh` | Security + readiness audit (PASS/WARN/FAIL). `--quick` skips deep scan |
| `swarm.sh mesh` | List every device on the mesh (name, OS, last seen) |
| `swarm.sh init <name>` | Name THIS machine; create board; register on the mesh |
| `swarm.sh add "<task>"` | Add a task to the shared backlog (any machine) |
| `swarm.sh list` | Show the board (every machine) |
| `swarm.sh claim [n]` | Atomically claim up to n TODO tasks for this machine |
| `swarm.sh up [n]` | Claim n **and** launch n agents (the swarm). Default 2 |
| `swarm.sh start <id>` | Launch one already-claimed task |
| `swarm.sh done <id>` | Push the task's branch + mark DONE (agents call this) |
| `swarm.sh status` | Board + this machine's active worktrees |
| `swarm.sh clean` | Remove worktrees for DONE tasks |
| `sync-machine.sh` | Sync current branch: stash → rebase → push (safe) |
| `sync-machine.sh status` | Show ahead/behind, worktrees, board (no changes) |
| `sync-machine.sh master` | Fast-forward `master` only |

npm aliases: `npm run swarm:join` · `swarm:doctor` · `swarm:mesh` · `swarm:status` · `sync:machine`.

### Phone alerts (SOS → your phone)

So `tmmt help` actually buzzes you, point it at Slack and/or Telegram once:

```bash
bash scripts/tmmt notify        # owner: paste a Slack webhook and/or Telegram token (one time)
bash scripts/tmmt notify-test   # confirm your phone buzzes
```

It stores them in `scripts/phase9-notify/.env.notify` (git-ignored, mode 600 —
never committed). If nothing's configured, an SOS still lands on the mesh board;
you just won't get the push.

## Toggles (env vars)

| Var | Effect |
|---|---|
| `SWARM_MACHINE=name` | Override this machine's name for one command |
| `SWARM_YOLO=1` | Agents run `--dangerously-skip-permissions` (autonomous — only for low-risk, well-scoped tasks; default is supervised) |
| `SWARM_LAUNCH=print\|tmux\|wt` | Force a launcher (default: auto-detect tmux → Windows Terminal → print) |
| `SWARM_INSTALL=1` | `npm install` per worktree instead of symlinking `node_modules` (forced automatically on Windows) |
| `SWARM_WORKTREE_BASE=/path` | Where worktrees live (default `../TMMT-swarm`) |

## Security model (defense in depth)

This is a production system with customer PII, contracts, and money flow, run
across machines on **separate accounts**. The threat we design against: a secret
or customer data leaking into git, or an agent quietly weakening a control.

**Layered controls:**

1. **Secrets never enter git.** `.env*` is git-ignored; the **pre-commit hook**
   blocks env files, private keys, and high-signal secret patterns (Supabase
   service-role key, GHL webhook secret, Airtable PAT, Stripe/Slack/Anthropic/
   GitHub tokens, AWS keys). The **pre-push hook** refuses to push if any secret
   file is tracked, and runs `gitleaks` over history when installed.
2. **Secrets travel only on the key flashdrive** — never through the repo, never
   between accounts. Owner-only; operators get zero-secret kits.
3. **Per-account attribution.** Each machine sets its own git identity, so every
   commit is traceable to the right account.
4. **Least privilege for agents.** Each agent is scoped to one branch in one
   worktree, is forbidden from weakening RLS / auth / zod validation / rate
   limiting / CSP / webhook signatures, and must STOP for any owner-only account
   action instead of inventing secrets.
5. **Nothing auto-merges.** Finished work lands as a branch + PR you review.
6. **Continuous audit.** `swarm-doctor` re-checks all of the above on demand.

**Owner-side (GitHub UI — do once per account/repo, from `ACTION-CHECKLIST.md` §A):**
branch protection on `master`, **2FA on every account**, **Secret Scanning +
Push Protection** ON. Install `gitleaks` on each machine for deep scanning
(`brew install gitleaks`). If a key drive is ever lost, rotate the Supabase
service-role key + `GHL_WEBHOOK_SECRET` and re-make the drive.

## Rules that keep it safe

- **Unique name per machine** — branches are `swarm/<machine>/<id>`, so no two
  computers can ever collide, even on the same task id.
- **Agents stay in their lane** — each prompt forbids touching `master` or other
  `swarm/*` branches and requires `npm run build && npm test && npm run lint`
  before pushing.
- **Owner gates respected** — agents STOP and report for any GHL / Vercel /
  Supabase / DNS action instead of guessing secrets (per `ACTION-CHECKLIST.md`).
- **Nothing auto-merges** — finished work lands as a branch + PR you review.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `tmux: command not found` (Mac/Linux) | `brew install tmux` / `apt install tmux`, or use `SWARM_LAUNCH=print` |
| Surface opens no tabs | Install **Windows Terminal** (Store), or use `SWARM_LAUNCH=print` and paste commands |
| `claude: command not found` | Install + log in the Claude Code CLI on that machine first |
| Symlink / `.env` errors on Windows | Expected — it auto-copies `.env` and installs deps per worktree; no action needed |
| Rebase conflict on sync | `sync-machine.sh` aborts cleanly and tells you; resolve in the worktree, re-run |
| Board looks stale | It's just a branch — re-run any `swarm.sh` command (they fetch first) |

---

*Companion: `CONTINUE-ON-CARRY-MAC.md` (move between Macs via the key drive) ·
`ACTION-CHECKLIST.md` (the backlog to feed the swarm) ·
`CLAUDE-CODE-RUNBOOK.md` (the revenue fast-track phases).*
