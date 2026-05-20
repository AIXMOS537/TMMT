#!/usr/bin/env bash
# Enable automatic Mac → AIXMOS02 flash sync when USB is plugged in.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="${HOME}/Library/LaunchAgents/com.aixmos.tmmt-flash-usb-sync.plist"
LABEL="com.aixmos.tmmt-flash-usb-sync"
GUI_DOMAIN="gui/$(id -u)"

bash "${REPO_ROOT}/scripts/install-flash-usb-sync.sh"

plutil -lint "$PLIST"

launchctl bootout "${GUI_DOMAIN}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "$GUI_DOMAIN" "$PLIST"
launchctl enable "${GUI_DOMAIN}/${LABEL}"
launchctl kickstart -k "${GUI_DOMAIN}/${LABEL}" 2>/dev/null || true

echo ""
echo "Flash USB sync enabled (checks every 2 minutes when logged in)."
echo "  Volume: /Volumes/$(tr -d '[:space:]' <"${REPO_ROOT}/scripts/flash-usb-volume-name")"
echo "  Log:    ~/Library/Logs/tmmt-flash-usb-sync.log"
echo "  Manual: bash ${REPO_ROOT}/scripts/sync-all-flash-drives.sh"
echo ""
