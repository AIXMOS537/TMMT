#!/usr/bin/env bash
# family-harness.sh — agentic LLM mesh harness for owner + immediate family devices.
# Ties forever-loop · local AI stack · Tailscale · prod integration · structure-first pathway.
#
# Usage:
#   bash scripts/mesh/family-harness.sh              # full status + health
#   bash scripts/mesh/family-harness.sh status       # same
#   bash scripts/mesh/family-harness.sh test         # run family-mesh-test.sh
#   bash scripts/mesh/family-harness.sh onboard      # family device boot hints (Phase 2)
#   bash scripts/mesh/family-harness.sh owner        # YOUR devices first — office checklist
#   bash scripts/mesh/family-harness.sh next         # one next move (owner devices)
#   bash scripts/mesh/family-harness.sh issue-key    # LiteLLM family key instructions
#   bash scripts/mesh/family-harness.sh tick         # one forever-loop style probe (quiet)
#
# Authority: PROJECT X HAILMARY · family-first · local-first
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh" 2>/dev/null || true
cd "$SWARM_ROOT"

TMMT="${TMMT:-$HOME/.config/tmmt}"
REGISTRY="$SWARM_ROOT/config/family-mesh.registry.json"
PATHWAY="$SWARM_ROOT/config/structure-first-pathway.json"
FAIL=0

[[ -f "$TMMT/two-worlds.env" ]] && source "$TMMT/two-worlds.env" 2>/dev/null || true
[[ -f "$TMMT/access-tiers.env" ]] && source "$TMMT/access-tiers.env" 2>/dev/null || true

if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; W=$'\e[97m'; BD=$'\e[1m'; X=$'\e[0m'
else G=; Y=; R=; C=; W=; D=; BD=; X=; fi

pass(){ printf '  %s✓%s %s\n' "$G" "$X" "$1"; }
warn(){ printf '  %s!%s %s\n' "$Y" "$X" "$1"; FAIL=1; }
info(){ printf '\n%s%s%s\n' "$C" "$1" "$X"; }

detect_seat(){
  local host="$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  case "$host" in
    macbook-pro-*|carry*|watchtower*) echo "sovereign" ;;
    *m1*|*rick*|*forge*) echo "forge" ;;
    *brainiac*) echo "brain" ;;
    iphone*|ipad*) echo "family-mobile" ;;
    *) echo "family" ;;
  esac
}

probe_url(){
  local label="$1" url="$2" auth="${3:-}"
  if [[ -n "$auth" ]]; then
    curl -sf --max-time 4 -H "Authorization: Bearer $auth" "$url" >/dev/null 2>&1 \
      && pass "$label" || warn "$label offline"
  else
    curl -sf --max-time 4 "$url" >/dev/null 2>&1 \
      && pass "$label" || warn "$label offline"
  fi
}

cmd_status(){
  local seat host machine
  seat="$(detect_seat)"
  host="$(hostname -s 2>/dev/null || echo unknown)"
  machine="$(cat "$SWARM_ROOT/.swarm/machine" 2>/dev/null || echo unset)"

  cat <<EOF
${C}${BD}╔══════════════════════════════════════════════════════════════╗
║  F A M I L Y   M E S H   H A R N E S S  —  agentic · forever  ║
╚══════════════════════════════════════════════════════════════╝${X}
  device: ${W}${host}${X} · seat: ${W}${seat}${X} · mesh: ${W}${machine}${X}
  program: Structure-First Pathway (learn → earn → churn)
EOF

  # Owner-first phase gate
  if bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" gate 2>/dev/null; then
    printf '  phase:  %s%s%s family may onboard\n' "$G" "Phase 2 OPEN ·" "$X"
  else
    printf '  phase:  %s%s%s YOUR devices first — bash scripts/tmmt owner\n' "$Y" "Phase 2 LOCKED ·" "$X"
  fi

  info "── LOCAL AI STACK (zero paid tokens default) ──"
  probe_url "Ollama :11434" "http://127.0.0.1:11434/api/tags"
  probe_url "LiteLLM :4001" "http://127.0.0.1:4001/health"
  probe_url "CCR :3456" "http://127.0.0.1:3456/health"
  probe_url "OmniRoute :20128" "http://127.0.0.1:20128/health"

  info "\n── TAILNET (family devices online?) ──"
  if command -v tailscale >/dev/null 2>&1; then
    tailscale status 2>/dev/null | while read -r line; do
      if echo "$line" | grep -qE 'brainiac|iphone|macbook|fleet|desktop'; then
        if echo "$line" | grep -q active; then
          pass "$(echo "$line" | awk '{print $2, $4}' | tr -s ' ')"
        elif echo "$line" | grep -q offline; then
          warn "$(echo "$line" | awk '{print $2}' | tr -s ' ') offline"
        else
          printf '  · %s\n' "$(echo "$line" | awk '{print $2, $4}' | tr -s ' ')"
        fi
      fi
    done
  else
    warn "tailscale not installed"
  fi

  info "\n── FOREVER LOOP ──"
  bash "$SWARM_ROOT/scripts/mesh/forever-loop.sh" status 2>/dev/null | sed 's/^/  /' | head -12 || true

  info "\n── STRUCTURE-FIRST PATHWAY (public ops) ──"
  if [[ -f "$PATHWAY" ]]; then
    pass "config/structure-first-pathway.json loaded"
    python3 -c "
import json
p=json.load(open('$PATHWAY'))
print('  fit →', p['entry_urls']['fit_test'])
print('  join →', p['entry_urls']['join'])
print('  cap →', p['caps']['launch_cap'], 'founding slots')
" 2>/dev/null || true
  else
    warn "structure-first-pathway.json missing"
  fi

  info "\n── RICK INBOX (missions waiting) ──"
  local inbox="${FOREVER_RICK_INBOX:-$HOME/Sync/rick/FLEET-INBOX}"
  if [[ -d "$inbox" ]]; then
    local n; n="$(find "$inbox" -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
    [[ "$n" -gt 0 ]] && warn "$n mission(s) in FLEET-INBOX" || pass "FLEET-INBOX clear"
  fi

  info "\n── COMMANDS ──"
  printf '  bash scripts/tmmt owner              YOUR devices first (office)\n'
  printf '  bash scripts/tmmt owner next         one next move on your checklist\n'
  printf '  bash scripts/mesh/family-harness.sh test     full mesh + prod test\n'
  printf '  bash scripts/mesh/go-live-device.sh --role family   (Phase 2 only)\n'
  printf '  god issue family                     issue Enchanted key (Phase 2)\n'
  printf '  bash scripts/tmmt mesh               who is online\n'
  printf '  bash ~/Desktop/X-FOREVER/RUN-X-FOREVER.sh   flash deploy\n'

  [[ $FAIL -eq 0 ]] && printf '\n%s%s HARNESS HEALTHY%s\n' "$G" "$BD" "$X" \
    || printf '\n%s%s HARNESS NEEDS ATTENTION — fix ! items%s\n' "$Y" "$BD" "$X"
  return $FAIL
}

