#!/usr/bin/env bash
# make-ultimate-drop.sh — ONE folder for EVERY device. AirDrop / BLIP / USB / Tailscale.
#
#   bash scripts/blip/make-ultimate-drop.sh
#
# Output: ~/Desktop/★ ULTIMATE-DROP
# Mac → double-click GO.command · Windows → GO.bat · That's it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RICK="${RICK:-$HOME/Sync/rick}"
DEST="${ULTIMATE_DEST:-$HOME/Sync/BLIP-DROP/ULTIMATE}"
DESK="${ULTIMATE_DESK:-$HOME/Desktop/★ ULTIMATE-DROP}"

say(){ printf '\n▶ %s\n' "$1"; }

say "Building ULTIMATE DROP (all devices · one folder)"

# Base BLIP pack (security scan + mesh + X-FOREVER)
BLIP_DEST="$DEST" BLIP_DESKTOP="" bash "$ROOT/scripts/blip/make-blip-bundle.sh"

# M1 / Rick scripts — work WITHOUT full TMMT clone
mkdir -p "$DEST/rick/M1-SCRIPTS" "$DEST/scripts/mesh"
for s in \
  brainiac-via-m1.sh m1-fleet-executor.sh m1-autopilot.sh m1-work-router.sh \
  forever-loop.sh install-m1-forever.sh rick-alive-executor.sh rick-guard.sh; do
  [[ -f "$RICK/M1-SCRIPTS/$s" ]] && cp -f "$RICK/M1-SCRIPTS/$s" "$DEST/rick/M1-SCRIPTS/"
  [[ -f "$ROOT/scripts/mesh/$s" ]] && cp -f "$ROOT/scripts/mesh/$s" "$DEST/rick/M1-SCRIPTS/" 2>/dev/null || true
  [[ -f "$ROOT/scripts/blip/$s" ]] && cp -f "$ROOT/scripts/blip/$s" "$DEST/rick/M1-SCRIPTS/" 2>/dev/null || true
done
[[ -f "$RICK/RUN-M1-FIX-ONCE.sh" ]] && cp -f "$RICK/RUN-M1-FIX-ONCE.sh" "$DEST/rick/"
[[ -f "$RICK/RUN-M1-NOW.sh" ]] && cp -f "$RICK/RUN-M1-NOW.sh" "$DEST/rick/"
[[ -f "$ROOT/scripts/blip/m1-oneshot-install.sh" ]] && cp -f "$ROOT/scripts/blip/m1-oneshot-install.sh" "$DEST/rick/oneshot-install.sh"
chmod +x "$DEST/rick/"*.sh "$DEST/rick/M1-SCRIPTS/"*.sh 2>/dev/null || true
cp -f "$DEST/rick/M1-SCRIPTS/brainiac-via-m1.sh" "$DEST/scripts/mesh/" 2>/dev/null || true

# Docs
cp -f "$ROOT/docs/ONE-SHOT-ALL-DEVICES.md" "$DEST/docs/" 2>/dev/null || true
cp -f "$ROOT/docs/ONE-SHOT-FOREVER.md" "$DEST/docs/" 2>/dev/null || true

# ── THE ONLY README THAT MATTERS ──
cat > "$DEST/★ START HERE.txt" <<'TXT'
╔══════════════════════════════════════════════════════════════════╗
║  ★ ULTIMATE DROP — ONE FOLDER · EVERY DEVICE · ZERO TYPING       ║
║  PROJECT X HAILMARY · Muhammad Taha · Rick · Moose · Chummo      ║
╚══════════════════════════════════════════════════════════════════╝

WHAT TO DO (literally one step per device):

  MAC (Carry · M1 · any Mac):
    → Double-click:  GO.command

  WINDOWS (Brainiac · office Intel/AMD):
    → Double-click:  GO.bat

That's it. Auto-detects your device. Installs. Starts forever-loop.
Work begins automatically from FLEET-INBOX / swarm board.

──────────────────────────────────────────────────────────────────
WHAT HAPPENS AUTOMATICALLY
──────────────────────────────────────────────────────────────────
  ✓ Detects role (carry / rick / brain / forge / ops)
  ✓ Clones TMMT if missing (github.com/AIXMOS537/TMMT)
  ✓ Local-first AI stack (Ollama · LiteLLM · CCR) — $0 default
  ✓ Forever-loop daemon (sync · dispatch · probe every 3 min)
  ✓ Rick on M1: drains ~/Sync/rick/FLEET-INBOX missions
  ✓ Brainiac: gateway boot + Rick ping from M1
  ✓ Office PCs: locked by default (no master keys)

──────────────────────────────────────────────────────────────────
MOBILE (iPhone / Android) — no folder drop, 2-minute setup
──────────────────────────────────────────────────────────────────
  See:  MOBILE-SETUP.txt

──────────────────────────────────────────────────────────────────
OWNER ONLY (Carry M5)
──────────────────────────────────────────────────────────────────
  Rebuild this folder:  bash ~/Projects/TMMT/scripts/blip/make-ultimate-drop.sh
  Unlock all office:    bash scripts/blip/office-mode.sh broadcast
  Paid polish only:     god on  (never on loops)

──────────────────────────────────────────────────────────────────
NEVER RE-RUN unless new computer or something broke.
SECURITY: SECURITY-CLEARANCE.txt
TXT

cat > "$DEST/MOBILE-SETUP.txt" <<'TXT'
MOBILE FARM — iPhone / Android
==============================

1. Install Tailscale → sign in AIXMOS537@
2. Install Enchanted LLM (iOS) or MLC Chat / Enchanted (Android)
3. API URL:   http://macbook-pro-2.tailceb455.ts.net:4001/v1
4. API Key:   ask Taha on Carry (litellm virtual key — rick-safe)
5. Model:     rick-safe

Rick in your pocket. Zero paid API. Same tailnet as the farm.
TXT

# Replace old readme pointers
cat > "$DEST/READ-ME-FIRST.txt" <<'TXT'
Open ★ START HERE.txt
Mac: GO.command · Windows: GO.bat
TXT

rm -f "$DEST/★ DOUBLE-CLICK ME.txt" 2>/dev/null || true

# Desktop copy — THE folder you AirDrop
rm -rf "$DESK" 2>/dev/null || true
cp -R "$DEST" "$DESK"

# Symlink alias for scripts that expect BLIP-DROP-LATEST
rm -rf "$HOME/Desktop/BLIP-DROP-LATEST" 2>/dev/null || true
ln -sf "$DESK" "$HOME/Desktop/BLIP-DROP-LATEST" 2>/dev/null || cp -R "$DESK" "$HOME/Desktop/BLIP-DROP-LATEST"

say "DONE"
cat <<OUT

╔══════════════════════════════════════════════════════════════════╗
║  ★ ULTIMATE DROP READY                                           ║
╚══════════════════════════════════════════════════════════════════╝

  AirDrop this ENTIRE folder to any device:

    $DESK

  Mac     → double-click GO.command
  Windows → double-click GO.bat
  Mobile  → read MOBILE-SETUP.txt

  Rebuild on Carry only:
    bash scripts/blip/make-ultimate-drop.sh

OUT
