#!/usr/bin/env bash
# compile-send-tonight.sh — ONE COMMAND: sweep · compile brain · stage noise · build BLIP folders.
#
#   bash scripts/blip/compile-send-tonight.sh
#   bash scripts/blip/compile-send-tonight.sh open   # open Desktop send folder
#
# Output: ~/Desktop/BLIP-SEND-TONIGHT/
#   1-TO-M1-RICK/       → AirDrop to M1 (Ant-Man right hand)
#   2-TO-ANY-DEVICE/    → AirDrop to family / Brainiac / ops
#   3-BRAIN-SLICE/      → compiled knowledge for M1 (no secrets)
#   README-SEND-FIRST.txt
#   SEND-ORDER.txt
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DESK="$HOME/Desktop/BLIP-SEND-TONIGHT"
TS="$(date +%Y%m%d-%H%M)"
M1_SRC="$HOME/Desktop/M1-ONE-SHOT-FOREVER"
GEN_SRC="$HOME/Desktop/BLIP-DROP-LATEST"
BRAIN_OUT="$HOME/Sync/rick/BRAIN-FEED/compiled"
MASTER_OUT="$HOME/Sync/rick/BRAIN-FEED/MASTER-CORPUS"

say(){ printf '\n▶ %s\n' "$1"; }
ok(){ printf '  ✓ %s\n' "$*"; }

say "TONIGHT PACK — Muhammad Taha · Brain → M1 · BLIP ready"

# ── 1. Session sweep (read all chats before any cleanup) ──
say "Step 1/6 — Session sweep (Cursor + Claude → Brain)"
bash "$ROOT/scripts/blip/session-sweep-tonight.sh" || true

# ── 2. Master brain compile (machine-wide, secret-safe) ──
say "Step 2/6 — Master brain compile"
if [[ -x "$HOME/Sync/rick/BRAIN-FEED/compile-master.sh" ]]; then
  bash "$HOME/Sync/rick/BRAIN-FEED/compile-master.sh" || true
  ok "MASTER-CORPUS rebuilt"
else
  say "  (compile-master.sh not found — skip)"
fi

# ── 3. Rick-safe corpus ──
say "Step 3/6 — Rick-safe corpus (Sync/rick)"
if [[ -x "$HOME/Sync/rick/BRAIN-FEED/compile-corpus.sh" ]]; then
  bash "$HOME/Sync/rick/BRAIN-FEED/compile-corpus.sh" || true
  ok "compiled/ rebuilt"
fi

# ── 4. Noise inventory (manifest only — NO DELETE) ──
say "Step 4/6 — Noise inventory (review before delete)"
bash "$ROOT/scripts/blip/noise-inventory-tonight.sh" || true

# ── 5. Build BLIP device bundles ──
say "Step 5/6 — Build BLIP bundles"
bash "$ROOT/scripts/blip/rollout-now.sh" build

# ── 6. Assemble send folder ──
say "Step 6/6 — Assemble ~/Desktop/BLIP-SEND-TONIGHT"
rm -rf "$DESK"
mkdir -p "$DESK/1-TO-M1-RICK" "$DESK/2-TO-ANY-DEVICE" "$DESK/3-BRAIN-SLICE" "$DESK/4-CARRY-KEEP-LOCAL"

# M1 bundle
if [[ -d "$M1_SRC" ]]; then
  cp -R "$M1_SRC" "$DESK/1-TO-M1-RICK/M1-ONE-SHOT-FOREVER"
  ok "M1 bundle copied"
fi

# General bundle
if [[ -d "$GEN_SRC" ]]; then
  cp -R "$GEN_SRC" "$DESK/2-TO-ANY-DEVICE/BLIP-DROP-LATEST"
  ok "General bundle copied"
fi

# Brain slice for M1 (Ant-Man dimension — curated, no vault raw)
BRAIN_SLICE="$DESK/3-BRAIN-SLICE"
mkdir -p "$BRAIN_SLICE/compiled" "$BRAIN_SLICE/digests" "$BRAIN_SLICE/law"

for f in \
  "$ROOT/docs/M1-DOCTRINE.txt" \
  "$ROOT/docs/M1-WORK-LAW.md" \
  "$ROOT/config/m1-work-law.json" \
  "$HOME/Sync/rick/BRAIN-FEED/MASTER-INDEX.md" \
  "$HOME/Brain/vault/00-Dashboard/SESSION-DIGESTS-TONIGHT/SESSION-CATALOG-"*.md; do
  [[ -f "$f" ]] && cp -f "$f" "$BRAIN_SLICE/" 2>/dev/null || true
