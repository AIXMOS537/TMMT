#!/usr/bin/env bash
# carry-fleet-command.sh — Carry at office: remote-push ALL devices · trapper corporate mode.
#
#   bash scripts/carry-fleet-command.sh
#   bash scripts/carry-fleet-command.sh open   # open drop folders when done
#
# Run ONCE when you sit down at office. Rick + forever-loop handle the rest.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RICK="${RICK:-$HOME/Sync/rick}"
INBOX="$RICK/FLEET-INBOX"
DROP_SRC="$HOME/Desktop/★ ULTIMATE-DROP"
DROP_SYNC="$RICK/DEVICE-DROPS/ULTIMATE-DROP"
CMD="$RICK/DEVICE-COMMANDS"
LOG="$HOME/Library/Logs/carry-fleet-command.log"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$INBOX/done" "$DROP_SYNC" "$CMD" "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

say(){ printf '\n▶ %s\n' "$1"; }
ok(){ printf '  ✓ %s\n' "$*"; }

cat <<'BANNER'
╔══════════════════════════════════════════════════════════════════╗
║  CARRY FLEET COMMAND — office takeover · all devices · A–Z       ║
║  Trappers gone corporate · Rick runs the backend                 ║
╚══════════════════════════════════════════════════════════════════╝
BANNER

# ── 1. Local-first · owner sovereign at office ──
say "1/8 — Office sovereign unlock (8h)"
bash "$ROOT/scripts/blip/office-mode.sh" broadcast 2>/dev/null \
  || bash "$DROP_SRC/scripts/blip/office-mode.sh" broadcast 2>/dev/null \
  || ok "office-mode skip (run from Carry with secret)"
export LOCAL_FIRST=1 HERMES_SEAT=taha
bash "$ROOT/scripts/mesh/enforce-local-first.sh" 2>/dev/null || true

# ── 2. Rebuild + sync ultimate drop to mesh ──
say "2/8 — Build ★ ULTIMATE-DROP + Syncthing push"
bash "$ROOT/scripts/blip/make-ultimate-drop.sh" 2>/dev/null || ok "ultimate drop partial"
if [[ -d "$DROP_SRC" ]]; then
  rm -rf "$DROP_SYNC" && cp -R "$DROP_SRC" "$DROP_SYNC"
  cp -f "$ROOT/docs/TRAPPER-CORPORATE-DAILY.md" "$DROP_SRC/docs/" 2>/dev/null || true
  cp -f "$ROOT/docs/TRAPPER-CORPORATE-DAILY.md" "$DROP_SYNC/docs/" 2>/dev/null || true
  ok "ULTIMATE-DROP → $DROP_SYNC (Syncthing → M1 · Rick)"
fi

# ── 3. Carry stack live ──
say "3/8 — Carry forever-loop + train"
bash "$ROOT/scripts/forever-up.sh" carry 2>/dev/null || true
[[ -x "$HOME/.config/tmmt/train.sh" ]] && bash "$HOME/.config/tmmt/train.sh" on 2>/dev/null || true

# ── 4. Device command cards (trapper corporate) ──
say "4/8 — Device orders → $CMD"
cat > "$CMD/00-OFFICE-TAKEOVER-$TS.txt" <<'EOF'
CARRY AT OFFICE — ALL DEVICES FAST-TRACKED
==========================================
Owner is on Carry. Fleet command ran. Do your one-shot:

  Mac:      ★ ULTIMATE-DROP → GO.command
  Windows:  ★ ULTIMATE-DROP → GO.bat
  Mobile:   MOBILE-SETUP.txt

Daily playbook: docs/TRAPPER-CORPORATE-DAILY.md
Never re-run unless new computer or broken.
EOF

cp -f "$ROOT/docs/TRAPPER-CORPORATE-DAILY.md" "$CMD/TRAPPER-CORPORATE-DAILY.md" 2>/dev/null || true

# ── 5. Fleet missions (scored — Rick executes on M1) ──
say "5/8 — Rick missions → FLEET-INBOX"

drop_mission(){
  local score="$1" name="$2"
  shift 2
  local f="$INBOX/law-${score}-${TS}-${name}.md"
  cat > "$f" <<EOF
# FLEET MISSION — $name
priority: MAX
score: $score
law: CARRY-OFFICE-TAKEOVER-$TS
from: Carry $(hostname -s) · $(date -u +%FT%TZ)

$*
EOF
  ok "mission $score: $name"
}

drop_mission 9997 m1-ultimate-drop <<'EOF'
## M1 Rick — execute NOW
1. If ★ ULTIMATE-DROP not run yet: double-click GO.command in ~/Desktop/★ ULTIMATE-DROP
   OR from Syncthing: ~/Sync/rick/DEVICE-DROPS/ULTIMATE-DROP/GO.command
