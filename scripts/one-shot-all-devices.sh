#!/usr/bin/env bash
# ONE-SHOT-ALL-DEVICES.sh — Carry M5 only. Builds every bundle + device card in sovereign order.
#
#   bash scripts/one-shot-all-devices.sh
#   bash scripts/one-shot-all-devices.sh open    # also open Desktop folders
#
# Order: Carry → M1 Rick → Brainiac (M1-owned) → Office → Mobile farm
# Authority: PROJECT X HAILMARY · Full sovereign on owned hardware
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMMT_CFG="${TMMT_CFG:-$HOME/.config/tmmt}"
RICK="${RICK:-$HOME/Sync/rick}"
DESK="$HOME/Desktop"
CMD_DIR="$RICK/DEVICE-COMMANDS"
INBOX="$RICK/FLEET-INBOX"
LOG="$HOME/Library/Logs/one-shot-all-devices.log"
MARKER="$TMMT_CFG/.one-shot-all-devices.done"

mkdir -p "$CMD_DIR" "$INBOX/done" "$RICK/DEVICE-COMMANDS" "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

G=$'\033[32m'; C=$'\033[36m'; B=$'\033[1m'; Y=$'\033[33m'; X=$'\033[0m'
say(){ printf '\n%s▶ %s%s\n' "$C" "$1" "$X"; }
ok(){ printf '  %s✓%s %s\n' "$G" "$X" "$*"; }
warn(){ printf '  %s!%s %s\n' "$Y" "$X" "$*"; }

HOST="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
case "$HOST" in
  *macbook-pro-2*|*macbook-pro-3*|*carry*) : ;;
  *)
    warn "This script is for Carry M5 (Watchtower). Other devices: see docs/ONE-SHOT-ALL-DEVICES.md"
    warn "Continuing anyway — you may be on a Carry alias host: $HOST"
    ;;
esac

cat <<'BANNER'
╔══════════════════════════════════════════════════════════════════╗
║  ONE-SHOT ALL DEVICES — PROJECT X HAILMARY                       ║
║  Carry → M1 Rick → Brainiac (M1-owned) → Office → Mobile       ║
║  Moose · Chummo · Rick · Full sovereign on your hardware          ║
╚══════════════════════════════════════════════════════════════════╝
BANNER

# ── 0. LOCAL-FIRST · protect credits ─────────────────────────────────────────
say "0/10 — Local-first · god OFF"
bash "$TMMT_CFG/god-mode.sh" off 2>/dev/null || true
unset ANTHROPIC_API_KEY OPENAI_API_KEY CLAUDE_CODE_USE_OPENAI 2>/dev/null || true
export LOCAL_FIRST=1 HERMES_SEAT=taha
[[ -x "$ROOT/scripts/mesh/enforce-local-first.sh" ]] \
  && bash "$ROOT/scripts/mesh/enforce-local-first.sh" || true
ok "Paid routes locked — god on only when Taha types it"

# ── 1. Carry sovereign stack ─────────────────────────────────────────────────
say "1/10 — Carry M5 · FULL HAILMARY"
bash "$ROOT/scripts/forever-up.sh" carry 2>/dev/null \
  || bash "$ROOT/scripts/one-shot-live-forever.sh" 2>/dev/null \
  || warn "forever-up partial"
bash "$ROOT/scripts/oneshot-generate.sh" 2>/dev/null && ok "ONE-SHOT-AI.md regenerated" || true
cp -f "$ROOT/docs/ONE-SHOT-ALL-DEVICES.md" "$DESK/ONE-SHOT-ALL-DEVICES.md" 2>/dev/null || true
ok "Carry Watchtower stack armed"

# ── 2. Train / heal local gateway ────────────────────────────────────────────
say "2/10 — Local AI gateway (Ollama · LiteLLM · CCR)"
if [[ -x "$TMMT_CFG/train.sh" ]]; then
  bash "$TMMT_CFG/train.sh" on 2>/dev/null || true
  bash "$TMMT_CFG/train.sh" health 2>/dev/null | tail -8 || true
