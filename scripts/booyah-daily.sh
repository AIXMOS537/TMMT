#!/usr/bin/env bash
# booyah-daily.sh — EVERY MORNING: HAILMARY live on this device · local only · no Fable burn.
#
#   booyah              (alias — same thing)
#   tmmt day
#   bash ~/Sync/rick/BOOYAH-DAILY.sh
#
set -uo pipefail

HOST="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
TMMT=""
for d in "$HOME/projects/TMMT" "$HOME/Projects/TMMT"; do
  [[ -f "$d/scripts/booyah-daily.sh" ]] && TMMT="$d" && break
done

say(){ printf '▶ %s\n' "$*"; }
ok(){ printf '✓ %s\n' "$*"; }

# ── M1 / Rick station ──
if [[ "$HOST" == *tmmt* || "$HOST" == *rick* || "$HOST" == *projectaixmos* || "$HOST" == *forge* ]]; then
  say "BOOYAH DAILY — Rick/M1"
  export LOCAL_FIRST=1
  unset ANTHROPIC_API_KEY OPENAI_API_KEY CLAUDE_CODE_USE_OPENAI 2>/dev/null || true
  [[ -x "$HOME/Sync/rick/RUN-M1-FIX-ONCE.sh" && ! -f "$HOME/.config/tmmt/.m1-fix-once.done" ]] \
    && bash "$HOME/Sync/rick/RUN-M1-FIX-ONCE.sh" && exit 0
  [[ -x "$HOME/Sync/rick/M1-SCRIPTS/m1-fleet-executor.sh" ]] \
    && bash "$HOME/Sync/rick/M1-SCRIPTS/m1-fleet-executor.sh" && ok "Rick fleet tick"
  left="$(find "$HOME/Sync/rick/FLEET-INBOX" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
  ok "Missions waiting: $left · daemon runs every 2m"
  exit 0
fi

# ── Carry / Watchtower (default) ──
[[ -n "$TMMT" ]] || { say "TMMT not found"; exit 1; }

say "BOOYAH DAILY — HAILMARY · $(date '+%A %b %d')"

# Protect Fable credits
bash "$HOME/.config/tmmt/god-mode.sh" off 2>/dev/null || true
export LOCAL_FIRST=1

# Ignite local stack
bash "$TMMT/scripts/mesh/unison.sh" up 2>/dev/null \
  || bash "$HOME/.config/tmmt/booyah.sh" 2>/dev/null \
  || true

# Route work to Rick
[[ -x "$TMMT/scripts/mesh/m1-work-router.sh" ]] \
  && bash "$TMMT/scripts/mesh/m1-work-router.sh" route 2>/dev/null || true

# Quick audit
[[ -x "$TMMT/scripts/mesh/enforce-local-first.sh" ]] \
  && bash "$TMMT/scripts/mesh/enforce-local-first.sh" 2>/dev/null | head -8 || true

waiting="$(find "$HOME/Sync/rick/FLEET-INBOX" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"
done_n="$(find "$HOME/Sync/rick/FLEET-INBOX/done" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')"

cat <<EOF

╔══════════════════════════════════════════════════════════════╗
║  BOOYAH — HAILMARY LIVE                                      ║
╠══════════════════════════════════════════════════════════════╣
║  Rick queue:  $waiting waiting · $done_n done                 ║
║  Drop work:   tmmt work "your task"                          ║
║  Fable YOU:   god on → claude (not on loops)                 ║
╚══════════════════════════════════════════════════════════════╝
EOF

date -u +%Y-%m-%d > "$HOME/.config/tmmt/.booyah-daily.last" 2>/dev/null || true
