#!/usr/bin/env bash
# Push canonical Mac TMMT OS → AIXMOS02 flash (plug-and-play USB).
# Called by LaunchAgent when the volume is mounted, or manually:
#   ~/dev/TMMT/scripts/flash-usb-sync.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_OS="${REPO_ROOT}/tmmt-os"
VOLUME_NAME="$(tr -d '[:space:]' <"$(dirname "$0")/flash-usb-volume-name")"
FLASH_VOL="/Volumes/${VOLUME_NAME}"
FLASH_OS="${FLASH_VOL}/TMMT MANAGEMENT/tmmt-os"

STATE_DIR="${HOME}/Library/Application Support/TMMT"
STATE_FILE="${STATE_DIR}/flash-usb.state"
LOCK_FILE="${STATE_DIR}/flash-usb-sync.lock"
LOG="${HOME}/Library/Logs/tmmt-flash-usb-sync.log"
MIN_INTERVAL_SEC="${TMMT_FLASH_SYNC_INTERVAL:-90}"

mkdir -p "$STATE_DIR"
exec >>"$LOG" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

was_mounted() {
  [[ -f "$STATE_FILE" ]] && grep -q '^mounted=1$' "$STATE_FILE" 2>/dev/null
}

write_state() {
  local mounted="$1"
  local epoch="${2:-$(last_sync_epoch)}"
  {
    echo "mounted=${mounted}"
    echo "last_check=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "last_sync_epoch=${epoch}"
    echo "volume=${VOLUME_NAME}"
  } >"$STATE_FILE"
}

last_sync_epoch() {
  if [[ -f "$STATE_FILE" ]]; then
    grep '^last_sync_epoch=' "$STATE_FILE" 2>/dev/null | cut -d= -f2 || echo 0
  else
    echo 0
  fi
}

record_sync() {
  {
    echo "mounted=1"
    echo "last_check=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "last_sync_epoch=$(date +%s)"
    echo "last_git=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    echo "volume=${VOLUME_NAME}"
  } >"$STATE_FILE"
}

cleanup_flash_api_duplicates() {
  local bad_intake="${FLASH_OS}/src/app/api/intake/intake"
  local bad_webhooks="${FLASH_OS}/src/app/api/webhooks/webhooks"
  if [[ -d "$bad_intake" ]]; then
    log "Removing duplicate flash path: intake/intake"
    rm -rf "$bad_intake"
  fi
  if [[ -d "$bad_webhooks" ]]; then
    log "Removing duplicate flash path: webhooks/webhooks"
    rm -rf "$bad_webhooks"
  fi
}

run_sync() {
  log "Sync start: ${LOCAL_OS} -> ${FLASH_OS}"

  if [[ ! -d "$LOCAL_OS" ]]; then
    log "ERROR: Local tmmt-os missing at ${LOCAL_OS}"
    return 1
  fi

  rsync -a \
    --delete \
    --exclude=.next \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.cursor \
    --exclude=.DS_Store \
    --exclude='._*' \
    --exclude=.Spotlight-V100 \
    --exclude=.Trashes \
    --exclude=.fseventsd \
    --exclude=.vercel \
    --exclude=tsconfig.tsbuildinfo \
    --exclude=node_modules.tar \
    "${LOCAL_OS}/" "${FLASH_OS}/"

  # FAT32 AppleDouble metadata (not deleted by rsync --delete).
  find "${FLASH_OS}" -name '._*' -type f -delete 2>/dev/null || true

  # Keep flash env aligned with office Mac (required for plug-and-play).
  if [[ -f "${LOCAL_OS}/.env.local" ]]; then
    rsync -a "${LOCAL_OS}/.env.local" "${FLASH_OS}/.env.local"
  fi

  cleanup_flash_api_duplicates

  if command -v npm >/dev/null 2>&1 && [[ -f "${FLASH_OS}/package.json" ]]; then
    log "Flash typecheck"
    (cd "$FLASH_OS" && CI=1 npm run typecheck) || log "WARNING: flash typecheck failed"
  fi

  record_sync
  log "Sync complete"
}

if [[ ! -d "$FLASH_VOL" ]]; then
  if was_mounted; then
    log "Flash unmounted (${FLASH_VOL})"
  fi
  write_state 0
  exit 0
fi

if [[ ! -d "$FLASH_OS" ]]; then
  log "ERROR: ${FLASH_OS} not found on USB"
  exit 1
fi

new_mount=0
if ! was_mounted; then
  new_mount=1
  log "Flash detected (new mount): ${FLASH_VOL}"
fi
now=$(date +%s)
last=$(last_sync_epoch)
if [[ "$new_mount" -eq 0 ]] && (( now - last < MIN_INTERVAL_SEC )); then
  exit 0
fi

if [[ -f "$LOCK_FILE" ]]; then
  pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    log "Sync already running (pid ${pid})"
    exit 0
  fi
fi

echo $$ >"$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

run_sync
