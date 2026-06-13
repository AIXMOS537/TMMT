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

## One-time setup (per machine)

### macOS (carry Mac) / Linux / WSL
```bash
# Prereqs: git, tmux, and the `claude` CLI on PATH
#   macOS:  brew install tmux
cd ~/Projects/TMMT
git pull origin master
bash scripts/swarm.sh init carry-mac        # UNIQUE name per machine
```

### Windows (Surface)
Two good options:

- **Best: WSL** (Ubuntu) — then follow the Linux steps above (`sudo apt install tmux`,
  install the `claude` CLI inside WSL). You get the full tmux experience.
- **Native Git Bash** — install **Git for Windows** (gives Git Bash) and
  **Windows Terminal** from the Store. Then:
  ```bash
  cd ~/Projects/TMMT          # in Git Bash
  git pull origin master
  bash scripts/swarm.sh init surface
  ```
  No tmux on native Git Bash, so the swarm opens each agent in its own **Windows
  Terminal tab** automatically. If Windows Terminal isn't found, it prints the
  command to paste. Symlinks may be blocked on Windows, so the swarm **copies
  `.env` and runs `npm install` per worktree** instead — the first launch on a
  Surface is slower, then it's fast.

`init` records the name in `.swarm/machine` (git-ignored) and creates the board
on `origin/swarm-coord` the first time any machine runs it.

> **Secrets:** the swarm provides each worktree your `.env` (symlink on Mac/Linux,
> copy on Windows) so agents can build. Keep `.env` current — it rides the **key
> flashdrive** (`CONTINUE-ON-CARRY-MAC.md`). `.env` and worktrees are never committed.

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
| `swarm.sh init <name>` | Name THIS machine; create the shared board |
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

## Toggles (env vars)

| Var | Effect |
|---|---|
| `SWARM_MACHINE=name` | Override this machine's name for one command |
| `SWARM_YOLO=1` | Agents run `--dangerously-skip-permissions` (autonomous — only for low-risk, well-scoped tasks; default is supervised) |
| `SWARM_LAUNCH=print\|tmux\|wt` | Force a launcher (default: auto-detect tmux → Windows Terminal → print) |
| `SWARM_INSTALL=1` | `npm install` per worktree instead of symlinking `node_modules` (forced automatically on Windows) |
| `SWARM_WORKTREE_BASE=/path` | Where worktrees live (default `../TMMT-swarm`) |

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
