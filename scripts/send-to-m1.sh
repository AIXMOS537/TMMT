#!/usr/bin/env bash
# send-to-m1.sh — rebuild empire package + open AirDrop folder. One command.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/make-empire-mesh.sh" open
echo ""
echo "M1 pastes this ONE line after Syncthing or AirDrop:"
echo "  bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh"
echo ""
echo "Or from dropped folder:"
echo "  bash rick/RUN-M1-FIX-ONCE.sh"
