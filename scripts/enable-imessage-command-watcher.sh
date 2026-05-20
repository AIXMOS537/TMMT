#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="${HOME}/Library/LaunchAgents/com.aixmos.tmmt-imessage-command-watcher.plist"
LABEL="com.aixmos.tmmt-imessage-command-watcher"
ENV_FILE="${REPO_ROOT}/scripts/office-agent-channel/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Create $ENV_FILE from .env.example first."
  exit 1
fi
if ! grep -q '^IMESSAGE_WATCHER_ENABLED=1' "$ENV_FILE" 2>/dev/null; then
  echo "Set IMESSAGE_WATCHER_ENABLED=1 (and IMESSAGE_ALLOWED_HANDLES) in $ENV_FILE before enabling."
  exit 1
fi

bash "${REPO_ROOT}/scripts/install-imessage-command-watcher.sh"
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST" 2>/dev/null || true
launchctl enable "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || true
echo "iMessage command watcher enabled. Grant Full Disk Access to /usr/bin/python3. Log: ~/Library/Logs/tmmt-imessage-watcher.log"
