#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_LABEL="com.aixmos.tmmt-remote-command-server"
PLIST_PATH="${HOME}/Library/LaunchAgents/${PLIST_LABEL}.plist"
SERVER="${REPO_ROOT}/scripts/office-agent-channel/remote_command_server.py"
PYTHON="${TMMT_PYTHON:-/Library/Frameworks/Python.framework/Versions/3.14/bin/python3}"
[[ -x "$PYTHON" ]] || PYTHON="$(command -v python3)"
LOG="${HOME}/Library/Logs/tmmt-remote-command-server.log"

chmod +x "$SERVER"
mkdir -p "$(dirname "$LOG")"
touch "$LOG"

cat >"$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON}</string>
    <string>${SERVER}</string>
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
  <string>${LOG}</string>
  <key>StandardErrorPath</key>
  <string>${LOG}</string>
</dict>
</plist>
EOF
echo "Installed ${PLIST_PATH}"
