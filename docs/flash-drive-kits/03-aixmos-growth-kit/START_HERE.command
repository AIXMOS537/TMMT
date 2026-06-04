#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "=== AIXMOS Growth Kit ==="
open "$ROOT/PRINT-QUICK-START.html" 2>/dev/null || true
read -r -p "Press Enter to open AIXMOS..." _
open "https://aixmos-landing.vercel.app/" 2>/dev/null || true