done

# Top compiled docs (cap 200 newest by mtime)
if [[ -d "$BRAIN_OUT" ]]; then
  find "$BRAIN_OUT" -type f \( -name '*.md' -o -name '*.txt' \) -print0 2>/dev/null \
    | xargs -0 ls -t 2>/dev/null | head -200 | while read -r f; do
      cp -f "$f" "$BRAIN_SLICE/compiled/" 2>/dev/null || true
    done
fi

# Session digests
[[ -d "$HOME/Brain/vault/00-Dashboard/SESSION-DIGESTS-TONIGHT" ]] && \
  cp -R "$HOME/Brain/vault/00-Dashboard/SESSION-DIGESTS-TONIGHT/"* "$BRAIN_SLICE/digests/" 2>/dev/null || true

# FLEET queue manifest (titles only)
{
  echo "# FLEET-INBOX QUEUE — $(date)"
  echo
  find "$HOME/Sync/rick/FLEET-INBOX" -maxdepth 1 -name '*.md' -type f 2>/dev/null \
    | sort | while read -r f; do echo "- $(basename "$f")"; done
} > "$BRAIN_SLICE/FLEET-QUEUE-MANIFEST.md"

# What stays on Carry (never BLIP)
{
  echo "# CARRY ONLY — never send off this Mac"
  echo
  echo "- ~/Brain/vault/ (raw vault T0)"
  echo "- ~/.config/tmmt/ (keys, tiers, god mode)"
  echo "- hc god / Fable 5 / master deploy keys"
  echo "- 98-Cold-Storage/_SENSITIVE-do-not-send/"
  echo "- GHL checkout owner gates"
} > "$DESK/4-CARRY-KEEP-LOCAL/NEVER-BLIP-THESE.txt"

cat > "$DESK/README-SEND-FIRST.txt" <<'README'
╔══════════════════════════════════════════════════════════════════╗
║  BLIP SEND TONIGHT — Muhammad Taha                               ║
║  Brain compiled · noise cataloged · ready to AirDrop               ║
╚══════════════════════════════════════════════════════════════════╝

SEND IN THIS ORDER (AirDrop or USB):

  [1] 1-TO-M1-RICK/M1-ONE-SHOT-FOREVER
      → M1 Mac · double-click ★ DOUBLE-CLICK ME.command
      → Rick becomes your digital right hand (Ant-Man dimension)

  [2] 3-BRAIN-SLICE  (optional if Syncthing slow)
      → Copy onto M1: ~/Sync/rick/BRAIN-FEED/
      → Or let Syncthing sync from Carry automatically

  [3] 2-TO-ANY-DEVICE/BLIP-DROP-LATEST
      → Brainiac Windows · family Macs · office PCs
      → Double-click GO.bat (Windows) or install script (Mac)

ON CARRY AFTER SEND:
  tmmt work "your task"
  tmmt route
  tstatus

NOISE / TRASH:
  Read 98-Cold-Storage/TRASH-STAGING-MANIFEST-*.md FIRST
  Fable 5 reviews → you approve → then delete. Never blind rm.

M1 flies the mesh. You stay sovereign on Carry.
README

cat > "$DESK/SEND-ORDER.txt" <<SEND
BLIP SEND ORDER — $TS
=====================
1. M1 Max        → 1-TO-M1-RICK/M1-ONE-SHOT-FOREVER
2. Brainiac-7    → 2-TO-ANY-DEVICE/BLIP-DROP-LATEST
3. Family Macs   → 2-TO-ANY-DEVICE/BLIP-DROP-LATEST
4. iPhone        → Tailscale + Enchanted (no folder)
5. Phase 3 Aayan → after family (god issue va)
6. Phase 4 Isaac → after Aayan (fit test)

Carry commands tonight:
  source ~/.zshrc
  booyah
  tmmt work "top priority tonight"
  tmmt route
  tstatus
SEND

# Symlink brain slice into M1 bundle for one-drop option
if [[ -d "$DESK/1-TO-M1-RICK/M1-ONE-SHOT-FOREVER" ]]; then
  mkdir -p "$DESK/1-TO-M1-RICK/M1-ONE-SHOT-FOREVER/BRAIN-SLICE"
  cp -R "$BRAIN_SLICE/"* "$DESK/1-TO-M1-RICK/M1-ONE-SHOT-FOREVER/BRAIN-SLICE/" 2>/dev/null || true
fi

ok "READY → $DESK"
ls -la "$DESK"

case "${1:-}" in
  open) open "$DESK" ;;
esac
