#!/usr/bin/env bash
# mesh-plate-restore.sh — restore order/serve if branch switch wiped scripts/.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CANON="$ROOT/scripts/lib/mesh-plate"
STAGE="$HOME/Sync/MESH-DEPLOY/LATEST/tools"

restore_one() {
  local rel="$1"
  local dst="$ROOT/$rel"
  [[ -f "$dst" ]] && return 0
  for src in "$CANON/${rel##*/}" "$STAGE/scripts/${rel#scripts/}"; do
    [[ -f "$src" ]] && { mkdir -p "$(dirname "$dst")"; cp -f "$src" "$dst"; chmod +x "$dst" 2>/dev/null || true; return 0; }
  done
  return 1
}

mkdir -p "$CANON" "$ROOT/config" "$ROOT/scripts/mesh"
for f in serve.sh serve-render.mjs booyah.sh x oneshot.sh fleet-up.sh m1-door.sh office-up-rick.sh; do
  [[ -f "$ROOT/scripts/$f" && ! -f "$CANON/$f" ]] && cp -f "$ROOT/scripts/$f" "$CANON/$f"
  restore_one "scripts/$f" || true
done
[[ -f "$ROOT/config/serve-menu.json" && ! -f "$CANON/serve-menu.json" ]] \
  && cp -f "$ROOT/config/serve-menu.json" "$CANON/serve-menu.json"
[[ -f "$ROOT/config/serve-menu.json" ]] || cp -f "$CANON/serve-menu.json" "$ROOT/config/serve-menu.json" 2>/dev/null || true
for f in brainiac-ctl.sh rick-send.sh; do
  [[ -f "$ROOT/scripts/mesh/$f" && ! -f "$CANON/$f" ]] && cp -f "$ROOT/scripts/mesh/$f" "$CANON/$f"
  [[ -f "$ROOT/scripts/mesh/$f" ]] || cp -f "$CANON/$f" "$ROOT/scripts/mesh/$f" 2>/dev/null || true
done
chmod +x "$ROOT/scripts"/*.sh "$ROOT/scripts/mesh"/*.sh "$ROOT/scripts/serve-render.mjs" 2>/dev/null || true
