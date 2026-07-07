#!/usr/bin/env bash
# make-m1-blip-bundle.sh — ONE folder → BLIP → M1 → double-click → army online
# Run on Carry M5 before sending to M1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${M1_BLIP_DEST:-$HOME/Sync/BLIP-DROP/M1-ONE-SHOT-FOREVER}"
XSRC="${XFOREVER_SRC:-$HOME/Desktop/X-FOREVER}"
RICK="$HOME/Sync/rick"

say(){ printf '\n▶ %s\n' "$1"; }

say "Building M1 ONE-SHOT FOREVER bundle → $DEST"
rm -rf "$DEST"
mkdir -p "$DEST/X-FOREVER" "$DEST/rick" "$DEST/docs"

# Core scripts (from this repo)
cp -f "$ROOT/scripts/blip/m1-oneshot-install.sh" "$DEST/oneshot-install.sh"
cp -f "$ROOT/docs/M1-DOCTRINE.txt" "$DEST/DOCTRINE.txt"
chmod +x "$DEST/oneshot-install.sh"

# Double-click launcher
cat > "$DEST/GO.command" <<'GO'
#!/bin/bash
cd "$(dirname "$0")"
exec bash ./oneshot-install.sh
GO
chmod +x "$DEST/GO.command"

# Alias double-click name
cp -f "$DEST/GO.command" "$DEST/★ DOUBLE-CLICK ME.command"
chmod +x "$DEST/★ DOUBLE-CLICK ME.command"

# README
cat > "$DEST/README-FIRST.txt" <<'TXT'
╔══════════════════════════════════════════════════════════════╗
║  M1 ONE-SHOT FOREVER — BLIP THIS FOLDER TO M1 MAC            ║
╚══════════════════════════════════════════════════════════════╝

ON M1 MAC:
  1. Receive this folder via BLIP / AirDrop / USB
  2. Double-click:  ★ DOUBLE-CLICK ME.command
     (or GO.command)
  3. Wait 5–15 minutes (first run pulls models)
  4. Done. Rick + Forge + Brain online forever.

WHAT IT DOES (automatic):
  ✓ Installs/syncs X-FOREVER agent stack (booyah, forge, Rick)
  ✓ Ollama + LiteLLM gateway on port 4001
  ✓ Rick-safe model + local brain (AnythingLLM if Syncthing ready)
  ✓ Compiles sovereign corpus from ~/Sync/rick when synced
  ✓ Picks up work from FLEET-INBOX / IDEA-QUEUE
  ✓ Family-first doctrine — see DOCTRINE.txt

PRIORITY ORDER (forever):
  1. Muhammad Taha + family — peaceful, paid, protected
  2. PROJECT X HAILMARY sovereign lane (owner only)
  3. Employees — set up for success, never discarded
  4. AIXMOS paid tiers by role (operators, VA, citizens)

AFTER INSTALL:
  booyah          → start working
  booyah fast     → quick chat
  forge status    → health check

Owner on Carry can drop missions to:
  ~/Sync/rick/FLEET-INBOX/

No typing required after double-click.
TXT

# X-FOREVER full stack (self-contained — no Desktop dependency on M1)
if [[ -d "$XSRC" ]]; then
  cp -R "$XSRC/." "$DEST/X-FOREVER/"
  chmod +x "$DEST/X-FOREVER/"*.sh "$DEST/X-FOREVER/"*.command 2>/dev/null || true
  say "X-FOREVER: $(ls "$DEST/X-FOREVER" | wc -l | tr -d ' ') files"
else
  echo "⚠ X-FOREVER not found at $XSRC" >&2
fi

# Rick model + brain setup helpers
[[ -f "$XSRC/Modelfile.rick-safe" ]] && cp -f "$XSRC/Modelfile.rick-safe" "$DEST/rick/"
[[ -f "$RICK/SETUP-BRAIN-M1.command" ]] && cp -f "$RICK/SETUP-BRAIN-M1.command" "$DEST/rick/"
[[ -f "$RICK/BRAIN-FEED/compile-corpus.sh" ]] && cp -f "$RICK/BRAIN-FEED/compile-corpus.sh" "$DEST/rick/"
[[ -f "$ROOT/docs/ONE-SHOT-ALL-DEVICES.md" ]] && cp -f "$ROOT/docs/ONE-SHOT-ALL-DEVICES.md" "$DEST/docs/"
[[ -f "$ROOT/docs/ONE-SHOT-FOREVER.md" ]] && cp -f "$ROOT/docs/ONE-SHOT-FOREVER.md" "$DEST/docs/"
[[ -f "$ROOT/docs/TMMT-V3-SOFT-LAUNCH.md" ]] && cp -f "$ROOT/docs/TMMT-V3-SOFT-LAUNCH.md" "$DEST/docs/"
[[ -f "$ROOT/config/operator-network-cap.json" ]] && cp -f "$ROOT/config/operator-network-cap.json" "$DEST/docs/"

# M1 scripts (work without full repo clone)
mkdir -p "$DEST/scripts/blip" "$DEST/scripts/mesh"
for s in \
  "$ROOT/scripts/blip/m1-autopilot.sh" \
  "$ROOT/scripts/mesh/m1-fleet-executor.sh" \
  "$ROOT/scripts/mesh/m1-work-router.sh" \
  "$ROOT/scripts/mesh/forever-loop.sh"; do
  [[ -f "$s" ]] && cp -f "$s" "$DEST/scripts/$(basename "$(dirname "$s")")/" 2>/dev/null || cp -f "$s" "$DEST/scripts/blip/" 2>/dev/null || true
done
[[ -f "$ROOT/scripts/blip/m1-autopilot.sh" ]] && cp -f "$ROOT/scripts/blip/m1-autopilot.sh" "$DEST/scripts/blip/"
[[ -f "$ROOT/scripts/mesh/m1-fleet-executor.sh" ]] && cp -f "$ROOT/scripts/mesh/m1-fleet-executor.sh" "$DEST/scripts/mesh/"
[[ -f "$ROOT/scripts/mesh/m1-work-router.sh" ]] && cp -f "$ROOT/scripts/mesh/m1-work-router.sh" "$DEST/scripts/mesh/"
[[ -f "$ROOT/scripts/mesh/brainiac-via-m1.sh" ]] && cp -f "$ROOT/scripts/mesh/brainiac-via-m1.sh" "$DEST/scripts/mesh/"
[[ -f "$RICK/M1-SCRIPTS/brainiac-via-m1.sh" ]] && cp -f "$RICK/M1-SCRIPTS/brainiac-via-m1.sh" "$DEST/scripts/mesh/"
chmod +x "$DEST/scripts/blip/"*.sh "$DEST/scripts/mesh/"*.sh 2>/dev/null || true

# Rick syncthing runner
[[ -f "$RICK/RUN-M1-NOW.sh" ]] && cp -f "$RICK/RUN-M1-NOW.sh" "$DEST/rick/"

# Desktop copy for easy AirDrop
DESK="$HOME/Desktop/M1-ONE-SHOT-FOREVER"
rm -rf "$DESK" 2>/dev/null || true
cp -R "$DEST" "$DESK"

say "DONE"
echo ""
echo "  BLIP send:  $DEST"
echo "  AirDrop:    $DESK"
echo ""
echo "  On M1: double-click ★ DOUBLE-CLICK ME.command"
echo ""
