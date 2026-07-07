#!/usr/bin/env bash
# install-heartbeat-watch.sh — device heartbeat every 60s (fleet board).
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh" 2>/dev/null || true

LABEL="com.tmmt.heartbeat-watch"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$SWARM_ROOT/.swarm/heartbeat-watch.log"

[[ "$(swarm_os)" == "macos" ]] || exit 0

cmd_install() {
  mkdir -p "$HOME/Library/LaunchAgents" "$SWARM_ROOT/.swarm"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SWARM_ROOT}/scripts/heartbeat.sh</string>
    <string>watch</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>${SWARM_ROOT}</string>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict></plist>
PLIST
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load -w "$PLIST" 2>/dev/null || true
}

case "${1:-install}" in
  install) cmd_install ;;
  uninstall) launchctl unload "$PLIST" 2>/dev/null; rm -f "$PLIST" ;;
esac
