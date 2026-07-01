#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -x "$ROOT/scripts/lib/mesh-plate-restore.sh" ]] && bash "$ROOT/scripts/lib/mesh-plate-restore.sh" 2>/dev/null || true
ME="$(hostname -s | tr '[:upper:]' '[:lower:]')"
[[ "$ME" == *pro-3* ]] && { printf 'carry\n' > "$ROOT/.swarm/machine"; printf 'owner\n' > "$ROOT/.swarm/role"; }
[[ -x "$ROOT/scripts/lib/install-oneshot-bin.sh" ]] && bash "$ROOT/scripts/lib/install-oneshot-bin.sh" 2>/dev/null || true
STAGE="$HOME/Sync/MESH-DEPLOY/LATEST/tools"
mkdir -p "$STAGE/scripts/mesh" "$STAGE/config" "$ROOT/scripts/lib/mesh-plate"
for f in serve.sh serve-render.mjs booyah.sh x oneshot.sh fleet-up.sh m1-door.sh office-up-rick.sh; do
  [[ -f "$ROOT/scripts/$f" ]] && cp -f "$ROOT/scripts/$f" "$STAGE/scripts/" "$ROOT/scripts/lib/mesh-plate/" 2>/dev/null || true
done
[[ -f "$ROOT/config/serve-menu.json" ]] && cp -f "$ROOT/config/serve-menu.json" "$STAGE/config/" "$ROOT/scripts/lib/mesh-plate/" 2>/dev/null || true
cp -f "$ROOT/scripts/mesh/"*.sh "$STAGE/scripts/mesh/" "$ROOT/scripts/lib/mesh-plate/" 2>/dev/null || true
echo "✓ fleet-up · carry/owner · mesh-plate backed up"
