#!/bin/bash
# PHONE SWEEP — standing empire-data compiler (launchd runs this hourly)
# If any trusted iPhone is plugged in and its last backup is >7 days old,
# take a full local backup (resumable), lock it 700, and log it.
# All local. Nothing leaves the machine. Never runs two backups at once.
set -u
LOG="$HOME/.tmmt/phone-sweep.log"
ROOT="$HOME"
STAMP() { date "+%Y-%m-%d %H:%M:%S"; }

# never overlap an in-flight backup (manual or previous sweep)
if pgrep -x idevicebackup2 >/dev/null 2>&1; then
  exit 0
fi

UDID=$(idevice_id -l 2>/dev/null | head -1)
[ -z "$UDID" ] && exit 0

NAME=$(ideviceinfo -u "$UDID" -k DeviceName 2>/dev/null | tr -cd '[:alnum:]-' )
[ -z "$NAME" ] && NAME="$UDID"

# find most recent backup dir containing this UDID
LAST=$(ls -dt "$ROOT"/iPhoneScan-*/"$UDID" 2>/dev/null | head -1)
if [ -n "$LAST" ] && [ -n "$(find "$LAST/Status.plist" -mtime -7 2>/dev/null)" ]; then
  # fresh backup exists (<7 days) and finished? only skip if it says finished
  if plutil -p "$LAST/Status.plist" 2>/dev/null | grep -q '"SnapshotState" => "finished"'; then
    exit 0
  fi
fi

BK="$ROOT/iPhoneScan-$NAME-$(date +%Y%m%d)"
mkdir -p "$BK" && chmod 700 "$BK"
echo "[$(STAMP)] sweep: backing up $NAME ($UDID) -> $BK" >> "$LOG"

for i in 1 2 3 4 5 6 7 8; do
  idevicebackup2 backup --full "$BK" >> "$BK/retry.log" 2>&1
  if grep -q "Backup Successful" "$BK/retry.log"; then
    chmod -R 700 "$BK"
    echo "[$(STAMP)] sweep: SUCCESS $NAME -> $BK (mine me: tell Claude 'mine $NAME backup')" >> "$LOG"
    exit 0
  fi
  sleep 20
done
echo "[$(STAMP)] sweep: incomplete for $NAME — will resume next hourly pass" >> "$LOG"
exit 0
