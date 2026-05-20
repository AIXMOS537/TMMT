#!/usr/bin/env bash
# Update CYBORG carry/home hub — refreshes command center under HOME_AI_PC without wiping the drive.
set -euo pipefail

CYBORG="${CYBORG:-/Volumes/CYBORG}"
SRC_CC="${SRC_CC:-$HOME/dev/AIX_Command_Center}"
SRC_TMMT="${SRC_TMMT:-$HOME/dev/TMMT}"

STATE_DIR="${HOME}/Library/Application Support/TMMT"
MIN_INTERVAL="${TMMT_CYBORG_SYNC_INTERVAL:-300}"

mkdir -p "$STATE_DIR"
LAST_FILE="${STATE_DIR}/last-cyborg-sync.epoch"
if [[ -z "${TMMT_FORCE_DOCK_SYNC:-}" && -f "$LAST_FILE" ]]; then
  last="$(cat "$LAST_FILE" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  if (( now - last < MIN_INTERVAL )); then
    exit 0
  fi
fi

if [[ ! -d "$CYBORG" ]]; then
  echo "CYBORG not mounted at $CYBORG"
  exit 0
fi

shopt -s nullglob

RSYNC_OPTS=(
  -a
  --exclude=node_modules
  --exclude=.git
  --exclude=.next
  --exclude=__pycache__
  --exclude=.venv
  --exclude=.DS_Store
  --exclude='._*'
  --exclude=.env
  --exclude=.env.local
  --exclude='.env.*.local'
  --exclude=.vercel
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] CYBORG $*"; }

# Standard carry layout: HOME_AI_PC/01_AIX_Command_Center
if [[ -d "$CYBORG/HOME_AI_PC" ]]; then
  dest="$CYBORG/HOME_AI_PC/01_AIX_Command_Center"
  mkdir -p "$dest"
  log "HOME_AI_PC → $dest"
  rsync "${RSYNC_OPTS[@]}" "$SRC_CC/" "$dest/"
fi

# APP_BUILD_FILES snapshot layout (if present)
for app_build in "$CYBORG"/APP_BUILD_FILES_*; do
  [[ -d "$app_build" ]] || continue
  dest="$app_build/01_AIX_Command_Center"
  mkdir -p "$dest"
  log "APP_BUILD → $dest"
  rsync "${RSYNC_OPTS[@]}" "$SRC_CC/" "$dest/"
done

# Root-level TMMT mirror (some CYBORG layouts)
if [[ -d "$CYBORG/TMMT MANAGEMENT" ]]; then
  log "TMMT MANAGEMENT (no secrets)"
  rsync "${RSYNC_OPTS[@]}" \
    --exclude=tmmt-os/.env.local \
    "$SRC_TMMT/" "$CYBORG/TMMT MANAGEMENT/"
fi

log "Done → $CYBORG (carry Mac files outside 01_AIX_Command_Center left intact)"
date +%s >"$LAST_FILE"
