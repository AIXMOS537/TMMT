#!/usr/bin/env bash
# Shared helpers for the TMMT two-laptop agentic swarm.
# Sourced by scripts/swarm.sh and scripts/sync-machine.sh.
#
# Concepts:
#   - MACHINE   : a stable name per laptop (e.g. "work-mac", "carry-mac") so the
#                 two laptops never collide on branch names.
#   - COORD     : a remote-only branch ("swarm-coord") holding a shared task
#                 board (board.tsv). Claims are atomic via push-or-retry, so two
#                 laptops can grab tasks at the same time without duplicating.
#   - WORKTREE  : each task runs in its own git worktree (a sibling checkout),
#                 so a swarm of agents edits files in parallel, conflict-free.

set -euo pipefail

# Repo root (this file lives in scripts/lib/).
SWARM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COORD_BRANCH="swarm-coord"
BOARD_FILE="board.tsv"
# Worktrees live OUTSIDE the repo, as a sibling dir, so they never get committed.
WORKTREE_BASE="${SWARM_WORKTREE_BASE:-$(cd "$SWARM_ROOT/.." && pwd)/TMMT-swarm}"

if [[ -t 1 ]]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; RED=$'\e[31m'; GRN=$'\e[32m'
  YLW=$'\e[33m'; BLU=$'\e[34m'; RST=$'\e[0m'
else
  BOLD=; DIM=; RED=; GRN=; YLW=; BLU=; RST=
fi

say()  { printf '%s\n' "$*"; }
info() { printf '%s\n' "${BLU}›${RST} $*"; }
ok()   { printf '%s\n' "${GRN}✓${RST} $*"; }
warn() { printf '%s\n' "${YLW}!${RST} $*" >&2; }
die()  { printf '%s\n' "${RED}✗${RST} $*" >&2; exit 1; }

# Which OS are we on? The mesh is mixed: macOS (carry Mac), Linux/WSL, or
# Windows (a Surface running Git Bash). Behavior (launcher, symlinks) adapts.
swarm_os() {
  case "$(uname -s 2>/dev/null)" in
    Darwin) echo macos ;;
    Linux)  if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then echo wsl; else echo linux; fi ;;
    MINGW*|MSYS*|CYGWIN*) echo windows ;;
    *) echo unknown ;;
  esac
}

# Stable per-machine identity: $SWARM_MACHINE > .swarm/machine file > hostname.
# Every machine on the mesh MUST have a unique name (branches are swarm/<name>/<id>).
swarm_machine() {
  if [[ -n "${SWARM_MACHINE:-}" ]]; then printf '%s' "$SWARM_MACHINE"; return; fi
  local f="$SWARM_ROOT/.swarm/machine"
  if [[ -f "$f" ]]; then tr -d '[:space:]' < "$f"; return; fi
  hostname -s 2>/dev/null | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-'
}

# git push with exponential backoff (matches the repo's 4-try convention).
git_push_retry() {
  local i delay=2
  for i in 1 2 3 4; do
    if git push "$@"; then return 0; fi
    warn "push failed (attempt $i) — retrying in ${delay}s"
    sleep "$delay"; delay=$((delay * 2))
  done
  return 1
}

# Print the shared board (from origin). Empty if it doesn't exist yet.
board_read() {
  git fetch -q origin "$COORD_BRANCH" 2>/dev/null || true
  git show "origin/$COORD_BRANCH:$BOARD_FILE" 2>/dev/null || true
}

worktree_path() { printf '%s/%s' "$WORKTREE_BASE" "$1"; }
