#!/usr/bin/env bash
# mesh-map — the whole network at a glance: every device, role, and which guardian
# holds it. Cyborg's wide-angle view from the Watchtower.   (word: mesh-map / map)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/scripts/lib/swarm-common.sh" ]]; then source "$ROOT/scripts/lib/swarm-common.sh" 2>/dev/null || true; fi
set +e
type swarm_machine >/dev/null 2>&1 || swarm_machine(){ hostname -s 2>/dev/null||echo device; }
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; M=$'\e[35m'; W=$'\e[97m'; D=$'\e[2m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; C=; M=; W=; D=; BD=; X=; fi

printf '\n%s%s  🗺️  MESH MAP — the global network%s\n' "$C" "$BD" "$X"
printf '  ──────────────────────────────────────────────\n'

# This device
ROLE="${SWARM_ROLE:-}"; [ -z "$ROLE" ] && [ -f "$ROOT/.swarm/role" ] && ROLE="$(tr -d '[:space:]' < "$ROOT/.swarm/role")"; [ -z "$ROLE" ] && ROLE="?"
printf '  you are here: %s%s%s (%s)\n' "$W" "$(swarm_machine)" "$X" "$ROLE"

# Tailscale view (the real network) if present
printf '\n%s  TAILSCALE (the private backbone)%s\n' "$BD" "$X"
if command -v tailscale >/dev/null 2>&1; then
  tailscale status 2>/dev/null | awk '{print "   "$1"  "$2"  "$5}' | head -30 \
    || printf '   (tailscale not connected)\n'
else
  printf '   %s(install Tailscale to see live devices)%s\n' "$D" "$X"
fi

# Swarm board (who has checked in)
printf '\n%s  MESH BOARD (heartbeats)%s\n' "$BD" "$X"
bash "$ROOT/scripts/swarm.sh" mesh 2>/dev/null | sed 's/^/   /' | head -30 || printf '   (no board yet)\n'

# The guardian council holding it
cat <<EOF

${BD}  GUARDIANS holding the map${X}
   🛡️  The Boss   ${D}Muhammad Taha — Ops everywhere · the word${X}
   🦾  Cyborg     ${D}Watchtower — AIXMOS (public) + HAILMARY (Project X)${X}
   🧠  Brainiac   ${D}BRAINIAC 7 — brain node + control plane${X}
   🦅  Nightwing  ${D}Ayyan Khan — field-ops lead${X}
   🐦‍⬛ Red Hood   ${D}Umar — Credit Guidance${X}
   🚗  The Crew   ${D}rentals + verticals + operators (fenced)${X}
   🦇  Batman     ${D}E-commerce — guards the back${X}
   ${D}protected by AIXMOS Agents of Chaos · more operators pending${X}

${D}  deeper: watchtower (health) · whoami (this device) · secure (launch check)${X}

EOF
