#!/usr/bin/env bash
# Sync canonical command center → LEXAR (master bundle). No --delete on LEXAR root.
set -euo pipefail

LEXAR="${LEXAR:-/Volumes/LEXAR}"
SRC="${SRC:-$HOME/dev/AIX_Command_Center}"

STATE_DIR="${HOME}/Library/Application Support/TMMT"
MIN_INTERVAL="${TMMT_LEXAR_SYNC_INTERVAL:-300}"

mkdir -p "$STATE_DIR"
LAST_FILE="${STATE_DIR}/last-lexar-sync.epoch"
if [[ -z "${TMMT_FORCE_DOCK_SYNC:-}" && -f "$LAST_FILE" ]]; then
  last="$(cat "$LAST_FILE" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  if (( now - last < MIN_INTERVAL )); then
    exit 0
  fi
fi

if [[ ! -d "$LEXAR" ]]; then
  echo "LEXAR not mounted at $LEXAR"
  exit 0
fi

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
  --exclude=.cursor
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] LEXAR $*"; }

for item in "TMMT MANAGEMENT" AIX_AI_COMMAND_SYSTEM AIXMODE INSTALL.md START_HERE.md; do
  [[ -e "$SRC/$item" ]] || continue
  if [[ -d "$SRC/$item" ]]; then
    log "Sync $item/"
    mkdir -p "$LEXAR/$item"
    rsync "${RSYNC_OPTS[@]}" "$SRC/$item/" "$LEXAR/$item/"
  else
    log "Sync $item"
    rsync "${RSYNC_OPTS[@]}" "$SRC/$item" "$LEXAR/"
  fi
done

log "Done → $LEXAR"
date +%s >"$LAST_FILE"
