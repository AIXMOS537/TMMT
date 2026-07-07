#!/usr/bin/env bash
# install-sovereign-login.sh — at every login: apex tick (zero typing).
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh" 2>/dev/null || true

LABEL="com.tmmt.sovereign-login"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$SWARM_ROOT/.swarm/sovereign-login.log"

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
    <string>${SWARM_ROOT}/scripts/apex.sh</string>
    <string>tick</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict></plist>
PLIST
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load -w "$PLIST" 2>/dev/null || true
}

case "${1:-install}" in
  install) cmd_install ;;
  uninstall) launchctl unload "$PLIST" 2>/dev/null; rm -f "$PLIST" ;;
esac