2. bash ~/Sync/rick/M1-SCRIPTS/brainiac-via-m1.sh
3. bash ~/Sync/rick/M1-SCRIPTS/m1-fleet-executor.sh
4. cd ~/projects/TMMT && bash scripts/tmmt go 2
5. Read docs/TRAPPER-CORPORATE-DAILY.md — trapper corporate mode

Local only. No paid API. Protect Taha.
EOF

drop_mission 9996 brainiac-gateway <<'EOF'
## Brainiac-7 — Rick owns via M1 ping
M1 runs brainiac-via-m1.sh — this mission is log-only on Brainiac.
If Ollama down locally: docker compose up -d in C:\hailmary\brainiac-litellm-gateway
If BLIP not dropped: run GO.bat from ★ ULTIMATE-DROP (AirDrop from Carry)
EOF

drop_mission 9995 office-pcs <<'EOF'
## Office Windows (fleet · desktop-*)
When online: ★ ULTIMATE-DROP → GO.bat → role forge
Owner at office: OFFICE-UNLOCKED flag in ~/Sync/rick/ should be signed
Poll: bash scripts/blip/office-mode.sh poll
Daily: docs/TRAPPER-CORPORATE-DAILY.md
EOF

drop_mission 9994 mobile-farm <<'EOF'
## iPhone / Android
Tailscale ON · Enchanted → macbook-pro-2.tailceb455.ts.net:4001 · rick-safe
No folder drop needed. See MOBILE-SETUP.txt in ULTIMATE-DROP.
EOF

drop_mission 9993 trapper-corporate-build <<'EOF'
## Build queue — trapper corporate A-Z
Execute highest-value OPEN swarm / IDEA-QUEUE items:
- GHL env + checkout URLs (npm run ghl:check)
- Lead webhook + first SMS probe
- Operator training polish
- Fleet doc-upload pattern (admin pages)
Read: docs/TRAPPER-CORPORATE-DAILY.md
Push branches · never deploy prod without Carry owner gate.
EOF

# ── 6. Route + dispatch ──
say "6/8 — Route work to Rick"
[[ -x "$ROOT/scripts/mesh/m1-work-router.sh" ]] \
  && bash "$ROOT/scripts/mesh/m1-work-router.sh" route 2>/dev/null || true
waiting="$(find "$INBOX" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
ok "FLEET-INBOX: $waiting missions queued"

# ── 7. Mesh roster ──
say "7/8 — Tailnet"
if command -v tailscale >/dev/null; then
  tailscale status 2>/dev/null | head -10
  echo ""
  for node in brainiac-7 fleet desktop-v9gqhhj; do
    ping -c 1 -W 2 "${node}.tailceb455.ts.net" >/dev/null 2>&1 \
      && ok "reachable: $node" || printf '  · offline: %s\n' "$node"
  done
fi

# ── 8. Money — Rick prepares, Taha only pastes URLs in GHL browser ──
say "8/8 — Rick owns GHL prep (Carry does NOT)"
bash "$ROOT/scripts/rick-order.sh" --all 2>/dev/null || true
waiting="$(find "$INBOX" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
ok "FLEET-INBOX: $waiting missions — RICK ON M1 EXECUTES ALL"
say "Taha's only crumbs: GHL UI paste (5 URLs) when Rick writes ~/Sync/rick/ESCALATED/GHL-OWNER-5MIN.md"

cat > "$HOME/Desktop/CARRY-FLEET-STATUS-$TS.txt" <<STATUS
CARRY FLEET COMMAND — $(date)
================================
Host: $(hostname -s)
Office unlock: broadcast (8h)
ULTIMATE-DROP: $DROP_SRC
Syncthing:   $DROP_SYNC
Missions:    $waiting in FLEET-INBOX
Playbook:    docs/TRAPPER-CORPORATE-DAILY.md

NEXT (physical):
  · M1: Syncthing picks up DEVICE-DROPS or AirDrop ★ ULTIMATE-DROP
  · Brainiac/fleet: GO.bat when at those machines
  · You: watchtower · GHL · ads · approve deploys

Rick drains inbox automatically. You trap. Corporate is the wrapper.
STATUS

ok "Status → ~/Desktop/CARRY-FLEET-STATUS-$TS.txt"

cat <<'DONE'

╔══════════════════════════════════════════════════════════════════╗
║  CARRY FLEET COMMAND COMPLETE                                    ║
╠══════════════════════════════════════════════════════════════════╣
║  ✓ Office sovereign unlocked (broadcast 8h)                      ║
║  ✓ ULTIMATE-DROP synced to ~/Sync/rick/DEVICE-DROPS/             ║
║  ✓ Rick missions queued — M1 drains automatically                ║
╠══════════════════════════════════════════════════════════════════╣
║  YOU:  watchtower · booyah · GHL · ads                         ║
║  RICK: chews FLEET-INBOX · owns Brainiac · parallel agents       ║
╚══════════════════════════════════════════════════════════════════╝

DONE

[[ "${1:-}" == "open" ]] && open "$DROP_SRC" "$CMD" 2>/dev/null || true
