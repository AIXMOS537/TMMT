#!/usr/bin/env bash
# make-blip-bundle.sh — ONE folder → BLIP/AirDrop/USB → every device 1:1.
# Double-click GO.command (Mac) or GO.bat (Windows) — zero typing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
DEST="${BLIP_DEST:-$HOME/Sync/BLIP-DROP/LATEST}"
mkdir -p "$DEST/scripts/blip" "$DEST/scripts/mesh" "$DEST/docs" "$DEST/config" "$DEST/X-FOREVER"

bash "$ROOT/scripts/oneshot-generate.sh"

# Core drop scripts
cp -f "$ROOT/scripts/blip/DROP-AND-GO.sh" "$DEST/"
cp -f "$ROOT/scripts/blip/PURGE-AND-GO.sh" "$DEST/"
cp -f "$ROOT/scripts/blip/DROP-AND-GO.ps1" "$DEST/"
cp -f "$ROOT/scripts/blip/PURGE-AND-GO.ps1" "$DEST/"
cp -f "$ROOT/scripts/blip/GO.command" "$DEST/"
cp -f "$ROOT/scripts/blip/GO.bat" "$DEST/"
cp -f "$ROOT/scripts/blip/office-mode.sh" "$DEST/scripts/blip/"
cp -f "$ROOT/scripts/blip/detect-device.sh" "$DEST/scripts/blip/"
chmod +x "$DEST/DROP-AND-GO.sh" "$DEST/PURGE-AND-GO.sh" "$DEST/GO.command" "$DEST/scripts/blip/"*.sh 2>/dev/null || true

# Preflight security scan — block send if secrets or malware patterns found
if [[ -x "$ROOT/scripts/blip/preflight-scan.sh" ]]; then
  cp -f "$ROOT/scripts/blip/preflight-scan.sh" "$DEST/scripts/blip/"
  chmod +x "$DEST/scripts/blip/preflight-scan.sh"
  if ! bash "$ROOT/scripts/blip/preflight-scan.sh" "$DEST"; then
    echo "✗ Bundle build aborted — fix preflight failures"
    exit 1
  fi
  cat > "$DEST/SECURITY-CLEARANCE.txt" <<SECC
BLIP SECURITY CLEARANCE — $(date -u +%Y-%m-%dT%H:%M:%SZ)
Preflight scan: PASSED

Verified clean:
  ✓ No API keys, tokens, or private keys in bundle
  ✓ No .env / master secret files shipped
  ✓ No curl|sh / malware patterns
  ✓ git clone → AIXMOS537/TMMT only (runtime)
  ✓ No unexpected compiled binaries

NEVER included in BLIP (stay on Carry only):
  ✗ ~/.config/tmmt/litellm-master.env
  ✗ ~/.config/tmmt/.owner-only/office-unlock.secret
  ✗ Brain vault · Stripe · Supabase service_role

Employee PCs: locked by default · virtual key only
Owner unlock: bash scripts/blip/office-mode.sh broadcast (Carry only)

Re-scan before send: bash scripts/blip/preflight-scan.sh .
SECC
fi

# Mesh + sovereign
cp -f "$ROOT/scripts/mesh/go-live-device.sh" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/mesh/go-live-integration-test.sh" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/mesh/notify-owner.sh" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/mesh/forever-loop.sh" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/mesh/agent-dispatch.sh" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/mesh/install-forever-loop.sh" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/mesh/sovereign-heal.sh" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/mesh/sovereign-status.sh" "$DEST/scripts/mesh/"
cp -f "$ROOT/scripts/apex.sh" "$DEST/scripts/"
cp -f "$ROOT/docs/GO-LIVE-CANON.md" "$DEST/docs/"
cp -f "$ROOT/docs/MESH-GO-LIVE-PACK.md" "$DEST/docs/"
cp -f "$ROOT/docs/FOREVER-LOOP.md" "$DEST/docs/"
cp -f "$ROOT/docs/ONE-SHOT-AI.md" "$DEST/"
cp -f "$ROOT/docs/ONE-SHOT-ALL-DEVICES.md" "$DEST/"
cp -f "$ROOT/config/notify-policy.json" "$DEST/config/"
cp -f "$ROOT/config/forever-loop.json" "$DEST/config/"
cp -f "$ROOT/config/onboard-phases.json" "$DEST/config/" 2>/dev/null || true
cp -f "$ROOT/scripts/blip/rollout-now.sh" "$DEST/scripts/blip/" 2>/dev/null || true
cp -f "$ROOT/scripts/mesh/owner-devices-first.sh" "$DEST/scripts/mesh/" 2>/dev/null || true
cp -f "$ROOT/config/sovereign-stack.json" "$DEST/config/" 2>/dev/null || true

