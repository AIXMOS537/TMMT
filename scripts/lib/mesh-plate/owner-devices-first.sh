#!/usr/bin/env bash
# owner-devices-first.sh — Rollout order: YOUR devices (BLIP) → family → Aayan → Isaac Scott
#
# Usage:
#   bash scripts/mesh/owner-devices-first.sh              # full rollout status
#   bash scripts/mesh/owner-devices-first.sh next         # one next move
#   bash scripts/mesh/owner-devices-first.sh done <id>    # mark device/person done
#   bash scripts/mesh/owner-devices-first.sh blip         # build + open BLIP folders NOW
#   bash scripts/mesh/owner-devices-first.sh unlock-family|unlock-aayan|unlock-isaac
#   bash scripts/mesh/owner-devices-first.sh gate [family|aayan|isaac|ops]
#
# Authority: PROJECT X HAILMARY · Muhammad Taha only
set -uo pipefail
source "$(dirname "$0")/../lib/swarm-common.sh" 2>/dev/null || true
cd "$SWARM_ROOT"

PHASES="$SWARM_ROOT/config/onboard-phases.json"
PROGRESS_DIR="${HOME}/.config/tmmt/.owner-only"
PROGRESS="${PROGRESS_DIR}/onboard-progress.json"
UNLOCK_FAMILY="${PROGRESS_DIR}/family-onboard-unlocked"
UNLOCK_AAYAN="${PROGRESS_DIR}/aayan-onboard-unlocked"
UNLOCK_ISAAC="${PROGRESS_DIR}/isaac-onboard-unlocked"

mkdir -p "$PROGRESS_DIR" 2>/dev/null || true

if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; W=$'\e[97m'; BD=$'\e[1m'; X=$'\e[0m'
else G=; Y=; C=; W=; BD=; X=; fi

init_progress(){
  if [[ ! -f "$PROGRESS" ]]; then
    cat > "$PROGRESS" <<EOF
{"current_phase":"phase-1-owner-blip","completed":[],"skipped":[],"started_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","updated_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
    chmod 600 "$PROGRESS"
  fi
}

mark_done(){
  local id="$1" skip="${2:-}"
  init_progress
  python3 <<PY
import json, datetime
p=json.load(open('$PROGRESS'))
key='skipped' if '$skip'=='skip' else 'completed'
if '$id' not in p.get(key,[]):
    p.setdefault(key,[]).append('$id')
p['updated_at']=datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
json.dump(p, open('$PROGRESS','w'), indent=2)
PY
  printf '%s✓%s Marked %s %s\n' "$G" "$X" "$id" "${skip:+skipped}"
}

phase1_complete(){
  [[ -f "$UNLOCK_FAMILY" ]] && return 0
  python3 <<PY
import json, os
ph=json.load(open('$PHASES'))
p=json.load(open('$PROGRESS')) if os.path.isfile('$PROGRESS') else {'completed':[],'skipped':[]}
req={d['id'] for d in ph['phases'][0]['devices'] if not d.get('optional')}
done=set(p.get('completed',[]))|set(p.get('skipped',[]))
raise SystemExit(0 if req <= done else 1)
PY
}

phase2_complete(){
  [[ -f "$UNLOCK_AAYAN" ]] && return 0
  phase1_complete || return 1
  python3 <<PY
import json, os
p=json.load(open('$PROGRESS')) if os.path.isfile('$PROGRESS') else {'completed':[]}
raise SystemExit(0 if 'family-member' in p.get('completed',[]) or 'family-member' in p.get('skipped',[]) else 1)
PY
}

phase3_complete(){
  [[ -f "$UNLOCK_ISAAC" ]] && return 0
  phase2_complete || return 1
  python3 <<PY
import json, os
p=json.load(open('$PROGRESS')) if os.path.isfile('$PROGRESS') else {'completed':[]}
raise SystemExit(0 if 'aayan' in p.get('completed',[]) else 1)
PY
}

gate_family(){ phase1_complete; }
gate_aayan(){ phase2_complete; }
gate_isaac(){ phase3_complete; }

cmd_gate(){
  local who="${1:-family}"
  case "$who" in
    family|phase-2|2) gate_family ;;
    aayan|phase-3|3) gate_aayan ;;
    isaac|isaac-scott|phase-4|4) gate_isaac ;;
    ops) gate_family ;; # legacy: ops after owner
    *) gate_family ;;
  esac
}

cmd_unlock(){
  local which="$1"
  case "$which" in
    family)  touch "$UNLOCK_FAMILY"; chmod 600 "$UNLOCK_FAMILY"
               printf '%s✓ Phase 2 UNLOCKED — family may onboard%s\n' "$G" "$X" ;;
    aayan)   touch "$UNLOCK_AAYAN"; chmod 600 "$UNLOCK_AAYAN"
               printf '%s✓ Phase 3 UNLOCKED — Aayan may onboard%s\n' "$G" "$X" ;;
    isaac)   touch "$UNLOCK_ISAAC"; chmod 600 "$UNLOCK_ISAAC"
               printf '%s✓ Phase 4 UNLOCKED — Isaac Scott may onboard%s\n' "$G" "$X" ;;
    *) echo "unlock: family | aayan | isaac" >&2; return 1 ;;
  esac
}

