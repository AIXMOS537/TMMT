#!/usr/bin/env bash
# install-forever-loop.sh — macOS LaunchAgent for autonomous mesh ticks.
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"

LABEL="com.tmmt.forever-loop"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$SWARM_ROOT/.swarm/forever-loop.log"

[[ "$(swarm_os)" == "macos" ]] || die "macOS-only (Linux: systemd unit — see docs/FOREVER-LOOP.md)"

cmd_install() {
  local role="${1:-carry}" interval="${2:-180}"
  mkdir -p "$HOME/Library/LaunchAgents" "$SWARM_ROOT/.swarm"
  local brewbin=""
  [[ -x /opt/homebrew/bin/brew ]] && brewbin="/opt/homebrew/bin:"
  [[ -x /usr/local/bin/brew ]] && brewbin="${brewbin}/usr/local/bin:"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SWARM_ROOT}/scripts/mesh/forever-loop.sh</string>
    <string>loop</string>
    <string>${interval}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>${SWARM_ROOT}</string>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SWARM_ROLE</key><string>${role}</string>
    <key>FOREVER_INTERVAL</key><string>${interval}</string>
    <key>PATH</key><string>${brewbin}/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.local/bin</string>
  </dict>
</dict></plist>
PLIST
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  launchctl load -w "$PLIST" 2>/dev/null \
    && ok "forever-loop installed: ${role} every ${interval}s" \
    || warn "load failed — try: launchctl load -w \"$PLIST\""
}

cmd_uninstall() {
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  ok "forever-loop removed"
}

cmd_status() {
  launchctl list 2>/dev/null | grep "$LABEL" && ok "loaded" || warn "not loaded"
  bash "$SWARM_ROOT/scripts/mesh/forever-loop.sh" status
}

case "${1:-status}" in
  install) shift; cmd_install "${1:-carry}" "${2:-180}";;
  uninstall|remove) cmd_uninstall;;
  status) cmd_status;;
  *) die "usage: install-forever-loop.sh [install [role] [secs] | status | uninstall]";;
esac