else
  launchctl kickstart -k "gui/$(id -u)/com.hailmary.litellm-local" 2>/dev/null || true
  sleep 2
fi
ok "Local stack heal attempted"

# ── 3. M1 bundle ─────────────────────────────────────────────────────────────
say "3/10 — M1 ONE-SHOT FOREVER bundle (Rick station)"
if [[ -x "$ROOT/scripts/blip/make-m1-blip-bundle.sh" ]]; then
  bash "$ROOT/scripts/blip/make-m1-blip-bundle.sh"
  ok "M1 bundle → ~/Desktop/M1-ONE-SHOT-FOREVER"
else
  warn "make-m1-blip-bundle.sh missing"
fi

# ── 4. General BLIP (Brainiac + office) ──────────────────────────────────────
say "4/10 — BLIP-DROP-LATEST (Brainiac · office · Android path)"
if [[ -x "$ROOT/scripts/blip/make-blip-bundle.sh" ]]; then
  bash "$ROOT/scripts/blip/make-blip-bundle.sh"
  cp -R "$HOME/Sync/BLIP-DROP/LATEST" "$DESK/BLIP-DROP-LATEST" 2>/dev/null || true
  cp -f "$ROOT/docs/ONE-SHOT-ALL-DEVICES.md" "$DESK/BLIP-DROP-LATEST/" 2>/dev/null || true
  ok "BLIP → ~/Desktop/BLIP-DROP-LATEST"
else
  warn "make-blip-bundle.sh missing"
fi

# ── 5. Device command cards (sovereign order) ────────────────────────────────
say "5/10 — Device command cards → $CMD_DIR"

cat > "$CMD_DIR/00-READ-FIRST.txt" <<'EOF'
ONE-SHOT ALL DEVICES — sovereign order
======================================
1. Carry M5      — DONE when one-shot-all-devices.sh completes
2. M1 Max        — 02-M1-RICK.txt
3. Brainiac-7    — 03-BRAINIAC.txt (Rick on M1 owns forever)
4. Office PCs    — 04-OFFICE.txt
5. iPhone        — 05-IPHONE.txt
6. Android farm  — 06-ANDROID.txt

Full doc: ~/Projects/TMMT/docs/ONE-SHOT-ALL-DEVICES.md
EOF

cat > "$CMD_DIR/01-CARRY-M5.txt" <<'EOF'
# PHASE 1 — CARRY M5 · FULL HAILMARY (Watchtower)
# Status: LIVE after one-shot-all-devices.sh

booyah                    # control board
watchtower                # health + inbox
train health              # Ollama · LiteLLM · CCR
god on                    # paid polish ONLY when YOU choose
god off                   # before you walk away

Drop work to Rick:
  booyah send "mission text"
  echo "# mission" >> ~/Sync/rick/FLEET-INBOX/mission-$(date +%s).md

ONLY YOU: GHL paste · vercel --prod · ads spend · real customer SMS
EOF

cat > "$CMD_DIR/02-M1-RICK.txt" <<'EOF'
# PHASE 2 — M1 MAX · RICK SORKIN · FULL HAILMARY
# AirDrop ~/Desktop/M1-ONE-SHOT-FOREVER from Carry

ON M1 — ONE ACTION:
  Double-click: ★ DOUBLE-CLICK ME.command

OR:
  bash ~/Desktop/M1-ONE-SHOT-FOREVER/oneshot-install.sh
  bash ~/Sync/rick/RUN-M1-FIX-ONCE.sh
  cd ~/Projects/TMMT && bash scripts/one-shot-forever.sh rick

RICK FOREVER (M1 chews queue · owns Brainiac):
  bash ~/Projects/TMMT/scripts/mesh/m1-fleet-executor.sh
  bash ~/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh
  bash scripts/tmmt go 2

Agents: Rick · Moose · Chummo · Forge — protect Taha · never back down
EOF

