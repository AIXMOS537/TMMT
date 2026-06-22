#!/usr/bin/env bash
#
# sync-to-usb.sh — push the AIXMOS Starter Pack staging dir onto a named USB
# drive (e.g. CYBORG, AIXMOS02). Owner-side tool; runs on your Mac.
# Spec: docs/superpowers/specs/2026-06-04-aixmos-starter-pack-design.md (§7)
#
# Usage:
#   bash scripts/sync-to-usb.sh CYBORG            # → /Volumes/CYBORG/AIXMOS-STARTER-PACK/
#   bash scripts/sync-to-usb.sh AIXMOS02 --dry-run
#   STAGING_DIR=~/Projects/AIXMOS-STARTER-PACK bash scripts/sync-to-usb.sh CYBORG
#   bash scripts/sync-to-usb.sh /Volumes/CYBORG  # full path also accepted
#
# rsync's staging → drive with --delete (keeps the drive clean), excluding
# .DS_Store, model weights (*.gguf), logs/, and .git.
set -euo pipefail

DRIVE="${1:-}"
DRY=""
[ "${2:-}" = "--dry-run" ] && DRY="--dry-run"
[ -n "$DRIVE" ] || { echo "Usage: bash scripts/sync-to-usb.sh <DRIVE_NAME|/Volumes/PATH> [--dry-run]"; exit 1; }

STAGING_DIR="${STAGING_DIR:-$HOME/Projects/AIXMOS-STARTER-PACK}"

# Resolve the destination volume.
case "$DRIVE" in
  /*) VOL="$DRIVE" ;;                 # full path given
  *)  VOL="/Volumes/$DRIVE" ;;        # drive name (macOS)
esac

command -v rsync >/dev/null 2>&1 || { echo "rsync not found (install it)"; exit 1; }
[ -d "$STAGING_DIR" ] || { echo "Staging dir not found: $STAGING_DIR (set STAGING_DIR=…)"; exit 1; }
[ -d "$VOL" ] || { echo "Drive not mounted: $VOL — plug it in (or pass the right name)."; exit 1; }

DEST="$VOL/AIXMOS-STARTER-PACK/"
echo "▸ Syncing"
echo "    from: $STAGING_DIR/"
echo "    to:   $DEST"
[ -n "$DRY" ] && echo "    (DRY RUN — no changes written)"

rsync -av --delete $DRY \
  --exclude ".DS_Store" \
  --exclude "*.gguf" \
  --exclude "logs/" \
  --exclude ".git/" \
  "$STAGING_DIR/" "$DEST"

if [ -z "$DRY" ]; then
  # Best-effort flush so it's safe to eject.
  sync || true
  echo "✓ Done. Safe-eject the drive before unplugging:  diskutil eject \"$VOL\"  (macOS)"
else
  echo "✓ Dry run complete — re-run without --dry-run to apply."
fi
