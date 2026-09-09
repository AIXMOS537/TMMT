#!/usr/bin/env bash
# PROJECT X HAILMARY readiness gate
# Dual-mode checks:
#   local       -> editable backend readiness on this machine
#   production  -> live production smoke + launch safety checks
#   all         -> local + production (default)
#
# Usage:
#   bash scripts/project-x-hailmary.sh
#   bash scripts/project-x-hailmary.sh local
#   bash scripts/project-x-hailmary.sh production
#   bash scripts/project-x-hailmary.sh all

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/.hailmary/checks"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [[ -t 1 ]]; then
  G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; B=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'
else
  G=; Y=; R=; C=; B=; D=; X=
fi

mode="${1:-all}"
case "$mode" in
  local|production|all) ;;
  -h|--help|help)
    cat <<'EOF'
PROJECT X HAILMARY readiness gate

Usage:
  bash scripts/project-x-hailmary.sh [local|production|all]

Modes:
  local       Editable backend checks on this machine
  production  Live smoke + launch safety checks
  all         Run both (default)
EOF
    exit 0
    ;;
  *)
    echo "Unknown mode: $mode (use local, production, or all)"
    exit 2
    ;;
esac

pass=0
warn=0
fail=0

note_pass() { printf '  %sPASS%s %s\n' "$G" "$X" "$1"; pass=$((pass+1)); }
note_warn() { printf '  %sWARN%s %s\n' "$Y" "$X" "$1"; warn=$((warn+1)); }
note_fail() { printf '  %sFAIL%s %s\n' "$R" "$X" "$1"; fail=$((fail+1)); }

run_check() {
  # $1 severity: fail|warn
  # $2 human label
  # $3 command
  local severity="$1" label="$2" cmd="$3"
  local slug log
  slug="$(echo "$label" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')"
  log="$LOG_DIR/${STAMP}-${slug}.log"

  printf '\n%s›%s %s\n' "$C" "$X" "$label"
  if bash -lc "cd \"$ROOT\" && $cmd" >"$log" 2>&1; then
    note_pass "$label"
  else
    if [[ "$severity" == "warn" ]]; then
      note_warn "$label (see $log)"
    else
      note_fail "$label (see $log)"
    fi
  fi
}

header() {
  printf '\n%s%sPROJECT X HAILMARY — %s mode%s\n' "$B" "$C" "$1" "$X"
  printf '%sRepo:%s %s\n' "$D" "$X" "$ROOT"
}

run_local() {
  header "LOCAL (editable backend)"

  local branch dirty
  branch="$(git -C "$ROOT" branch --show-current 2>/dev/null || echo unknown)"
  if [[ "$branch" == "master" ]]; then
    note_pass "Branch is master"
  else
    note_warn "Branch is $branch (expected master for production prep)"
  fi

  dirty="$(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "${dirty:-0}" -eq 0 ]]; then
    note_pass "Working tree clean"
  else
    note_warn "Working tree has local changes ($dirty file(s))"
  fi

  run_check fail "Build compiles (Next.js production build)" "npm run build"
  run_check fail "Machine security/readiness doctor (quick)" "bash scripts/swarm-doctor.sh --quick"
  run_check fail "Launch security gate" "bash scripts/launch-check.sh"
  run_check warn "Revenue env audit (local readiness)" "npm run check-env:revenue"
}

run_production() {
  header "PRODUCTION (live smoke + security)"
  run_check fail "Live smoke test (tmmt-ops)" "npm run smoke:prod"
  run_check fail "Kits page returns 200/307/308" "curl -sS -o /dev/null -w '%{http_code}' -L https://tmmt-ops.vercel.app/kits | rg '^(200|307|308)$'"
  run_check fail "Customer intake returns 200" "curl -sS -o /dev/null -w '%{http_code}' https://tmmt-ops.vercel.app/forms/customer-intake | rg '^200$'"
  run_check warn "Watchtower vertical health check" "bash scripts/health.sh --compact"
}

case "$mode" in
  local) run_local ;;
  production) run_production ;;
  all)
    run_local
    run_production
    ;;
esac

printf '\n%s%sVerdict:%s %s%d pass%s · %s%d warn%s · %s%d fail%s\n' \
  "$B" "$C" "$X" "$G" "$pass" "$X" "$Y" "$warn" "$X" "$R" "$fail" "$X"
printf '%sLogs:%s %s\n' "$D" "$X" "$LOG_DIR"

if [[ "$fail" -gt 0 ]]; then
  printf '%s✗ Not production-ready yet. Fix FAIL items first.%s\n\n' "$R" "$X"
  exit 1
fi

if [[ "$warn" -gt 0 ]]; then
  printf '%s▲ Ready with warnings. Close remaining WARNs for full hardening.%s\n\n' "$Y" "$X"
  exit 0
fi

printf '%s✓ Fully green: local + production checks passed.%s\n\n' "$G" "$X"
exit 0
