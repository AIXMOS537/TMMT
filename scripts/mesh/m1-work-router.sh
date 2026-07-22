#!/usr/bin/env bash
# m1-work-router.sh — M1 WORK LAW: track · score · route all Taha work → FLEET-INBOX.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAW="$ROOT/config/m1-work-law.json"
INBOX="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
LEDGER="${M1_WORK_LEDGER:-$HOME/.config/tmmt/.owner-only/work-ledger.tsv}"
INTAKE_ROOT="${OWNER_WORK_INTAKE:-$HOME/Brain/vault/00-Dashboard/OWNER-WORK-INTAKE}"
QUEUE="${FOREVER_QUEUE:-$HOME/Brain/vault/00-Dashboard/IDEA-QUEUE-LIVE.md}"
HANDOFF="${FOREVER_HANDOFF:-$HOME/Brain/vault/00-Dashboard/HANDOFF-TO-FORGE}"
WATCHTOWER="${WATCHTOWER_INBOX:-$HOME/Brain/vault/03-Systems/watchtower-inbox}"
DISPATCH_LOG="$ROOT/.swarm/dispatch-log.tsv"
DEDUPE="${FOREVER_DISPATCH_DEDUPE:-3600}"
HOST="$(hostname -s 2>/dev/null || echo carry)"

mkdir -p "$INBOX" "$(dirname "$LEDGER")" "$ROOT/.swarm" \
  "$INTAKE_ROOT/business" "$INTAKE_ROOT/personal" "$INTAKE_ROOT/social" "$INTAKE_ROOT/work"
touch "$LEDGER" "$DISPATCH_LOG"

say(){ printf '%s\n' "$*"; }
warn(){ printf '⚠ %s\n' "$*" >&2; }

D_EMERGENCY=2; D_MONEY=2; D_PEOPLE=3; D_TIME=2; D_ENERGY=4; D_COST=5
W_EMERGENCY=1000; W_MONEY=100; W_PEOPLE=50; W_TIME=30; W_ENERGY=20; W_COST=10

clamp_1_5() {
  local v="${1:-2}"
  [[ "$v" -lt 1 ]] && v=1
  [[ "$v" -gt 5 ]] && v=5
  printf '%s' "$v"
}

invert_score() { printf '%s' "$(( 6 - $1 ))"; }

compute_score() {
  local e m p t en c en_i c_i
  e="$(clamp_1_5 "$1")"; m="$(clamp_1_5 "$2")"; p="$(clamp_1_5 "$3")"
  t="$(clamp_1_5 "$4")"; en="$(clamp_1_5 "$5")"; c="$(clamp_1_5 "$6")"
  en_i="$(invert_score "$en")"; c_i="$(invert_score "$c")"
  printf '%s' "$(( e * W_EMERGENCY + m * W_MONEY + p * W_PEOPLE + t * W_TIME + en_i * W_ENERGY + c_i * W_COST ))"
}

parse_frontmatter() {
  local f="$1"
  D_EMERGENCY=2; D_MONEY=2; D_PEOPLE=3; D_TIME=2; D_ENERGY=4; D_COST=5
  PARSED_DOMAIN=""; PARSED_OWNER_GATE="false"
  [[ -f "$f" ]] || return 0
  local in_fm=0 line k v
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == "---" ]] && { in_fm=$((in_fm + 1)); continue; }
    [[ "$in_fm" -eq 1 ]] || continue
    [[ "$in_fm" -ge 2 ]] && break
    k="${line%%:*}"; v="${line#*:}"; v="${v#"${v%%[![:space:]]*}"}"
    case "$k" in
      emergency) D_EMERGENCY="$v";;
      money|money_impact) D_MONEY="$v";;
      people_helped|people) D_PEOPLE="$v";;
      time|time_pressure) D_TIME="$v";;
      energy|owner_energy) D_ENERGY="$v";;
      cost) D_COST="$v";;
      domain) PARSED_DOMAIN="$v";;
      owner_gate) PARSED_OWNER_GATE="$v";;
    esac
  done < "$f"
}

recently_sent() {
  local key="$1" now cutoff
  now="$(date +%s)"; cutoff=$(( now - DEDUPE ))
  while IFS=$'\t' read -r ts k _; do
    [[ "$k" == "$key" && "$ts" -ge "$cutoff" ]] && return 0
  done < "$DISPATCH_LOG"
  return 1
}

log_dispatch() { printf '%s\t%s\t%s\n' "$(date +%s)" "$1" "$2" >> "$DISPATCH_LOG"; }
log_ledger() {
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$3" "$4" "$5" >> "$LEDGER"
}

emit_mission() {
  local key="$1" score="$2" domain="$3" title="$4" body="$5" owner_gate="${6:-false}"
  # ── PAUSE-EMIT kill-switch (Rick, 2026-07-18) ──────────────────────────────
  # Single choke point for every file-*/law-* mission this router emits. Honors
  # a flag so the boomerang re-ingestion storm stays OFF regardless of what
  # re-bootstraps the pipeline. Reverse: rm ~/.config/tmmt/.swarm/PAUSE-EMIT
  if [[ -f "$HOME/.config/tmmt/.swarm/PAUSE-EMIT" ]]; then
    log_ledger "PAUSED" "$score" "$domain" "$title" "$key" "$HOST" 2>/dev/null || true
    return 0
  fi
  recently_sent "$key" && return 0
  if [[ "$owner_gate" == "true" || "$owner_gate" == "yes" || "$owner_gate" == "1" ]]; then
    warn "owner_gate — stays on Carry: $title"
    log_ledger "GATE" "$score" "$domain" "$title" "$key" "carry"
    return 0
  fi
  local ts f padded
  ts="$(date +%Y%m%d-%H%M%S)"
  padded="$(printf '%04d' "$score")"
  f="$INBOX/law-${padded}-${ts}-${key}.md"
  cat > "$f" <<EOF
# M1 WORK LAW — ${title}
from: ${HOST} · $(date -u +%Y-%m-%dT%H:%M:%SZ)
law: M1-WORK-LAW v1.0
domain: ${domain:-general}
score: ${score}
dedupe_key: ${key}

## Mission
${body}

## Execute on M1
cd ~/projects/TMMT || cd ~/Projects/TMMT
bash scripts/mesh/m1-fleet-executor.sh
EOF
  log_dispatch "$key" "$f"
  log_ledger "ROUTED" "$score" "${domain:-general}" "$title" "$key" "${f##*/}"
  say "✓ M1 ← [$score] $title"
}

