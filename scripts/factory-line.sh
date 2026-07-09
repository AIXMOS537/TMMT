#!/usr/bin/env bash
#
# factory-line.sh — the Ford assembly line for the AIXMOS mesh.
# ---------------------------------------------------------------------------
# One node, one pass, on repeat: SYNC → WORK (by the agent) → QA GATE → BRAIN
# → BRAINIAC FAST-TRACK → HAND THE BATON to the next device → loop. Every green
# pass is recorded so the mesh gets stronger/faster/smarter over time, and the
# BRAIN (PC/Brainiac) node always receives the info to fast-track the next job.
#
# This is the local `/loop` named as "Next" in docs/MESH-COORDINATION.md §6.
# It ORCHESTRATES the existing gates — it does not reinvent them:
#   • QA station      → scripts/verify-gate.sh   (deterministic checks + local auto-fix)
#   • baton           → scripts/mesh-handoff.sh   (git-branch message bus, §3)
#   • fast-track pack  → scripts/brainiac-handoff.sh (all-relevant-info for BRAIN)
#   • hard gate        → scripts/verify.sh         (lint→test→build, ground truth)
#
# The AGENT (Claude Code / Cursor) is the worker on the line; this script is the
# conveyor + QA + baton. Give the agent docs/FACTORY-LINE.md, then run this.
#
# SAFETY (never negotiable — see CLAUDE.md + MESH-COORDINATION.md §4):
#   • Obeys the DARK kill-switch (.swarm/DARK) — stops immediately.
#   • NEVER merges to master, deploys, sends external messages, or `--no-verify`.
#   • NEVER flips a compliance gate. Broken work is NOT handed off.
#   • Money / legal / prod / send stay owner-gated — this only prepares + verifies.
#
# Usage:
#   bash scripts/factory-line.sh                    # 3 passes on this node, local-only
#   bash scripts/factory-line.sh --once             # a single pass
#   bash scripts/factory-line.sh --passes 5 --apply # 5 passes, let verify-gate auto-fix
#   bash scripts/factory-line.sh --handoff --to FORGE  # on green, pass the baton to FORGE
#   bash scripts/factory-line.sh --node BRAIN --brief "wire GHL rental-payment tag"
#   bash scripts/factory-line.sh --dry              # demo: no fetch/push, just run the stations
#
# Nodes (bodies of the one mind): CARRY · FORGE · BRAIN · CLOUD  (§1).
# Chain (baton order):            CARRY → FORGE → BRAIN → CLOUD → CARRY.
# ---------------------------------------------------------------------------
set -uo pipefail   # not -e: we handle failures ourselves so the line never crashes silently

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -t 1 ]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; C=$'\e[36m'; B=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'; else G=; R=; Y=; C=; B=; D=; X=; fi
say()  { printf '%s\n' "$*"; }
step() { printf '\n%s┌─ %s%s\n' "$C$B" "$*" "$X"; }
ok()   { printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
bad()  { printf '%s  ✗ %s%s\n' "$R" "$*" "$X"; }
warn() { printf '%s  ! %s%s\n' "$Y" "$*" "$X"; }
ts()   { date -u +%Y-%m-%dT%H:%M:%SZ; }

# ---- defaults / args -------------------------------------------------------
NODE=""; TO=""; PASSES=3; APPLY=false; ESCALATE=false; HANDOFF=false; DRY=false
BRIEF=""; SLUG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --node)     NODE="${2:?}"; shift 2 ;;
    --to)       TO="${2:?}"; shift 2 ;;
    --passes)   PASSES="${2:?}"; shift 2 ;;
    --once)     PASSES=1; shift ;;
    --apply)    APPLY=true; shift ;;
    --escalate) ESCALATE=true; shift ;;
    --handoff)  HANDOFF=true; shift ;;
    --brief)    BRIEF="${2:?}"; shift 2 ;;
    --slug)     SLUG="${2:?}"; shift 2 ;;
    --dry)      DRY=true; shift ;;
    -h|--help)  grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) bad "unknown arg: $1 (try --help)"; exit 2 ;;
  esac
