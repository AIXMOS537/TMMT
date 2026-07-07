#!/usr/bin/env bash
# purge-and-go.sh — factory fresh: wipe stale junk, keep only sovereign stack, boot clean.
# Treat every device as NEW. Safe on Mac + Linux (Git Bash on Windows).
#
#   bash PURGE-AND-GO.sh              # auto role
#   bash PURGE-AND-GO.sh carry        # owner Mac
#   bash PURGE-AND-GO.sh forge        # office/build Mac
#   bash PURGE-AND-GO.sh brain        # Brainiac
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROLE="${1:-}"
ARCHIVE="${HOME}/.config/tmmt/.purged-$(date +%Y%m%d-%H%M%S)"
UID_NUM="$(id -u 2>/dev/null || echo 501)"

log(){ printf '[purge] %s\n' "$*"; }
ok(){ log "✓ $*"; }

# Canonical agents ONLY — everything else gets unloaded + archived
KEEP_AGENTS="
com.tmmt.forever-loop
com.tmmt.router
com.tmmt.memory-sync
com.tmmt.voice-inbox
com.tmmt.heartbeat-watch
com.tmmt.sovereign-login
com.aixmos.hailmary
com.hailmary.litellm-local
com.hailmary.ccr
"

is_kept_agent(){
  local label="$1"
  for k in $KEEP_AGENTS; do
    [[ "$label" == "$k" ]] && return 0
  done
  return 1
}

purge_launchagents(){
  [[ "$(uname -s)" == Darwin ]] || return 0
  local la="$HOME/Library/LaunchAgents"
  [[ -d "$la" ]] || return 0
  mkdir -p "$ARCHIVE/LaunchAgents"
  for plist in "$la"/*.plist; do
    [[ -f "$plist" ]] || continue
    local base label
    base="$(basename "$plist" .plist)"
    label="$base"
    case "$base" in
      com.tmmt.*|com.aixmos.*|com.hailmary.*|com.sork.*|com.projectx.*) ;;
      *) continue ;;
    esac
    is_kept_agent "$label" && continue
    launchctl bootout "gui/$UID_NUM" "$plist" 2>/dev/null || launchctl unload "$plist" 2>/dev/null || true
    mv -f "$plist" "$ARCHIVE/LaunchAgents/" 2>/dev/null || true
    log "removed stale agent: $label"
  done
  ok "LaunchAgents cleaned (kept sovereign stack only)"
}

purge_stale_config(){
  local cfg="${HOME}/.config/tmmt"
  [[ -d "$cfg" ]] || return 0
  mkdir -p "$ARCHIVE/tmmt-config"
  # NEVER touch these
  local keep_pat='litellm-master\.env|\.owner-only|office-unlock\.secret|rick\.env|active-tier\.env|access-tiers\.env|sovereign\.env'
  for f in "$cfg"/*; do
    [[ -e "$f" ]] || continue
    local bn
    bn="$(basename "$f")"
    echo "$bn" | rg -q "$keep_pat" && continue
    [[ "$bn" == booyah.sh ]] && continue
    [[ "$bn" == forge.sh ]] && continue
    [[ "$bn" == god-mode.sh ]] && continue
    [[ "$bn" == x-forever.sh ]] && continue
    case "$bn" in
      booyah-*.env|booyah-*.txt|auto-deploy-*|*.log|*.err|QUARANTINE-*|CYBORG-*|FINISH-*|ROLE-SCOPE-*)
        mv -f "$f" "$ARCHIVE/tmmt-config/" 2>/dev/null && log "archived config: $bn"
        ;;
      .purged-*|.archived-*) ;;
    esac
  done
  ok "stale ~/.config/tmmt junk archived"
}

purge_stale_repos(){
  local projects="${HOME}/Projects"
  [[ -d "$projects" ]] || projects="${HOME}/projects"
  [[ -d "$projects" ]] || return 0
  mkdir -p "$projects/_ARCHIVE-PURGED"
  for d in "$projects"/TMMT.broken.* "$projects"/TMMT-swarm "$projects"/TMMT-payweek "$projects"/tmmt-agent-channel; do
    [[ -d "$d" ]] || continue
    local bn
    bn="$(basename "$d")"
    mv -f "$d" "$projects/_ARCHIVE-PURGED/$bn-$(date +%Y%m%d)" 2>/dev/null \
      && log "archived dormant repo: $bn"
  done
  ok "dormant repos moved to _ARCHIVE-PURGED"
}

lift_dark(){
  for d in "$HOME/projects/TMMT" "$HOME/Projects/TMMT" "$HOME/TMMT"; do
    [[ -f "$d/.swarm/DARK" ]] && rm -f "$d/.swarm/DARK" && log "lifted DARK on $d"
    [[ -f "$d/scripts/godark" ]] && bash "$d/scripts/godark" lift 2>/dev/null || true
  done
}

sync_x_forever(){
  local src="${HOME}/Desktop/X-FOREVER"
  local dst="${HOME}/.config/tmmt"
  [[ -d "$src" ]] || return 0
  mkdir -p "$dst"
  for f in booyah.sh forge.sh god-mode.sh x-forever.sh access-tiers.env; do
    [[ -f "$src/$f" ]] && cp -f "$src/$f" "$dst/$f" && chmod +x "$dst/$f" 2>/dev/null || true
  done
  ok "X-FOREVER canonical scripts synced to ~/.config/tmmt"
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  PURGE + GO — factory fresh · sovereign stack only           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

lift_dark
purge_launchagents
purge_stale_config
purge_stale_repos
sync_x_forever

log "archive of removed junk: $ARCHIVE"

# Fresh boot
DROP="$SCRIPT_DIR/DROP-AND-GO.sh"
[[ -f "$DROP" ]] || DROP="$SCRIPT_DIR/../blip/DROP-AND-GO.sh"
[[ -f "$DROP" ]] || DROP="$(find "$HOME/projects/TMMT" "$HOME/Projects/TMMT" -path '*/blip/DROP-AND-GO.sh' 2>/dev/null | head -1)"

if [[ -f "$DROP" ]]; then
  log "running fresh install..."
  bash "$DROP" ${ROLE:+"$ROLE"}
else
  # Inline minimal boot if bundle-only
  for d in "$HOME/projects/TMMT" "$HOME/Projects/TMMT"; do
    [[ -f "$d/scripts/apex.sh" ]] && { cd "$d" && bash scripts/apex.sh up; break; }
  done
fi

echo ""
ok "PURGE COMPLETE — device is clean sovereign stack"
echo "  check: x forever  ·  apex status  ·  watchtower"
echo ""