route_file() {
  local f="$1" domain="${2:-general}"
  parse_frontmatter "$f"
  [[ -n "${PARSED_DOMAIN:-}" ]] && domain="$PARSED_DOMAIN"
  local key title body score og
  key="file-$(basename "$f" .md | tr -cs 'A-Za-z0-9' '-' | cut -c1-40)"
  title="$(grep -m1 '^# ' "$f" 2>/dev/null | sed 's/^# //' || basename "$f")"
  body="$(head -120 "$f" 2>/dev/null)"
  og="${PARSED_OWNER_GATE:-false}"
  score="$(compute_score "$D_EMERGENCY" "$D_MONEY" "$D_PEOPLE" "$D_TIME" "$D_ENERGY" "$D_COST")"
  emit_mission "$key" "$score" "$domain" "$title" "$body" "$og"
}

route_queue_rows() {
  [[ -f "$QUEUE" ]] || return 0
  while IFS= read -r line; do
    [[ "$line" =~ ^\|[[:space:]]*[0-9]+[[:space:]]*\| ]] || continue
    [[ "$line" =~ OPEN ]] || continue
    [[ "$line" =~ P0 ]] || continue
    D_EMERGENCY=4; D_MONEY=4; D_TIME=3; D_PEOPLE=3; D_ENERGY=4; D_COST=5
    local key title score
    key="$(printf '%s' "$line" | tr -cs 'A-Za-z0-9' '-' | cut -c1-48)"
    title="$(echo "$line" | awk -F'|' '{print $3}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    score="$(compute_score "$D_EMERGENCY" "$D_MONEY" "$D_PEOPLE" "$D_TIME" "$D_ENERGY" "$D_COST")"
    emit_mission "$key" "$score" "business" "P0 queue: ${title:-work}" "$line" "false"
  done < "$QUEUE"
}

route_all() {
  say "M1 WORK LAW — routing → $INBOX"
  local d sub f
  for d in business personal social work; do
    sub="$INTAKE_ROOT/$d"
    [[ -d "$sub" ]] || continue
    find "$sub" -maxdepth 1 -name '*.md' -type f 2>/dev/null | while read -r f; do route_file "$f" "$d"; done
  done
  find "$INTAKE_ROOT" -maxdepth 1 -name '*.md' -type f 2>/dev/null | while read -r f; do route_file "$f" "general"; done
  [[ -d "$HANDOFF" ]] && find "$HANDOFF" -maxdepth 1 -name '*.md' -type f 2>/dev/null | head -10 | while read -r f; do route_file "$f" "work"; done
  [[ -d "$WATCHTOWER" ]] && find "$WATCHTOWER" -maxdepth 1 -name '*.md' -type f 2>/dev/null | head -10 | while read -r f; do route_file "$f" "work"; done
  route_queue_rows
  say "done"
}

cmd_intake() {
  local title="${1:-}"; shift || true
  [[ -n "$title" ]] || { warn 'usage: m1-work-router.sh intake "title" [--domain business] [--emergency N]'; return 1; }
  local domain="business" e=2 m=2 p=3 t=2 en=4 c=5 og="false"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain) domain="$2"; shift 2;;
      --emergency) e="$2"; shift 2;;
      --money) m="$2"; shift 2;;
      --people) p="$2"; shift 2;;
      --time) t="$2"; shift 2;;
      --energy) en="$2"; shift 2;;
      --cost) c="$2"; shift 2;;
      --owner-gate) og="true"; shift;;
      *) shift;;
    esac
  done
  D_EMERGENCY="$e"; D_MONEY="$m"; D_PEOPLE="$p"; D_TIME="$t"; D_ENERGY="$en"; D_COST="$c"
  local ts f score key
  ts="$(date +%Y%m%d-%H%M%S)"
  key="intake-$ts"
  f="$INTAKE_ROOT/$domain/work-$ts.md"
  cat > "$f" <<EOF
---
domain: $domain
emergency: $e
money: $m
people_helped: $p
time: $t
energy: $en
cost: $c
owner_gate: $og
---

# $title
EOF
  score="$(compute_score "$e" "$m" "$p" "$t" "$en" "$c")"
  say "✓ intake → $f (score $score)"
  emit_mission "$key" "$score" "$domain" "$title" "See: $f" "$og"
}

cmd_status() {
  say "— M1 WORK LAW —"
  say "inbox: $INBOX"
  local n; n="$(find "$INBOX" -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
  say "missions waiting: $n"
  say "ledger: $LEDGER"
  [[ -f "$LEDGER" ]] && tail -n 5 "$LEDGER" | sed 's/^/  /'
}

case "${1:-status}" in
  route) route_all;;
  intake) shift; cmd_intake "$@";;
  status) cmd_status;;
  *) cmd_status;;
esac
