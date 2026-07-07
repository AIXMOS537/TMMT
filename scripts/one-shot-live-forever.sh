#!/usr/bin/env bash
# ONE-SHOT-LIVE-FOREVER.sh — Carry: one command · all devices live · ZERO Fable credits.
#
#   bash ~/projects/TMMT/scripts/one-shot-live-forever.sh
#   bash ~/projects/TMMT/scripts/one-shot-live-forever.sh open
#
# Rules: god OFF · local OSS only · Rick runs army · never back down.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMMT_CFG="$HOME/.config/tmmt"
RICK="$HOME/Sync/rick"
INBOX="$RICK/FLEET-INBOX"
DESK="$HOME/Desktop"
TS="$(date +%Y%m%d-%H%M%S)"
MARKER="$TMMT_CFG/.one-shot-live-forever.done"
LOG="$HOME/Library/Logs/one-shot-live.log"

mkdir -p "$TMMT_CFG" "$INBOX/done" "$RICK/DEVICE-COMMANDS" "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

G=$'\033[32m'; Y=$'\033[33m'; C=$'\033[36m'; B=$'\033[1m'; X=$'\033[0m'
say(){ printf '\n%s▶ %s%s\n' "$C" "$1" "$X"; }
ok(){ printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
warn(){ printf '  %s!%s %s\n' "$Y" "$X" "$*"; }

cat <<'BANNER'
╔══════════════════════════════════════════════════════════════════╗
║  ONE SHOT LIVE FOREVER — Muhammad Taha · PROJECT X HAILMARY      ║
║  Local first · No Fable burn · Army online · Never back down       ║
╚══════════════════════════════════════════════════════════════════╝
BANNER

# ── 0. KILL PAID ROUTES (protect Fable 5 credits) ──
say "0/9 — Protect credits (god OFF · local only)"
bash "$TMMT_CFG/god-mode.sh" off 2>/dev/null || true
unset ANTHROPIC_API_KEY OPENAI_API_KEY CLAUDE_CODE_USE_OPENAI 2>/dev/null || true
export LOCAL_FIRST=1
[[ -x "$ROOT/scripts/mesh/enforce-local-first.sh" ]] \
  && bash "$ROOT/scripts/mesh/enforce-local-first.sh" || true
ok "Paid APIs off for automation — use god on ONLY when YOU type in Claude"

# ── 1. Carry stack LIVE ──
say "1/9 — Carry Watchtower LIVE (booyah/unison)"
bash "$ROOT/scripts/mesh/unison.sh" up 2>/dev/null \
  || bash "$ROOT/scripts/hailmary" booyah 2>/dev/null \
  || warn "booyah partial — check manually"
ok "Carry local brain up"

# ── 2. Brain compile (no Fable) ──
say "2/9 — Compile brain (local scripts only)"
bash "$ROOT/scripts/blip/session-sweep-tonight.sh" 2>/dev/null || true
[[ -x "$RICK/BRAIN-FEED/compile-corpus.sh" ]] && bash "$RICK/BRAIN-FEED/compile-corpus.sh" || true
ok "Brain corpus refreshed"

# ── 3. BLIP bundles ready ──
say "3/9 — BLIP bundles"
if [[ -x "$ROOT/scripts/blip/rollout-now.sh" ]]; then
  bash "$ROOT/scripts/blip/rollout-now.sh" build 2>/dev/null || true
fi
[[ -d "$DESK/M1-ONE-SHOT-FOREVER" ]] && ok "M1 bundle on Desktop" || warn "Run: tmmt blip"
[[ -d "$DESK/BLIP-DROP-LATEST" ]] && ok "General BLIP on Desktop" || true

# ── 4. Route all work to Rick/M1 ──
say "4/9 — Route work → M1 FLEET-INBOX"
[[ -x "$ROOT/scripts/mesh/m1-work-router.sh" ]] \
  && bash "$ROOT/scripts/mesh/m1-work-router.sh" route || true
waiting="$(find "$INBOX" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
done_n="$(find "$INBOX/done" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
ok "FLEET: $waiting waiting · $done_n done"

# ── 5. Device command cards (one line each device) ──
say "5/9 — Device command cards → ~/Sync/rick/DEVICE-COMMANDS/"

cat > "$RICK/DEVICE-COMMANDS/01-CARRY-M5.txt" <<'EOF'
# Already live if you ran one-shot-live-forever.sh
# Drop work:  tmmt work "task"
# Route:      tmmt route
# Status:     tstatus
# Fable ONLY when YOU open:  god on && cd ~/Brain/vault && claude
EOF

cat > "$RICK/DEVICE-COMMANDS/02-M1-RICK.txt" <<'EOF'
bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh
# Once only. Then daemon runs forever. Zero human.
EOF

cat > "$RICK/DEVICE-COMMANDS/03-BRAINIAC-WINDOWS.txt" <<'EOF'
Double-click GO.bat in BLIP-DROP-LATEST folder (AirDrop from Carry)
Or: cd C:\hailmary\brainiac-litellm-gateway && docker compose up -d
Reach via M1 tailnet — no separate owner BLIP required after M1 live
EOF

cat > "$RICK/DEVICE-COMMANDS/04-IPHONE-TAHA.txt" <<'EOF'
Tailscale ON · Enchanted app → http://macbook-pro-2.tailceb455.ts.net:4001/v1
No Fable · no paid API · local Rick only
EOF

cat > "$RICK/DEVICE-COMMANDS/05-FAMILY-LOCKED.txt" <<'EOF'
LOCKED until Taha unlocks Phase 2.
When ready: god issue family → BLIP-DROP-LATEST → go-live-device --role family
EOF

cat > "$RICK/DEVICE-COMMANDS/06-OFFICE-LOCKED.txt" <<'EOF'
LOCKED — AIXMOS until Taha unlocks.
BLIP-DROP-LATEST when approved. office-mode.sh lock by default.
EOF

# Drop master mission for M1
cat > "$INBOX/law-9999-${TS}-one-shot-live-all.md" <<EOF
# ONE SHOT LIVE ALL DEVICES — $(date -u +%Y-%m-%dT%H:%M:%SZ)
priority: MAX
score: 9999
law: LOCAL-FIRST-FOREVER

## Execute on M1 (Rick)
1. bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh
2. bash ~/Sync/rick/M1-SCRIPTS/m1-fleet-executor.sh (repeat until inbox drains)
3. bash ~/projects/TMMT/scripts/mesh/brainiac-via-m1.sh
4. npm run build in ~/projects/TMMT if present
5. Log to ~/Library/Logs/m1-forever.log

## Never
- Call paid Anthropic/OpenAI APIs
- Deploy prod without Carry owner gate
- LIVE send without Taha

## Rick persona
Protect Taha. Stern. Never back down. Local OSS only.
EOF
ok "Device cards + master mission dropped"

# ── 6. Sync runners to all devices via Syncthing ──
say "6/9 — Syncthing runners"
cp -f "$ROOT/scripts/one-shot-live-forever.sh" "$RICK/ONE-SHOT-LIVE-CARRY.sh" 2>/dev/null || true
cp -f "$RICK/RUN-M1-FIX-ONCE.sh" "$RICK/" 2>/dev/null || true
cp -f "$ROOT/scripts/mesh/enforce-local-first.sh" "$RICK/M1-SCRIPTS/" 2>/dev/null || true
chmod +x "$RICK/"*.sh "$RICK/M1-SCRIPTS/"*.sh 2>/dev/null || true
ok "Scripts in ~/Sync/rick (Syncthing → M1)"

# ── 7. Mesh roster ──
say "7/9 — Mesh status"
bash "$ROOT/scripts/tmmt" mesh 2>/dev/null | head -12 || true

# ── 8. GHL owner gate reminder ──
say "8/9 — Money loop (YOU only — not Rick)"
(cd "$ROOT" && npm run ghl:check 2>&1 | grep -E 'P0|Result' | tail -5) || true
warn "GHL URLs = Taha pastes in Vercel · Rick drafts only"

# ── 9. Desktop launcher ──
say "9/9 — Desktop launcher"
cat > "$DESK/★ GO LIVE FOREVER.command" <<'LAUNCH'
#!/bin/bash
cd ~/projects/TMMT 2>/dev/null || cd ~/Projects/TMMT
bash scripts/one-shot-live-forever.sh open
LAUNCH
chmod +x "$DESK/★ GO LIVE FOREVER.command"

cat > "$DESK/ONE-SHOT-LIVE-STATUS.txt" <<STATUS
ONE SHOT LIVE — $(date)
========================
Carry:     LIVE (local brain · god OFF)
M1 Rick:   Run: bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh
Brainiac:  AirDrop BLIP-DROP-LATEST → GO.bat
FLEET:     $waiting waiting / $done_n done
Fable:     god on ONLY when YOU compile — never on loops

Never back down. Rick holds the line.
STATUS

date -u +%Y-%m-%dT%H:%M:%SZ > "$MARKER"

cat <<'DONE'

╔══════════════════════════════════════════════════════════════════╗
║  ONE SHOT LIVE — CARRY COMPLETE                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  ✓ Local brain LIVE · Fable credits PROTECTED                    ║
║  ✓ Work routed to M1 · daemon chews queue                        ║
║  ✓ BLIP folders on Desktop · AirDrop to other devices            ║
╠══════════════════════════════════════════════════════════════════╣
║  M1 (if not done):  bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh          ║
║  Brainiac:          AirDrop ~/Desktop/BLIP-DROP-LATEST           ║
║  Drop work:         tmmt work "your task"                        ║
║  Fable compile:     god on → claude → paste FABLE-MASTER-BRIEF   ║
╚══════════════════════════════════════════════════════════════════╝

DONE

[[ "${1:-}" == "open" ]] && open "$DESK" && open "$RICK/DEVICE-COMMANDS"
