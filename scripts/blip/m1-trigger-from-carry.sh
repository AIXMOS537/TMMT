#!/usr/bin/env bash
# m1-trigger-from-carry.sh — Carry drops autopilot mission after BLIP to M1.
set -euo pipefail
INBOX="${HOME}/Sync/rick/FLEET-INBOX"
mkdir -p "$INBOX"
TS="$(date +%Y%m%d-%H%M%S)"
cat > "$INBOX/mission-autopilot-${TS}.md" <<EOF
# AUTOPILOT — zero human on M1
priority: P0
trigger: m1-autopilot

Run on M1 Rick (automatic):
- bash ~/projects/TMMT/scripts/blip/m1-autopilot.sh
- Brainiac via M1 (NOT separate BLIP): brainiac-via-m1.sh
- Process all FLEET-INBOX missions
EOF
echo "Autopilot mission → $INBOX/mission-autopilot-${TS}.md"
echo "Syncthing delivers to M1 · forever-loop executes within ~2 min"
echo "Mark Brainiac via M1: tmmt owner done brainiac-7"
