#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="${HOME}/Library/LaunchAgents/com.aixmos.tmmt-telegram-owner-bot.plist"
LABEL="com.aixmos.tmmt-telegram-owner-bot"

if [[ ! -f "${REPO_ROOT}/scripts/office-agent-channel/.env" ]]; then
  echo "Create ${REPO_ROOT}/scripts/office-agent-channel/.env from .env.example first."
  exit 1
fi

bash "${REPO_ROOT}/scripts/install-telegram-owner-bot.sh"
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST" 2>/dev/null || true
launchctl enable "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || true
echo "Telegram owner bot enabled. Log: ~/Library/Logs/tmmt-telegram-owner-bot.log"
