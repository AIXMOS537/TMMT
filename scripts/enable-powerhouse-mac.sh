#!/usr/bin/env bash
# Office / travel Mac: start all TMMT background services + one immediate flash cycle.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== TMMT powerhouse Mac — enabling services ==="
if ! bash "${REPO_ROOT}/scripts/usb-write-test.sh" 2>/dev/null; then
  echo ""
  echo "USB write test FAILED — opening Full Disk Access settings…"
  bash "${REPO_ROOT}/scripts/open-full-disk-access-settings.sh" || true
  echo "After enabling Terminal + /bin/bash, run this script again."
  echo ""
fi
bash "${REPO_ROOT}/scripts/enable-office-services.sh"

ENV_FILE="${REPO_ROOT}/scripts/office-agent-channel/.env"
if grep -q '^TELEGRAM_BOT_TOKEN=.\+' "$ENV_FILE" 2>/dev/null && \
   grep -q '^TELEGRAM_ALLOWED_CHAT_IDS=.\+' "$ENV_FILE" 2>/dev/null; then
  bash "${REPO_ROOT}/scripts/enable-telegram-owner-bot.sh"
else
  echo ""
  echo "Telegram: .env missing token or chat IDs."
  echo "  Run: bash ${REPO_ROOT}/scripts/configure-telegram-interactive.sh"
fi

echo ""
echo "=== Immediate flash pull + sync (dock mounted) ==="
TMMT_FORCE_FLASH_PULL=1 bash "${REPO_ROOT}/scripts/pull-from-flash-drives.sh" || true
TMMT_FORCE_DOCK_SYNC=1 bash "${REPO_ROOT}/scripts/sync-all-flash-drives.sh" || true

echo ""
bash "${REPO_ROOT}/scripts/verify-office-services.sh"
