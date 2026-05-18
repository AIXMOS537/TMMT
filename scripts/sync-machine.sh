#!/usr/bin/env bash
# Sync local TMMT checkout with GitHub and refresh dependencies.
# macOS (office M1 or any Mac): ~/dev/TMMT/scripts/sync-machine.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="$(cat "$REPO_ROOT/scripts/default-branch" 2>/dev/null || echo main)"
OS_DIR="$REPO_ROOT/tmmt-os"

echo "==> TMMT sync @ $REPO_ROOT"
cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "WARNING: Uncommitted changes. Commit or stash before pulling on another machine."
  git status -sb
fi

git fetch origin
git pull --rebase origin "$BRANCH"

if [[ -f "$OS_DIR/package-lock.json" ]]; then
  echo "==> npm ci (tmmt-os)"
  (
    cd "$OS_DIR"
    if command -v fnm >/dev/null 2>&1; then
      eval "$(fnm env)"
      fnm use 2>/dev/null || fnm install
    elif command -v mise >/dev/null 2>&1; then
      mise install -y
    fi
    npm ci
  )
fi

echo "==> Done. Branch: $(git branch --show-current)"
