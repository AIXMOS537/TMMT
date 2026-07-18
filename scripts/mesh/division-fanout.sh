#!/usr/bin/env bash
# division-fanout.sh — route work to army division workers (Hermes personas + office nodes).
set -uo pipefail
ROOT=""
for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT"; do
  [[ -d "$d/scripts/mesh" ]] && ROOT="$d" && break
done
ROOT="${ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
RICK="${FOREVER_RICK_INBOX:-$HOME/Sync/rick}"
DISPATCH="$RICK/MESH-DISPATCH"

mkdir -p "$DISPATCH"/{chummo,moose,vision,wonder-woman,captain-america,office-alpha,office-charlie,office-fleet}

route_division() {
  local div="$1" pattern="$2"
  find "$RICK/FLEET-INBOX" -maxdepth 1 -name "$pattern" -type f 2>/dev/null | head -3 | while read -r f; do
    cp -f "$f" "$DISPATCH/$div/" 2>/dev/null || true
  done
}

cmd_route() {
  route_division "chummo" "law-*-outreach*.md"
  route_division "moose" "law-*-batch*.md"
  route_division "vision" "law-*-revenue*.md"
  route_division "wonder-woman" "law-*-inbox*.md"
  route_division "captain-america" "law-*-quarantine*.md"
  route_division "office-alpha" "law-*-integration*.md"
  route_division "office-charlie" "law-*-probe*.md"
  route_division "office-fleet" "law-*-clip*.md"
  date -u +%FT%TZ > "$RICK/AUTORUN.stamp"
  printf 'division-fanout: routed at %s\n' "$(date -u +%FT%TZ)"
}

cmd_status() {
  printf '— Division fanout —\n'
  for d in chummo moose vision wonder-woman captain-america office-alpha office-charlie office-fleet; do
    local c
    c="$(find "$DISPATCH/$d" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
    printf '  %-18s %s missions\n' "$d:" "$c"
  done
}

case "${1:-status}" in
  route) cmd_route;;
  status) cmd_status;;
  *) cmd_status;;
esac
