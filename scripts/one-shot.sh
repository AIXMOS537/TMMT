#!/usr/bin/env bash
# one-shot.sh — THE ONLY COMMAND. Everything. Always. One time.
#
#   bash ~/Projects/TMMT/scripts/one-shot.sh
#   bash ~/Projects/TMMT/scripts/one-shot.sh open
#
# Carry: run once at office or home. Rick + mesh handle the rest forever.
# No other scripts. No other steps. This is it.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
chmod +x "$ROOT/scripts/one-shot.sh" 2>/dev/null || true
[[ -x "$ROOT/scripts/lib/install-oneshot-bin.sh" ]] && bash "$ROOT/scripts/lib/install-oneshot-bin.sh" 2>/dev/null || true
RICK="${RICK:-$HOME/Sync/rick}"
INBOX="$RICK/FLEET-INBOX"
DESK="$HOME/Desktop"
OUT="$DESK/★ ONE-SHOT"
DROP="$DESK/★ ULTIMATE-DROP"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$HOME/Library/Logs/one-shot.log"
FABLE="$OUT/FABLE-PASTE.md"

mkdir -p "$OUT" "$INBOX/done" "$RICK/OUTBOUND" "$RICK/DEVICE-DROPS" "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

run(){ bash "$@" 2>/dev/null || true; }

cat <<'BANNER'
╔══════════════════════════════════════════════════════════════════╗
║  ★ ONE SHOT — Muhammad Taha · PROJECT X HAILMARY                 ║
║  Devices · Mixtape · Rick · Money prep · Fable feed · ALWAYS     ║
╚══════════════════════════════════════════════════════════════════╝
BANNER

# ── 1. Sovereign + office + local-first ───────────────────────────
run "$HOME/.config/tmmt/god-mode.sh" off
export LOCAL_FIRST=1 HERMES_SEAT=taha
run "$ROOT/scripts/blip/office-mode.sh" broadcast
run "$ROOT/scripts/mesh/enforce-local-first.sh"
[[ -x "$HOME/.config/tmmt/train.sh" ]] && run "$HOME/.config/tmmt/train.sh" on

# ── 2. Carry forever-loop ─────────────────────────────────────────
run "$ROOT/scripts/forever-up.sh" carry

# ── 3. Ultimate drop (all devices) ────────────────────────────────
run "$ROOT/scripts/blip/make-ultimate-drop.sh"
[[ -d "$DROP" ]] && rm -rf "$RICK/DEVICE-DROPS/ULTIMATE-DROP" && cp -R "$DROP" "$RICK/DEVICE-DROPS/ULTIMATE-DROP"

# ── 4. Fleet command + Rick missions ──────────────────────────────
run "$ROOT/scripts/carry-fleet-command.sh"
run "$ROOT/scripts/rick-order.sh" --all

# ── 5. Mixtape / proof / showcase ─────────────────────────────────
run "$ROOT/scripts/showcase-ultimate.sh"
run "$ROOT/scripts/recompile-v3-master.sh"
run "$ROOT/scripts/fable-master-run.sh"
[[ -x "$RICK/BRAIN-FEED/compile-corpus.sh" ]] && run "$RICK/BRAIN-FEED/compile-corpus.sh"

