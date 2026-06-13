# Two-Laptop Agentic Swarm — work 2x faster, in sync

Run a **swarm of Claude Code agents in parallel on each laptop**, and keep **two
laptops in sync** without ever colliding. Git is the only moving part — no
server, no extra account.

## How it works (the three ideas)

1. **Git is the sync layer.** Both laptops push/pull the same GitHub repo
   (`AIXMOS537/TMMT`). `scripts/sync-machine.sh` does the safe handshake
   (stash → rebase → push), never force-pushing, never merging.
2. **A shared task board** lives on a remote-only branch, `swarm-coord`
   (file `board.tsv`). Either laptop can `add` tasks and `claim` them. Claims are
   **atomic** — if both laptops grab at the same instant, one wins and the other
   retries, so a task is never worked twice.
3. **Each task runs in its own git worktree** — a separate checkout in
   `../TMMT-swarm/<id>` on branch `swarm/<laptop>/<id>`. Agents edit different
   files in different folders, so a swarm never steps on itself. Each agent runs
   in its own **tmux** window.

```
        GitHub (origin)
   ┌────────┴─────────┐         swarm-coord branch = shared task board
 work-mac          carry-mac
   │                  │
 swarm: t1 t2      swarm: t3 t4   ← tmux windows, one Claude agent each
   │   │              │   │
 ../TMMT-swarm/1 …   ../TMMT-swarm/3 …   ← isolated worktrees + branches
```

## One-time setup (each laptop, ~3 min)

```bash
# Prereqs: git, tmux, and the `claude` CLI on PATH; repo cloned to ~/Projects/TMMT
#   macOS:  brew install tmux
cd ~/Projects/TMMT
git pull origin master

# Name THIS laptop (use a DIFFERENT name on each one):
bash scripts/swarm.sh init work-mac      # on the other laptop:  ... init carry-mac
```

`init` records the name in `.swarm/machine` (git-ignored) and creates the shared
board on `origin/swarm-coord` the first time.

> Secrets: the swarm symlinks your `~/Projects/TMMT/.env` and `node_modules` into
> each worktree so agents can build. Keep `.env` current (it rides the **key
> flashdrive** — see `CONTINUE-ON-CARRY-MAC.md`). Worktrees and `.env` are never
> committed.

## Daily flow

```bash
# 1) Sync first (always)
npm run sync:machine

# 2) Fill the backlog (from EITHER laptop — it's shared)
bash scripts/swarm.sh add "Wire Sentry DSN (E2) + verify an error appears"
bash scripts/swarm.sh add "Email notifications for form confirmations (Gap #10)"
bash scripts/swarm.sh add "Create Supabase Storage bucket + surface uploaders (E4)"
bash scripts/swarm.sh add "Fix management@tmmtrentals.net bounce"

# 3) Spin up the swarm on THIS laptop (claim N tasks + launch N agents)
bash scripts/swarm.sh up 2          # work-mac grabs 2
#   …on the other laptop:  bash scripts/swarm.sh up 2   (carry-mac grabs the next 2)

# 4) Watch / steer the agents
tmux attach -t swarm                 # Ctrl-b n / p = next/prev agent · Ctrl-b d = detach

# 5) See the whole picture (both laptops)
bash scripts/swarm.sh status         # or: npm run swarm:status

# 6) When an agent finishes it auto-runs `swarm.sh done <id>` (pushes its branch
#    + marks the board DONE). You then open a PR:
gh pr create --base master --head swarm/work-mac/4

# 7) Tidy finished worktrees
bash scripts/swarm.sh clean
```

## Command reference

| Command | What it does |
|---|---|
| `swarm.sh init <name>` | Name this laptop; create the shared board |
| `swarm.sh add "<task>"` | Add a task to the shared backlog |
| `swarm.sh list` | Show the board (both laptops) |
| `swarm.sh claim [n]` | Atomically claim up to n TODO tasks for this laptop |
| `swarm.sh up [n]` | Claim n **and** launch n agents (the swarm). Default 2 |
| `swarm.sh start <id>` | Launch one already-claimed task |
| `swarm.sh done <id>` | Push the task's branch + mark it DONE (agents call this) |
| `swarm.sh status` | Board + this laptop's active worktrees |
| `swarm.sh clean` | Remove worktrees for DONE tasks |
| `sync-machine.sh` | Sync current branch: stash → rebase → push (safe) |
| `sync-machine.sh status` | Show ahead/behind, worktrees, board (no changes) |
| `sync-machine.sh master` | Fast-forward `master` only |

## Toggles (env vars)

| Var | Effect |
|---|---|
| `SWARM_MACHINE=name` | Override this laptop's name for one command |
| `SWARM_YOLO=1` | Launch agents with `--dangerously-skip-permissions` (autonomous — only for low-risk, well-scoped tasks; default is supervised) |
| `SWARM_LAUNCH=print` | Don't use tmux — just print the launch command per task |
| `SWARM_INSTALL=1` | `npm install` per worktree instead of symlinking `node_modules` |
| `SWARM_WORKTREE_BASE=/path` | Where worktrees live (default `../TMMT-swarm`) |

## Rules that keep it safe

- **Different name per laptop** — branches are `swarm/<laptop>/<id>`, so the two
  machines can never collide even on the same task id.
- **Agents stay in their lane** — each prompt forbids touching `master` or other
  `swarm/*` branches, and requires `npm run build && npm test && npm run lint`
  before pushing.
- **Owner gates respected** — agents STOP and report for any GHL / Vercel /
  Supabase / DNS action instead of guessing secrets (matches `ACTION-CHECKLIST.md`).
- **Nothing auto-merges** — finished work lands as a branch + PR you review.

## Troubleshooting

- **`tmux: command not found`** → `brew install tmux`, or run with
  `SWARM_LAUNCH=print` and paste the commands into your own terminals.
- **`claude: command not found`** → install/login the Claude Code CLI first.
- **Rebase conflict on sync** → `sync-machine.sh` aborts cleanly and tells you;
  resolve in the affected worktree, then re-run.
- **An agent needs deps that changed** → run with `SWARM_INSTALL=1` for that task,
  or `npm install` inside its worktree.
- **Board looks stale** → it's just a branch; `git fetch origin swarm-coord` or
  re-run any `swarm.sh` command (they fetch first).

---

*Companion: `CONTINUE-ON-CARRY-MAC.md` (move between Macs via the key drive) ·
`ACTION-CHECKLIST.md` (the backlog to feed the swarm) ·
`CLAUDE-CODE-RUNBOOK.md` (the revenue fast-track phases).*