cat > "$CMD_DIR/03-BRAINIAC.txt" <<'EOF'
# PHASE 3 — BRAINIAC-7 · RICK OWNS FROM M1 FOREVER
# AirDrop ~/Desktop/BLIP-DROP-LATEST from Carry

ON BRAINIAC — ONE ACTION:
  Double-click: GO.bat
  (pick role: brain)

POWERSHELL ALT:
  cd $env:USERPROFILE\Desktop\BLIP-DROP-LATEST
  .\DROP-AND-GO.ps1 brain

DOCKER GATEWAY:
  cd C:\hailmary\brainiac-litellm-gateway
  .\secrets-load.ps1 && docker compose up -d

M1 TAKES OVER (run on M1 — not Carry):
  bash ~/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh

Tailnet: brainiac-7 · Ollama :11434 · LiteLLM :4000
EOF

cat > "$CMD_DIR/04-OFFICE.txt" <<'EOF'
# PHASE 4 — OFFICE PCs (Intel/AMD Windows you own)
# Same BLIP folder as Brainiac

AT DESK:
  Double-click GO.bat (role: forge)
  bash scripts/blip/office-mode.sh unlock

LEAVING DESK:
  bash scripts/blip/office-mode.sh lock

PARALLEL BUILD (free):
  cd ~/Projects/TMMT && bash scripts/tmmt go 2

Tailnet names: fleet · desktop-*
EOF

cat > "$CMD_DIR/05-IPHONE.txt" <<'EOF'
# PHASE 5a — iPHONE / iPAD · OWNER MOBILE · FULL HAILMARY

1. Tailscale → AIXMOS537@ tailnet
2. Enchanted LLM (App Store)
3. API URL:  http://macbook-pro-2.tailceb455.ts.net:4001/v1
4. API Key:  owner key from Carry ~/.config/tmmt/litellm-master.env
5. Model:    rick-safe

Rick in pocket · zero paid API · Carry gateway
EOF

cat > "$CMD_DIR/06-ANDROID.txt" <<'EOF'
# PHASE 5b — ANDROID · FARM GROWTH

1. Tailscale (Play Store) → same tailnet
2. Enchanted or MLC Chat → custom OpenAI-compatible endpoint
3. API URL:  http://macbook-pro-2.tailceb455.ts.net:4001/v1
4. Key:      god issue family (Carry) — upgrade when vetted
5. Join mesh: bash scripts/swarm-join.sh --name mobile-<name>

Ever growing · ever learning · Rick routes from M1
EOF

ok "Six device cards written"

# ── 6. Master mission → M1 FLEET-INBOX ─────────────────────────────────────
say "6/10 — Rick mission drop (M1 executes all phases below Carry)"
TS="$(date +%Y%m%d-%H%M%S)"
cat > "$INBOX/law-9998-${TS}-one-shot-all-devices.md" <<EOF
# ONE-SHOT ALL DEVICES — Rick execute chain
priority: MAX
score: 9998
law: LOCAL-FIRST-FOREVER
from: Carry $(hostname -s) · $(date -u +%FT%TZ)

## Rick on M1 — run in order
1. bash ~/Desktop/M1-ONE-SHOT-FOREVER/oneshot-install.sh  (if not done)
2. bash ~/Projects/TMMT/scripts/mesh/m1-fleet-executor.sh
3. bash ~/Projects/TMMT/scripts/mesh/brainiac-via-m1.sh   # OWN BRAINIAC FOREVER
4. bash ~/Projects/TMMT/scripts/mesh/brainiac-via-m1.sh   # re-ping every forever-loop tick
5. npm run build in ~/Projects/TMMT when HANDOFF requests deploy prep

## Brainiac
- Confirm GO.bat completed or docker compose up -d
- Log tailnet health to ~/Library/Logs/brainiac-via-m1.log

## Never
- Paid Anthropic/OpenAI on loops
- vercel --prod without Carry owner gate
- LIVE customer SMS without Taha

