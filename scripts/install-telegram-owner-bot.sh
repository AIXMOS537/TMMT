#!/usr/bin/env bash
# Install LaunchAgent: Telegram owner bot (long-poll).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.aixmos.tmmt-telegram-owner-bot"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
BOT="${REPO_ROOT}/scripts/office-agent-channel/telegram_owner_bot.py"
LOG_DIR="${HOME}/Library/Logs"

chmod +x "${REPO_ROOT}/scripts/office-agent-channel/imessage_send.sh"
chmod +x "$BOT"
mkdir -p "$LOG_DIR"
touch "${LOG_DIR}/tmmt-telegram-owner-bot.log"

cat >"$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>${BOT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>TMMT_REPO_ROOT</key>
    <string>${REPO_ROOT}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/tmmt-telegram-owner-bot.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/tmmt-telegram-owner-bot.log</string>
  </dict>
</plist>
EOF

echo "Installed ${PLIST_PATH}"
echo "Log: ${LOG_DIR}/tmmt-telegram-owner-bot.log"
echo "Copy scripts/office-agent-channel/.env.example → .env and fill TELEGRAM_*"
echo "Enable: ${REPO_ROOT}/scripts/enable-telegram-owner-bot.sh"
