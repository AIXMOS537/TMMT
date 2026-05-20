#!/usr/bin/env bash
# Install office auto-pull (every 15 min). Edit plist TMMT_ROOT / GIT_BRANCH first.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.tmmt.sync.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.tmmt.sync.plist"
SYNC_SCRIPT="$REPO_ROOT/ops/dev-machine/sync-machine.sh"

TMMT_ROOT="${TMMT_ROOT:-$HOME/dev/TMMT}"
GIT_BRANCH="${GIT_BRANCH:-main}"
SYNC_MODE="${SYNC_MODE:-code}"

chmod +x "$SYNC_SCRIPT" "$SCRIPT_DIR/bootstrap-macos.sh"

LOG_DIR="$HOME/Library/Logs/tmmt-sync"
mkdir -p "$LOG_DIR"

sed \
  -e "s|__TMMT_ROOT__|$TMMT_ROOT|g" \
  -e "s|__GIT_BRANCH__|$GIT_BRANCH|g" \
  -e "s|__SYNC_MODE__|$SYNC_MODE|g" \
  -e "s|__SYNC_SCRIPT__|$SYNC_SCRIPT|g" \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  "$PLIST_SRC" >"$PLIST_DST"

launchctl bootout "gui/$(id -u)/com.tmmt.sync" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/com.tmmt.sync"
launchctl kickstart -k "gui/$(id -u)/com.tmmt.sync"

echo "Installed $PLIST_DST (every 15 min, mode=$SYNC_MODE)"
echo "Logs: ~/Library/Logs/tmmt-sync/"