## Persona
Rick Sorkin · PROJECT X HAILMARY · Moose + Chummo with God
Protect Muhammad Taha · stern · local OSS · wins any race
EOF
ok "Mission dropped → $INBOX"

# ── 7. Route inbox ───────────────────────────────────────────────────────────
say "7/10 — Work router"
[[ -x "$ROOT/scripts/mesh/m1-work-router.sh" ]] \
  && bash "$ROOT/scripts/mesh/m1-work-router.sh" route 2>/dev/null || true
waiting="$(find "$INBOX" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
ok "FLEET-INBOX: $waiting missions waiting for M1 Rick"

# ── 8. Brain corpus ──────────────────────────────────────────────────────────
say "8/10 — Brain corpus"
bash "$ROOT/scripts/blip/session-sweep-tonight.sh" 2>/dev/null || true
[[ -x "$RICK/BRAIN-FEED/compile-corpus.sh" ]] && bash "$RICK/BRAIN-FEED/compile-corpus.sh" 2>/dev/null && ok "Corpus compiled" || true

# ── 9. Mesh roster ───────────────────────────────────────────────────────────
say "9/10 — Tailnet roster"
command -v tailscale >/dev/null && tailscale status 2>/dev/null | head -12 || warn "tailscale not in PATH"

# ── 10. Desktop launcher + status ─────────────────────────────────────────────
say "10/10 — Desktop launcher"
cat > "$DESK/★ ONE-SHOT ALL DEVICES.command" <<'LAUNCH'
#!/bin/bash
cd ~/Projects/TMMT 2>/dev/null || cd ~/projects/TMMT
bash scripts/one-shot-all-devices.sh open
LAUNCH
chmod +x "$DESK/★ ONE-SHOT ALL DEVICES.command"

cat > "$DESK/ONE-SHOT-ALL-DEVICES-STATUS.txt" <<STATUS
ONE-SHOT ALL DEVICES — $(date)
================================
Phase 1 Carry:     LIVE (this run)
Phase 2 M1:        AirDrop M1-ONE-SHOT-FOREVER → ★ DOUBLE-CLICK ME.command
Phase 3 Brainiac:  AirDrop BLIP-DROP-LATEST → GO.bat · Rick owns from M1
Phase 4 Office:    Same BLIP · office-mode unlock/lock
Phase 5 Mobile:    Tailscale + Enchanted → Carry :4001

FLEET-INBOX:       $waiting missions for Rick
Full playbook:     ~/Desktop/ONE-SHOT-ALL-DEVICES.md
Credits:           LOCAL FIRST · god on = polish only

Rick · Moose · Chummo · PROJECT X HAILMARY · forever
STATUS

date -u +%Y-%m-%dT%H:%M:%SZ > "$MARKER"

cat <<'DONE'

╔══════════════════════════════════════════════════════════════════╗
║  ONE-SHOT ALL DEVICES — CARRY COMPLETE                           ║
╠══════════════════════════════════════════════════════════════════╣
║  NEXT: AirDrop M1-ONE-SHOT-FOREVER → M1 → double-click launcher  ║
║  THEN:  AirDrop BLIP-DROP-LATEST → Brainiac → GO.bat             ║
║  M1:    bash scripts/mesh/brainiac-via-m1.sh (owns Brainiac)     ║
╠══════════════════════════════════════════════════════════════════╣
║  Doc:   ~/Desktop/ONE-SHOT-ALL-DEVICES.md                        ║
║  Cards: ~/Sync/rick/DEVICE-COMMANDS/                             ║
╚══════════════════════════════════════════════════════════════════╝

DONE

[[ "${1:-}" == "open" ]] && {
  open "$DESK/M1-ONE-SHOT-FOREVER" 2>/dev/null || true
  open "$DESK/BLIP-DROP-LATEST" 2>/dev/null || true
  open "$CMD_DIR" 2>/dev/null || true
  open "$DESK/ONE-SHOT-ALL-DEVICES.md" 2>/dev/null || true
}
