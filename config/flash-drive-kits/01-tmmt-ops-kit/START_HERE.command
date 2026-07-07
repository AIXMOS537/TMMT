#!/usr/bin/env bash
# TMMT Ops Kit — USB first-run (Mac)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "=== TMMT Ops Kit ==="
echo "Installing desktop shortcuts..."
DEST="$HOME/Desktop/TMMT Ops Kit"
mkdir -p "$DEST"
cp -R "$ROOT/bookmarks/"* "$DEST/" 2>/dev/null || true
open "$DEST" 2>/dev/null || true
echo ""
echo "Next: open TMMT Ops.url → sign in with your emailed credentials."
echo "Quick start: $ROOT/PRINT-QUICK-START.html (open in browser to print)"
read -r -p "Press Enter to open TMMT Ops login..." _
open "https://tmmt-ops.vercel.app/login" 2>/dev/null || true