done

case "$PASSES" in ''|*[!0-9]*) bad "--passes must be a number"; exit 2 ;; esac
[ "$PASSES" -ge 1 ] 2>/dev/null || { bad "--passes must be >= 1"; exit 2; }

# ---- DARK kill-switch: while blacked out, the line does not run ------------
if [ -f "$ROOT/.swarm/DARK" ]; then
  bad "DARK — the mesh is stopped. Lift with: bash scripts/godark lift"
  exit 1
fi

# ---- node identity ---------------------------------------------------------
upper() { printf '%s' "$1" | tr '[:lower:]' '[:upper:]'; }
detect_node() {
  local n=""
  [ -n "${AIXMOS_NODE:-}" ] && n="$AIXMOS_NODE"
  [ -z "$n" ] && [ -f "$ROOT/.swarm/node" ] && n="$(tr -d '[:space:]' < "$ROOT/.swarm/node")"
  if [ -z "$n" ]; then
    # Heuristic fallback: a cloud/CI checkout is CLOUD; otherwise best-effort by host.
    if [ -n "${CI:-}" ] || [ -n "${CURSOR_CLOUD:-}" ] || [ ! -t 0 ]; then n="CLOUD"; else
      case "$(hostname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')" in
        *carry*) n="CARRY";; *brainiac*|*brain*|*nas*) n="BRAIN";;
        *m1*|*forge*|*macpro*) n="FORGE";; *) n="CLOUD";;
      esac
    fi
  fi
  printf '%s' "$(upper "$n")"
}
NODE="$(upper "${NODE:-$(detect_node)}")"
case " CARRY FORGE BRAIN CLOUD " in *" $NODE "*) : ;; *) bad "--node must be CARRY|FORGE|BRAIN|CLOUD"; exit 2 ;; esac

# baton order → next node
next_node() {
  case "$1" in CARRY) echo FORGE;; FORGE) echo BRAIN;; BRAIN) echo CLOUD;; CLOUD) echo CARRY;; esac
}
[ -n "$TO" ] && TO="$(upper "$TO")" || TO="$(next_node "$NODE")"

OUTDIR="$ROOT/.aixmos"; mkdir -p "$OUTDIR"
LINE_LOG="$OUTDIR/factory-line.ndjson"
brain_record() { printf '{"t":"%s","node":"%s","pass":%s,"sha":"%s","result":"%s","checks":"%s"}\n' \
  "$(ts)" "$NODE" "$1" "$(git rev-parse --short HEAD 2>/dev/null || echo '-')" "$2" "${3:-}" >> "$LINE_LOG"; }

# ---- header ----------------------------------------------------------------
SEAL="(none)"; [ -f "$ROOT/auth/OWNER.seal" ] && SEAL="set"
say ""
say "${B}  🏭 AIXMOS FACTORY LINE${X}"
say "  ────────────────────────────────────────────"
say "   node    : ${B}$NODE${X}   →  baton to: ${B}$TO${X}"
say "   passes  : $PASSES    apply-fix: $APPLY    handoff: $HANDOFF    dry: $DRY"
say "   seal    : owner $SEAL      brain log: .aixmos/factory-line.ndjson"
[ -n "$BRIEF" ] && say "   brief   : $BRIEF"
say "  ────────────────────────────────────────────"

