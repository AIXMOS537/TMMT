#!/usr/bin/env bash
# verify — THE local-first gate. Nothing goes live until this passes.
#
# Runs the full local check: lint → unit tests → production build (typecheck).
# Exit 0 = safe to ship. Exit 1 = do NOT deploy. Used by:
#   • humans:   npm run verify   (or bash scripts/verify.sh)
#   • git:      scripts/hooks/pre-push (blocks pushing broken app code)
#   • deploy:   scripts/ship.sh (refuses to deploy unless this passes)
#   • CI:       .github/workflows/verify.yml (backstop on every PR + master)
#
# No secrets needed — build/test/lint all run without .env (env is read lazily).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p "$ROOT/.swarm"
VERIFY_LOCK="$ROOT/.swarm/verify.lock"
echo $$ > "$VERIFY_LOCK"
trap 'rm -f "$VERIFY_LOCK"' EXIT

if [ -t 1 ]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; B=$'\e[1m'; X=$'\e[0m'; else G=; R=; Y=; B=; X=; fi
step(){ printf '\n%s== %s ==%s\n' "$B" "$*" "$X"; }
pass(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$X"; }
fail(){ printf '%s  ✗ %s%s\n' "$R" "$*" "$X" >&2; printf '\n%s✗ VERIFY FAILED — do NOT deploy. Fix the above, then re-run.%s\n' "$R$B" "$X" >&2; exit 1; }

command -v npm >/dev/null 2>&1 || fail "npm not found — install Node.js first."

# Ensure deps so the gate is reliable on any machine.
if [ ! -d node_modules ]; then
  step "Install dependencies"
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund || fail "dependency install failed"
  pass "dependencies installed"
fi

step "1/4 · Brands"
npm run brand:check || fail "tenant brand map is stale — run 'npm run brand:sync' and commit the result"
pass "tenant brand map in sync"
step "2/4 · Lint";  npm run lint  || fail "lint failed (errors must be fixed before shipping)"; pass "lint clean"
step "3/4 · Tests"; npm test      || fail "unit tests failed"; pass "tests pass"
step "4/4 · Build (production + typecheck)"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=12288}"
npm run build || fail "production build failed"; pass "build succeeded"

printf '\n%s✓ ALL LOCAL CHECKS PASSED — safe to go live.%s\n' "$G$B" "$X"
