#!/bin/bash
set -eu
USB="$(cd "$(dirname "$0")" && pwd)"
cd "$USB"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Install Node.js" message "Download from nodejs.org then run START_MAC again."'
  open "https://nodejs.org" 2>/dev/null || true
  exit 1
fi

[[ -x "$USB/install.sh" ]] && bash "$USB/install.sh" || true

TMMT_OS="$USB/TMMT MANAGEMENT/tmmt-os"
if [[ ! -d "$TMMT_OS" ]]; then
  osascript -e 'display alert "Missing TMMT OS" message "TMMT MANAGEMENT/tmmt-os not found on this drive."'
  exit 1
fi

cd "$TMMT_OS"
[[ -f .env.local ]] || { [[ -f .env.example ]] && cp .env.example .env.local; }

if [[ ! -d node_modules ]] || ! node -e "require('next/package.json')" 2>/dev/null; then
  echo "Installing dependencies (first run or stale node_modules)..."
  npm install
fi

echo "Starting TMMT OS at http://localhost:3000"
echo "Press Ctrl+C to stop."
(sleep 2 && open "http://localhost:3000") &
npm run dev
