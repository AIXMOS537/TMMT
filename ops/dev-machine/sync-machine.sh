#!/usr/bin/env bash
# Pull latest TMMT code on office/home. Safe to run from cron/launchd.
set -euo pipefail

# --- configure per machine (or export before running) ---
TMMT_ROOT="${TMMT_ROOT:-$HOME/dev/TMMT}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SYNC_MODE="${SYNC_MODE:-code}"   # code | dev
LOG_DIR="${LOG_DIR:-$HOME/Library/Logs/tmmt-sync}"
LOCK_FILE="${LOCK_FILE:-/tmp/tmmt-sync.lock}"

mkdir -p "$LOG_DIR"
exec >>"$LOG_DIR/sync-$(date +%Y%m%d).log" 2>&1

echo "=== $(date -Iseconds) sync-machine ($SYNC_MODE) ==="

if [[ ! -d "$TMMT_ROOT/.git" ]]; then
  echo "ERROR: $TMMT_ROOT is not a git clone. Run bootstrap-macos.sh first."
  exit 1
fi

if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  echo "Another sync is running; exit."
  exit 0
fi
trap 'rmdir "$LOCK_FILE" 2>/dev/null || true' EXIT

cd "$TMMT_ROOT"
git fetch origin --prune
git checkout "$GIT_BRANCH"
git pull --ff-only origin "$GIT_BRANCH"

if [[ "$SYNC_MODE" == "dev" ]]; then
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
  elif command -v mise >/dev/null 2>&1; then
    eval "$(mise activate bash)"
  fi

  if [[ -f tmmt-os/package-lock.json ]]; then
    (cd tmmt-os && npm ci)
  fi
  echo "Dev mode: dependencies installed. Start dev manually or use start-dev.sh."
fi

echo "OK: $(git rev-parse --short HEAD) on $GIT_BRANCH"