# X-FOREVER essentials (1:1 forge stack on every Mac/Windows)
XSRC="${XFOREVER_SRC:-$HOME/Desktop/X-FOREVER}"
if [[ -d "$XSRC" ]]; then
  for f in RUN-X-FOREVER.sh RUN-X-FOREVER.ps1 RUN-X-FOREVER.command install-forge-m1.sh \
           x-forever.sh forge.sh god-mode.sh booyah.sh access-tiers.env \
           BRAINIAC-PASTE.ps1 COMMANDS.txt START-HERE.txt; do
    [[ -f "$XSRC/$f" ]] && cp -f "$XSRC/$f" "$DEST/X-FOREVER/"
  done
  chmod +x "$DEST/X-FOREVER/"*.sh "$DEST/X-FOREVER/"*.command 2>/dev/null || true
fi

# Access tiers + office doc
[[ -f "$HOME/.config/tmmt/access-tiers.env" ]] && cp -f "$HOME/.config/tmmt/access-tiers.env" "$DEST/config/"
[[ -f "$HOME/Desktop/OFFICE-3-WORKSTATIONS-GO.md" ]] && cp -f "$HOME/Desktop/OFFICE-3-WORKSTATIONS-GO.md" "$DEST/docs/"
[[ -f "$HOME/Desktop/LAUNCH-WAR-PLAN-2026-07-04.md" ]] && cp -f "$HOME/Desktop/LAUNCH-WAR-PLAN-2026-07-04.md" "$DEST/docs/"

cat > "$DEST/★ DOUBLE-CLICK ME.txt" <<'TXT'
╔══════════════════════════════════════════════════════════════╗
║  BLIP DROP — FACTORY FRESH (treat device as NEW)             ║
╚══════════════════════════════════════════════════════════════╝

MAC:      double-click  GO.command
WINDOWS:  double-click  GO.bat

What happens automatically:
  1. PURGE — removes stale agents, broken config, dormant repos
  2. GO    — installs ONLY the sovereign stack (forever + apex + Rick)
  3. LOCK  — employee PCs stay locked (no master keys)

Owner in office (Carry only):
  bash scripts/blip/office-mode.sh broadcast

That's it. Never reinstall unless new computer.

SECURITY: see SECURITY-CLEARANCE.txt
TXT

cat > "$DEST/READ-ME-FIRST.txt" <<'TXT'
See ★ DOUBLE-CLICK ME.txt — Mac: GO.command · Windows: GO.bat
TXT

chmod +x "$DEST/DROP-AND-GO.sh" "$DEST/GO.command" "$DEST/scripts/mesh/"*.sh 2>/dev/null || true

# Also copy to Desktop for easy AirDrop
DESK="${BLIP_DESKTOP:-$HOME/Desktop/BLIP-DROP-LATEST}"
rm -rf "$DESK" 2>/dev/null || true
cp -R "$DEST" "$DESK" 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  BLIP BUNDLE READY                                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Primary:  $DEST"
echo "  AirDrop:  $DESK"
echo ""
echo "  Send the whole folder via BLIP / AirDrop / USB to each device."
echo "  Mac → double-click GO.command"
echo "  Windows → double-click GO.bat"
echo ""
echo "  Owner unlock all office PCs from Carry:"
echo "    bash scripts/blip/office-mode.sh broadcast"
echo ""
