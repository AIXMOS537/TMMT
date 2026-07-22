#!/usr/bin/env bash
#
# ceo.sh — the owner's 30-second brief. The ONE screen a CEO looks at: what's on
# fire, what needs YOUR decision, how the team is doing, and the single highest-
# leverage move today. Everything else is delegated or automated. You don't dig —
# the brief surfaces. Read it, make the calls only you can make, get on with your day.
# ---------------------------------------------------------------------------
#   bash scripts/ceo.sh         # the morning brief
# ---------------------------------------------------------------------------
# Read-only. Aggregates queue.sh (decisions), grant.sh (team), heartbeat (presence),
# doctor.sh (ready?), and the open security thread. Prints no secrets.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT"
A="$ROOT/.aixmos"

h(){ printf "\n\033[1;96m── %s ──\033[0m\n" "$1"; }
fire(){ printf "  \033[41;97m 🔴 \033[0m %s\n      \033[2m→ %s\033[0m\n" "$1" "$2"; }
good(){ printf "  \033[42;30m ✓ \033[0m %s\n" "$1"; }
note(){ printf "  \033[2m%s\033[0m\n" "$1"; }

printf "\033[1m👑 CEO BRIEF\033[0m  —  %s\n" "$(date '+%A %B %-d, %Y · %H:%M')"
note "the one screen. read it, decide, delegate. you stay at altitude."

ONFIRE=0

# ── 1. ON FIRE — only things that genuinely need the owner, today ───────────
h "🔴 ON FIRE (only you can clear these)"
# the one live security thread
if grep -rqi 'REVOKE.*Airtable\|AIRTABLE_TOKEN_REVOKED' docs config 2>/dev/null; then
  fire "Airtable token still needs revoking" "airtable.com/create/tokens → delete it (2 min, your login)"; ONFIRE=1
fi
# machine not ready to open
if [ -x scripts/doctor.sh ]; then
  if ! bash scripts/doctor.sh --quiet >/dev/null 2>&1; then
    fire "This machine isn't 'ready to open'" "bash scripts/doctor.sh → fix the ✗ in order"; ONFIRE=1
  else good "Machine ready to open (doctor green)"; fi
fi
# owner-protection exposure (identity / secrets / locks)
if [ -x scripts/protect.sh ]; then
  if ! bash scripts/protect.sh --quiet >/dev/null 2>&1; then
    fire "Owner-protection exposure detected" "bash scripts/protect.sh → fix every ✗ (identity/secrets/locks)"; ONFIRE=1
  else good "Owner protected (guardian green)"; fi
fi
# perimeter breach risk (public attack surface)
if [ -x scripts/sentry.sh ]; then
  if ! bash scripts/sentry.sh --quiet >/dev/null 2>&1; then
    fire "Perimeter breach risk — an endpoint may be exposed" "bash scripts/sentry.sh → close every ✗"; ONFIRE=1
  else good "Perimeter secure (Sentry green — HAILMARY on watch)"; fi
fi
[ "$ONFIRE" = 0 ] && good "Nothing on fire. You're clear to build, sell, or rest."

# ── 2. YOUR DECISIONS — the queue that waits for your YES ────────────────────
h "📥 YOUR DECISIONS (the world's waiting on your YES)"
if [ -x scripts/queue.sh ]; then
  N="$(bash scripts/queue.sh count 2>/dev/null | tail -1 | tr -dc '0-9')"; N="${N:-0}"
  if [ "$N" -gt 0 ]; then
    printf "  \033[43;30m %s waiting \033[0m\n" "$N"
    bash scripts/queue.sh list 2>/dev/null | grep -E '^\s+#' | head -8
    note "decide:  bash scripts/queue.sh yes <id>  |  no <id>"
  else good "Queue empty — nothing needs you. You're free."; fi
else note "(queue not initialized)"; fi

# ── 3. YOUR TEAM — who's granted, who's online ──────────────────────────────
h "👥 YOUR TEAM"
if ls "$A/grants"/*-GRANTED.md >/dev/null 2>&1; then
  CNT=$(ls "$A/grants"/*-GRANTED.md 2>/dev/null | wc -l | tr -d ' ')
  good "$CNT operator(s) live:"
  for f in "$A/grants"/*-GRANTED.md; do printf "      • %s\n" "$(basename "$f" -GRANTED.md)"; done
else
  fire "No operators granted yet — you're the whole team" "send dist/onboard.command (msg ready: dist/SEND-TO-JUSTIN.md)"
fi
if ls "$A/heartbeat"/*.beat >/dev/null 2>&1; then
  ON=$(find "$A/heartbeat" -name '*.beat' -newermt '-60 seconds' 2>/dev/null | wc -l | tr -d ' ')
  note "devices on the mesh: $(ls "$A/heartbeat"/*.beat 2>/dev/null | wc -l | tr -d ' ') total · ~$ON active now"
fi

# ── 4. THE NUMBER — collected, your cut, and what's unpaid ──────────────────
h "💰 THE NUMBER"
if [ -f "$A/revenue.txt" ]; then
  note "$(cat "$A/revenue.txt")"
else
  note "No deals logged yet. Log one: bash scripts/deal.sh add --who ... --amount ... --cut 50% --paid"
fi
# paid-upfront enforcement: any unpaid deal is work you should NOT be doing
if [ -x scripts/deal.sh ] && [ -f "$A/ledger/deals.tsv" ]; then
  HOLD=$(awk -F'\t' 'NR>1 && $9!="yes"' "$A/ledger/deals.tsv" 2>/dev/null | grep -c . || echo 0)
  if [ "${HOLD:-0}" -gt 0 ]; then
    fire "$HOLD deal(s) UNPAID — work should be on HOLD (no pay, no work)" "bash scripts/deal.sh hold → collect upfront or kill it"; ONFIRE=1
  else good "Every deal on the books is paid upfront. Clean."; fi
fi

# ── 5. TODAY'S ONE MOVE — the single highest-leverage action ─────────────────
h "🎯 TODAY'S ONE MOVE"
if [ "$ONFIRE" = 1 ] && grep -rqi 'REVOKE.*Airtable\|AIRTABLE_TOKEN_REVOKED' docs config 2>/dev/null; then
  printf "  \033[1mRevoke the Airtable token.\033[0m It's the only thing on fire and only you can.\n"
elif ! ls "$A/grants"/*-GRANTED.md >/dev/null 2>&1; then
  printf "  \033[1mSend Justin his file.\033[0m Open dist/SEND-TO-JUSTIN.md → copy → attach onboard.command → send.\n"
  note "That's the whole revenue motion starting. One send."
else
  printf "  \033[1mGet Justin booking.\033[0m Team's in — hand them the kit and let the calls come.\n"
fi

printf "\n\033[2m  that's the brief. everything else is handled or delegated. go be the CEO. 👑\033[0m\n"