STABLE_GREENS=0
FINAL_RC=0
for ((p=1; p<=PASSES; p++)); do
  # Re-check DARK every pass — the owner can stop the line mid-run.
  if [ -f "$ROOT/.swarm/DARK" ]; then warn "DARK raised mid-run — stopping the line."; FINAL_RC=1; break; fi

  step "PASS $p/$PASSES · station 1 — SYNC (pull the bus)"
  if $DRY; then say "   ${D}(dry: skipping git fetch)${X}"; else
    if git fetch --all --prune >/dev/null 2>&1; then ok "bus synced (git fetch --all)"; else warn "fetch failed (offline?) — continuing on local HEAD"; fi
  fi

  step "PASS $p/$PASSES · station 2 — WORK (the agent's slice)"
  # The AGENT (Claude Code / Cursor) does the actual fixing/cleaning/adding this
  # pass, guided by docs/FACTORY-LINE.md. The line records intent + moves on to QA.
  if [ -n "$BRIEF" ]; then say "   worker brief: ${BRIEF}"; else say "   ${D}worker brief: (open) — agent continues the current mission / inbox${X}"; fi

  step "PASS $p/$PASSES · station 3 — QA GATE (fact-check, auto-fix)"
  gate_args=()
  $APPLY && gate_args+=(--apply)
  $ESCALATE && gate_args+=(--escalate)
  if bash "$ROOT/scripts/verify-gate.sh" "${gate_args[@]}"; then
    ok "QA passed — work is real"
    GREEN=true
  else
    GREEN=false
  fi

  if $GREEN; then
    STABLE_GREENS=$((STABLE_GREENS+1))
    brain_record "$p" "green" "verify-gate"
    step "PASS $p/$PASSES · station 4 — BRAIN (record the win → get smarter)"
    ok "recorded green pass #$p to the brain log"

    step "PASS $p/$PASSES · station 5 — BRAINIAC FAST-TRACK (feed the PC brain)"
    if [ -x "$ROOT/scripts/brainiac-handoff.sh" ] || [ -f "$ROOT/scripts/brainiac-handoff.sh" ]; then
      bash "$ROOT/scripts/brainiac-handoff.sh" --node "$NODE" ${BRIEF:+--brief "$BRIEF"} $($DRY && echo --dry) || warn "brainiac packet step returned non-zero (non-fatal)"
    else
      warn "scripts/brainiac-handoff.sh not found — skipping fast-track packet"
    fi

    step "PASS $p/$PASSES · station 6 — HAND THE BATON → $TO"
    if $HANDOFF && ! $DRY; then
      hslug="${SLUG:-factory-$(date -u +%Y%m%d-%H%M%S)}"
      hintent="${BRIEF:-"Factory-line green pass #$p from $NODE — continue the line"}"
      bash "$ROOT/scripts/mesh-handoff.sh" --from "$NODE" --to "$TO" \
        --intent "$hintent" --slug "$hslug" \
        --context "green verify-gate pass #$p; see .aixmos/factory-line.ndjson + .aixmos/brainiac/" \
        --accept "verify-gate passes on $TO" --accept "brain log appended" \
        --guard "do NOT merge to master / deploy / send — owner-gated (CLAUDE.md)" \
        --reply-to "factory line on $NODE" --push \
        && ok "baton handed to $TO over the git bus" \
        || warn "handoff emit failed (branch may exist) — check manually"
    else
      say "   ${D}(baton held: pass --handoff without --dry to emit the git-bus message to $TO)${X}"
    fi
  else
    bad "QA failed after station 3 — line PAUSED (broken work is NOT handed off)"
    brain_record "$p" "red" "verify-gate"
    warn "clean report in .aixmos/check-*.log and .aixmos/verify-log.ndjson"
    warn "ping CARRY: the line needs a human/owner look (MESH-COORDINATION.md §4)"
    FINAL_RC=1
    break
  fi
done

# ---- final readout ---------------------------------------------------------
say ""
say "  ────────────────────────────────────────────"
if [ "$FINAL_RC" -eq 0 ]; then
  say "  ${G}${B}✓ LINE GREEN${X} — $STABLE_GREENS/$PASSES passes clean on $NODE."
  say "  ${D}every green pass is logged; BRAIN gets the fast-track packet; baton → $TO.${X}"
else
  say "  ${Y}${B}⏸ LINE PAUSED${X} — fix the QA failure, then re-run to resume the loop."
fi
say "  next: ${B}bash scripts/factory-line.sh --node $TO${X}   (on that device)"
say "  ────────────────────────────────────────────"
say ""
exit "$FINAL_RC"
