#!/usr/bin/env bash
# Copy Desktop operator kits → flash volumes (no live secrets).
# Called from sync-all-flash-drives.sh after tmmt-os sync.
set -euo pipefail

DESKTOP="${HOME}/Desktop"
LOG="${HOME}/Library/Logs/tmmt-flash-usb-sync.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] desktop-kits $*" | tee -a "$LOG"; }

RSYNC=(
  -a
  --exclude=config.sh
  --exclude='config.sh.bak'
  --exclude=.DS_Store
  --exclude='._*'
  --exclude=sent/
  --exclude='*.log'
  --exclude=llama8b-pull.log
  --exclude=mac-brain-setup.log
)

sync_volume() {
  local vol="$1"
  [[ -d "$vol" ]] || return 0

  local dest="$vol/TMMT MANAGEMENT/desktop-kits"
  mkdir -p "$dest"

  for kit in mac-brain imessage-hands TAHA-HQ; do
    [[ -d "$DESKTOP/$kit" ]] || continue
    rsync "${RSYNC[@]}" "$DESKTOP/$kit/" "$dest/$kit/"
    log "$kit → $dest/$kit"
  done

  for item in \
    "⭐ START HERE.html" \
    "WORK-MAC-COMMAND-HUB.md" \
    "WORK-MAC-COMMAND-HUB-SETUP.command" \
    "⭐️ START-HERE-CARRY-MAC.txt" \
    "CARRY-MAC-BOOTUP-SYNC.command" \
    "Start-iMessage-Watcher.command" \
    "TMMT-iPhone-Command.shortcut.md"
  do
    [[ -f "$DESKTOP/$item" ]] || continue
    rsync -a "$DESKTOP/$item" "$dest/"
    log "hub file → $dest/$(basename "$item")"
  done

  # Plug-and-play launcher at volume root (carry Mac double-click)
  local launcher_src
  launcher_src="$(cd "$(dirname "$0")" && pwd)/desktop/START_MAC.command"
  if [[ -f "$launcher_src" ]]; then
    rsync -a "$launcher_src" "$vol/START_MAC.command"
    chmod +x "$vol/START_MAC.command" 2>/dev/null || true
    log "START_MAC.command → $vol/"
  fi

  # Quick entry card on volume root
  cat >"$vol/TMMT DESKTOP KITS.txt" <<EOF
TMMT desktop kits — updated $(date '+%Y-%m-%d %H:%M')
====================================================
Open:  TMMT MANAGEMENT/desktop-kits/

  mac-brain/          → local AI (setup.command)
  imessage-hands/     → iMessage assistant (setup.command)
  TAHA-HQ/            → business command center
  ⭐ START HERE.html  → visual launcher

Boot app: double-click START_MAC.command (volume root)
EOF
  log "Wrote $vol/TMMT DESKTOP KITS.txt"
}

for vol in /Volumes/AIXMOS02 /Volumes/AIX-CARRY /Volumes/CYBORG /Volumes/AIX-INVESTORS; do
  sync_volume "$vol"
done
