#!/usr/bin/env bash
# Reload LaunchAgents that need Full Disk Access (run AFTER enabling bash/Terminal/sqlite3).
set -euo pipefail

UID_NUM="$(id -u)"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

reload() {
  local label="$1"
  local plist="${HOME}/Library/LaunchAgents/${label}.plist"
  [[ -f "$plist" ]] || return 0
  launchctl bootout "gui/${UID_NUM}/${label}" 2>/dev/null || true
  launchctl bootstrap "gui/${UID_NUM}" "$plist" 2>/dev/null || launchctl load "$plist" 2>/dev/null || true
  launchctl enable "gui/${UID_NUM}/${label}" 2>/dev/null || true
  launchctl kickstart -k "gui/${UID_NUM}/${label}" 2>/dev/null || true
  echo "  reloaded $label"
}

echo "=== Reloading FDA-dependent agents ==="
reload com.tmmt.imessage-hands
reload com.tmmt.mac-brain-learn
reload com.aixmos.tmmt-imessage-command-watcher
reload com.aixmos.tmmt-flash-usb-sync

echo ""
echo "=== Quick health ==="
bash "${REPO_ROOT}/scripts/usb-write-test.sh" 2>/dev/null || true
"${HOME}/Desktop/imessage-hands/status.command" 2>/dev/null | head -12 || true
"${HOME}/Desktop/mac-brain/brain.command" status 2>/dev/null | head -8 || true
