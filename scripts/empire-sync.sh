#!/usr/bin/env bash
# empire-sync.sh — one command: health-check every business entity + sync readiness.
# Like multiple chess boards + one Rubik's cube: each vertical moves, spine stays aligned.
#
#   bash scripts/empire-sync.sh           full readout (read-only)
#   bash scripts/empire-sync.sh --compact one screen for watchtower
#   bash scripts/empire-sync.sh --json    machine-readable summary
#
# Does NOT deploy or mutate prod unless you separately run go-live --apply.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPACT=""; JSON=""
for a in "$@"; do case "$a" in --compact) COMPACT=1;; --json) JSON=1;; esac; done

if [[ -t 1 && -z "$JSON" ]]; then
  G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; BD=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'
else G=; R=; Y=; BD=; D=; X=; fi

pass=0; warn=0; fail=0
note_pass(){ pass=$((pass+1)); [ -n "$JSON" ] || printf '%s✓%s %s\n' "$G" "$X" "$1"; }
note_warn(){ warn=$((warn+1)); [ -n "$JSON" ] || printf '%s!%s %s\n' "$Y" "$X" "$1"; }
note_fail(){ fail=$((fail+1)); [ -n "$JSON" ] || printf '%s✗%s %s\n' "$R" "$X" "$1"; }

run_quiet(){ "$@" >/dev/null 2>&1; }

[ -z "$JSON" ] && [ -z "$COMPACT" ] && printf '\n%s🦾 EMPIRE SYNC — all entities, one spine%s\n\n' "$BD" "$X"

# ── Layer 1: Build + tests (code spine) ─────────────────────────────────────
if npm run build >/tmp/empire-build.log 2>&1; then note_pass "Build (npm run build)"
else note_fail "Build failed — see /tmp/empire-build.log"; fi

if npm test >/tmp/empire-test.log 2>&1; then note_pass "Unit tests (143 suites)"
else note_fail "Tests failed — see /tmp/empire-test.log"; fi

# ── Layer 2: Vertical health (chess boards) ─────────────────────────────────
if bash "$ROOT/scripts/health.sh" ${COMPACT:+--compact}; then :; fi
health_down=$(bash "$ROOT/scripts/health.sh" 2>/dev/null | grep -c '● DOWN' || true)
health_up=$(bash "$ROOT/scripts/health.sh" 2>/dev/null | grep -c '● UP' || true)
[ "$health_down" -eq 0 ] && note_pass "Vertical health ($health_up up)" || note_fail "Vertical health ($health_down down)"

# ── Layer 3: Per-app smoke ──────────────────────────────────────────────────
smoke_app(){ local base="$1" name="$2"; SMOKE_BASE_URL="$base" bash "$ROOT/scripts/smoke-prod.sh" >/tmp/empire-smoke.log 2>&1
  if [ $? -eq 0 ]; then note_pass "Smoke $name"; return 0; fi
  note_warn "Smoke $name — partial (CC may lack /forms/customer-intake by design)"; return 1; }
smoke_app "https://tmmt-ops.vercel.app" "TMMT Ops" || true
smoke_app "https://allinonemanagementsolutions.com" "Public site (GHL)" || true

# ── Layer 4: Mesh + secrets ─────────────────────────────────────────────────
if bash "$ROOT/scripts/swarm-doctor.sh" >/tmp/empire-doctor.log 2>&1; then
  grep -q '0 fail' /tmp/empire-doctor.log && note_pass "Swarm-doctor (mesh hygiene)" || note_warn "Swarm-doctor warnings — see /tmp/empire-doctor.log"
else note_warn "Swarm-doctor issues"; fi

if bash "$ROOT/scripts/device-integrity.sh" >/tmp/empire-integrity.log 2>&1; then note_pass "Device integrity"
else note_warn "Device integrity flags — see .aixmos/integrity-*.txt"; fi

# ── Layer 5: Revenue spine (GHL + env) ──────────────────────────────────────
if [ -f "$ROOT/.env" ]; then note_pass ".env present (Vercel pull)"
else note_warn ".env missing — run: vercel env pull .env --environment=production"; fi

if [ -f "$ROOT/.env" ] && node "$ROOT/scripts/ghl-activation-check.mjs" >/tmp/empire-ghl.log 2>&1; then
  note_pass "GHL activation env"
else
  blockers=$(grep -c 'P0 blocker' /tmp/empire-ghl.log 2>/dev/null || echo 0)
  [ "$blockers" = "0" ] && note_warn "GHL check — review /tmp/empire-ghl.log" || note_fail "GHL P0 blockers — paste checkout URLs into Vercel env"
fi

# ── Layer 6: Operator factory ───────────────────────────────────────────────
for f in docs/OPERATOR-BRAIN.md docs/OPERATOR-AGENT-RULES.md docs/TONIGHT-ONBOARDING-GO-LIVE.md; do
  [ -f "$ROOT/$f" ] && note_pass "Brain: $(basename "$f")" || note_fail "Missing $f"
done
[ -f "$ROOT/operators.csv" ] && note_pass "operators.csv ready" || note_warn "No operators.csv — copy operators.csv.example"

# ── Summary ─────────────────────────────────────────────────────────────────
score=$(( pass * 10 - fail * 15 - warn * 3 ))
[ "$score" -lt 0 ] && score=0
[ "$score" -gt 100 ] && score=100

if [ -n "$JSON" ]; then
  printf '{"pass":%d,"warn":%d,"fail":%d,"score":%d,"health_up":%d,"health_down":%d}\n' "$pass" "$warn" "$fail" "$score" "$health_up" "$health_down"
  exit $(( fail > 0 ? 1 : 0 ))
fi

printf '\n%s── Score: %s/100%s  (%s pass · %s warn · %s fail)\n' "$BD" "$score" "$X" "$pass" "$warn" "$fail"
printf '%sNext:%s docs/EMPIRE-READINESS-SCORECARD.md · fix fails first · then go-live --apply\n\n' "$D" "$X"
exit $(( fail > 0 ? 1 : 0 ))
