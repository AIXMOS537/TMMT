#!/usr/bin/env bash
# TMMT-GO — double-click this on a Mac to update + boot the whole base.
# (Right-click → Open the first time if macOS Gatekeeper asks.)
cd "$(dirname "$0")" 2>/dev/null || true
bash "$(dirname "$0")/scripts/go"
echo
echo "Done. You can close this window."
