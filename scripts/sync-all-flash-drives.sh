#!/usr/bin/env bash
# Work MacBook: sync all docked flash drives (AIXMOS02 + LEXAR + CYBORG).
# Run manually or via LaunchAgent when drives are plugged in.
#
# IMPORTANT: Only one Mac should write to the dock at a time.
# Sleep/disconnect the carry MacBook before syncing from this work Mac.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF="${REPO_ROOT}/scripts/flash-drives.conf"
LOG="${HOME}/Library/Logs/tmmt-flash-usb-sync.log"

mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

resolve_volume() {
  local key="$1"
  local aliases="$2"
  local vol alt

  if [[ -d "/Volumes/${key}" ]]; then
    echo "/Volumes/${key}"
    return 0
  fi
  IFS=',' read -ra alts <<<"$aliases"
  for alt in "${alts[@]}"; do
    alt="$(echo "$alt" | tr -d '[:space:]')"
    [[ -n "$alt" && -d "/Volumes/${alt}" ]] && { echo "/Volumes/${alt}"; return 0; }
  done
  return 1
}

mounted_volumes() {
  ls -1 /Volumes 2>/dev/null | grep -v '^Macintosh HD$' || true
}

log "=== sync-all-flash-drives (work Mac) ==="
log "Mounted: $(mounted_volumes | tr '\n' ' ' | sed 's/ $//')"

any=0

# AIXMOS02 — full tmmt-os + .env.local (plug-and-play app hub)
if vol="$(resolve_volume AIXMOS02 "AIX-CARRY")"; then
  any=1
  log "Handler: AIXMOS02 at $vol"
  TMMT_FLASH_SYNC_INTERVAL=0 bash "${REPO_ROOT}/scripts/flash-usb-sync.sh" || log "WARNING: AIXMOS02 sync failed"
else
  log "Skip AIXMOS02 (not mounted)"
fi

# LEXAR — command center bundle (no delete)
if vol="$(resolve_volume LEXAR "AIX-HOME-PC")"; then
  any=1
  log "Handler: LEXAR at $vol"
  LEXAR="$vol" bash "${REPO_ROOT}/scripts/sync-lexar-flash.sh" || log "WARNING: LEXAR sync failed"
else
  log "Skip LEXAR (not mounted)"
fi

# CYBORG — carry / home AI PC hub (merge, no wipe)
if vol="$(resolve_volume CYBORG "AIX-INVESTORS")"; then
  any=1
  log "Handler: CYBORG at $vol"
  CYBORG="$vol" bash "${REPO_ROOT}/scripts/sync-cyborg-flash.sh" || log "WARNING: CYBORG sync failed"
else
  log "Skip CYBORG (not mounted)"
fi

if [[ "$any" -eq 0 ]]; then
  log "No target flash volumes mounted."
fi

log "=== sync-all complete ==="
