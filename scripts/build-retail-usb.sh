#!/usr/bin/env bash
# Copy retail kit content onto a USB volume (FAT32/exFAT recommended).
# Usage: bash scripts/build-retail-usb.sh <ops|command|growth> /Volumes/YOURUSB
#
# Kit source folders live under docs/flash-drive-kits/ when populated.
# See docs/FLASH-DRIVE-PRODUCT-LINE.md and docs/flash-drive-kits/README.md

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KIT="${1:-}"
VOL="${2:-}"

usage() {
  echo "Usage: bash scripts/build-retail-usb.sh <ops|command|growth> /Volumes/YOURUSB"
  echo ""
  echo "Examples:"
  echo "  bash scripts/build-retail-usb.sh ops     /Volumes/TMMT-OPS"
  echo "  bash scripts/build-retail-usb.sh command /Volumes/TMMT-CMD"
  echo "  bash scripts/build-retail-usb.sh growth  /Volumes/AIXMOS-GROWTH"
  exit 1
}

[[ -n "$KIT" && -n "$VOL" ]] || usage

case "$KIT" in
  ops)     SRC="$ROOT/docs/flash-drive-kits/01-tmmt-ops-kit" ;;
  command) SRC="$ROOT/docs/flash-drive-kits/02-tmmt-command-kit" ;;
  growth)  SRC="$ROOT/docs/flash-drive-kits/03-aixmos-growth-kit" ;;
  *) echo "Unknown kit: $KIT (use ops, command, or growth)"; exit 1 ;;
esac

if [[ ! -d "$VOL" ]]; then
  echo "ERROR: Volume not found: $VOL"
  echo "Plug in the USB drive and confirm it appears under /Volumes/"
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "ERROR: Kit source folder missing: $SRC"
  echo ""
  echo "Populate docs/flash-drive-kits/ per docs/FLASH-DRIVE-PRODUCT-LINE.md,"
  echo "or clone the aixmos-kit repo and use scripts/build-master-usb.sh there."
  exit 1
fi

KIT_ID="$(echo "$KIT" | tr '[:lower:]' '[:upper:]')-$(date +%Y%m%d)-001"
echo "=== Build retail USB: $KIT → $VOL ==="
echo "Kit ID: $KIT_ID"

rsync -a --delete "$SRC/" "$VOL/"
echo "$KIT_ID" > "$VOL/kit-id.txt"
echo "Built $(date -u +%Y-%m-%dT%H:%M:%SZ) from $SRC" > "$VOL/MANIFEST.txt"
echo ""
echo "Done. Label drive, log Kit ID in GHL contact note, ship with printed insert."
echo "Print pack: docs/flash-drive-kits/ORDER-FORM.html (when present)"
