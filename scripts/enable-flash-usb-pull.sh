#!/usr/bin/env bash
# Enable automatic flash → Mac pull when USB volumes are mounted.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="${HOME}/Library/LaunchAgents/com.aixmos.tmmt-flash-usb-pull.plist"
LABEL="com.aixmos.tmmt-flash-usb-pull"

bash "${REPO_ROOT}/scripts/install-flash-usb-pull.sh"

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST" 2>/dev/null || true
launchctl enable "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || true

plutil -lint "$PLIST" 2>/dev/null || true

echo ""
echo "Flash → Mac pull enabled (checks every 2 minutes when logged in)."
echo "  Inbox:  ~/Documents/TMMT-Flash-Inbox/current/"
echo "  Log:    ~/Library/Logs/tmmt-flash-usb-pull.log"
echo "  Manual: TMMT_FORCE_FLASH_PULL=1 bash ${REPO_ROOT}/scripts/pull-from-flash-drives.sh"
