#!/usr/bin/env bash
# sovereignty-audit.sh — hardcore gate: leaks, waste, access holes.
# No deploy. No owner seal. Run anytime before ship.
#
#   bash scripts/sovereignty-audit.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; FAIL=1; }
hr()   { printf '\033[2m%s\033[0m\n' "────────────────────────────────────────────────────────"; }

FAIL=0
hr; printf '  \033[1m🛡️  SOVEREIGNTY AUDIT\033[0m  (Muhammad Taha — fail closed)\n'; hr

# ── 1. Upload firewall ───────────────────────────────────────────────────────
if [ -f "$ROOT/.vercelignore" ]; then
  for req in .aixmos/ auth/ config/ docs/ scripts/; do
    grep -qF "$req" "$ROOT/.vercelignore" || die ".vercelignore missing $req"
  done
  ok "Vercel upload firewall (.vercelignore)"
else
  die "Missing .vercelignore — deploy will leak local assets"
fi

# ── 2. Kill switches ─────────────────────────────────────────────────────────
[ -f "$ROOT/.swarm/DARK" ] || [ -f "$ROOT/auth/DARK" ] && warn "Kill-switch DARK file present"
[ "${B3_KILL_SWITCH:-0}" = "1" ] && ok "B3 agent kill-switch ON (no LLM burn)" || warn "B3_KILL_SWITCH not set — SMS agent can spend LLM credits"
[ "${V3_AUTO_PROVISION_OPERATORS:-false}" = "true" ] && warn "V3_AUTO_PROVISION_OPERATORS=true — public can create auth users until cap"

# ── 3. Middleware machine-auth paths (grep sanity) ───────────────────────────
grep -q 'isMachineAuthPath' "$ROOT/middleware.ts" && ok "Middleware bypasses machine-auth APIs (cron/license/audit)" \
  || die "middleware.ts missing isMachineAuthPath — crons may 302 to /login"

grep -q 'isStaffOnlyForm' "$ROOT/middleware.ts" && ok "Fleet forms gated in middleware" \
  || warn "Staff-only forms not gated in middleware"

# ── 4. Fleet form server-action gate ─────────────────────────────────────────
grep -q 'requireFleetOps' "$ROOT/src/app/forms/actions.ts" && ok "Handover/inspection require fleet login" \
  || warn "Fleet forms may still accept anonymous submissions"

# ── 5. Application API token gate ────────────────────────────────────────────
grep -q 'authorizeApplicationAccess' "$ROOT/src/app/api/cube/application/route.ts" && ok "Program cube API requires token or staff" \
  || die "cube/application route is wide open (IDOR)"

# ── 6. LLM burn guards ───────────────────────────────────────────────────────
grep -q 'assertLlmCapNotExceeded' "$ROOT/src/lib/agent/guard.ts" && ok "Per-org LLM daily cap enforced"
grep -q 'isRateLimited.*sms-in' "$ROOT/src/app/api/agent/sms/inbound/route.ts" && ok "SMS inbound rate-limited per caller" \
  || warn "SMS inbound has no per-caller rate limit"

# ── 7. Build + tests ─────────────────────────────────────────────────────────
info() { printf '  \033[36m›\033[0m %s\n' "$*"; }
info "npm test…"
npm test > /tmp/sovereignty-test.log 2>&1 && ok "Tests passed" || { tail -10 /tmp/sovereignty-test.log; die "Tests failed"; }

info "npm run build…"
npm run build > /tmp/sovereignty-build.log 2>&1 && ok "Build passed" || { tail -15 /tmp/sovereignty-build.log; die "Build failed"; }

echo
if [ "$FAIL" = "0" ]; then
  ok "SOVEREIGNTY AUDIT PASSED — work protected, no known leak paths"
  exit 0
else
  printf '  \033[31m✗\033[0m Fix above before shipping or opening public surfaces.\n'
  exit 1
fi
