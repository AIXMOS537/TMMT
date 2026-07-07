#!/usr/bin/env bash
# memory-sync — stream HAILMARY's absorbed memory into BRAINIAC's Obsidian vault.
# Phase 3 of the mesh blueprint. PUSH-ONLY by design (M1 → vault): the agent
# writes memory, the vault is the read side. Git stays the durable source of
# truth for code/specs; Obsidian is the human-readable second brain.
#
#   bash scripts/mesh/memory-sync.sh once         sync now, one shot
#   bash scripts/mesh/memory-sync.sh loop [secs]  sync on a timer (default 300s)
#   bash scripts/mesh/memory-sync.sh install [secs]  macOS LaunchAgent (background)
#   bash scripts/mesh/memory-sync.sh uninstall
#   bash scripts/mesh/memory-sync.sh status
#
# Target vault: set HAILMARY_VAULT to an rsync destination reachable over
# Tailscale, e.g.  export HAILMARY_VAULT="brainiac:/Users/brainiac/Obsidian/HAILMARY"
# (a Tailscale SSH host:path). No secret values are ever in the memory files —
# scripts/hailmary scrubs them at capture time.
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh"

MEM_DIR="$SWARM_ROOT/.hailmary/memory"
LABEL="com.tmmt.memory-sync"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$SWARM_ROOT/.hailmary/memory-sync.log"

do_sync() {
  mkdir -p "$MEM_DIR"
  if [[ -z "${HAILMARY_VAULT:-}" ]]; then
    warn "HAILMARY_VAULT not set — memory stays owner-local at $MEM_DIR (nothing to push)."
    return 0
  fi
  command -v rsync >/dev/null 2>&1 || die "rsync not found — install it (brew install rsync)."
  # Push-only, archive, never delete on the far side (vault is append/accrete).
  if rsync -az --ignore-existing "$MEM_DIR"/ "$HAILMARY_VAULT"/ 2>>"$LOG"; then
    ok "memory synced → $HAILMARY_VAULT  ($(find "$MEM_DIR" -name 'absorb-*.md' 2>/dev/null | wc -l | tr -d ' ') snapshots)"
  else
    warn "vault sync failed (is BRAINIAC reachable on Tailscale? check: tailscale ping brainiac). See $LOG"
    return 1
  fi
}

cmd_loop() {
  local secs="${1:-300}"
  info "memory-sync loop every ${secs}s → ${HAILMARY_VAULT:-<unset>} (Ctrl-C to stop)"
  while :; do do_sync || true; sleep "$secs"; done
}

cmd_install() {
  [[ "$(swarm_os)" == "macos" ]] || die "installer is macOS-only (BRAINIAC/Windows: Task Scheduler — ask for the .ps1)."
  [[ -n "${HAILMARY_VAULT:-}" ]] || die "set HAILMARY_VAULT first (the Obsidian vault rsync target on BRAINIAC)."
  local secs="${1:-300}"
  mkdir -p "$HOME/Library/LaunchAgents" "$(dirname "$LOG")"
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
    <string>${SWARM_ROOT}/scripts/mesh/memory-sync.sh</string>
    <string>loop</string>
    <string>${secs}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>${SWARM_ROOT}</string>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HAILMARY_VAULT</key><string>${HAILMARY_VAULT}</string>
    <key>PATH</key><string>${brewbin}/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict></plist>
PLIST
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  if launchctl load -w "$PLIST" 2>/dev/null; then
    ok "memory-sync installed: pushing every ${secs}s → $HAILMARY_VAULT"
    say "Runs at login, restarts itself. Check: bash scripts/mesh/memory-sync.sh status"
  else
    warn "could not load LaunchAgent — try: launchctl load -w \"$PLIST\""
  fi
}

cmd_uninstall() {
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  ok "memory-sync removed (memory files kept locally)."
}

cmd_status() {
  if launchctl list 2>/dev/null | grep -q "$LABEL"; then ok "memory-sync INSTALLED."
  else warn "not installed. Run: bash scripts/mesh/memory-sync.sh install"; fi
  say "vault target: ${HAILMARY_VAULT:-<unset>}"
  [[ -f "$LOG" ]] && { say "last log:"; tail -n 5 "$LOG" | sed 's/^/   /'; }
}

case "${1:-once}" in
  once|now)        do_sync;;
  loop)            shift; cmd_loop "${1:-300}";;
  install)         shift; cmd_install "${1:-300}";;
  uninstall|remove) cmd_uninstall;;
  status)          cmd_status;;
  *) die "usage: memory-sync.sh [once | loop [secs] | install [secs] | uninstall | status]";;
esac
