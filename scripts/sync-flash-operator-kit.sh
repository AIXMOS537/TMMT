#!/usr/bin/env bash
# Copy TMMT operator docs + scripts to a flash path (no secrets, no tmmt-os app tree).
# Usage: bash scripts/sync-flash-operator-kit.sh /Volumes/AIXMOS02/TMMT\ MANAGEMENT
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-}"

if [[ -z "$DEST" ]]; then
  echo "Usage: $0 /Volumes/DRIVE/TMMT\\ MANAGEMENT" >&2
  exit 1
fi

mkdir -p "$DEST"

RSYNC=(
  -a
  --exclude=node_modules
  --exclude=.git
  --exclude=.next
  --exclude=.vercel
  --exclude=.cursor
  --exclude=__pycache__
  --exclude=.venv
  --exclude=.DS_Store
  --exclude='._*'
  --exclude=.env
  --exclude=.env.local
  --exclude='.env.*'
  --exclude='*.env.local*'
  --exclude=tmmt-os
  --exclude=ARCHIVE
  --exclude=e2e/test-results
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] operator-kit $*"; }

log "docs → $DEST/docs"
mkdir -p "$DEST/docs"
rsync "${RSYNC[@]}" "$REPO_ROOT/docs/" "$DEST/docs/"

log "scripts → $DEST/scripts"
mkdir -p "$DEST/scripts"
rsync "${RSYNC[@]}" "$REPO_ROOT/scripts/" "$DEST/scripts/"

# USB-friendly entry (same text on every drive root when called from sync-all)
if [[ -n "${FLASH_VOL_ROOT:-}" && -d "$FLASH_VOL_ROOT" ]]; then
  cat >"${FLASH_VOL_ROOT}/AGENT_START_HERE.txt" <<EOF
TMMT — agent + office Mac (read first)
======================================
Updated: $(date '+%Y-%m-%d %H:%M:%S')

1. Open on this USB:
   TMMT MANAGEMENT/docs/AGENT_HANDOFF_ONE_PAGER.md

2. Full setup:
   TMMT MANAGEMENT/docs/AGENT_IMESSAGE_TELEGRAM_SETUP.md

3. Flash dock + inbox:
   TMMT MANAGEMENT/docs/OFFICE_FLASH_PULL_AND_REMOTE.md

4. Bot scripts (copy .env.example → .env on the OFFICE Mac only — never on USB):
   TMMT MANAGEMENT/scripts/office-agent-channel/

Do not store bot tokens or .env files on this drive.
EOF
  log "Wrote ${FLASH_VOL_ROOT}/AGENT_START_HERE.txt"
fi

log "Done operator-kit → $DEST"
