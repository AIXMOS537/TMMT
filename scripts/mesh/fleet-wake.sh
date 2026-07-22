#!/usr/bin/env bash
# fleet-wake.sh — the SANCTIONED fleet wake path. Replaces the rogue "GO WAKE"
# mission spam that flooded FLEET-INBOX with an undeduped ping per node per cycle.
#
# Design (why this can never spam):
#   • A node that answers on the tailnet needs NO wake — nothing is written.
#   • A node that's down gets exactly ONE standing wake note, at a FIXED path
#     (no timestamp in the name → rewriting it is a no-op, not a new file).
#   • The moment the node answers again, its note is deleted automatically.
#   • Notes live in FLEET-INBOX/wakes/, OUTSIDE the law-*.md mission glob — so
#     the owner-approval executor never sees wake plumbing as "work".
#
#   bash scripts/mesh/fleet-wake.sh          check + wake the fleet (idempotent)
#   bash scripts/mesh/fleet-wake.sh status   readout only, writes nothing
#
# Schedule it (max ONE writer fleet-wide, on carry):
#   launchd StartInterval 7200 → com.tmmt.fleet-wake running this script.
# Wake-on-LAN: set BRAINIAC_MAC (and friends) — down nodes get a WOL attempt
# via wakeonlan when configured, same pattern as brainiac-ctl.sh.
set -uo pipefail

NODES="${FLEET_WAKE_NODES:-office-fleet office-amd m1-rick brainiac-win}"
INBOX="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
WAKES="$INBOX/wakes"
HOST="$(hostname -s 2>/dev/null || echo carry)"
VERB="${1:-wake}"
mkdir -p "$WAKES"

if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; X=$'\e[0m'; else G=; Y=; X=; fi
ok(){ printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
dn(){ printf '  %s!%s %s\n' "$Y" "$X" "$*"; }

reachable() { command -v tailscale >/dev/null 2>&1 && tailscale ping -c1 --timeout 3s "$1" >/dev/null 2>&1; }

wol_for() { # node → env var like OFFICE_FLEET_MAC / BRAINIAC_MAC
  local var; var="$(printf '%s' "$1" | tr 'a-z-' 'A-Z_')_MAC"
  printf '%s' "${!var:-}"
}

printf 'FLEET WAKE — %s · %s\n' "$HOST" "$(date -u +%FT%TZ)"
DOWN=0
for n in $NODES; do
  NOTE="$WAKES/$n.md"
  if reachable "$n"; then
    [[ -f "$NOTE" ]] && rm -f "$NOTE" && ok "$n is back — wake note cleared" || ok "$n up"
    continue
  fi
  DOWN=$((DOWN + 1))
  dn "$n down"
  [[ "$VERB" == "status" ]] && continue
  # WOL attempt if a MAC is configured (best-effort, silent)
  mac="$(wol_for "$n")"
  [[ -n "$mac" ]] && command -v wakeonlan >/dev/null 2>&1 && wakeonlan "$mac" >/dev/null 2>&1 \
    && dn "  → wake-on-LAN sent to $n"
  # ONE standing note per node — fixed path, rewritten in place, never accumulates.
  cat > "$NOTE" <<EOF
# WAKE — $n
from: $HOST · last checked $(date -u +%FT%TZ)
This node is offline. Power it on (or check its network); it rejoins the
tailnet on boot and this note clears itself on the next fleet-wake cycle.
EOF
done
[[ "$DOWN" -eq 0 ]] && ok "whole fleet answering — nothing written"
exit 0
