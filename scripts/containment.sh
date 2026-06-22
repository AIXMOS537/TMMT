#!/usr/bin/env bash
# containment — the BARN DOOR PROTOCOL. Brace the safety interlocks BEFORE the power
# flows (fleet fanout, shared brain, prod). Read-only; touches nothing. FAIL = a real
# leak/exposure (blocks high-power ops); WARN = harden-soon; PASS = sealed.
#
#   bash scripts/containment.sh           full readout
#   bash scripts/containment.sh --gate    fast critical-only; non-zero exit on FAIL
#   bash scripts/tmmt barn
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
if [[ -t 1 ]]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; R=; Y=; BD=; X=; fi
GATE=0; [ "${1:-}" = "--gate" ] && GATE=1
PASS=0; WARN=0; FAIL=0; FAILS=()
pass(){ PASS=$((PASS+1)); [ "$GATE" = 1 ] || printf '   %s✓ %s%s\n' "$G" "$*" "$X"; }
warn(){ WARN=$((WARN+1)); [ "$GATE" = 1 ] || printf '   %s• %s%s\n' "$Y" "$*" "$X"; }
fail(){ FAIL=$((FAIL+1)); FAILS+=("$1"); printf '   %s✗ %s%s\n' "$R" "$1" "$X"; }

[ "$GATE" = 1 ] || printf '%s🧤 BARN DOOR PROTOCOL — containment check%s\n\n%s── CRITICAL (must be sealed) ──%s\n' "$BD" "$X" "$BD" "$X"

# 1) No secret files tracked in git (the worst leak).
tracked="$(git ls-files 2>/dev/null | grep -Ei '(^|/)\.env(\.|$)|\.pem$|\.p12$|\.pfx$|(^|/)id_(rsa|ed25519)$|service[_-]?role' | grep -v '\.example$' || true)"
if [ -n "$tracked" ]; then fail "secret file(s) tracked in git: $(echo "$tracked" | tr '\n' ' ')"; else pass "no secret files tracked in git"; fi

# 2) .env is gitignored.
if git check-ignore .env >/dev/null 2>&1 || grep -qE '(^|/)\.env' .gitignore 2>/dev/null; then pass ".env is gitignored"; else fail ".env is NOT gitignored — add it"; fi

# 3) No service-role / server-only secret reachable from a client bundle.
leak=0
for f in $(grep -rl '"use client"' src 2>/dev/null); do
  grep -qE "supabase-service|createServiceRoleClient|SERVICE_ROLE|pocket-brain|token-ledger" "$f" 2>/dev/null && { fail "client file imports a server secret: $f"; leak=1; }
done
[ "$leak" = 0 ] && pass "no server secret reachable from client code"

# 4) The (unauthenticated) brain/router never bind 0.0.0.0 — no public exposure.
if grep -rnE "OLLAMA_HOST=0\.0\.0\.0|BRAIN_ROUTER_HOST.{0,8}0\.0\.0\.0" scripts 2>/dev/null | grep -vq '#'; then
  fail "the brain/router binds 0.0.0.0 (unauthenticated endpoint could face the public net)"
else pass "brain/router bind tailnet/localhost only (never 0.0.0.0)"; fi

if [ "$GATE" = 1 ]; then
  [ "$FAIL" = 0 ] && exit 0 || { printf '%s⛔ CONTAINMENT FAIL — power op blocked: %s%s\n' "$R" "${FAILS[*]}" "$X"; exit 1; }
fi

# ── deeper scan (full mode only) ──
printf '\n%s── DEEP (harden-soon) ──%s\n' "$BD" "$X"
if [ -x "$ROOT/scripts/secret-scan.sh" ]; then
  if bash "$ROOT/scripts/secret-scan.sh" >/dev/null 2>&1; then pass "secret-scan: working tree clean"; else warn "secret-scan flagged something — run: bash scripts/secret-scan.sh"; fi
else warn "secret-scan.sh not present"; fi
command -v gitleaks >/dev/null 2>&1 && pass "gitleaks present (push guard active)" || warn "gitleaks missing — install so the pre-push guard works"
git config --get core.hooksPath >/dev/null 2>&1 && pass "git secret-guard hooks wired" || warn "git hooks not wired (git config core.hooksPath scripts/hooks)"
[ -f "$ROOT/auth/OWNER.seal" ] && pass "owner seal present" || warn "owner seal not set (bash scripts/tmmt seal)"
[ -x "$ROOT/scripts/godark" ] && pass "DARK kill-switch available" || warn "DARK kill-switch (scripts/godark) missing"
[ -f "$ROOT/.swarm/DARK" ] && warn "currently DARK (blacked out)" || pass "not blacked out"

printf '\n'
if [ "$FAIL" = 0 ]; then
  printf '%s%s🧤 SEALED — %s passed, %s to harden, 0 leaks. Power may flow.%s\n' "$BD" "$G" "$PASS" "$WARN" "$X"
else
  printf '%s%s⛔ NOT SEALED — %s leak(s): %s%s\n' "$BD" "$R" "$FAIL" "${FAILS[*]}" "$X"; exit 1
fi
