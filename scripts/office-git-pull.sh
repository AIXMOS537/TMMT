#!/usr/bin/env bash
# Lightweight pull for office Mac (launchd). No npm ci — keeps it fast and quiet.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="$(cat "$REPO_ROOT/scripts/default-branch" 2>/dev/null || echo main)"
LOG="${HOME}/Library/Logs/tmmt-git-pull.log"

{
  echo "---- $(date -Iseconds) ----"
  cd "$REPO_ROOT"
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "SKIP: dirty working tree"
    exit 0
  fi
  git fetch origin -q
  git pull --rebase origin "$BRANCH" -q && echo "OK: pulled $BRANCH"
} >>"$LOG" 2>&1
