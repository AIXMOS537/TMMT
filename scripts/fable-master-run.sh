#!/usr/bin/env bash
# fable-master-run.sh — TONIGHT before midnight: compile · audit · brief for Fable 5.
#
#   bash scripts/fable-master-run.sh
#   bash scripts/fable-master-run.sh open
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HOME/Desktop/FABLE-FEED-TONIGHT"
TS="$(date +%Y%m%d-%H%M)"
BRIEF="$OUT/FABLE-MASTER-BRIEF.md"
mkdir -p "$OUT"

say(){ printf '\n▶ %s\n' "$1"; }

say "FABLE MASTER RUN — $TS"

# 1 Session sweep
bash "$ROOT/scripts/blip/session-sweep-tonight.sh" 2>/dev/null || true

# 2 Brain compile
[[ -x "$HOME/Sync/rick/BRAIN-FEED/compile-master.sh" ]] && bash "$HOME/Sync/rick/BRAIN-FEED/compile-master.sh" || true
[[ -x "$HOME/Sync/rick/BRAIN-FEED/compile-corpus.sh" ]] && bash "$HOME/Sync/rick/BRAIN-FEED/compile-corpus.sh" || true

# 3 Noise manifest (no delete)
bash "$ROOT/scripts/blip/noise-inventory-tonight.sh" 2>/dev/null || true

# 4 Local-first audit
bash "$ROOT/scripts/mesh/enforce-local-first.sh" > "$OUT/local-first-audit.txt" 2>&1 || true

# 5 Device scan
{
  echo "# DEVICE SCAN — $TS"
  echo
  echo "## Tailscale mesh"
  echo '```'
  tailscale status 2>/dev/null || echo "(tailscale unavailable)"
  echo '```'
  echo
  echo "## FLEET-INBOX"
  echo "waiting: $(find "$HOME/Sync/rick/FLEET-INBOX" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  echo "done: $(find "$HOME/Sync/rick/FLEET-INBOX/done" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  echo
  echo "## GHL P0"
  (cd "$ROOT" && npm run ghl:check 2>&1 | tail -15) || true
} > "$OUT/device-scan.md"

# 6 Copy key configs into feed folder
cp -f "$ROOT/docs/FABLE-MASTER-BRIEF.md" "$BRIEF" 2>/dev/null || true
cp -f "$ROOT/config/local-first-law.json" "$ROOT/config/rick-persona.txt" \
  "$ROOT/config/m1-work-law.json" "$ROOT/docs/M1-DOCTRINE.txt" "$OUT/" 2>/dev/null || true
cp -f "$HOME/Brain/vault/00-Dashboard/SESSION-DIGESTS-TONIGHT/SESSION-CATALOG-"*.md "$OUT/" 2>/dev/null || true
cp -f "$HOME/Brain/vault/98-Cold-Storage/TRASH-STAGING-MANIFEST-"*.md "$OUT/" 2>/dev/null || true

# Append live audit to brief
{
  echo ""
  echo "---"
  echo "## LIVE AUDIT APPEND — $TS"
  echo ""
  cat "$OUT/local-first-audit.txt"
  echo ""
  cat "$OUT/device-scan.md"
} >> "$BRIEF"

say "DONE → $OUT"
say "Feed Fable 5:"
say "  cd ~/Brain/vault && claude"
say "  Then paste: Read ~/Desktop/FABLE-FEED-TONIGHT/FABLE-MASTER-BRIEF.md and execute Phase 1 tonight."

[[ "${1:-}" == "open" ]] && open "$OUT"
ls -la "$OUT"
