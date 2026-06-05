#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="${HOME}/Library/LaunchAgents/com.aixmos.tmmt-remote-command-server.plist"
LABEL="com.aixmos.tmmt-remote-command-server"
ENV_FILE="${REPO_ROOT}/scripts/office-agent-channel/.env"

if ! grep -q '^REMOTE_CMD_SECRET=.\+' "$ENV_FILE" 2>/dev/null; then
  SECRET="$(openssl rand -hex 16)"
  echo "REMOTE_CMD_SECRET=${SECRET}" >>"$ENV_FILE"
  echo "REMOTE_CMD_PORT=9876" >>"$ENV_FILE"
  echo "REMOTE_CMD_HOST=0.0.0.0" >>"$ENV_FILE"
  echo "REMOTE_REPLY_IMESSAGE=1" >>"$ENV_FILE"
  echo "Generated REMOTE_CMD_SECRET in .env"
fi

bash "${REPO_ROOT}/scripts/install-remote-command-server.sh"
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST" 2>/dev/null || true
launchctl enable "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || true
echo "Remote command server enabled on :9876 — log: ~/Library/Logs/tmmt-remote-command-server.log"
