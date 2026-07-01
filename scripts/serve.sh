#!/usr/bin/env bash
# serve.sh / order — role menu. Only your plate.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -x "$ROOT/scripts/lib/mesh-plate-restore.sh" ]] && bash "$ROOT/scripts/lib/mesh-plate-restore.sh" 2>/dev/null || true

detect_role() {
  [[ -n "${FORCED_ROLE:-}" ]] && { echo "$FORCED_ROLE"; return; }
  case "$(id -un 2>/dev/null)" in
    ceo.moe|muhammad*) echo owner; return ;;
    projectaixmos01) echo rick; return ;;
  esac
  [[ -f "$ROOT/.swarm/role" ]] && { tr -d '[:space:]' < "$ROOT/.swarm/role"; return; }
  echo operator
}

detect_vertical() {
  [[ -n "${FORCED_VERTICAL:-}" ]] && { echo "$FORCED_VERTICAL"; return; }
  [[ -f "$ROOT/.swarm/vertical" ]] && { tr -d '[:space:]' < "$ROOT/.swarm/vertical"; return; }
  echo car_rental
}

FORCED_ROLE=""; FORCED_VERTICAL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    owner|rick|brainiac|family|member|operator) FORCED_ROLE="$1" ;;
    rental|car|car_rental) FORCED_VERTICAL="car_rental" ;;
    help|-h) echo "order — your plate"; exit 0 ;;
  esac
  shift
done

ROLE="$(detect_role)"
VERTICAL="$(detect_vertical)"
NEXT="order"
[[ "$ROLE" == "owner" ]] && NEXT="x --money  →  npm run ghl:sync-vercel"

HOST="$(hostname -s 2>/dev/null || echo mac)"
[[ -f "$ROOT/.swarm/machine" ]] && HOST="$(tr -d '[:space:]' < "$ROOT/.swarm/machine")"
export ROLE VERTICAL NEXT ROOT SERVE_SKIN="${SERVE_SKIN:-}" HOST

if [[ -f "$ROOT/scripts/serve-render.mjs" ]]; then
  exec node "$ROOT/scripts/serve-render.mjs"
fi
printf '\n👑 OWNER — fallback plate\n  → x --money\n  → bash scripts/lib/mesh-plate-restore.sh\n\n'
