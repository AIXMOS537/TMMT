#!/usr/bin/env bash
# Office Mac: copy FROM docked flash drives → local inbox (reverse of sync-all).
# Does not execute anything on the USB. Safe rsync only.
#
# Default inbox: ~/Documents/TMMT-Flash-Inbox/current/
# Log: ~/Library/Logs/tmmt-flash-usb-pull.log
#
# Env:
#   TMMT_FLASH_PULL_DEST   override inbox root (default ~/Documents/TMMT-Flash-Inbox)
#   TMMT_FLASH_PULL_INTERVAL  min seconds between pulls (default 180)
#   TMMT_FORCE_FLASH_PULL     set to 1 to bypass interval (e.g. SSH trigger)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="${HOME}/Library/Application Support/TMMT"
STATE_FILE="${STATE_DIR}/flash-pull.state"
INBOX_ROOT="${TMMT_FLASH_PULL_DEST:-$HOME/Documents/TMMT-Flash-Inbox}"
DEST="${INBOX_ROOT}/current"
LOG="${HOME}/Library/Logs/tmmt-flash-usb-pull.log"
MIN_INTERVAL="${TMMT_FLASH_PULL_INTERVAL:-180}"

mkdir -p "$STATE_DIR" "$(dirname "$LOG")"
exec >>"$LOG" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

resolve_volume() {
  local key="$1" aliases="$2" alt
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

drives_signature() {
  local sig=() v
  for spec in "AIXMOS02|AIX-CARRY" "LEXAR|AIX-HOME-PC" "CYBORG|AIX-INVESTORS"; do
    key="${spec%%|*}"
    aliases="${spec#*|}"
    if v="$(resolve_volume "$key" "$aliases" 2>/dev/null)"; then
      sig+=("$(basename "$v")")
    fi
  done
  (IFS=,; echo "${sig[*]}")
}

last_pull_epoch() {
  if [[ -f "$STATE_FILE" ]]; then
    grep '^last_pull_epoch=' "$STATE_FILE" 2>/dev/null | cut -d= -f2 || echo 0
  else
    echo 0
  fi
}

last_drives_sig() {
  grep '^drives_sig=' "$STATE_FILE" 2>/dev/null | cut -d= -f2- || echo ""
}

write_state() {
  local sig="$1" epoch="$2"
  {
    echo "drives_sig=${sig}"
    echo "last_pull_epoch=${epoch}"
    echo "last_check=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >"$STATE_FILE"
}

RSYNC_EX=(
  -a
  --copy-links
  --exclude=node_modules
  --exclude=.git
  --exclude=.next
  --exclude=.vercel
  --exclude=__pycache__
  --exclude=.venv
  --exclude=.DS_Store
  --exclude='._*'
  --exclude=.Spotlight-V100
  --exclude=.Trashes
  --exclude=.fseventsd
  --exclude='.node_modules.tar.*'
  --exclude='.connect.ts.*'
  --exclude='*.swp'
)

pull_tree() {
  local label="$1" src="$2" dst="$3"
  [[ -d "$src" ]] || return 0
  mkdir -p "$dst"
  log "PULL $label: $src -> $dst"
  if ! rsync "${RSYNC_EX[@]}" "$src/" "$dst/"; then
    log "WARNING rsync exit $? for $label (USB temp/broken files are common — re-run pull if needed)"
  fi
}

# --- main ---
sig="$(drives_signature)"
now=$(date +%s)
last_ep="$(last_pull_epoch)"
prev_sig="$(last_drives_sig)"

if [[ -z "$sig" ]]; then
  if [[ -n "$prev_sig" ]]; then
    log "Flash inbox: all target volumes unmounted (was: $prev_sig)"
  fi
  write_state "" "$last_ep"
  exit 0
fi

if [[ -z "${TMMT_FORCE_FLASH_PULL:-}" ]]; then
  if [[ "$sig" == "$prev_sig" ]] && (( now - last_ep < MIN_INTERVAL )); then
    exit 0
  fi
fi

log "=== pull-from-flash-drives (sig=$sig) ==="
mkdir -p "$DEST"

# AIXMOS02 / AIX-CARRY (whole TMMT MANAGEMENT tree includes tmmt-os)
if vol="$(resolve_volume AIXMOS02 "AIX-CARRY")"; then
  base="$DEST/AIXMOS02"
  if [[ -d "$vol/TMMT MANAGEMENT" ]]; then
    pull_tree "AIXMOS02-TMMT_MANAGEMENT" "$vol/TMMT MANAGEMENT" "$base/TMMT_MANAGEMENT"
  elif [[ -d "$vol/TMMT MANAGEMENT/tmmt-os" ]]; then
    pull_tree "AIXMOS02-tmmt-os" "$vol/TMMT MANAGEMENT/tmmt-os" "$base/TMMT_MANAGEMENT_tmmt-os"
  fi
  [[ -f "$vol/TMMT MANAGEMENT/tmmt-os/.env.local" ]] && mkdir -p "$base/_secrets" && \
    cp -f "$vol/TMMT MANAGEMENT/tmmt-os/.env.local" "$base/_secrets/tmmt-os.env.local" 2>/dev/null && \
    log "Copied .env.local to $base/_secrets/ (review before merging to ~/dev)"
fi

# LEXAR / AIX-HOME-PC
if vol="$(resolve_volume LEXAR "AIX-HOME-PC")"; then
  base="$DEST/LEXAR"
  for item in "TMMT MANAGEMENT" AIX_AI_COMMAND_SYSTEM AIXMODE INSTALL.md START_HERE.md; do
    [[ -e "$vol/$item" ]] || continue
    if [[ -d "$vol/$item" ]]; then
      pull_tree "LEXAR-$item" "$vol/$item" "$base/${item// /_}"
    else
      mkdir -p "$base"
      cp -f "$vol/$item" "$base/" 2>/dev/null || true
      log "COPY LEXAR file $item"
    fi
  done
fi

# CYBORG / AIX-INVESTORS
if vol="$(resolve_volume CYBORG "AIX-INVESTORS")"; then
  base="$DEST/CYBORG"
  shopt -s nullglob
  pull_tree "CYBORG-HOME_AI_PC" "$vol/HOME_AI_PC" "$base/HOME_AI_PC"
  pull_tree "CYBORG-TMMT_MANAGEMENT" "$vol/TMMT MANAGEMENT" "$base/TMMT_MANAGEMENT"
  for app in "$vol"/APP_BUILD_FILES_*; do
    [[ -d "$app" ]] || continue
    name="$(basename "$app")"
    pull_tree "CYBORG-$name" "$app" "$base/$name"
  done
  shopt -u nullglob
fi

cat >"${INBOX_ROOT}/README.txt" <<'README'
TMMT flash pull inbox (office Mac)
==================================
This folder is updated automatically when AIXMOS02, LEXAR, and/or CYBORG volumes are mounted.

- current/  — latest snapshot from all mounted drives
- _secrets/ — copies of .env.local from AIXMOS02 only; treat as sensitive

Merge into canonical dev tree manually when ready:
  diff -rq ~/dev/TMMT/tmmt-os current/AIXMOS02/TMMT_MANAGEMENT/tmmt-os | head

WhatsApp / iMessage cannot run Terminal commands. To trigger a pull from your phone:
  1) Tailscale on office Mac + phone, then SSH:  ssh you@office-mac 'launchctl kickstart -k gui/$(id -u)/com.aixmos.tmmt-flash-usb-pull'
  2) Or use Screen Sharing / AnyDesk and double-click "Pull From Flash Drives.command"
README

write_state "$sig" "$now"
log "=== pull complete -> $DEST ==="
