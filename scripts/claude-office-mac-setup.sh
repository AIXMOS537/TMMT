#!/usr/bin/env bash
# TMMT office Mac — one-shot setup (flash dock + Telegram agent).
# Safe to run from Terminal or paste into Claude Code on the office Mac.
#
# Usage:
#   bash ~/dev/TMMT/scripts/claude-office-mac-setup.sh
#
# With Telegram secrets (owner provides these — never commit):
#   TELEGRAM_BOT_TOKEN='123:ABC' \
#   TELEGRAM_ALLOWED_CHAT_IDS='111,222' \
#   IMESSAGE_BUDDY='[phone removed]' \
#   TELEGRAM_REPLY_IMESSAGE=1 \
#   bash ~/dev/TMMT/scripts/claude-office-mac-setup.sh
#
# Skip flash copy (services only):
#   TMMT_SETUP_SKIP_FLASH=1 bash ~/dev/TMMT/scripts/claude-office-mac-setup.sh

set -euo pipefail

REPO="${TMMT_REPO:-$HOME/dev/TMMT}"
ENV_FILE="${REPO}/scripts/office-agent-channel/.env"
ENV_EXAMPLE="${REPO}/scripts/office-agent-channel/.env.example"
LOG_DIR="${HOME}/Library/Logs"
INBOX="${HOME}/Documents/TMMT-Flash-Inbox/current"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ -d "$REPO" ]] || die "Repo not found at $REPO — clone or symlink ~/dev/TMMT first."
cd "$REPO"

log "=== TMMT office Mac setup ==="
log "Repo: $REPO"

# --- 1) Flash volumes ---
log "--- Step 1: Flash volumes ---"
MOUNTED=()
for v in AIXMOS02 AIX-CARRY LEXAR AIX-HOME-PC CYBORG AIX-INVESTORS; do
  [[ -d "/Volumes/$v" ]] && MOUNTED+=("$v")
done
if ((${#MOUNTED[@]})); then
  log "Mounted: ${MOUNTED[*]}"
else
  log "No target flash volumes mounted (OK if setting up Telegram only)."
  log "Expected names: AIXMOS02, CYBORG, LEXAR (or AIX-CARRY, AIX-INVESTORS, AIX-HOME-PC)"
fi

# --- 2) Office services ---
log "--- Step 2: Office LaunchAgents ---"
chmod +x scripts/*.sh scripts/office-agent-channel/*.sh scripts/office-agent-channel/*.py 2>/dev/null || true
xattr -dr com.apple.quarantine "$REPO/scripts" 2>/dev/null || true

bash scripts/enable-office-autopull.sh 2>/dev/null || log "WARN: enable-office-autopull failed (may need Full Disk Access)"
bash scripts/enable-office-dev-server.sh 2>/dev/null || log "WARN: enable-office-dev-server failed"
bash scripts/enable-flash-usb-sync.sh 2>/dev/null || log "WARN: enable-flash-usb-sync failed"
bash scripts/enable-flash-usb-pull.sh 2>/dev/null || log "WARN: enable-flash-usb-pull failed"

# --- 3) Telegram .env ---
log "--- Step 3: Telegram agent .env ---"
mkdir -p "$(dirname "$ENV_FILE")"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  log "Created $ENV_FILE from .env.example"
fi

write_env_var() {
  local key="$1" val="$2"
  [[ -z "$val" ]] && return 0
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # macOS sed -i ''
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >>"$ENV_FILE"
  fi
}

write_env_var "TELEGRAM_BOT_TOKEN" "${TELEGRAM_BOT_TOKEN:-}"
write_env_var "TELEGRAM_ALLOWED_CHAT_IDS" "${TELEGRAM_ALLOWED_CHAT_IDS:-}"
write_env_var "IMESSAGE_BUDDY" "${IMESSAGE_BUDDY:-}"
[[ -n "${TELEGRAM_REPLY_IMESSAGE:-}" ]] && write_env_var "TELEGRAM_REPLY_IMESSAGE" "${TELEGRAM_REPLY_IMESSAGE}"

if grep -q '^TELEGRAM_BOT_TOKEN=$' "$ENV_FILE" || grep -q '^TELEGRAM_BOT_TOKEN=\s*$' "$ENV_FILE"; then
  log "TELEGRAM_BOT_TOKEN still empty in $ENV_FILE"
  log "Owner must fill: BotFather token, chat IDs (@userinfobot), optional IMESSAGE_BUDDY"
  log "Then re-run: bash scripts/enable-telegram-owner-bot.sh"
else
  bash scripts/install-telegram-owner-bot.sh
  bash scripts/enable-telegram-owner-bot.sh 2>/dev/null || log "WARN: Telegram bot enable failed — check Full Disk Access for python3"
  log "Telegram bot enabled. Test with /help on Telegram."
fi

# --- 4) Flash pull + sync (if mounted) ---
if [[ -z "${TMMT_SETUP_SKIP_FLASH:-}" ]] && ((${#MOUNTED[@]})); then
  log "--- Step 4: Flash pull + sync (may take several minutes) ---"
  TMMT_FORCE_FLASH_PULL=1 bash scripts/pull-from-flash-drives.sh || log "WARN: pull had errors (USB temp files are common — re-run pull)"
  TMMT_FORCE_DOCK_SYNC=1 bash scripts/sync-all-flash-drives.sh || log "WARN: sync had errors — re-run when dock is idle"
else
  log "--- Step 4: Skipped flash copy ---"
fi

# --- 5) Health ---
log "--- Step 5: Health check ---"
bash scripts/verify-office-services.sh || true

log "=== Done ==="
log "Inbox:  $INBOX"
log "Logs:   $LOG_DIR/tmmt-flash-usb-pull.log"
log "        $LOG_DIR/tmmt-flash-usb-sync.log"
log "        $LOG_DIR/tmmt-telegram-owner-bot.log"
log "Agent doc: $REPO/docs/AGENT_HANDOFF_ONE_PAGER.md"

if [[ -d "$INBOX" ]]; then
  du -sh "$INBOX"/* 2>/dev/null || true
fi

if grep -q '^TELEGRAM_BOT_TOKEN=$' "$ENV_FILE" 2>/dev/null; then
  log "NEXT: Edit $ENV_FILE then: bash scripts/enable-telegram-owner-bot.sh"
  exit 2
fi

exit 0
