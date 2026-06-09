#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "=== TMMT Command Kit ==="
DEST="$HOME/Desktop/TMMT Command Kit"
mkdir -p "$DEST"
cp -R "$ROOT/bookmarks/"* "$DEST/" 2>/dev/null || true
open "$DEST" 2>/dev/null || true
read -r -p "Press Enter to open Command Center login..." _
open "https://tmmt-command-center.vercel.app/login" 2>/dev/null || true