next_item(){
  python3 <<PY
import json, os
ph=json.load(open('$PHASES'))
p=json.load(open('$PROGRESS')) if os.path.isfile('$PROGRESS') else {'completed':[],'skipped':[]}
done=set(p.get('completed',[]))|set(p.get('skipped',[]))
for phase in ph['phases']:
    for d in sorted(phase.get('devices',[]), key=lambda x: x.get('order',0)):
        if d['id'] not in done:
            print(d['id'])
            print(phase['id'])
            raise SystemExit(0)
print('ALL_COMPLETE')
print('done')
PY
}

cmd_status(){
  init_progress
  local host next_id next_phase
  host="$(hostname -s 2>/dev/null || echo unknown)"
  read -r next_id next_phase <<< "$(next_item | tr '\n' ' ')"

  cat <<EOF
${C}${BD}╔══════════════════════════════════════════════════════════════╗
║  R O L L O U T   Q U E U E  —  BLIP · family · Aayan · Isaac  ║
╚══════════════════════════════════════════════════════════════╝${X}
  Carry: ${W}${host}${X}
  Order: ${W}YOUR devices (BLIP now) → family → Aayan → Isaac Scott${X}
EOF

  phase1_complete 2>/dev/null && p1="${G}OPEN${X}" || p1="${Y}LOCKED${X}"
  gate_family 2>/dev/null && p2="${G}OPEN${X}" || p2="${Y}LOCKED${X}"
  gate_aayan 2>/dev/null && p3="${G}OPEN${X}" || p3="${Y}LOCKED${X}"
  gate_isaac 2>/dev/null && p4="${G}OPEN${X}" || p4="${Y}LOCKED${X}"

  printf '\n  Phase 1 YOUR devices (BLIP):  %b\n' "$p1"
  printf '  Phase 2 Family:               %b\n' "$p2"
  printf '  Phase 3 Aayan:                %b\n' "$p3"
  printf '  Phase 4 Isaac Scott:          %b\n' "$p4"

  printf '\n%s── PHASE 1: BLIP YOUR DEVICES NOW ──%s\n' "$BD" "$X"
  python3 <<PY
import json, os
ph=json.load(open('$PHASES'))
p=json.load(open('$PROGRESS'))
done=set(p.get('completed',[])); skip=set(p.get('skipped',[]))
for d in sorted(ph['phases'][0]['devices'], key=lambda x: x['order']):
    mark='✓' if d['id'] in done else ('○' if d['id'] in skip else '→' if d['id']=='$next_id' else '·')
    blip=' [BLIP]' if d.get('blip') else ''
    opt=' (optional)' if d.get('optional') else ''
    print(f"  [{mark}] {d['order']}. {d['label']}{blip}{opt}")
PY

  if [[ "$next_id" != "ALL_COMPLETE" ]]; then
    printf '\n%s── ONE NEXT MOVE ──%s\n' "$BD" "$X"
    cmd_next
  fi

  printf '\n%s── BLIP SEND NOW ──%s\n' "$BD" "$X"
  printf '  bash scripts/blip/rollout-now.sh        build + queue + open Finder\n'
  printf '  bash scripts/tmmt owner blip             same\n'
}

cmd_next(){
  init_progress
  local next_id next_phase
  read -r next_id next_phase <<< "$(next_item | tr '\n' ' ')"
  if [[ "$next_id" == "ALL_COMPLETE" ]]; then
    say "Rollout complete for all phases."
    return 0
  fi
  python3 <<PY
import json
ph=json.load(open('$PHASES'))
for phase in ph['phases']:
    for d in phase.get('devices',[]):
        if d['id']=='$next_id':
            print(f"Phase: {phase['name']}")
            print(f"Target: {d['label']}")
            if d.get('blip'):
                b=d.get('blip_bundle','owner_general')
                paths={'owner_m1':'~/Desktop/M1-ONE-SHOT-FOREVER','owner_general':'~/Desktop/BLIP-DROP-LATEST'}
                print(f"BLIP folder: {paths.get(b,'~/Desktop/BLIP-DROP-LATEST')}")
            print("")
            for i,c in enumerate(d.get('commands',[]),1):
                print(f"  {i}. {c}")
            print(f"\nWhen done: bash scripts/tmmt owner done {d['id']}")
            break
PY
}

cmd_blip(){
  exec bash "$SWARM_ROOT/scripts/blip/rollout-now.sh" now
}

case "${1:-status}" in
  status|"") cmd_status ;;
  next|now)  cmd_next ;;
  list)      bash "$SWARM_ROOT/scripts/blip/rollout-now.sh" queue ;;
  blip|rollout|send) cmd_blip ;;
  done)      mark_done "${2:?id}" ;;
  skip)      mark_done "${2:?id}" skip ;;
  unlock-family|unlock) cmd_unlock family ;;
  unlock-aayan) cmd_unlock aayan ;;
  unlock-isaac) cmd_unlock isaac ;;
  gate|check)  cmd_gate "${2:-family}" ;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//' ;;
  *) echo "Unknown: $1" >&2; exit 1 ;;
esac
