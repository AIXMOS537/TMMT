#!/usr/bin/env bash
# Build a retail USB for one kit SKU.
# Usage: bash scripts/build-retail-usb.sh <ops|command|growth> /Volumes/YOURUSB
set -euo pipefail

SKU="${1:-}"
DEST="${2:-}"

if [[ -z "$SKU" || -z "$DEST" ]]; then
  echo "Usage: bash scripts/build-retail-usb.sh <ops|command|growth> /Volumes/USB" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "$SKU" in
  ops)     SRC="$REPO_ROOT/docs/flash-drive-kits/01-tmmt-ops-kit" ;;
  command) SRC="$REPO_ROOT/docs/flash-drive-kits/02-tmmt-command-kit" ;;
  growth)  SRC="$REPO_ROOT/docs/flash-drive-kits/03-aixmos-growth-kit" ;;
  *) echo "Unknown SKU: $SKU (use ops, command, growth)" >&2; exit 1 ;;
esac

if [[ ! -d "$DEST" ]]; then
  echo "Destination not mounted: $DEST" >&2
  exit 1
fi

echo "Copying $SKU kit from $SRC → $DEST"
rsync -a --delete \
  "$SRC/" "$DEST/" \
  "$REPO_ROOT/docs/flash-drive-kits/LICENSE.txt" "$DEST/" \
  "$REPO_ROOT/docs/flash-drive-kits/ORDER-FORM.html" "$DEST/" 2>/dev/null || \
rsync -a "$SRC/" "$DEST/"

chmod +x "$DEST/START_HERE.command" 2>/dev/null || true
# FAT32: strip macOS junk on copy target if needed
find "$DEST" -name '._*' -delete 2>/dev/null || true

echo "Done. Label USB and write Kit ID on envelope cover."
echo "Print: open $SRC/PRINT-QUICK-START.html → Print"
