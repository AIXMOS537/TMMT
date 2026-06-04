#!/usr/bin/env bash
# Enable both office LaunchAgents (git pull + dev server). Run in Terminal.app.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

bash "${REPO_ROOT}/scripts/enable-office-autopull.sh"
bash "${REPO_ROOT}/scripts/enable-office-dev-server.sh"
bash "${REPO_ROOT}/scripts/enable-flash-usb-sync.sh"
bash "${REPO_ROOT}/scripts/enable-flash-usb-pull.sh"

ENV_FILE="${REPO_ROOT}/scripts/office-agent-channel/.env"
if grep -q '^TELEGRAM_BOT_TOKEN=.\+' "$ENV_FILE" 2>/dev/null && \
   grep -q '^TELEGRAM_ALLOWED_CHAT_IDS=.\+' "$ENV_FILE" 2>/dev/null; then
  bash "${REPO_ROOT}/scripts/enable-telegram-owner-bot.sh"
else
  echo ""
  echo "Telegram bot: add token to scripts/office-agent-channel/.env then run:"
  echo "  bash ${REPO_ROOT}/scripts/configure-telegram-interactive.sh"
fi

echo ""
echo "Office services enabled: auto-pull + dev server + flash sync + flash pull (+ Telegram if .env set)."
