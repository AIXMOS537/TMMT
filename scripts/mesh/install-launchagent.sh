#!/usr/bin/env bash
# install-launchagent — make this Mac stay on the mesh 24/7 in the BACKGROUND
# (no open Terminal window). Installs a macOS LaunchAgent that runs the presence
# loop at login and restarts it if it ever stops.
#
#   bash scripts/mesh/install-launchagent.sh install [role] [interval_secs]
#   bash scripts/mesh/install-launchagent.sh status
#   bash scripts/mesh/install-launchagent.sh logs
#   bash scripts/mesh/install-launchagent.sh uninstall
#
# role: owner | operator | agent   (default: owner)
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"

LABEL="com.tmmt.presence"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$SWARM_ROOT/.swarm/presence.log"

[[ "$(swarm_os)" == "macos" ]] || die "this installer is macOS-only (use Task Scheduler on Windows/BRAINIAC — ask me for the .ps1)."

cmd_install() {
  local role="${1:-owner}" interval="${2:-180}"
  mkdir -p "$HOME/Library/LaunchAgents" "$SWARM_ROOT/.swarm"
  # Resolve a usable PATH for the LaunchAgent context (Homebrew + system).
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
    <string>${SWARM_ROOT}/scripts/mesh/presence.sh</string>
    <string>loop</string>
    <string>${interval}</string>
    <string>${role}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>${SWARM_ROOT}</string>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>SWARM_ROLE</key><string>${role}</string>
    <key>PATH</key><string>${brewbin}/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict></plist>
PLIST
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  if launchctl load -w "$PLIST" 2>/dev/null; then
    ok "background presence installed: '$(swarm_machine)' as ${role}, every ${interval}s."
    say "It runs at login and restarts itself. No window needed."
    say "Check it:  bash scripts/mesh/install-launchagent.sh status"
  else
    warn "could not load the LaunchAgent — try: launchctl load -w \"$PLIST\""
  fi
}

cmd_uninstall() {
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  bash "$SWARM_ROOT/scripts/swarm.sh" beat "${SWARM_ROLE:-owner}" offline >/dev/null 2>&1 || true
  ok "background presence removed; marked offline."
}

cmd_status() {
  if launchctl list 2>/dev/null | grep -q "$LABEL"; then
    ok "background presence is INSTALLED and loaded."
    launchctl list | grep "$LABEL" | sed 's/^/   /'
  else
    warn "not installed. Run: bash scripts/mesh/install-launchagent.sh install owner"
  fi
  [[ -f "$LOG" ]] && { say "last log lines:"; tail -n 6 "$LOG" | sed 's/^/   /'; }
}

cmd_logs() { [[ -f "$LOG" ]] && tail -n 40 "$LOG" || warn "no log yet at $LOG"; }

case "${1:-status}" in
  install)   shift; cmd_install "${1:-owner}" "${2:-180}";;
  uninstall|remove) cmd_uninstall;;
  status)    cmd_status;;
  logs)      cmd_logs;;
  *) die "usage: install-launchagent.sh [install [role] [secs] | status | logs | uninstall]";;
esac
