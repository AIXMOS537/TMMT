#!/usr/bin/env bash
# Production deploy step for office Mac spine (launchd, every 5 min).
# Pulls the deploy branch; if HEAD moved (or no build exists), rebuilds and
# restarts the prod server. Replaces the dev-mode hot-reload that `next dev` gave.

set -euo pipefail

REPO_ROOT="${TMMT_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
OS_DIR="${REPO_ROOT}/tmmt-os"
BRANCH="$(cat "$REPO_ROOT/scripts/default-branch" 2>/dev/null || echo main)"
LOG="${HOME}/Library/Logs/tmmt-prod-deploy.log"
SERVER_LABEL="gui/$(id -u)/com.aixmos.tmmt-prod-server"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"
export NODE_ENV=production

{
  echo "---- $(date -Iseconds) ----"
  cd "$REPO_ROOT"

  if [[ -n "$(git status --porcelain)" ]]; then
    echo "SKIP: dirty working tree"
    exit 0
  fi

  BEFORE="$(git rev-parse HEAD)"
  git fetch origin -q
  git pull --rebase origin "$BRANCH" -q && echo "OK: pulled $BRANCH"
  AFTER="$(git rev-parse HEAD)"

  cd "$OS_DIR"

  if [[ "$BEFORE" != "$AFTER" || ! -f .next/BUILD_ID ]]; then
    echo "CHANGED: ${BEFORE:0:8} -> ${AFTER:0:8} — rebuilding"
    # Reinstall deps only when the lockfile actually changed.
    if ! git diff --quiet "$BEFORE" "$AFTER" -- package-lock.json 2>/dev/null; then
      echo "lockfile changed — npm ci"
      npm ci
    fi
    if npm run build; then
      echo "BUILD OK — restarting server"
      launchctl kickstart -k "$SERVER_LABEL" && echo "RESTARTED"
    else
      echo "BUILD FAILED — leaving current server running on old build"
      exit 1
    fi
  else
    echo "no changes"
  fi
} >>"$LOG" 2>&1
