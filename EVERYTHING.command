#!/usr/bin/env bash
# EVERYTHING — double-click this to do it all on this device.
# (Finder: double-click. First time: right-click → Open.)
cd "$(dirname "$0")" 2>/dev/null || exit 1
bash scripts/everything "$@"
echo
echo "(You can close this window.)"
