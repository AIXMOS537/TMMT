#!/usr/bin/env bash
# make-empire-mesh.sh — ONE package for M1 · Brainiac · Office · Mobile. Build on Carry only.
#
#   bash scripts/make-empire-mesh.sh
#   bash scripts/make-empire-mesh.sh open   # AirDrop folder
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RICK="${RICK:-$HOME/Sync/rick}"
DEST="${EMPIRE_DEST:-$HOME/Sync/empire-mesh}"
DESK="${EMPIRE_DESK:-$HOME/Desktop/★ SEND-TO-DEVICES}"

say(){ printf '\n▶ %s\n' "$1"; }

say "Build ULTIMATE base (all devices)"
bash "$ROOT/scripts/blip/make-ultimate-drop.sh"

ULT="${ULTIMATE_DEST:-$HOME/Sync/BLIP-DROP/ULTIMATE}"
# Never cp through ULTIMATE→empire-mesh symlink (circular). Prefer desktop send folder.
rm -rf "$DEST"
if [[ -L "$ULT" ]]; then
  cp -R "$DESK/." "$DEST"
elif [[ -d "$ULT" ]]; then
  cp -R "$ULT/." "$DEST"
else
  cp -R "$DESK/." "$DEST"
fi

say "Add Brainiac gateway + setup"
mkdir -p "$DEST/brainiac/gateway"
GW="$RICK/wave4-handoffs-mirror/BRAINIAC-LiteLLM-Gateway-2026-07-01"
for f in docker-compose.yml litellm-config.yaml secrets-load.ps1; do
  [[ -f "$GW/$f" ]] && cp -f "$GW/$f" "$DEST/brainiac/gateway/"
done
[[ -f "$RICK/SETUP-BRAIN-BRAINIAC.ps1" ]] && cp -f "$RICK/SETUP-BRAIN-BRAINIAC.ps1" "$DEST/brainiac/"
cat > "$DEST/brainiac/★ WINDOWS START.txt" <<'WIN'
BRAINIAC (Windows at home)
==========================
1. Copy brainiac/gateway/ → C:\hailmary\brainiac-litellm-gateway\
2. Right-click PowerShell → Run: SETUP-BRAIN-BRAINIAC.ps1
3. Or double-click GO.bat in this folder's parent (ULTIMATE root)
4. Verify: curl http://localhost:4000/health

M1 will ping you via brainiac-via-m1.sh once live.
WIN

say "Add capture + intake (Carry)"
mkdir -p "$DEST/capture" "$DEST/scripts/mesh"
cp -f "$ROOT/scripts/install-capture-engine.sh" "$ROOT/scripts/voice-inbox-watch.sh" "$DEST/capture/"
cp -f "$ROOT/scripts/mesh/empire-intake.sh" "$ROOT/scripts/mesh/clickup-intake.mjs" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/mesh/family-harness.sh" "$ROOT/scripts/mesh/operator-dispatch.sh" "$DEST/scripts/mesh/" 2>/dev/null || true
chmod +x "$DEST/capture/"*.sh "$DEST/scripts/mesh/"*.sh 2>/dev/null || true

say "Add M1 send card"
mkdir -p "$DEST/m1"
cat > "$DEST/m1/★ M1 ONE LINE.txt" <<'M1'
⛔ NOT FOR CARRY — M1 MAC ONLY ⛔

If you are on MacBook-Pro-3 (Carry / Watchtower), DO NOT RUN THIS.
Run instead: bash ~/Projects/TMMT/scripts/restore-carry-watchtower.sh

M1 MAC — paste in Terminal (one line):

  bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh

If Syncthing not synced yet, AirDrop this whole folder first, then:

  bash rick/RUN-M1-FIX-ONCE.sh

Rick drains ~/Sync/rick/FLEET-INBOX forever. Zero typing after this.
M1
cp -f "$DEST/rick/RUN-M1-FIX-ONCE.sh" "$DEST/m1/" 2>/dev/null || true

say "Config (no secrets)"
cp -f "$ROOT/config/tiered-help.json" "$ROOT/config/operator-dispatch.json" \
  "$ROOT/config/family-mesh.registry.json" "$ROOT/config/m1-work-law.json" "$DEST/config/" 2>/dev/null || true

cat > "$DEST/★ SEND ORDER.txt" <<'ORDER'
EMPIRE MESH — SEND ORDER (Muhammad Taha)
========================================

1. CARRY (you) — already live:
   bash ~/Projects/TMMT/scripts/install-carry-watchtower.sh
   x autopilot

2. M1 — AirDrop ★ SEND-TO-DEVICES folder OR wait for Syncthing:
   bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh

3. BRAINIAC (Windows home) — AirDrop folder · read brainiac/★ WINDOWS START.txt

4. OFFICE PCs — AirDrop folder · double-click GO.bat · office locked until:
   bash scripts/blip/office-mode.sh broadcast   (Carry only)

5. iPHONES (personal + work) — MOBILE-SETUP.txt
   Share voice/photos → iCloud VoiceDrop / MediaDrop
   Empire intake transcribes + routes automatically.

WHAT GETS COLLECTED (no human):
  • Voice memos · videos · photos (iCloud drops)
  • ClickUp open tasks
  • Carry watcher STATE files
  • tmmt work / catch / vault transcripts
  → all route to M1 FLEET-INBOX

OWNER PINGED ONLY: emergency / urgent (notify-policy.json)

Rebuild package: bash ~/Projects/TMMT/scripts/make-empire-mesh.sh
ORDER

# Desktop copy for AirDrop
mkdir -p "$RICK/DEVICE-DROPS/ULTIMATE-DROP"
rm -rf "$DESK" 2>/dev/null || true
cp -R "$DEST" "$DESK"
ln -sfn "$DESK" "$HOME/Desktop/★ ULTIMATE-DROP" 2>/dev/null || true
cp -R "$DEST/." "$RICK/DEVICE-DROPS/ULTIMATE-DROP/" 2>/dev/null || true

say "DONE — AirDrop this folder:"
echo "  $DESK"
echo ""
echo "M1 one-liner: bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh"

[[ "${1:-}" == "open" ]] && open "$DESK"