cmd_onboard(){
  if ! bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" gate 2>/dev/null; then
    warn "Family onboard LOCKED — finish YOUR devices at the office first"
    exec bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" status
  fi
  rick_prime_banner 2>/dev/null || true
  cat <<'ONBOARD'

══ PHASE 2: IMMEDIATE FAMILY — after YOUR devices are done ══

1. Install Tailscale on the device (same tailnet as Carry)
2. Install Enchanted (iOS) or LibreChat (browser on Brainiac)
3. On Carry (owner): god issue family
   → Create LiteLLM virtual key (rick-safe only) at http://localhost:4001/ui
4. Enchanted settings:
   URL:  http://macbook-pro-2.tailceb455.ts.net:4001
   Key:  (virtual key from step 3 — NEVER master/FOUNDER key)
5. Join mesh:
   cd ~/projects/TMMT && git pull
   bash scripts/swarm-join.sh --name family-<name>
   bash scripts/mesh/go-live-device.sh --role family
6. Test: bash scripts/mesh/family-harness.sh test

Family gets: Rick via HAILMARY · rick-safe · protect/educate/with Taha
Family NEVER gets: vault · hc god · deploy · operator admin · master keys

══ STRUCTURE-FIRST OPERATOR PATH (for people called "lazy") ══

  /fit-test  →  /join  →  Academy  →  share ONE link  →  /operator/earnings
  One next move. Visual progress. Earn before ask. No shame.

ONBOARD
}

cmd_issue_key(){
  if ! bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" gate 2>/dev/null; then
    warn "Issue family keys LOCKED — finish YOUR devices first: bash scripts/tmmt owner"
    return 1
  fi
  if [[ -f "$TMMT/god-mode.sh" ]]; then
    bash "$TMMT/god-mode.sh" issue family
  else
    warn "god-mode.sh not found — run on Carry with ~/.config/tmmt synced"
  fi
}

cmd_owner(){
  exec bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" "${1:-status}" "${@:2}"
}

cmd_next(){
  exec bash "$SWARM_ROOT/scripts/mesh/owner-devices-first.sh" next
}

cmd_tick(){
  probe_url "ollama" "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1 || true
  probe_url "litellm" "http://127.0.0.1:4001/health" >/dev/null 2>&1 || true
  command -v tailscale >/dev/null && tailscale status --json >/dev/null 2>&1 || true
  return $FAIL
}

case "${1:-status}" in
  status|"") cmd_status; exit $? ;;
  test)      exec bash "$SWARM_ROOT/scripts/mesh/family-mesh-test.sh" "${@:2}" ;;
  onboard|boot|join) cmd_onboard ;;
  owner|office|mine) cmd_owner "${2:-status}" "${@:3}" ;;
  next|now)  cmd_next ;;
  issue-key|issue) cmd_issue_key ;;
  tick)      cmd_tick; exit $? ;;
  -h|--help)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *) echo "Unknown: $1 — try: family-harness.sh status|owner|next|test|onboard|issue-key|tick" >&2; exit 1 ;;
esac
