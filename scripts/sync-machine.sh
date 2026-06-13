#!/usr/bin/env bash
# Keep two laptops in sync. Safe to run any time, on any branch.
#
# Usage:
#   bash scripts/sync-machine.sh            # sync the CURRENT branch (stash → rebase → push)
#   npm run sync:machine                     # same
#   bash scripts/sync-machine.sh status      # just show where things stand (no changes)
#   bash scripts/sync-machine.sh master      # fast-forward master only
#
# It NEVER force-pushes and NEVER merges; on conflict it stops cleanly and tells
# you what to do. Run it at the start and end of every work block on each laptop.

set -euo pipefail
source "$(dirname "$0")/lib/swarm-common.sh"
cd "$SWARM_ROOT"

show_status() {
  local cur; cur="$(git branch --show-current 2>/dev/null || echo DETACHED)"
  info "machine: ${BOLD}$(swarm_machine)${RST}   branch: ${BOLD}${cur}${RST}"
  git fetch -q origin 2>/dev/null || warn "fetch failed (offline?)"
  local up
  if up="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
    local counts; counts="$(git rev-list --left-right --count "${up}...HEAD" 2>/dev/null || echo '0	0')"
    say "   vs ${up}: $(awk '{print $2" ahead, "$1" behind"}' <<<"$counts")"
  else
    say "   (no upstream set for ${cur})"
  fi
  say ""
  info "worktrees (parallel agents):"
  git worktree list | sed 's/^/   /'
  say ""
  info "swarm board:"
  local b; b="$(board_read)"
  if [[ -n "$b" ]]; then
    printf '%s\n' "$b" | awk -F'\t' 'NR==1{next}{printf "   #%-3s %-8s %-12s %s\n",$1,$2,$3,$5}'
  else
    say "   (none yet — start one with: bash scripts/swarm.sh add \"a task\")"
  fi
}

sync_current() {
  local cur; cur="$(git branch --show-current)" \
    || die "detached HEAD — check out a branch first"

  local stashed=0
  if [[ -n "$(git status --porcelain)" ]]; then
    info "stashing local changes…"
    git stash push -u -q -m "sync-machine auto $(date +%s)"
    stashed=1
  fi

  info "fetching…"
  git fetch -q origin

  if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    info "rebasing ${cur} onto its upstream…"
    if ! git rebase -q '@{u}'; then
      git rebase --abort || true
      [[ $stashed -eq 1 ]] && git stash pop -q 2>/dev/null || true
      die "rebase hit a conflict vs upstream — resolve manually, then re-run."
    fi
  else
    info "no upstream; rebasing onto origin/master…"
    if ! git rebase -q origin/master; then
      git rebase --abort || true
      [[ $stashed -eq 1 ]] && git stash pop -q 2>/dev/null || true
      die "rebase hit a conflict vs origin/master — resolve manually, then re-run."
    fi
  fi

  info "pushing ${cur}…"
  git_push_retry -u origin "$cur" || warn "push failed (offline?) — your commits are safe locally."

  if [[ $stashed -eq 1 ]]; then
    info "restoring your stashed changes…"
    git stash pop -q || warn "stash pop conflicted — see 'git stash list' and resolve."
  fi
  ok "synced ${cur}"
}

case "${1:-current}" in
  status|--status) show_status ;;
  master|--master)
    git fetch -q origin
    git checkout -q master
    git pull -q --ff-only origin master && ok "master up to date"
    ;;
  current|--current|"") sync_current; say ""; show_status ;;
  *) die "unknown option '$1' (use: status | master | current)" ;;
esac