# ── 6. Package ONE output folder (atomic — never empty mid-run) ───
STAGE="$OUT.staging-$TS"
rm -rf "$STAGE"
mkdir -p "$STAGE"
[[ -d "$DESK/★ TEAM-UP-SHOWCASE" ]] && cp -R "$DESK/★ TEAM-UP-SHOWCASE"/* "$STAGE/"
[[ -d "$DESK/HAILMARY-V3-MASTER" ]] && cp -R "$DESK/HAILMARY-V3-MASTER" "$STAGE/PROOF-V3"
[[ -d "$HOME/Desktop/FABLE-FEED-TONIGHT" ]] && cp -R "$HOME/Desktop/FABLE-FEED-TONIGHT" "$STAGE/FABLE-FEED"
[[ -d "$DROP" ]] && cp -R "$DROP" "$STAGE/ULTIMATE-DROP"
cp -f "$ROOT/docs/TRAPPER-CORPORATE-DAILY.md" "$ROOT/docs/ONE-SHOT-ALL-DEVICES.md" "$STAGE/" 2>/dev/null || true
(cd "$ROOT" && npm run ghl:check > "$STAGE/ghl-check.txt" 2>&1) || true
echo "ONE SHOT packaging… $(date)" > "$OUT/STATUS.txt" 2>/dev/null || mkdir -p "$OUT" && echo "ONE SHOT packaging… $(date)" > "$OUT/STATUS.txt"

# Link audit
MANIFEST="$STAGE/LINK-MANIFEST.json"
TS_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "{ \"verified_at\": \"$TS_ISO\", \"links\": ["
  for pair in \
    "Build|https://tmmt-ops.vercel.app/build" \
    "Kits|https://tmmt-ops.vercel.app/kits" \
    "Credit|https://tmmt-ops.vercel.app/forms/credit-funding-intake" \
    "Lead|https://tmmt-ops.vercel.app/forms/lead-intake" \
    "Join|https://tmmt-ops.vercel.app/join" \
    "Fit test|https://tmmt-ops.vercel.app/fit-test" \
    "Lead magnet|https://tmmt-ops.vercel.app/lp/aixmos/lead-magnet"; do
    name="${pair%%|*}"; url="${pair##*|}"
    read -r code final < <(curl -sS -o /dev/null -w "%{http_code} %{url_effective}" -L --connect-timeout 6 --max-time 12 "$url" 2>/dev/null || echo "000 $url")
    ok="true"; fix=""
    if [[ "$final" == *"/login"* && "$url" != *"/login"* ]]; then ok="false"; fix="needs deploy"; fi
    [[ "$code" == "000" ]] && ok="false"
    printf '  {"name":"%s","url":"%s","http":%s,"final":"%s","ok":%s' "$name" "$url" "$code" "$final" "$ok"
    [[ -n "$fix" ]] && printf ',"fix":"%s"' "$fix"
    echo "},"
  done
  echo '  {"name":"_end","ok":true}'
  echo " ] }"
} > "$MANIFEST"

# Sync everywhere
rm -rf "$OUT" && mv "$STAGE" "$OUT"
cp -R "$OUT"/* "$RICK/DEVICE-DROPS/ONE-SHOT/" 2>/dev/null || { mkdir -p "$RICK/DEVICE-DROPS/ONE-SHOT" && cp -R "$OUT"/* "$RICK/DEVICE-DROPS/ONE-SHOT/"; }
cp -f "$OUT/ULTIMATE-A-Z-SHOWCASE.md" "$RICK/OUTBOUND/ONE-SHOT.md" 2>/dev/null || true
[[ -d "$DROP/showcase" ]] && cp -R "$OUT"/* "$DROP/showcase/" 2>/dev/null || true

# ── 7. Rick blitz missions ────────────────────────────────────────
FLEET_WAIT=$(find "$INBOX" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
FLEET_DONE=$(find "$INBOX/done" -name '*-REPORT.md' 2>/dev/null | wc -l | tr -d ' ')

cat > "$INBOX/law-10000-${TS}-one-shot-deploy.md" <<'EOF'
# ONE SHOT — deploy public routes
cd ~/projects/TMMT || cd ~/Projects/TMMT
git pull && npm run build && bash scripts/ship --dry-run tmmt-ops
Report done/DEPLOY-READY.md — Taha types DEPLOY for prod.
EOF

run "$ROOT/scripts/rick-order.sh" "ONE SHOT: execute all P0 FLEET-INBOX deploy dry-run GHL prep showcase sync"

# ── 8. Fable paste (only thing after one-shot if you want polish) ─
cat > "$FABLE" <<FABLE
# ONE SHOT — FABLE 5 (optional polish only)
State: $(date) · Rick queue: ${FLEET_WAIT}w / ${FLEET_DONE}d · Output: $OUT

1. Read $OUT/PROOF-V3/MUHAMMAD-TAHA-PROOF-V3.md + $OUT/LINK-MANIFEST.json
2. npm run ghl:check → write $OUT/OWNER-GHL-5MIN.md
3. bash scripts/ship --dry-run tmmt-ops → if green tell Taha: bash scripts/ship tmmt-ops
4. PDF → $OUT/MIXTAPE.pdf → copy $RICK/OUTBOUND/MIXTAPE.pdf
GO.
FABLE
cp -f "$FABLE" "$RICK/OUTBOUND/FABLE-PASTE.md"

# ── 9. Desktop launcher (THE ONLY FILE YOU NEED) ──────────────────
cat > "$DESK/★ ONE-SHOT.command" <<'LAUNCH'
#!/bin/bash
for d in ~/Projects/TMMT ~/projects/TMMT; do
  [[ -x "$d/scripts/one-shot.sh" ]] && exec bash "$d/scripts/one-shot.sh" open
done
osascript -e 'display alert "TMMT not found" message "Clone AIXMOS537/TMMT first."'
LAUNCH
chmod +x "$DESK/★ ONE-SHOT.command"

# ── 10. Done ──────────────────────────────────────────────────────
cat > "$DESK/★ ONE-SHOT-DONE.txt" <<DONE
ONE SHOT COMPLETE — $(date)
============================
Everything is in: $OUT

Rick: ${FLEET_WAIT} queued · ${FLEET_DONE} done
Mesh: brainiac-7 · fleet · desktop-v9gqhhj (check tailscale status)

OPTIONAL Fable polish only:
  god on && cd ~/Brain/vault && claude
  paste: $FABLE

Money (you only):
  bash scripts/ship tmmt-ops  (after dry-run green)
  GHL paste: see $OUT/ghl-check.txt

Pass out: AirDrop folder $OUT
Re-run anytime: double-click ★ ONE-SHOT.command
DONE

cat <<DONE

╔══════════════════════════════════════════════════════════════════╗
║  ★ ONE SHOT COMPLETE                                             ║
╠══════════════════════════════════════════════════════════════════╣
║  OUTPUT:  $OUT
║  RICK:    ${FLEET_WAIT} missions · ${FLEET_DONE} done
╠══════════════════════════════════════════════════════════════════╣
║  THAT'S IT. Re-run: double-click ★ ONE-SHOT.command on Desktop   ║
║  Fable (optional): god on → paste $FABLE
╚══════════════════════════════════════════════════════════════════╝

DONE

[[ "${1:-}" == "open" ]] && open "$OUT" "$OUT/index.html" "$FABLE" "$DESK/★ ONE-SHOT-DONE.txt" 2>/dev/null || true
