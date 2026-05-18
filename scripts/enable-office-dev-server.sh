#!/usr/bin/env bash
# Run once in Terminal.app:
#   ~/dev/TMMT/scripts/enable-office-dev-server.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="${HOME}/Library/LaunchAgents/com.aixmos.tmmt-dev-server.plist"
LABEL="com.aixmos.tmmt-dev-server"
GUI_DOMAIN="gui/$(id -u)"

bash "${REPO_ROOT}/scripts/install-office-dev-server.sh"

if [[ ! -f "${REPO_ROOT}/tmmt-os/.env.local" ]]; then
  echo "WARNING: ${REPO_ROOT}/tmmt-os/.env.local is missing. Dev server will crash until you add it."
fi

plutil -lint "$PLIST"

launchctl bootout "${GUI_DOMAIN}/${LABEL}" 2>/dev/null || true
launchctl bootstrap "$GUI_DOMAIN" "$PLIST"
launchctl enable "${GUI_DOMAIN}/${LABEL}"
launchctl kickstart -k "${GUI_DOMAIN}/${LABEL}" 2>/dev/null || true

echo ""
echo "Dev server LaunchAgent enabled."
echo "  Log:  ~/Library/Logs/tmmt-dev.log"
echo "  Local: http://127.0.0.1:3000"
echo "  Tailscale: http://<your-mac-tailscale-name>:3000"
echo ""
echo "Stop:  launchctl bootout ${GUI_DOMAIN}/${LABEL}"
echo "Tail:  tail -f ~/Library/Logs/tmmt-dev.log"
