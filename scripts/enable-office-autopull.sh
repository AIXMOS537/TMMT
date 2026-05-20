#!/usr/bin/env bash
# Run once in Terminal.app (not inside Cursor's sandboxed shell):
#   ~/dev/TMMT/scripts/enable-office-autopull.sh

set -euo pipefail

PLIST="${HOME}/Library/LaunchAgents/com.aixmos.tmmt-git-pull.plist"
LABEL="com.aixmos.tmmt-git-pull"
GUI_DOMAIN="gui/$(id -u)"

if [[ ! -f "$PLIST" ]]; then
  echo "Missing plist. Run: ~/dev/TMMT/scripts/install-office-autopull.sh"
  exit 1
fi

plutil -lint "$PLIST"

launchctl bootout "${GUI_DOMAIN}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "$GUI_DOMAIN" "$PLIST"
launchctl enable "${GUI_DOMAIN}/${LABEL}"
launchctl kickstart -k "${GUI_DOMAIN}/${LABEL}" 2>/dev/null || true

echo ""
echo "Auto-pull enabled (every 5 minutes when logged in)."
echo "Log: ~/Library/Logs/tmmt-git-pull.log"
launchctl print "${GUI_DOMAIN}/${LABEL}" 2>/dev/null | head -15 || launchctl list | grep tmmt || true
