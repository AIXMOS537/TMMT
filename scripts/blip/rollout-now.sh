#!/usr/bin/env bash
# rollout-now.sh — BLIP YOUR devices from Carry RIGHT NOW. Then family → Aayan → Isaac Scott.
#
# Usage:
#   bash scripts/blip/rollout-now.sh              # build bundles + show BLIP send queue
#   bash scripts/blip/rollout-now.sh build        # rebuild M1 + general bundles only
#   bash scripts/blip/rollout-now.sh queue        # print send order (no build)
#   bash scripts/blip/rollout-now.sh open         # open Desktop BLIP folders in Finder
#
# Authority: PROJECT X HAILMARY · Muhammad Taha · Carry M5 only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; W=$'\e[97m'; BD=$'\e[1m'; X=$'\e[0m'
else G=; Y=; C=; W=; BD=; X=; fi

M1_DEST="$HOME/Sync/BLIP-DROP/M1-ONE-SHOT-FOREVER"
M1_DESK="$HOME/Desktop/M1-ONE-SHOT-FOREVER"
GEN_DEST="$HOME/Sync/BLIP-DROP/LATEST"
GEN_DESK="$HOME/Desktop/BLIP-DROP-LATEST"

cmd_build(){
  printf '%s%s Building BLIP bundles…%s\n' "$C" "$BD" "$X"
  bash "$ROOT/scripts/blip/make-m1-blip-bundle.sh"
  bash "$ROOT/scripts/blip/make-blip-bundle.sh"
  # Ensure Desktop copies
  [[ -d "$M1_DEST" ]] && rm -rf "$M1_DESK" 2>/dev/null; cp -R "$M1_DEST" "$M1_DESK" 2>/dev/null || true
  printf '%s✓%s Bundles ready\n' "$G" "$X"
}

cmd_open(){
  cmd_open_one(){
    [[ -d "$1" ]] && open "$1" 2>/dev/null || warn "Missing: $1"
  }
  cmd_open_one "$M1_DESK"
  cmd_open_one "$GEN_DESK"
  [[ -d "$M1_DEST" && ! -d "$M1_DESK" ]] && cmd_open_one "$M1_DEST"
  [[ -d "$GEN_DEST" && ! -d "$GEN_DESK" ]] && cmd_open_one "$GEN_DEST"
}

cmd_queue(){
  cat <<EOF
${C}${BD}╔══════════════════════════════════════════════════════════════╗
║  B L I P   R O L L O U T   Q U E U E  —  send in this order   ║
╚══════════════════════════════════════════════════════════════╝${X}

${BD}PHASE 1 — YOUR DEVICES (BLIP NOW from this Mac)${X}

  [1] ${W}This Mac (Carry)${X} — no BLIP · run here:
      bash scripts/blip/rollout-now.sh build
      bash ~/Desktop/X-FOREVER/RUN-X-FOREVER.sh
      bash scripts/tmmt owner done carry-m5

  [2] ${W}M1 Max${X} — BLIP this folder:
      ${M1_DESK}
      → M1 double-clicks: ★ DOUBLE-CLICK ME.command
      bash scripts/tmmt owner done forge-m1

  [3] ${W}Brainiac-7${X} — BLIP this folder:
      ${GEN_DESK}
      → Windows double-clicks: GO.bat
      bash scripts/tmmt owner done brainiac-7

  [4] ${W}Office PCs you own${X} (optional) — same folder as Brainiac:
      ${GEN_DESK}
      bash scripts/tmmt owner skip office-pc-owned

  [5] ${W}Your iPhone${X} — App Store (no BLIP folder):
      Tailscale + Enchanted → Carry LiteLLM
      bash scripts/tmmt owner done iphone-taha

${BD}PHASE 2 — IMMEDIATE FAMILY${X} (after Phase 1)
      god issue family → Enchanted per person
      bash scripts/mesh/go-live-device.sh --role family

${BD}PHASE 3 — AAYAN${X} (after family)
      god issue va → ops lane
      bash scripts/swarm-join.sh --name ops-aayan
      bash scripts/mesh/go-live-device.sh --role ops

${BD}PHASE 4 — ISAAC SCOTT${X} (after Aayan)
      /fit-test → /join → Operator T1
      god issue operator
      bash scripts/swarm-join.sh --name ops-isaac-scott

${Y}Track progress:${X} bash scripts/tmmt owner
${Y}Open BLIP folders:${X} bash scripts/blip/rollout-now.sh open
EOF
}

case "${1:-now}" in
  build)   cmd_build ;;
  queue)   cmd_queue ;;
  open)    cmd_open ;;
  ""|now|go)
    cmd_build
    echo ""
    cmd_queue
    echo ""
    cmd_open
    ;;
  \#*)     cmd_build; echo ""; cmd_queue; echo ""; cmd_open ;;
  -h|--help)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "Unknown: $1 — try: rollout-now.sh | build | queue | open" >&2
    exit 1
    ;;
esac
